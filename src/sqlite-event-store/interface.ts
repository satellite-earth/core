import EventEmitter from 'events';
import { Filter, NostrEvent } from 'nostr-tools';

type EventMap = {
	'event:inserted': [NostrEvent];
	'event:removed': [string];
};

export interface IEventStore extends EventEmitter<EventMap> {
	setup(): Promise<void>;
	addEvent(event: NostrEvent): boolean;
	removeEvent(id: string): boolean;
	getEventsForFilters(filters: Filter[]): NostrEvent[];
}
