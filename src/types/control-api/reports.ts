import { NostrEvent } from 'nostr-tools';

export type ReportArguments = {
	OVERVIEW: {};
	CONVERSATIONS: { pubkey: string };
	LOGS: { service?: string };
	SERVICES: {};
};
export type ReportResults = {
	OVERVIEW: { pubkey: string; events: number };
	CONVERSATIONS: {
		pubkey: string;
		count: number;
		sent: number;
		received: number;
		lastReceived?: number;
		lastSent?: number;
	};
	LOGS: { id: string; message: string; service: string; timestamp: number };
	SERVICES: { id: string };
};

// client -> server
export type ReportSubscribeMessage<T extends keyof ReportArguments> = [
	'CONTROL',
	'REPORT',
	'SUBSCRIBE',
	string,
	T,
	ReportArguments[T],
];
export type ReportCloseMessage = ['CONTROL', 'REPORT', 'CLOSE', string];

// server -> client
export type ReportResultMessage<T extends keyof ReportResults> = [
	'CONTROL',
	'REPORT',
	'RESULT',
	string,
	ReportResults[T],
];
export type ReportErrorMessage = ['CONTROL', 'REPORT', 'ERROR', string, string];

// control api types
export type ReportsMessage =
	| ReportSubscribeMessage<'OVERVIEW'>
	| ReportSubscribeMessage<'CONVERSATIONS'>
	| ReportCloseMessage;
export type ReportsResponse =
	| ReportResultMessage<'OVERVIEW'>
	| ReportResultMessage<'CONVERSATIONS'>
	| ReportErrorMessage;
