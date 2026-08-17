import fs from 'node:fs';
import path from 'node:path';

const STAT_CACHE_MAX = 500;
const STAT_CACHE_TTL = 10_000; // 10 seconds

const statCache = new Map<string, { stats: fs.Stats; ts: number }>();

export function getCachedStats(filePath: string): fs.Stats | null {
	const now = Date.now();
	const hit = statCache.get(filePath);
	if (hit && now - hit.ts < STAT_CACHE_TTL) return hit.stats;

	let stats: fs.Stats;
	try {
		stats = fs.statSync(filePath);
	} catch {
		statCache.delete(filePath);
		return null;
	}

	if (statCache.size >= STAT_CACHE_MAX) {
		statCache.delete(statCache.keys().next().value!);
	}
	statCache.set(filePath, { stats, ts: now });
	return stats;
}

/**
 * Call this after uploading or deleting a file to evict the stale cache entry.
 * @param absoluteFilePath — the fully resolved path to the file
 */
export function invalidateStatCache(absoluteFilePath: string) {
	statCache.delete(absoluteFilePath);
}
