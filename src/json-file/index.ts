import { EventEmitter } from 'events';
import { Adapter, Low, LowSync, SyncAdapter } from 'lowdb';

import { PrivateNodeConfig } from '@satellite-earth/core/types/private-node-config.js';

export const defaultConfig: PrivateNodeConfig = {
	//pubkeys: [],
	//relays: [],
	//cacheLevel: 2,
	autoListen: false,
	logsEnabled: true,
	requireReadAuth: false,
	publicAddresses: [],
};

type EventMap<T> = {
	loaded: [T];
	changed: [T, string, any];
	saved: [T];
};

export class ReactiveJsonFile<T extends object> extends EventEmitter<EventMap<T>> implements Low<T> {
	private db: Low<T>;
	adapter: Adapter<T>;

	data: T;

	constructor(adapter: Adapter<T>, defaultData: T) {
		super();

		this.adapter = adapter;
		this.db = new Low<T>(adapter, defaultData);

		this.data = this.createProxy();
	}

	private createProxy() {
		return (this.data = new Proxy(this.db.data, {
			get(target, prop, receiver) {
				return Reflect.get(target, prop, receiver);
			},
			set: (target, p, newValue, receiver) => {
				Reflect.set(target, p, newValue, receiver);
				this.emit('changed', target as T, String(p), newValue);
				return newValue;
			},
		}));
	}

	async read() {
		await this.db.read();
		this.emit('loaded', this.data);
		this.createProxy();
	}
	async write() {
		await this.db.write();
		this.emit('saved', this.data);
	}
	update(fn: (data: T) => unknown) {
		return this.db.update(fn);
	}
}

export class ReactiveJsonFileSync<T extends object> extends EventEmitter<EventMap<T>> implements LowSync<T> {
	private db: LowSync<T>;
	adapter: SyncAdapter<T>;

	data: T;

	constructor(adapter: SyncAdapter<T>, defaultData: T) {
		super();

		this.adapter = adapter;
		this.db = new LowSync<T>(adapter, defaultData);

		this.data = this.createProxy();
	}

	private createProxy() {
		return (this.data = new Proxy(this.db.data, {
			get(target, prop, receiver) {
				return Reflect.get(target, prop, receiver);
			},
			set: (target, p, newValue, receiver) => {
				Reflect.set(target, p, newValue, receiver);
				this.emit('changed', target as T, String(p), newValue);
				return newValue;
			},
		}));
	}

	read() {
		this.db.read();
		this.emit('loaded', this.data);
		this.createProxy();
	}
	write() {
		this.db.write();
		this.emit('saved', this.data);
	}
	update(fn: (data: T) => unknown) {
		return this.db.update(fn);
	}
}
