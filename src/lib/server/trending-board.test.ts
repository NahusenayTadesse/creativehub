import { describe, expect, it, vi } from 'vitest';

/*
 * `trending-service.ts` imports the connection pool and the viewer's location
 * at module load. Nothing tested here reaches either — `buildBoard` only reads
 * the database in manual mode, and every test below hands it its candidates.
 */
vi.mock('$lib/server/db', () => ({ db: {}, insertedId: () => 0 }));
vi.mock('$lib/server/viewer-location', () => ({ getViewerLocation: async () => null }));

import {
	TRENDING_DEFAULTS,
	buildBoard,
	type Candidate,
	type OverrideRow,
	type TrendingConfigValues
} from './trending-service';
import { TRENDING_SIGNALS, followerTier, type SignalValues } from '$lib/domain/trending';

const NOW = new Date('2026-09-14T12:00:00Z');

/** Ranks on the platform score alone, so a test states the order by stating scores. */
const config = (overrides: Partial<TrendingConfigValues> = {}): TrendingConfigValues => ({
	...TRENDING_DEFAULTS,
	...Object.fromEntries(
		TRENDING_SIGNALS.map((key) => [`weight${key[0].toUpperCase()}${key.slice(1)}`, 0])
	),
	weightScore: 100,
	normalization: 'minmax',
	mode: 'automatic',
	slots: 3,
	...overrides
});

const candidate = (id: number, score: number, overrides: Partial<Candidate> = {}): Candidate => {
	const values = Object.fromEntries(TRENDING_SIGNALS.map((key) => [key, 0])) as SignalValues;
	values.score = score;
	const followers = overrides.followers ?? 5_000;
	return {
		creatorId: id,
		username: `creator${id}`,
		fullName: `Creator ${id}`,
		avatar: null,
		countryId: 1,
		countryName: 'Ethiopia',
		regionId: null,
		city: `City ${id}`,
		primaryPlatformId: id,
		categoryIds: [id],
		facets: [],
		verificationLevel: 'unverified',
		availability: 'available',
		followers,
		tier: followerTier(followers),
		audience: {
			reach: followers,
			scoredReach: followers,
			engagement: 0,
			scoredEngagement: 0,
			engagedAudience: 0,
			confirmedShare: 0,
			largestChannel: followers,
			freshestUpdate: null,
			channelCount: 1
		},
		channelCount: 1,
		ageDays: 400,
		values,
		excludedReason: null,
		...overrides
	};
};

const override = (overrides: Partial<OverrideRow>): OverrideRow => ({
	id: 1,
	creatorId: 0,
	kind: 'pin',
	position: 0,
	multiplier: 1,
	note: null,
	startsAt: null,
	expiresAt: null,
	createdBy: null,
	updatedBy: null,
	createdAt: NOW,
	updatedAt: NOW,
	deletedAt: null,
	...overrides
});

const ids = (entries: { creatorId: number }[]) => entries.map((entry) => entry.creatorId);

const build = (
	candidates: Candidate[],
	settings: Partial<TrendingConfigValues> = {},
	extra: { overrides?: OverrideRow[]; incumbentIds?: number[] } = {}
) =>
	buildBoard({
		config: config(settings),
		overrides: extra.overrides ?? [],
		now: NOW,
		candidates,
		incumbentIds: new Set(extra.incumbentIds ?? [])
	});

describe('buildBoard — the basics still hold', () => {
	it('fills the slots highest score first', async () => {
		const board = await build([
			candidate(1, 10),
			candidate(2, 90),
			candidate(3, 50),
			candidate(4, 70)
		]);
		expect(ids(board.entries)).toEqual([2, 4, 3]);
		expect(board.entries.map((entry) => entry.rank)).toEqual([1, 2, 3]);
	});

	it('records everyone who never reached the ranking, and why', async () => {
		const board = await build([
			candidate(1, 90, { excludedReason: 'max_engagement' }),
			candidate(2, 50)
		]);
		expect(board.excluded.map((row) => [row.candidate.creatorId, row.reason])).toEqual([
			[1, 'max_engagement']
		]);
		expect(board.stats.exclusions).toEqual({ max_engagement: 1 });
	});
});

describe('buildBoard — overrides', () => {
	it('ignores an override that has not started yet', async () => {
		const later = new Date(NOW.getTime() + 86_400_000);
		const board = await build(
			[candidate(1, 90), candidate(2, 10)],
			{ mode: 'hybrid', slots: 1 },
			{ overrides: [override({ creatorId: 2, kind: 'pin', startsAt: later })] }
		);
		expect(ids(board.entries)).toEqual([1]);
	});

	it('applies one that has started', async () => {
		const earlier = new Date(NOW.getTime() - 86_400_000);
		const board = await build(
			[candidate(1, 90), candidate(2, 10)],
			{ mode: 'hybrid', slots: 1 },
			{ overrides: [override({ creatorId: 2, kind: 'pin', startsAt: earlier })] }
		);
		expect(ids(board.entries)).toEqual([2]);
	});
});

