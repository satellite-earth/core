import express from 'express';
import { DesktopBlobServer } from './index.js';
import morgan from 'morgan';
import { BlossomSQLite } from 'blossom-server-sdk/metadata/sqlite';
import { logger } from './logger.js';
import { BlobArchiver } from './archiver.js';

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
});

archiver.addToQueue(
	'b1674191a88ec5cdd733e4240a81803105dc412d6c6708d53ab94fc248f4f553',
	{ servers: ['https://cdn.satellite.earth'] },
);

// download pubkeys blobs
await archiver.queueBlobsFromPubkey(
	'266815e0c9210dfa324c6cba3573b14bee49da4209a9456f9484e5106cd408a5',
	['https://cdn.hzrd149.com', 'https://cdn.satellite.earth'],
);
await archiver.queueBlobsFromPubkey(
	'ff27d01cb1e56fb58580306c7ba76bb037bf211c5b573c56e4e70ca858755af0',
	['https://cdn.satellite.earth', 'https://cdn.hzrd149.com'],
);

async function downloadNext() {
	let count = archiver.queue.length;
	await archiver.downloadNext();
	if (count > 0 && archiver.queue.length === 0) {
		console.log('Finished');
	}

	process.nextTick(downloadNext);
}
downloadNext();
