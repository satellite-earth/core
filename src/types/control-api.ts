import { PrivateNodeConfig } from './private-node-config.js';

/** control messages in format: ['CONTROL', <handler name>, <action>, ...params[]] */

// Auth
type AuthMessage = ['CONTROL', 'AUTH', 'CODE', string];
type AuthSuccessResponse = ['CONTROL', 'AUTH', 'SUCCESS'];
type AuthInvalidResponse = ['CONTROL', 'AUTH', 'INVALID', string];
type AuthResponse = AuthSuccessResponse | AuthInvalidResponse;

// Config
type ConfigSubscribe = ['CONTROL', 'CONFIG', 'SUBSCRIBE'];
type ConfigSetAction = ['CONTROL', 'CONFIG', 'SET', keyof PrivateNodeConfig, any];

export type ConfigResponse = ['CONTROL', 'CONFIG', 'CHANGED', PrivateNodeConfig];
export type ConfigMessage = ConfigSubscribe | ConfigSetAction;

// Database
export type DatabaseStats = {
	count: number;
	size?: number;
};
type DatabaseSubscribeAction = ['CONTROL', 'DATABASE', 'SUBSCRIBE'];
type DatabaseUnsubscribeAction = ['CONTROL', 'DATABASE', 'UNSUBSCRIBE'];
type DatabaseStatsAction = ['CONTROL', 'DATABASE', 'STATS'];
type DatabaseClearAction = ['CONTROL', 'DATABASE', 'CLEAR'];
type DatabaseExportAction = ['CONTROL', 'DATABASE', 'EXPORT'];

type DatabaseStatsResponse = ['CONTROL', 'DATABASE', 'STATS', DatabaseStats];

export type DatabaseMessage =
	| DatabaseSubscribeAction
	| DatabaseUnsubscribeAction
	| DatabaseStatsAction
	| DatabaseClearAction
	| DatabaseExportAction;
export type DatabaseResponse = DatabaseStatsResponse;

// Log
type LogSubscribe = ['CONTROL', 'LOG', 'SUBSCRIBE'];
type LogUnsubscribe = ['CONTROL', 'LOG', 'UNSUBSCRIBE'];
type LogClearAction = ['CONTROL', 'LOG', 'CLEAR'];

type LogLineResponse = ['CONTROL', 'LOG', 'LINE', string];
type LogClearResponse = ['CONTROL', 'LOG', 'CLEAR'];

export type LogMessage = LogSubscribe | LogUnsubscribe | LogClearAction;
export type LogResponse = LogLineResponse | LogClearResponse;

// Receiver
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

// Direct Messages
type DirectMessageOpenConversation = ['CONTROL', 'DM', 'OPEN', string, string];
type DirectMessageCloseConversation = ['CONTROL', 'DM', 'CLOSE', string, string];

export type DirectMessageMessage = DirectMessageOpenConversation | DirectMessageCloseConversation;

// Control Api
export type ControlMessage =
	| AuthMessage
	| ConfigMessage
	| DatabaseMessage
	| LogMessage
	| ReceiverMessage
	| DirectMessageMessage;
export type ControlResponse = AuthResponse | ConfigResponse | DatabaseResponse | LogResponse | ReceiverResponse;