describe('buildBoard — diversity caps', () => {
	it('caps creators per size band', async () => {
		const board = await build(
			[
				candidate(1, 90, { followers: 2_000_000 }),
				candidate(2, 80, { followers: 3_000_000 }),
				candidate(3, 70, { followers: 20_000 })
			],
			{ maxPerTier: 1 }
		);
		expect(ids(board.entries)).toEqual([1, 3]);
		const benched = board.ranked.find((row) => row.creatorId === 2);
		expect(benched && 'benchReason' in benched && benched.benchReason).toBe('tier_cap');
		expect(board.stats.cappedOut).toBe(1);
	});

	it('caps creators per primary platform and per city', async () => {
		const sharedPlatform = await build(
			[
				candidate(1, 90, { primaryPlatformId: 7 }),
				candidate(2, 80, { primaryPlatformId: 7 }),
				candidate(3, 70)
			],
			{ maxPerPlatform: 1 }
		);
		expect(ids(sharedPlatform.entries)).toEqual([1, 3]);

		const sharedCity = await build(
			[
				candidate(1, 90, { city: 'Addis Ababa' }),
				candidate(2, 80, { city: ' addis ababa ' }),
				candidate(3, 70)
			],
			{ maxPerCity: 1 }
		);
		expect(ids(sharedCity.entries)).toEqual([1, 3]);
	});
});

describe('buildBoard — stability', () => {
	it('lets the incumbent bonus keep a near-tie in place', async () => {
		const pool = [candidate(1, 100), candidate(2, 50), candidate(3, 48), candidate(4, 0)];
		const without = await build(pool, { slots: 2 }, { incumbentIds: [3] });
		expect(ids(without.entries)).toEqual([1, 2]);

		const withBonus = await build(pool, { slots: 2, incumbentBonus: 5 }, { incumbentIds: [3] });
		expect(ids(withBonus.entries)).toEqual([1, 3]);
		expect(withBonus.entries[1].bonus).toBe(5);
	});

	it('admits at most the configured number of new faces per run', async () => {
		const pool = [
			candidate(1, 100),
			candidate(2, 90),
			candidate(3, 80),
			candidate(4, 10),
			candidate(5, 5)
		];
		const board = await build(pool, { slots: 3, maxNewPerRun: 1 }, { incumbentIds: [4, 5] });
		expect(ids(board.entries)).toEqual([1, 4, 5]);
		expect(board.stats.churnHeld).toBe(2);
	});

	it('still fills the board when the incumbents cannot', async () => {
		const pool = [candidate(1, 100), candidate(2, 90), candidate(3, 80), candidate(4, 10)];
		const board = await build(pool, { slots: 3, maxNewPerRun: 1 }, { incumbentIds: [4] });
		expect(ids(board.entries)).toEqual([1, 2, 4]);
		expect(board.stats.churnHeld).toBe(1);
	});

	it('does not limit new faces on a first run', async () => {
		const pool = [candidate(1, 100), candidate(2, 90), candidate(3, 80)];
		const board = await build(pool, { slots: 3, maxNewPerRun: 1 });
		expect(ids(board.entries)).toEqual([1, 2, 3]);
	});
});

describe('buildBoard — newcomer slots', () => {
	it('gives a reserved slot to the best benched newcomer, displacing the lowest algorithm entry', async () => {
		const pool = [
			candidate(1, 100),
			candidate(2, 90),
			candidate(3, 80),
			candidate(4, 30, { ageDays: 5 }),
			candidate(5, 20, { ageDays: 3 })
		];
		const board = await build(pool, { newcomerSlots: 1, newcomerMaxAgeDays: 30 });
		expect(ids(board.entries)).toEqual([1, 2, 4]);
		expect(board.entries.find((entry) => entry.creatorId === 4)?.reserved).toBe(true);
		expect(board.stats.newcomersReserved).toBe(1);
	});

	it('reserves nothing when enough newcomers earned a place outright', async () => {
		const pool = [
			candidate(1, 100, { ageDays: 2 }),
			candidate(2, 90),
			candidate(3, 80),
			candidate(4, 30, { ageDays: 5 })
		];
		const board = await build(pool, { newcomerSlots: 1 });
		expect(ids(board.entries)).toEqual([1, 2, 3]);
		expect(board.stats.newcomersReserved).toBe(0);
	});

	it('never displaces a pin to make room', async () => {
		const pool = [candidate(1, 10), candidate(2, 90), candidate(3, 30, { ageDays: 1 })];
		const board = await build(
			pool,
			{ mode: 'hybrid', slots: 2, newcomerSlots: 1 },
			{ overrides: [override({ creatorId: 1, kind: 'pin' })] }
		);
		expect(ids(board.entries)).toEqual([1, 3]);
	});

	it('does not reach past a diversity cap for a newcomer', async () => {
		const pool = [
			candidate(1, 100, { categoryIds: [9] }),
			candidate(2, 90),
			candidate(3, 50, { categoryIds: [9], ageDays: 1 })
		];
		const board = await build(pool, { slots: 2, maxPerCategory: 1, newcomerSlots: 1 });
		expect(ids(board.entries)).toEqual([1, 2]);
	});
});
