/**
 * How a creator behaves once a brand is talking to them, measured from what
 * already happened on the platform.
 *
 * Two figures, both of which used to be assumed rather than known: the score
 * awarded every creator 13 of 15 points for a response rate nobody had
 * measured. These are the measurements. Everything here is pure — the database
 * half, which gathers the events, is `$lib/server/db/creator-score.ts`.
 *
 * Both return `null` for the rate until there is enough to judge by. Null means
 * "no evidence yet" and is scored as nothing, which is not the same as a
 * creator who was asked and did not answer.
 */

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** An ask answered inside this counts as answered. Two days, not one: weekends. */
export const ANSWER_WINDOW_MS = 48 * HOUR;

/** Asks older than this no longer describe how the creator behaves now. */
export const RESPONSE_LOOKBACK_MS = 180 * DAY;

/** Deadlines older than this are left out of the delivery figure, likewise. */
export const DELIVERY_LOOKBACK_MS = 365 * DAY;

/** Fewer asks than this and the rate is noise — one ignored message would be 0%. */
export const MIN_ASKS = 3;

/** Fewer deadlines than this and the rate is noise. */
export const MIN_DELIVERIES = 2;

/* ------------------------------------------------------------------ *
 * Responsiveness
 * ------------------------------------------------------------------ */

/**
 * One thing in a conversation, reduced to when it happened and what it means
 * for the question "was the creator waited on?".
 *
 * - `brand` — something the creator is expected to answer: a booking request, a
 *   counter-offer from the organisation, a message from anyone but the creator.
 * - `creator` — the creator answering, in any form: a reply, their own
 *   counter-offer, accepting terms, submitting work. The moment terms were
 *   frozen counts too, because freezing needs both sides to have confirmed.
 * - `closed` — the thing being waited on went away without the creator: the
 *   brand cancelled the booking.
 */
export type ThreadEvent = { at: Date; by: 'brand' | 'creator' | 'closed' };

/** Something the brand side was waiting on, and how the wait ended. */
export type Ask = {
	askedAt: Date;
	answeredAt: Date | null;
	/** Set when the brand withdrew before any answer. */
	withdrawnAt?: Date | null;
};

/**
 * The asks in one conversation.
 *
 * Three messages from a brand in a row are one ask, not three: the creator
 * answers them together, and counting each would punish a brand for writing in
 * short lines. An ask starts at the first unanswered `brand` event and ends at
 * the next `creator` event — or at a `closed` one, which withdraws it.
 */
export function asksIn(events: ThreadEvent[]): Ask[] {
	const ordered = [...events].sort((a, b) => a.at.getTime() - b.at.getTime());
	const asks: Ask[] = [];
	let open: Date | null = null;

	for (const event of ordered) {
		if (event.by === 'brand') {
			open ??= event.at;
		} else if (open) {
			asks.push(
				event.by === 'creator'
					? { askedAt: open, answeredAt: event.at }
					: { askedAt: open, answeredAt: null, withdrawnAt: event.at }
			);
			open = null;
		}
	}

	if (open) asks.push({ askedAt: open, answeredAt: null });
	return asks;
}

export type Responsiveness = {
	/** 0–100, or null with fewer than `MIN_ASKS` decided asks. */
	rate: number | null;
	/** How many asks the rate is over. */
	sample: number;
	/** Median time to any answer, late ones included. Null with none answered. */
	medianMinutes: number | null;
};

/**
 * The share of asks answered within `ANSWER_WINDOW_MS`.
 *
 * Left out, because the creator has not failed at anything yet: an unanswered
 * ask whose window is still open, and one the brand withdrew inside the window.
 * A withdrawal after the window had already run out is still a missed ask. A
 * late answer counts against the rate but still goes into the median, because
 * it happened.
 */
export function measureResponsiveness(asks: Ask[], now: Date): Responsiveness {
	const since = now.getTime() - RESPONSE_LOOKBACK_MS;
	let decided = 0;
	let inTime = 0;
	const durations: number[] = [];

	for (const ask of asks) {
		const askedAt = ask.askedAt.getTime();
		if (askedAt < since || askedAt > now.getTime()) continue;

		if (ask.answeredAt) {
			const took = ask.answeredAt.getTime() - askedAt;
			durations.push(took);
			decided++;
			if (took <= ANSWER_WINDOW_MS) inTime++;
			continue;
		}

		const waitedUntil = ask.withdrawnAt ? ask.withdrawnAt.getTime() : now.getTime();
		if (waitedUntil - askedAt > ANSWER_WINDOW_MS) decided++;
	}

	return {
		rate: decided >= MIN_ASKS ? Math.round((inTime / decided) * 100) : null,
		sample: decided,
		medianMinutes: durations.length ? Math.round(median(durations) / 60_000) : null
	};
}

/* ------------------------------------------------------------------ *
 * Delivery
 * ------------------------------------------------------------------ */

/** Statuses in which the work is agreed and not yet handed in. */
const AWAITING_DELIVERY = new Set(['booked', 'in_production']);

export type Deadline = {
	/** `YYYY-MM-DD`, as `bookings.deadline` stores it. */
	deadline: string | null;
	/** When the creator first handed something in, if they have. */
	firstSubmittedAt: Date | null;
	status: string;
};

export type Delivery = {
	/** 0–100, or null with fewer than `MIN_DELIVERIES` decided deadlines. */
	rate: number | null;
	sample: number;
};

/**
 * The end of a deadline day.
 *
 * The column is a date with no zone. Reading it as the end of that day in UTC
 * is lenient by up to three hours for East Africa, which is the right way round
 * for a figure that counts against someone.
 */
function endOfDeadline(deadline: string): number | null {
	const start = Date.parse(`${deadline}T00:00:00Z`);
	return Number.isNaN(start) ? null : start + DAY;
}

/**
 * The share of deadlines met by a first submission.
 *
 * A booking counts when it had a deadline and either something was handed in,
 * or the deadline passed while the work was still owed. Cancelled deals, deals
 * still being negotiated, and deals that finished with no submission on record
 * — a barter settled on the parties' word — say nothing about timeliness and
 * are left out.
 */
export function measureDelivery(deadlines: Deadline[], now: Date): Delivery {
	const since = now.getTime() - DELIVERY_LOOKBACK_MS;
	let decided = 0;
	let onTime = 0;

	for (const item of deadlines) {
		if (!item.deadline) continue;
		const due = endOfDeadline(item.deadline);
		if (due === null || due < since) continue;

		if (item.firstSubmittedAt) {
			decided++;
			if (item.firstSubmittedAt.getTime() <= due) onTime++;
		} else if (AWAITING_DELIVERY.has(item.status) && now.getTime() > due) {
			decided++;
		}
	}

	return {
		rate: decided >= MIN_DELIVERIES ? Math.round((onTime / decided) * 100) : null,
		sample: decided
	};
}

function median(values: number[]): number {
	const sorted = [...values].sort((a, b) => a - b);
	const middle = Math.floor(sorted.length / 2);
	return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}
