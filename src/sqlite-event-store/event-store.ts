import { Database } from 'better-sqlite3';
import { Filter, NostrEvent, kinds } from 'nostr-tools';
import EventEmitter from 'events';

import { mapParams } from '../helpers/sql.js';
import { IEventStore } from './interface.js';
import { logger } from '../logger.js';

const isFilterKeyIndexableTag = (key: string) => {
	return key[0] === '#' && key.length === 2;
};

type EventMap = {
	'event:inserted': [NostrEvent];
	'event:removed': [string];
};

export class SQLiteEventStore extends EventEmitter<EventMap> implements IEventStore {
	db: Database;
	log = logger.extend('sqlite-event-store');

	constructor(db: Database) {
		super();
		this.db = db;
	}

	async setup() {
		this.db.transaction(() => {
			// Create events table
			this.db
				.prepare(
					`
				CREATE TABLE IF NOT EXISTS events (
					id TEXT(64) PRIMARY KEY,
					created_at INTEGER,
					pubkey TEXT(64),
					sig TEXT(128),
					kind INTEGER,
					content TEXT,
					tags TEXT
				)
				`,
				)
				.run();

			// Create tags table
			this.db
				.prepare(
					`
				CREATE TABLE IF NOT EXISTS tags (
					i INTEGER PRIMARY KEY AUTOINCREMENT,
					e TEXT(64) REFERENCES events(id),
					t TEXT(1),
					v TEXT
				)
				`,
				)
				.run();

			// Create indices
			const indices = [
				this.db.prepare('CREATE INDEX IF NOT EXISTS events_created_at ON events(created_at)'),
				this.db.prepare('CREATE INDEX IF NOT EXISTS events_pubkey ON events(pubkey)'),
				this.db.prepare('CREATE INDEX IF NOT EXISTS events_kind ON events(kind)'),
				this.db.prepare('CREATE INDEX IF NOT EXISTS tags_e ON tags(e)'),
				this.db.prepare('CREATE INDEX IF NOT EXISTS tags_t ON tags(t)'),
				this.db.prepare('CREATE INDEX IF NOT EXISTS tags_v ON tags(v)'),
			];

			indices.forEach((statement) => statement.run());
		})();

		this.log('Setup tables and indices');
	}

	addEvent(
		event: NostrEvent,
		options: {
			preserveEphemeral?: boolean;
			preserveReplaceable?: boolean;
		} = {},
	) {
		// Don't store ephemeral events in db,
		// just return the event directly
		if (!options.preserveEphemeral && kinds.isEphemeralKind(event.kind)) return false;

		const inserted = this.db.transaction(() => {
			// TODO: Check if event is replaceable and if its newer
			// before inserting it into the database

			const insert = this.db
				.prepare(
					`
					INSERT OR IGNORE INTO events (id, created_at, pubkey, sig, kind, content, tags)
					VALUES (?, ?, ?, ?, ?, ?, ?)
				`,
				)
				.run([
					event.id,
					event.created_at,
					event.pubkey,
					event.sig,
					event.kind,
					event.content,
					JSON.stringify(event.tags),
				]);

			// If event inserted, index tags
			if (insert.changes) {
				for (let tag of event.tags) {
					// add single tags into tags table
					if (tag[0].length === 1) {
						this.db.prepare(`INSERT INTO tags (e, t, v) VALUES (?, ?, ?)`).run(event.id, tag[0], tag[1]);
					}
				}

				// By default, remove older replaceable
				// events and all their associated tags
				if (!options.preserveReplaceable) {
					let existing: { id: string; created_at: number }[] = [];

					if (kinds.isReplaceableKind(event.kind)) {
						// Normal replaceable event
						existing = this.db
							.prepare(
								`
								SELECT events.id, events.created_at FROM events
								WHERE kind = ? AND pubkey = ?
							`,
							)
							.all(event.kind, event.pubkey) as { id: string; created_at: number }[];
					} else if (kinds.isParameterizedReplaceableKind(event.kind)) {
						// Parameterized Replaceable
						const d = event.tags.find((t) => t[0] === 'd')?.[1];

						if (d) {
							existing = this.db
								.prepare(
									`
									SELECT events.id, events.created_at FROM events
									INNER JOIN tags ON events.id = tags.e
									WHERE kind = ? AND pubkey = ? AND tags.t = ? AND tags.v = ?
								`,
								)
								.all(event.kind, event.pubkey, 'd', d) as { id: string; created_at: number }[];
						}
					}

					// If found other events that may need to be replaced,
					// sort the events according to timestamp descending,
					// falling back to id lexical order ascending as per
					// NIP-01. Remove all non-most-recent events and tags.
					if (existing.length > 1) {
						const removeIds = existing
							.sort((a, b) => {
								return a.created_at === b.created_at ? a.id.localeCompare(b.id) : b.created_at - a.created_at;
							})
							.slice(1)
							.map((item) => item.id);

						if (!removeIds.includes(event.id)) this.log('Removed', removeIds.length, 'old replaceable events');

						this.removeEvents(removeIds);

						// If the event that was just inserted was one of
						// the events that was removed, return null so to
						// indicate that the event was in effect *not*
						// upserted and thus, if using the DB for a nostr
						// relay, does not need to be pushed to clients
						if (removeIds.indexOf(event.id) !== -1) return false;
					}
				}
			}

			return insert.changes > 0;
		})();

		if (inserted) this.emit('event:inserted', event);

		return inserted;
	}

