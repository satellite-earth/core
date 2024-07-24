export type ReportArguments = {
	OVERVIEW: {};
};
export type ReportResults = {
	OVERVIEW: { pubkey: string; events: number };
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
export type ReportsMessage = ReportSubscribeMessage<'OVERVIEW'> | ReportCloseMessage;
export type ReportsResponse = ReportResultMessage<'OVERVIEW'> | ReportErrorMessage;
