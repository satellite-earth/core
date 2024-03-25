import { BlossomClient } from 'blossom-client-sdk';
import { IBlobMetadataStore, IBlobStorage } from 'blossom-server-sdk';
import { readStreamFromURL } from './helpers.js';
import { Debugger } from 'debug';
import { logger } from './logger.js';

export class BlobArchiver {
	pubkeys = new Map<string, string[]>();
	storage: IBlobStorage;
	metadata: IBlobMetadataStore;

	log: Debugger = logger.extend('archiver');

	constructor(storage: IBlobStorage, metadata: IBlobMetadataStore) {
		this.storage = storage;
		this.metadata = metadata;
	}

	setPubkeyServers(pubkey: string, servers: string[]) {
		this.pubkeys.set(pubkey, servers);
	}

	async sync() {
		this.log('Starting sync');

		const checked = new Set<string>();
		for (const [pubkey, servers] of this.pubkeys) {
			this.log('Syncing', pubkey);

			for (const server of servers) {
				this.log('Checking', server);
				try {
					const blobs = await BlossomClient.listBlobs(server, pubkey);

					let d = 0;
					for (const blob of blobs) {
						if (!checked.has(blob.sha256)) {
							if ((await this.storage.hasBlob(blob.sha256)) === false) {
								this.log('Downloading', blob.sha256);

								const res = await readStreamFromURL(blob.url);
								await this.storage.writeBlob(
									blob.sha256,
									res,
									blob.type || res.headers['content-type'],
								);

								d++;

								if ((await this.metadata.hasBlob(blob.sha256)) === false) {
									await this.metadata.addBlob(blob);
								}
							}

							if (
								(await this.metadata.hasOwner(blob.sha256, pubkey)) === false
							) {
								await this.metadata.addOwner(blob.sha256, pubkey);
							}

							checked.add(blob.sha256);
						}
					}

					this.log(`Downloaded ${d} blobs`);
				} catch (e) {
					this.log('Failed to get blobs from', server);
					if (e instanceof Error) this.log(e.message);
				}
			}
		}

		this.log(`Done sync, checked ${checked.size} blobs`);
	}
}
