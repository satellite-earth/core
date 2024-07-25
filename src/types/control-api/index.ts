import { AuthMessage, AuthResponse } from './auth.js';
import { ConfigMessage, ConfigResponse } from './config.js';
import { DatabaseMessage, DatabaseResponse } from './database.js';
import { DirectMessageMessage } from './direct-messages.js';
import { LogMessage, LogResponse } from './log.js';
import { NotificationsMessage, NotificationsResponse } from './notifications.js';
import { ReceiverMessage, ReceiverResponse } from './receiver.js';
import { RemoteAuthMessage, RemoteAuthResponse } from './remote-auth.js';
import { ReportsMessage, ReportsResponse } from './reports.js';

export type ControlMessage =
	| AuthMessage
	| ConfigMessage
	| DatabaseMessage
	| LogMessage
	| ReceiverMessage
	| DirectMessageMessage
	| NotificationsMessage
	| RemoteAuthMessage
	| ReportsMessage;
export type ControlResponse =
	| AuthResponse
	| ConfigResponse
	| DatabaseResponse
	| LogResponse
	| ReceiverResponse
	| NotificationsResponse
	| RemoteAuthResponse
	| ReportsResponse;
