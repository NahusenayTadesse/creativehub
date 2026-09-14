import { describe, expect, it } from 'vitest';
import {
	ANSWER_WINDOW_MS,
	MIN_ASKS,
	RESPONSE_LOOKBACK_MS,
	asksIn,
	measureDelivery,
	measureResponsiveness,
	type Ask,
	type ThreadEvent
} from './track-record';

const HOUR = 60 * 60 * 1000;
const now = new Date('2026-09-14T12:00:00Z');
const ago = (hours: number) => new Date(now.getTime() - hours * HOUR);

const brand = (hoursAgo: number): ThreadEvent => ({ at: ago(hoursAgo), by: 'brand' });
const creator = (hoursAgo: number): ThreadEvent => ({ at: ago(hoursAgo), by: 'creator' });
const closed = (hoursAgo: number): ThreadEvent => ({ at: ago(hoursAgo), by: 'closed' });

/** `count` asks, each answered after `tookHours`, spread a week apart. */
const answered = (count: number, tookHours: number): Ask[] =>
	Array.from({ length: count }, (_, i) => ({
		askedAt: ago(200 + i * 168),
		answeredAt: ago(200 + i * 168 - tookHours)
	}));

describe('asksIn', () => {
	it('treats a run of brand messages as one ask, timed from the first', () => {
		const asks = asksIn([brand(10), brand(9), brand(8), creator(5)]);
		expect(asks).toEqual([{ askedAt: ago(10), answeredAt: ago(5) }]);
	});

	it('does not care what order the events arrive in', () => {
		expect(asksIn([creator(5), brand(8), brand(10)])).toEqual(
			asksIn([brand(10), brand(8), creator(5)])
		);
	});

	it('ignores creator events nobody was waiting for', () => {
		expect(asksIn([creator(20), creator(10)])).toEqual([]);
	});

	it('leaves a trailing ask open', () => {
		expect(asksIn([brand(10), creator(9), brand(3)])).toEqual([
			{ askedAt: ago(10), answeredAt: ago(9) },
			{ askedAt: ago(3), answeredAt: null }
		]);
	});

	it('marks an ask the brand closed as withdrawn, not answered', () => {
		expect(asksIn([brand(10), closed(4)])).toEqual([
			{ askedAt: ago(10), answeredAt: null, withdrawnAt: ago(4) }
		]);
	});
});

describe('measureResponsiveness', () => {
	it('reports no rate until there are enough asks to judge by', () => {
		const result = measureResponsiveness(answered(MIN_ASKS - 1, 1), now);
		expect(result.rate).toBeNull();
		expect(result.sample).toBe(MIN_ASKS - 1);
	});

	it('counts answers inside the window, and late ones against the rate', () => {
		const asks = [
			...answered(3, 1),
			...answered(1, 72).map((ask, i) => ({
				askedAt: new Date(ask.askedAt.getTime() - (i + 5) * 168 * HOUR),
				answeredAt: new Date(ask.answeredAt!.getTime() - (i + 5) * 168 * HOUR)
			}))
		];
		const result = measureResponsiveness(asks, now);
		expect(result.sample).toBe(4);
		expect(result.rate).toBe(75);
	});

	it('does not count an unanswered ask whose window is still open', () => {
		const asks = [...answered(3, 1), { askedAt: ago(5), answeredAt: null }];
		expect(measureResponsiveness(asks, now)).toMatchObject({ rate: 100, sample: 3 });
	});

	it('counts an unanswered ask as missed once the window has passed', () => {
		const asks = [...answered(3, 1), { askedAt: ago(49), answeredAt: null }];
		expect(measureResponsiveness(asks, now)).toMatchObject({ rate: 75, sample: 4 });
	});

	it('leaves out an ask the brand withdrew inside the window', () => {
		const asks = [...answered(3, 1), { askedAt: ago(100), answeredAt: null, withdrawnAt: ago(90) }];
		expect(measureResponsiveness(asks, now)).toMatchObject({ rate: 100, sample: 3 });
	});

	it('still counts a withdrawal that came after the window ran out', () => {
		const asks = [...answered(3, 1), { askedAt: ago(100), answeredAt: null, withdrawnAt: ago(10) }];
		expect(measureResponsiveness(asks, now)).toMatchObject({ rate: 75, sample: 4 });
	});

	it('treats the window edge as answered in time', () => {
		const exactly = ANSWER_WINDOW_MS / HOUR;
		expect(measureResponsiveness(answered(3, exactly), now).rate).toBe(100);
	});

	it('ignores asks older than the lookback', () => {
		const old = {
			askedAt: new Date(now.getTime() - RESPONSE_LOOKBACK_MS - HOUR),
			answeredAt: null
		};
		expect(measureResponsiveness([...answered(3, 1), old], now).sample).toBe(3);
	});

	it('takes the median over every answer, late ones included', () => {
		const asks = [
			...answered(1, 1),
			...answered(1, 2).map(shift(1)),
			...answered(1, 100).map(shift(2))
		];
		expect(measureResponsiveness(asks, now).medianMinutes).toBe(120);
	});
});