	removeEvents(ids: string[]) {
		const results = this.db.transaction(() => {
			this.db.prepare(`DELETE FROM tags WHERE e IN ${mapParams(ids)}`).run(...ids);

			return this.db.prepare(`DELETE FROM events WHERE events.id IN ${mapParams(ids)}`).run(...ids);
		})();

		if (results.changes > 0) {
			for (const id of ids) {
				this.emit('event:removed', id);
			}
		}
	}

	removeEvent(id: string) {
		const results = this.db.transaction(() => {
			this.db.prepare(`DELETE FROM tags WHERE e = ?`).run(id);

			return this.db.prepare(`DELETE FROM events WHERE events.id = ?`).run(id);
		})();

		if (results.changes > 0) this.emit('event:removed', id);

		return results.changes > 0;
	}

	buildConditionsForFilters(filter: Filter) {
		const joins: string[] = [];
		const conditions: string[] = [];
		const parameters: (string | number)[] = [];

		const tagQueries = Object.keys(filter).filter((t) => {
			return isFilterKeyIndexableTag(t);
		});

		if (tagQueries.length > 0) {
			joins.push('INNER JOIN tags ON events.id = tags.e');
		}

		if (typeof filter.since === 'number') {
			conditions.push(`events.created_at >= ?`);
			parameters.push(filter.since);
		}

		if (typeof filter.until === 'number') {
			conditions.push(`events.created_at < ?`);
			parameters.push(filter.until);
		}

		if (filter.ids) {
			conditions.push(`events.id IN ${mapParams(filter.ids)}`);
			parameters.push(...filter.ids);
		}

		if (filter.kinds) {
			conditions.push(`events.kind IN ${mapParams(filter.kinds)}`);
			parameters.push(...filter.kinds);
		}

		if (filter.authors) {
			conditions.push(`events.pubkey IN ${mapParams(filter.authors)}`);
			parameters.push(...filter.authors);
		}

		for (let t of tagQueries) {
			conditions.push(`tags.t = ?`);
			parameters.push(t.slice(1));

			// @ts-expect-error
			const v = filter[t] as string[];
			conditions.push(`tags.v IN ${mapParams(v)}`);
			parameters.push(...v);
		}

		return { conditions, parameters, joins };
	}

	protected buildSQLQueryForFilters(filters: Filter[]) {
		let sql = 'SELECT events.* FROM events ';

		const orConditions: string[] = [];
		const parameters: any[] = [];

		let joins = new Set<string>();
		for (const filter of filters) {
			const parts = this.buildConditionsForFilters(filter);

			orConditions.push(`(${parts.conditions.join(' AND ')})`);
			parameters.push(...parts.parameters);

			for (const join of parts.joins) joins.add(join);
		}

		sql += Array.from(joins).join(' ');

		if (orConditions.length > 0) {
			sql += ` WHERE ${orConditions.join(' OR ')}`;
		}

		sql = sql + ' ORDER BY created_at DESC';

		let minLimit = Infinity;
		for (const filter of filters) {
			if (filter.limit) minLimit = Math.min(minLimit, filter.limit);
		}
		if (minLimit !== Infinity) {
			sql += ' LIMIT ?';
			parameters.push(minLimit);
		}

		return { sql, parameters };
	}

	getEventsForFilters(filters: Filter[]) {
		type Row = {
			id: string;
			kind: number;
			pubkey: string;
			content: string;
			tags: string;
			created_at: number;
			sig: string;
		};

		const { sql, parameters } = this.buildSQLQueryForFilters(filters);

		const results = this.db.prepare(sql).all(parameters) as Row[];

		function parseEventTags(row: Row): NostrEvent {
			return { ...row, tags: JSON.parse(row.tags) };
		}

		return results.map(parseEventTags);
	}

	countEventsForFilters(filters: Filter[]) {
		let sql = 'SELECT count(events.id) as count FROM events ';

		const orConditions: string[] = [];
		const parameters: any[] = [];

		let joins = new Set<string>();
		for (const filter of filters) {
			const parts = this.buildConditionsForFilters(filter);

			orConditions.push(`(${parts.conditions.join(' AND ')})`);
			parameters.push(...parts.parameters);

			for (const join of parts.joins) joins.add(join);
		}

		sql += Array.from(joins).join(' ');

		if (orConditions.length > 0) {
			sql += ` WHERE ${orConditions.join(' OR ')}`;
		}

		const results = this.db.prepare(sql).get(parameters) as { count: number };
		return results.count;
	}
}
