import { describe, it, expect, beforeEach } from 'vitest';
import { take, resetRateLimits, trackedKeys, MAX_TRACKED_KEYS } from './ratelimit';

const limit = { limit: 10, windowMs: 10_000 };

beforeEach(resetRateLimits);

describe('take', () => {
	it('lets a caller spend the whole bucket at once, then stops', () => {
		for (let i = 0; i < 10; i++) expect(take('a', limit, 0).ok, `request ${i}`).toBe(true);
		expect(take('a', limit, 0).ok).toBe(false);
	});

	it('refills continuously rather than at a window boundary', () => {
		for (let i = 0; i < 10; i++) take('a', limit, 0);
		expect(take('a', limit, 0).ok).toBe(false);

		/* One token per second at this rate. */
		expect(take('a', limit, 999).ok).toBe(false);
		expect(take('a', limit, 1_000).ok).toBe(true);
		expect(take('a', limit, 1_000).ok).toBe(false);
	});

	/*
	 * The reason for a bucket rather than a fixed window: a caller who learns
	 * where a window resets gets two windows' worth by firing on either side of
	 * it. Twenty requests in a hair over one window is what that looks like.
	 */
	it('does not hand out a double allowance across a window boundary', () => {
		for (let i = 0; i < 10; i++) expect(take('a', limit, 9_999).ok).toBe(true);
		let allowed = 0;
		for (let i = 0; i < 10; i++) if (take('a', limit, 10_001).ok) allowed++;
		expect(allowed).toBeLessThan(3);
	});

	it('never says to retry in zero seconds', () => {
		for (let i = 0; i < 10; i++) take('a', limit, 0);
		const decision = take('a', limit, 0);
		expect(decision.ok).toBe(false);
		if (!decision.ok) expect(decision.retryAfter).toBeGreaterThanOrEqual(1);
	});

	it('reports a retry that is actually long enough to wait', () => {
		for (let i = 0; i < 10; i++) take('a', limit, 0);
		const decision = take('a', limit, 0);
		if (decision.ok) throw new Error('expected the bucket to be empty');
		expect(take('a', limit, decision.retryAfter * 1000).ok).toBe(true);
	});

	it('keeps callers apart', () => {
		for (let i = 0; i < 10; i++) take('a', limit, 0);
		expect(take('a', limit, 0).ok).toBe(false);
		expect(take('b', limit, 0).ok).toBe(true);
	});

	it('refills a bucket to its ceiling and no further', () => {
		take('a', limit, 0);
		/* A full day of silence does not bank a day of requests. */
		for (let i = 0; i < 10; i++) expect(take('a', limit, 86_400_000).ok).toBe(true);
		expect(take('a', limit, 86_400_000).ok).toBe(false);
	});

	/*
	 * Every key is an address a stranger chooses, so the map has to forget.
	 * Without this the limiter is a memory leak with a stable public trigger.
	 */
	it('forgets callers who have gone quiet, rather than growing without bound', () => {
		for (let i = 0; i < MAX_TRACKED_KEYS; i++) take(`caller-${i}`, limit, 0);
		expect(trackedKeys()).toBe(MAX_TRACKED_KEYS);

		/* The caller after the cap is the one that provokes a sweep, and every
		   bucket above is a full window stale by now, so all of them go. */
		take('someone-new', limit, 10_001);
		expect(trackedKeys()).toBe(1);
	});

	it('would rather forget everyone than exhaust the heap', () => {
		/* The pathological case the cap exists for: a caller cycling through
		   addresses fast enough that nothing is stale enough to sweep. */
		for (let i = 0; i <= MAX_TRACKED_KEYS; i++) take(`caller-${i}`, limit, 0);
		expect(trackedKeys()).toBeLessThanOrEqual(MAX_TRACKED_KEYS);
	});
});
