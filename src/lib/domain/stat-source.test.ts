import { describe, expect, it } from 'vitest';
import { STAT_SOURCES, isConfirmedSource, sourceConfidence, statSourceLabel } from './stat-source';
import { statSourceEnum } from '$lib/server/db/schema';
import { engagementForScore } from '$lib/server/db/creator-score';

describe('stat sources', () => {
	it('match the column the database stores them in', () => {
		expect([...STAT_SOURCES]).toEqual([...statSourceEnum]);
	});

	it('call only a platform figure or an approved proof confirmed', () => {
		expect(STAT_SOURCES.filter(isConfirmedSource)).toEqual(['proof', 'platform']);
		expect(isConfirmedSource(null)).toBe(false);
		expect(isConfirmedSource('anything else')).toBe(false);
	});

	it('weigh an unconfirmed figure at half', () => {
		expect(sourceConfidence('platform')).toBe(1);
		expect(sourceConfidence('self_reported')).toBe(0.5);
	});

	it('label every source, naming the platform where it matters', () => {
		for (const source of STAT_SOURCES)
			expect(statSourceLabel(source, 'YouTube').length).toBeGreaterThan(0);
		expect(statSourceLabel('platform', 'YouTube')).toContain('YouTube');
	});
});

describe('engagementForScore', () => {
	it('prefers confirmed rates outright rather than averaging them with unconfirmed ones', () => {
		expect(
			engagementForScore([
				{ rate: 2, source: 'platform' },
				{ rate: 12, source: 'self_reported' }
			])
		).toEqual({ engagementRate: 2, engagementConfirmed: true });
	});

	it('averages unconfirmed rates when nothing is confirmed, and leaves zeros out', () => {
		expect(
			engagementForScore([
				{ rate: 4, source: 'imported' },
				{ rate: 6, source: 'self_reported' },
				{ rate: 0, source: 'platform' }
			])
		).toEqual({ engagementRate: 5, engagementConfirmed: false });
	});

	it('has nothing to report for a creator with no rates at all', () => {
		expect(engagementForScore([])).toEqual({ engagementRate: 0, engagementConfirmed: false });
	});
});
