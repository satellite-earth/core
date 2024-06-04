export type PrivateNodeConfig = {
	owner?: string;
	pubkeys: string[];
	relays: { url: string }[];

	cacheLevel: 1 | 2 | 3;

	/**
	 * Whether the node should require NIP-42 auth to read
	 * Desktop: false by default
	 * Hosted: true by default
	 */
	requireReadAuth: boolean;

	/**
	 * various address that this node can be reached from
	 * Desktop: default to empty
	 * Hosted: default to public facing URLs
	 */
	publicAddresses: string[];

	/** @deprecated this should probably be moved to desktop */
	autoListen: boolean;
	/** @deprecated this should always be enabled */
	logsEnabled: boolean;

	// VAPID keys
	vapidPublicKey?: string;
	vapidPrivateKey?: string;
};
