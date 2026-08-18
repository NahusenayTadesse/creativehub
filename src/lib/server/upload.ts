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

/** A rejected upload. Callers turn this into a form message, not a 500. */
export class UploadError extends Error {
	constructor(readonly reason: 'too_large' | 'bad_type') {
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
	const counted = new TransformStream<Uint8Array, Uint8Array>({
		transform(chunk, controller) {
			written += chunk.byteLength;
			if (written > MAX_UPLOAD_BYTES) throw new UploadError('too_large');
			controller.enqueue(chunk);
		}
	});

	const nodeStream = Readable.fromWeb(file.stream().pipeThrough(counted) as any);

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
