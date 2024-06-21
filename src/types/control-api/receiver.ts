export type ReceiverStatus = {
	active: boolean;
	relays: Record<
		string,
		{
			connected: boolean;
		}
	>;
};
type ReceiverStatusSubscribe = ['CONTROL', 'RECEIVER', 'SUBSCRIBE'];
type ReceiverStatusUnsubscribe = ['CONTROL', 'RECEIVER', 'UNSUBSCRIBE'];
type ReceiverStatusStatus = ['CONTROL', 'RECEIVER', 'STATUS'];
type ReceiverStart = ['CONTROL', 'RECEIVER', 'START'];
type ReceiverStop = ['CONTROL', 'RECEIVER', 'STOP'];

type ReceiverStatusResponse = ['CONTROL', 'RECEIVER', 'STATUS', ReceiverStatus];

export type ReceiverMessage =
	| ReceiverStatusSubscribe
	| ReceiverStatusUnsubscribe
	| ReceiverStatusStatus
	| ReceiverStart
	| ReceiverStop;
export type ReceiverResponse = ReceiverStatusResponse;
