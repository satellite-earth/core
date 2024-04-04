import { Filter, NostrEvent } from 'nostr-tools';

export interface IEventStore {
	setup(): Promise<void>;
	addEvent(event: NostrEvent): boolean;
	removeEvent(id: string): boolean;
	getEventsForFilters(filters: Filter[]): NostrEvent[];
}
