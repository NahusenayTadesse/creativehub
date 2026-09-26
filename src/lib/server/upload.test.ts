import { afterEach, describe, expect, it } from 'vitest';
import { deleteUploadedFile, isRemoteUrl, mirrorRemoteImage, UploadError } from './upload';

/* The smallest valid PNG header: the signature, then an IHDR chunk's start. */
const PNG = new Uint8Array([
	0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0
]);

const reply = (body: BodyInit | null, init: ResponseInit = {}) =>
	(async () => new Response(body, init)) as unknown as typeof fetch;

const stored: string[] = [];
afterEach(async () => {
	await Promise.all(stored.splice(0).map((name) => deleteUploadedFile(name)));
});

const failure = async (promise: Promise<unknown>) => {
	try {
		await promise;
	} catch (err) {
		return err as UploadError;
	}
	throw new Error('expected a rejection');
};

describe('isRemoteUrl', () => {
	it('tells a link from an upload', () => {
		expect(isRemoteUrl('https://cdn.example.com/a.jpg')).toBe(true);
		expect(isRemoteUrl('//cdn.example.com/a.jpg')).toBe(true);
		expect(isRemoteUrl('3f2a.webp')).toBe(false);
		expect(isRemoteUrl('/hero/gallery-1.webp')).toBe(false);
		expect(isRemoteUrl('')).toBe(false);
	});
});

describe('mirrorRemoteImage', () => {
	it('stores a picture by what its bytes are, whatever the header says', async () => {
		const name = await mirrorRemoteImage(
			'https://cdn.example.com/avatar',
			reply(PNG, { headers: { 'content-type': 'application/octet-stream' } })
		);
		stored.push(name);
		expect(name).toMatch(/^[0-9a-f-]{36}\.png$/);
	});

	it('keeps the status of a refusal, so a caller can tell gone from busy', async () => {
		const gone = await failure(
			mirrorRemoteImage('https://cdn.example.com/x', reply(null, { status: 404 }))
		);
		expect(gone.reason).toBe('unreachable');
		expect(gone.status).toBe(404);
		const busy = await failure(
			mirrorRemoteImage('https://cdn.example.com/x', reply(null, { status: 429 }))
		);
		expect(busy.status).toBe(429);
	});

	it('refuses something that is not a picture', async () => {
		const err = await failure(
			mirrorRemoteImage('https://cdn.example.com/x', reply('<html>nope</html>'))
		);
		expect(err.reason).toBe('bad_type');
	});

	it('never fetches this machine or a private network', async () => {
		const never = (async () => {
			throw new Error('fetched');
		}) as unknown as typeof fetch;
		for (const url of [
			'http://localhost/a.png',
			'http://127.0.0.1/a.png',
			'http://10.0.0.5/a.png',
			'http://192.168.1.1/a.png',
			'http://169.254.169.254/latest/meta-data',
			'http://[::1]/a.png',
			'ftp://example.com/a.png'
		]) {
			const err = await failure(mirrorRemoteImage(url, never));
			expect(err.reason, url).toBe('unreachable');
			expect(err.status, url).toBeUndefined();
		}
	});
});
