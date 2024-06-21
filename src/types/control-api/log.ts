type LogSubscribe = ['CONTROL', 'LOG', 'SUBSCRIBE'];
type LogUnsubscribe = ['CONTROL', 'LOG', 'UNSUBSCRIBE'];
type LogClearAction = ['CONTROL', 'LOG', 'CLEAR'];

type LogLineResponse = ['CONTROL', 'LOG', 'LINE', string];
type LogClearResponse = ['CONTROL', 'LOG', 'CLEAR'];

export type LogMessage = LogSubscribe | LogUnsubscribe | LogClearAction;
export type LogResponse = LogLineResponse | LogClearResponse;
