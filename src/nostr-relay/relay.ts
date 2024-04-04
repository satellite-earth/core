import EventEmitter from 'events';
import crypto from 'crypto';
import { IncomingMessage } from 'http';
import { type WebSocketServer, type WebSocket } from 'ws';
import { Filter, NostrEvent, verifyEvent, matchFilters } from 'nostr-tools';

import { IEventStore } from '../sqlite-event-store/interface.js';
import { logger } from '../logger.js';

export type Subscription = {
	ws: WebSocket;
	id: string;
	filters: Filter[];
};

type EventMap = {
	'event:received': [NostrEvent, WebSocket];
	'event:inserted': [NostrEvent, WebSocket];
	'event:rejected': [NostrEvent, WebSocket];
	'subscription:created': [Subscription];
	'subscription:updated': [Subscription];
	'subscription:closed': [Subscription];
};

export class NostrRelay extends EventEmitter<EventMap> {
	log = logger.extend('relay');
	eventStore: IEventStore;

	connectionId = new WeakMap<WebSocket, string>();

	// A map of subscriptions
	subscriptions: Subscription[] = [];

	// Create a map of connections
	// in the form <connid> : <ws>
	connections: Record<string, WebSocket> = {};

	constructor(eventStore: IEventStore) {
		super();

		this.eventStore = eventStore;
	}

	attachToServer(wss: WebSocketServer) {
		wss.on('connection', (ws, req) => {
			this.handleConnection(ws, req);

			ws.on('message', (data, isBinary) => {
				if (data instanceof Buffer) this.handleMessage(data, ws);
			});
			ws.on('close', () => this.handleDisconnect(ws));
		});
	}

	handleMessage(message: Buffer | string, ws: WebSocket) {
		let data;

		try {
			// TODO enforce max size

			// Parse JSON from the raw buffer
			data = JSON.parse(typeof message === 'string' ? message : message.toString('utf-8'));

			if (Array.isArray(data)) throw new Error('Message is not an array');

			// Pass the data to appropriate handler
			switch (data[0]) {
				// TODO handle auth
				case 'REQ':
					this.handleReqMessage(data, ws);
					break;
				case 'EVENT':
					this.handleEventMessage(data, ws);
					break;
				case 'CLOSE':
					this.handleCloseMessage(data, ws);
					break;
			}
		} catch (err) {
			this.log('Failed to handle message', message, err);
		}

		return data;
	}

	handleConnection(ws: WebSocket, req: IncomingMessage) {
		let ip;

		// Record the IP address of the client
		if (typeof req.headers['x-forwarded-for'] === 'string') {
			ip = req.headers['x-forwarded-for'].split(',')[0].trim();
		} else {
			ip = req.socket.remoteAddress;
		}

		// Generate a unique ID for ws connection
		const id = crypto.randomUUID();

		this.connectionId.set(ws, id);
		this.connections[id] = ws;

		// Return model of the connection
		return { id, ip, opened: Math.floor(Date.now() / 1000) };
	}

	handleDisconnect(ws: WebSocket) {
		const id = this.connectionId.get(ws);
		if (!id) return;

		// remove all subscriptions
		this.subscriptions = this.subscriptions.filter((sub) => sub.ws !== ws);

		this.connectionId.delete(ws);
		delete this.connections[id];
	}

	protected passToSubscriptions(event: NostrEvent) {
		for (const sub of this.subscriptions) {
			if (matchFilters(sub.filters, event)) {
				sub.ws.send(JSON.stringify(['EVENT', sub.id, event]));
			}
		}
	}

	handleEventMessage(data: ['EVENT', NostrEvent], ws: WebSocket) {
		// Get the event data
		const event = data[1] as NostrEvent;

		try {
			let inserted = false;

			// Verify the event's signature
			if (!verifyEvent(event)) throw new Error(`invalid: event failed to validate or verify`);

			try {
				// Persist to database
				inserted = this.eventStore.addEvent(event);
			} catch (err) {
				console.log(err);
				throw new Error(`error: server error`);
			}

			this.emit('event:received', event, ws);
			if (inserted) {
				this.emit('event:inserted', event, ws);
				ws.send(JSON.stringify(['OK', event.id, true, 'accepted']));

				this.passToSubscriptions(event);
			} else {
				ws.send(JSON.stringify(['OK', event.id, true, 'duplicate']));
			}
		} catch (err) {
			if (err instanceof Error) {
				// error occurred, send back the OK message with false
				this.emit('event:rejected', event, ws);
				ws.send(JSON.stringify(['OK', event.id, false, err.message]));
			}
		}
	}

	protected runSubscription(sub: Subscription) {
		const events = this.eventStore.getEventsForFilters(sub.filters);
		for (let event of events) {
			sub.ws.send(JSON.stringify(['EVENT', sub.id, event]));
		}
		sub.ws.send(JSON.stringify(['EOSE', sub.id]));
	}

	handleReqMessage(data: ['REQ', string, ...Filter[]], ws: WebSocket) {
		const [_, subid, ...filters] = data;
		if (typeof subid !== 'string') return;

		let subscription = this.subscriptions.find((s) => s.id === subid) || { id: subid, ws, filters: [] };

		// override or set the filters
		subscription.filters = filters;

		if (!this.subscriptions.includes(subscription)) {
			this.subscriptions.push(subscription);
			this.log('Created sub', subid);
			this.emit('subscription:created', subscription);
		} else {
			this.log('Updated sub', subid);
			this.emit('subscription:updated', subscription);
		}

		// Run the subscription
		this.runSubscription(subscription);
	}

	handleCloseMessage(data: ['CLOSE', string], ws: WebSocket) {
		if (typeof data[1] !== 'string') return;
		const subid = data[1];

		const subscription = this.subscriptions.find((s) => s.id === subid && s.ws === ws);

		if (subscription) {
			this.subscriptions.splice(this.subscriptions.indexOf(subscription), 1);
			this.emit('subscription:closed', subscription);
		}
	}

	stop() {
		this.removeAllListeners();
	}
}
