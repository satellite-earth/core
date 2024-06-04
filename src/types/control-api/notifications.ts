import { NostrEvent } from 'nostr-tools';

export type WebSubscription = {
	type: 'web';
	deviceType: 'mobile' | 'desktop';
	endpoint: string;
	expirationTime: PushSubscriptionJSON['expirationTime'];
	keys: {
		p256dh: string;
		auth: string;
	}; //PushSubscriptionJSON['keys'];
};

type NotificationsRegister = ['CONTROL', 'NOTIFICATIONS', 'REGISTER', WebSubscription];
type NotificationsUnregister = ['CONTROL', 'NOTIFICATIONS', 'UNREGISTER', string];
type NotificationsList = ['CONTROL', 'NOTIFICATIONS', 'LIST'];
type NotificationsGetVapidKey = ['CONTROL', 'NOTIFICATIONS', 'GET-VAPID-KEY'];

type NotificationsListResponse = ['CONTROL', 'NOTIFICATIONS', 'LIST', WebSubscription[]];
type NotificationsVapidKey = ['CONTROL', 'NOTIFICATIONS', 'VAPID-KEY', string];

export type NotificationsMessage =
	| NotificationsRegister
	| NotificationsUnregister
	| NotificationsList
	| NotificationsGetVapidKey;
export type NotificationsResponse = NotificationsListResponse | NotificationsVapidKey;

// notification types

export type DirectMessageNotification = {
	/** senders kind:0 event */
	sender?: NostrEvent;
	/** DM event */
	event: NostrEvent;
};

export type NotificationType = DirectMessageNotification;
