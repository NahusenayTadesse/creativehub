// src/lib/server/upload.ts
import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { randomUUID } from 'crypto';
import { invalidateStatCache } from '$lib/server/fileCache';
import { FILES_DIR, PRIVATE_DIR } from '$lib/server/serveFile';

/** Nothing on disk may exceed this. Also the cheap first rejection. */
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

/**
 * What may be stored, and the extension each type is given.
 *
 * The extension comes from the declared type rather than the client's filename:
 * the filename is attacker-controlled and only ever needed for display, and
 * `/files/[name]` picks its `Content-Type` from the stored extension.
 */
const ALLOWED_TYPES = new Map<string, string>([
	['image/png', '.png'],
	['image/jpeg', '.jpg'],
	['image/webp', '.webp'],
	['image/avif', '.avif'],
	['application/pdf', '.pdf']
]);

/**
 * The first bytes each allowed type must start with.
 *
 * `file.type` is the browser's word for what it is sending, and a direct
 * multipart POST says whatever it likes — so a PDF, an SVG or an HTML page can
 * arrive claiming `image/png` and be stored with a `.png` extension. That
 * matters because `/files/[name]` picks its `Content-Type` from that extension:
 * a browser told `image/png` will not execute the file, but nothing else in the
 * chain would have noticed the lie.
 *
 * A magic number is not a full parse. It is the cheap half that a mislabelled
 * file cannot survive, and it needs no dependency.
 */
const SIGNATURES: Record<string, (head: Uint8Array) => boolean> = {
	/* \x89 P N G \r \n \x1a \n */
	'image/png': (h) =>
		h[0] === 0x89 && h[1] === 0x50 && h[2] === 0x4e && h[3] === 0x47 && h[4] === 0x0d,
	/* JPEG segments always open FF D8 FF. */
	'image/jpeg': (h) => h[0] === 0xff && h[1] === 0xd8 && h[2] === 0xff,
	/* RIFF....WEBP */
	'image/webp': (h) => ascii(h, 0, 4) === 'RIFF' && ascii(h, 8, 12) === 'WEBP',
	/* An ISO-BMFF box: ....ftyp, with a brand naming AVIF. */
	'image/avif': (h) => ascii(h, 4, 8) === 'ftyp' && ascii(h, 8, 12).startsWith('avi'),
	/* %PDF- */
	'application/pdf': (h) => ascii(h, 0, 5) === '%PDF-'
};

const ascii = (bytes: Uint8Array, from: number, to: number) =>
	String.fromCharCode(...bytes.subarray(from, to));

/** Enough for every signature above; `ftyp` needs twelve. */
const HEADER_BYTES = 16;

/** A rejected upload. Callers turn this into a form message, not a 500. */
export class UploadError extends Error {
	constructor(readonly reason: 'too_large' | 'bad_type' | 'content_mismatch') {
		super(reason);
		this.name = 'UploadError';
	}
}

/**
 * Save an uploaded file and return the stored file name.
 *
 * The `accept` attribute on the input is a client-side hint only — a direct
 * multipart POST carries whatever it likes — so type and size are both checked
 * here. The size is checked twice: `file.size` is a cheap early rejection, and
 * the stream is counted as it is written in case that figure was a lie.
 *
 * Pass `visibility: 'private'` for anything that needs an authorisation check
 * before it is handed back — verification evidence, for instance. Those land in
 * a separate directory and the returned name is prefixed `private/`, which is
 * both what the column stores and the path `/files/private/[name]` serves.
 *
 * @param file  File object coming from formData (has .name, .stream(), .type, etc.)
 * @returns     The stored name, to put in the DB column
 * @throws      {UploadError} if the file is too large or of a type we do not store
 * @throws      If the write fails
 */
export async function saveUploadedFile(
	file: File,
	options: { visibility?: 'public' | 'private' } = {}
): Promise<string> {
	const ext = ALLOWED_TYPES.get(file.type);
	if (!ext) throw new UploadError('bad_type');
	if (file.size > MAX_UPLOAD_BYTES) throw new UploadError('too_large');

	const isPrivate = options.visibility === 'private';
	const fileName = `${randomUUID()}${ext}`;
	const target = path.join(isPrivate ? PRIVATE_DIR : FILES_DIR, fileName);

	let written = 0;
	/* Collected across chunks: a first chunk shorter than a signature is legal. */
	let head = new Uint8Array(0);
	let headChecked = false;
	const matches = SIGNATURES[file.type];

	const counted = new TransformStream<Uint8Array, Uint8Array>({
		transform(chunk, controller) {
			written += chunk.byteLength;
			if (written > MAX_UPLOAD_BYTES) throw new UploadError('too_large');

			if (!headChecked && matches) {
				const merged = new Uint8Array(head.length + chunk.byteLength);
				merged.set(head);
				merged.set(chunk, head.length);
				head = merged.subarray(0, HEADER_BYTES);

				if (head.length >= HEADER_BYTES) {
					headChecked = true;
					if (!matches(head)) throw new UploadError('content_mismatch');
				}
			}

			controller.enqueue(chunk);
		},
		flush() {
			/* A file shorter than sixteen bytes is not any of the types above. */
			if (!headChecked && matches && !matches(head)) {
				throw new UploadError('content_mismatch');
			}
		}
	});

	const nodeStream = Readable.fromWeb(
		file.stream().pipeThrough(counted) as import('node:stream/web').ReadableStream<Uint8Array>
	);

	try {
		await pipeline(nodeStream, fs.createWriteStream(target));
	} catch (err) {
		/* Never leave a partial file behind for a rejected upload. */
		await fs.promises.rm(target, { force: true }).catch(() => {});
		throw err;
	}

	invalidateStatCache(path.resolve(target));

	/* The `private/` prefix is part of the stored value: `assetUrl` turns it into
	   `/files/private/<name>`, which is the route that checks authorisation. */
	return isPrivate ? `private/${fileName}` : fileName;
}

/**
 * Removes a stored upload from disk.
 *
 * Takes the value as the column holds it — `abc.png`, or `private/abc.png` —
 * and does nothing for anything else, because those columns may equally hold an
 * external URL. The resolved path is checked to be inside the upload root: the
 * value came from a database row, but so does every value that has ever been
 * used for a traversal.
 *
 * Never throws. A file that is already gone is the outcome the caller wanted,
 * and a file that will not delete must not fail the write that prompted it.
 */
export async function deleteUploadedFile(stored?: string | null): Promise<void> {
	if (!stored) return;
	if (/^(https?:)?\/\//.test(stored) || stored.startsWith('data:') || stored.startsWith('/')) {
		return;
	}

	const target = path.resolve(FILES_DIR, stored);
	const root = path.resolve(FILES_DIR);
	if (target !== root && !target.startsWith(root + path.sep)) return;

	try {
		await fs.promises.rm(target, { force: true });
		invalidateStatCache(target);
	} catch (err) {
		console.error('Could not remove upload', stored, err);
	}
}
