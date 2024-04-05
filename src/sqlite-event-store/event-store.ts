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

			const _result = this.db
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
			if (_result.changes) {
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
							.map((item) => {
								return item.id;
							});

						this.db
							.prepare(
								`
								DELETE FROM tags
								WHERE e IN ${mapParams(removeIds)}
							`,
							)
							.run(removeIds);

						this.db
							.prepare(
								`
								DELETE FROM events
								WHERE id IN ${mapParams(removeIds)}
							`,
							)
							.run(removeIds);

						// If the event that was just inserted was one of
						// the events that was removed, return null so to
						// indicate that the event was in effect *not*
						// upserted and thus, if using the DB for a nostr
						// relay, does not need to be pushed to clients
						if (removeIds.indexOf(event.id) !== -1) return false;
					}
				}
			}

			return _result.changes > 0;
		})();

		if (inserted) this.emit('event:inserted', event);

		return inserted;
	}

	removeEvent(id: string) {
		const results = this.db.transaction(() => {
			this.db.prepare(`DELETE FROM tags WHERE e = ?`).run(id);

			return this.db.prepare(`DELETE FROM events WHERE id = ?`).run(id);
		})();

		if (results.changes > 0) this.emit('event:removed', id);

		return results.changes > 0;
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

		const results = filters.map((filter) => {
			let sql =
				'SELECT events.id, events.created_at, events.pubkey, events.sig, events.kind, events.content, events.tags FROM events';

			const conditions = [];
			const parameters = [];

			const tagQueries = Object.keys(filter).filter((t) => {
				return isFilterKeyIndexableTag(t);
			});

			if (tagQueries.length > 0) {
				sql += ' INNER JOIN tags ON events.id = tags.e';
			}

			if (typeof filter.since === 'number') {
				conditions.push(`created_at >= ?`);
				parameters.push(filter.since);
			}

			if (typeof filter.until === 'number') {
				conditions.push(`created_at < ?`);
				parameters.push(filter.until);
			}

			if (filter.ids) {
				conditions.push(`id IN ${mapParams(filter.ids)}`);
				parameters.push(...filter.ids);
			}

			if (filter.kinds) {
				conditions.push(`kind IN ${mapParams(filter.kinds)}`);
				parameters.push(...filter.kinds);
			}

			if (filter.authors) {
				conditions.push(`pubkey IN ${mapParams(filter.authors)}`);
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

			if (parameters.length > 0) {
				sql += ` WHERE ${conditions.join(' AND ')}`;
			}

			sql = sql + ' ORDER BY created_at DESC';

			if (filter.limit) {
				parameters.push(filter.limit);
				sql += ' LIMIT ?';
			}

			return this.db.prepare(sql).all(parameters) as Row[];
		});

		function parseEventTags(row: Row): NostrEvent {
			return { ...row, tags: JSON.parse(row.tags) };
		}

		// For multiple filters, results need
		// to be merged to avoid duplicates
		if (results.length > 1) {
			const ids = new Set<string>();

			const events: NostrEvent[] = [];

			for (let result of results) {
				for (let row of result) {
					if (!ids.has(row.id)) {
						events.push(parseEventTags(row));
						ids.add(row.id);
					}
				}
			}

			// Return sorted unique array of
			// events that match any filter,
			// sorting deterministically by
			// created_at, falling back to id
			return events.sort((a, b) => {
				const deltat = b.created_at - a.created_at;
				return deltat === 0 ? parseInt(b.id, 16) - parseInt(a.id, 16) : deltat;
			});
		}

		return results[0].map(parseEventTags);
	}
}
