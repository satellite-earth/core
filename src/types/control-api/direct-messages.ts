export type DMStats = Record<string, { sent: number; received: number; lastSent?: number; lastReceived?: number }>;
type DirectMessageOpenConversation = ['CONTROL', 'DM', 'OPEN', string, string];
type DirectMessageCloseConversation = ['CONTROL', 'DM', 'CLOSE', string, string];
type DirectMessageGetStats = ['CONTROL', 'DM', 'GET-STATS'];

type DirectMessageStats = ['CONTROL', 'DM', 'STATS', DMStats];

export type DirectMessageMessage =
	| DirectMessageGetStats
	| DirectMessageOpenConversation
	| DirectMessageCloseConversation;
export type DirectMessageResponse = DirectMessageStats;
