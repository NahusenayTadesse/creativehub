// src/lib/server/upload.ts
import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { env } from '$env/dynamic/private';
import { randomUUID } from 'crypto';

const FILES_DIR = env.FILES_DIR ?? '.tempFiles';

/* ensure folder exists once, at module load */
if (!fs.existsSync(FILES_DIR)) {
	fs.mkdirSync(FILES_DIR, { recursive: true });
}

/**
 * Save an uploaded file and return the stored file name.
 * @param file  File object coming from formData (has .name, .stream(), .type, etc.)
 * @returns     The generated file name (with extension) that was written to disk
 * @throws      If the write fails
 */
export async function saveUploadedFile(file: File): Promise<string> {
	const ext = path.extname(file.name); // keep original extension
	const fileName = `${randomUUID()}${ext}`;

	const target = path.join(FILES_DIR, fileName);

	const webStream = file.stream(); // Web-stream from File
	const nodeStream = Readable.fromWeb(webStream as any);

	await pipeline(nodeStream, fs.createWriteStream(target));
	invalidateStatCache(path.resolve(FILES_DIR, target));

	return fileName; // store this string in your DB
}

import { invalidateStatCache } from '$lib/server/fileCache';