describe('measureDelivery', () => {
	const due = (daysAgo: number) =>
		new Date(now.getTime() - daysAgo * 24 * HOUR).toISOString().slice(0, 10);

	it('counts a first submission on the deadline day as on time', () => {
		const deadline = due(10);
		const lateThatDay = new Date(`${deadline}T23:30:00Z`);
		const result = measureDelivery(
			[
				{ deadline, firstSubmittedAt: lateThatDay, status: 'completed' },
				{ deadline: due(20), firstSubmittedAt: ago(30 * 24), status: 'completed' }
			],
			now
		);
		expect(result).toEqual({ rate: 100, sample: 2 });
	});

	it('counts a submission the day after as late', () => {
		const deadline = due(10);
		const result = measureDelivery(
			[
				{ deadline, firstSubmittedAt: new Date(`${due(9)}T00:30:00Z`), status: 'completed' },
				{ deadline: due(20), firstSubmittedAt: ago(30 * 24), status: 'completed' }
			],
			now
		);
		expect(result).toEqual({ rate: 50, sample: 2 });
	});

	it('counts work still owed after its deadline as missed', () => {
		const result = measureDelivery(
			[
				{ deadline: due(3), firstSubmittedAt: null, status: 'in_production' },
				{ deadline: due(20), firstSubmittedAt: ago(30 * 24), status: 'completed' }
			],
			now
		);
		expect(result).toEqual({ rate: 50, sample: 2 });
	});

	it('leaves out deals that say nothing about timeliness', () => {
		const result = measureDelivery(
			[
				{ deadline: null, firstSubmittedAt: ago(1), status: 'completed' },
				{ deadline: due(3), firstSubmittedAt: null, status: 'cancelled' },
				{ deadline: due(3), firstSubmittedAt: null, status: 'negotiating' },
				/* Settled on the parties' word: nothing handed in through the platform. */
				{ deadline: due(3), firstSubmittedAt: null, status: 'completed' },
				/* Owed, but not due yet. */
				{ deadline: due(-5), firstSubmittedAt: null, status: 'booked' }
			],
			now
		);
		expect(result).toEqual({ rate: null, sample: 0 });
	});

	it('ignores a deadline it cannot read', () => {
		expect(
			measureDelivery([{ deadline: 'soon', firstSubmittedAt: ago(1), status: 'completed' }], now)
		).toEqual({ rate: null, sample: 0 });
	});
});

function shift(weeks: number) {
	return (ask: Ask): Ask => ({
		askedAt: new Date(ask.askedAt.getTime() - weeks * 168 * HOUR),
		answeredAt: ask.answeredAt && new Date(ask.answeredAt.getTime() - weeks * 168 * HOUR)
	});
}
