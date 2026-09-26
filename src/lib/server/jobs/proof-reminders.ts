import { and, eq, inArray, isNull } from 'drizzle-orm';
import { db } from '$lib/server/db';
import * as t from '$lib/server/db/schema';
import { notify } from '$lib/server/notify';
import { dueCheckpoints } from '$lib/domain/proof';
import * as m from '$lib/paraglide/messages';
import { outOfTime, type JobOptions, type JobResult } from './types';

/**
 * Asks creators for a live post's figures when a checkpoint falls due.
 *
 * Each checkpoint is asked for once — `post_proofs.reminded_checkpoints`
 * remembers — and a checkpoint already recorded is never asked for. Hourly
 * is often enough: the earliest one opens a day after posting.
 */
export async function runProofReminders(options: JobOptions = {}): Promise<JobResult> {
	const { write = false, budgetMs } = options;
	const startedAt = Date.now();

	const proofs = await db
		.select({
			id: t.postProofs.id,
			bookingId: t.postProofs.bookingId,
			postedAt: t.postProofs.postedAt,
			reminded: t.postProofs.remindedCheckpoints,
			title: t.bookings.title,
			creatorUserId: t.creators.userId
		})
		.from(t.postProofs)
		.innerJoin(t.bookings, eq(t.bookings.id, t.postProofs.bookingId))
		.innerJoin(t.creators, eq(t.creators.id, t.bookings.creatorId))
		.where(
			and(
				isNull(t.postProofs.deletedAt),
				inArray(t.bookings.status, ['awaiting_settlement', 'completed', 'disputed'])
			)
		);
	if (!proofs.length)
		return { examined: 0, changed: 0, stoppedEarly: false, note: 'no live posts' };

	const recorded = await db
		.select({ proofId: t.proofMetrics.proofId, checkpoint: t.proofMetrics.checkpoint })
		.from(t.proofMetrics)
		.where(
			inArray(
				t.proofMetrics.proofId,
				proofs.map((proof) => proof.id)
			)
		);

	let examined = 0;
	let changed = 0;
	let stoppedEarly = false;

	for (const proof of proofs) {
		if (outOfTime(startedAt, budgetMs)) {
			stoppedEarly = true;
			break;
		}
		examined++;

		const reminded = Array.isArray(proof.reminded)
			? proof.reminded
			: (JSON.parse(String(proof.reminded ?? '[]')) as string[]);
		const done = recorded.filter((row) => row.proofId === proof.id).map((row) => row.checkpoint);
		const due = dueCheckpoints(proof.postedAt, [...done, ...reminded]);
		if (!due.length) continue;

		if (write) {
			await notify(proof.creatorUserId, {
				category: 'deals',
				kind: 'booking',
				title: m.notif_metrics_due_title({ checkpoint: due.join(', ') }),
				body: m.notif_metrics_due_body({ title: proof.title }),
				link: `/dashboard/bookings/${proof.bookingId}`,
				actionLabel: m.mail_open_booking(),
				footnote: m.mail_prefs_footnote()
			});
			await db
				.update(t.postProofs)
				.set({ remindedCheckpoints: [...reminded, ...due] })
				.where(eq(t.postProofs.id, proof.id));
		}
		changed++;
	}

	return {
		examined,
		changed,
		stoppedEarly,
		note: write ? `reminded ${changed} creator(s)` : `${changed} reminder(s) due; rehearsal`
	};
}
