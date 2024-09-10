import { NostrEvent } from 'nostr-tools';

type DeviceType = 'mobile' | 'desktop';

type BaseSubscription = {
	id: string;
	type: string;
	deviceType: DeviceType;
};
export type WebSubscription = BaseSubscription & {
	type: 'web';
	endpoint: string;
	expirationTime: PushSubscriptionJSON['expirationTime'];
	keys: {
		p256dh: string;
		auth: string;
	};
};
export type NtfySubscription = BaseSubscription & {
	type: 'ntfy';
	server: string;
	topic: string;
};

export type NotificationSubscription = WebSubscription | NtfySubscription;

type NotificationsRegister = ['CONTROL', 'NOTIFICATIONS', 'REGISTER', NotificationSubscription];
type NotificationsUnregister = ['CONTROL', 'NOTIFICATIONS', 'UNREGISTER', string];
type NotificationsNotify = ['CONTROL', 'NOTIFICATIONS', 'NOTIFY', string];
type NotificationsList = ['CONTROL', 'NOTIFICATIONS', 'LIST'];
type NotificationsGetVapidKey = ['CONTROL', 'NOTIFICATIONS', 'GET-VAPID-KEY'];

type NotificationsListResponse = ['CONTROL', 'NOTIFICATIONS', 'LIST', NotificationSubscription[]];
type NotificationsVapidKey = ['CONTROL', 'NOTIFICATIONS', 'VAPID-KEY', string];

export type NotificationsMessage =
	| NotificationsRegister
	| NotificationsUnregister
	| NotificationsList
	| NotificationsNotify
	| NotificationsGetVapidKey;
export type NotificationsResponse = NotificationsListResponse | NotificationsVapidKey;

// notification types

export type WebPushNotification = {
	title: string;
	body: string;
	icon: string;
	url: string;
	event: NostrEvent;
};

export type NotificationType = WebPushNotification;
