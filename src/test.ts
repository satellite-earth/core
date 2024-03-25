import express from 'express';
import { DesktopBlobServer } from './index.js';
import morgan from 'morgan';
import { BlossomSQLite } from 'blossom-server-sdk/metadata/sqlite';
import { logger } from './logger.js';
import { readStreamFromURL } from './helpers.js';
import { BlobArchiver } from './archiver.js';

const now = () => Math.floor(Date.now() / 1000);

const app = express();
app.use(morgan('dev'));

const metadata = new BlossomSQLite('./data/sqlite.db');
const blobs = new DesktopBlobServer('./data', metadata);
await blobs.setup();

const archiver = new BlobArchiver(blobs.storage, metadata);

app.use(blobs.router);

app.get('/', (req, res) => {
	res.status(200).send('Hello world');
});

app.listen(8080, () => {
	logger('Started on port 8080');

	for (const sha256 of TEST_BLOBS) {
		logger(new URL(sha256, 'http://localhost:8080').toString());
	}
});

// download generic blobs
const TEST_BLOBS = [
	'b1674191a88ec5cdd733e4240a81803105dc412d6c6708d53ab94fc248f4f553',
];

for (const sha256 of TEST_BLOBS) {
	if ((await metadata.hasBlob(sha256)) === false) {
		const res = await readStreamFromURL(
			new URL(sha256, 'https://cdn.satellite.earth'),
		);
		const type = res.headers['content-type'];

		// save the blob to the file system
		await blobs.storage.writeBlob(sha256, res, type);

		// add the blob metadata
		await metadata.addBlob({
			sha256,
			type: type ?? '',
			size: 20,
			created: now(),
		});
	}
}

// download pubkeys blobs
archiver.setPubkeyServers(
	'266815e0c9210dfa324c6cba3573b14bee49da4209a9456f9484e5106cd408a5',
	['https://cdn.hzrd149.com', 'https://cdn.satellite.earth'],
);
archiver.setPubkeyServers(
	'ff27d01cb1e56fb58580306c7ba76bb037bf211c5b573c56e4e70ca858755af0',
	['https://cdn.satellite.earth'],
);

await archiver.sync();
