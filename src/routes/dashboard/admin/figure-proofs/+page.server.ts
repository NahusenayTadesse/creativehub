import * as m from '$lib/paraglide/messages';
import { fail } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { eq } from 'drizzle-orm';
import type { PageServerLoad, Actions } from './$types';
import { db } from '$lib/server/db';
import * as t from '$lib/server/db/schema';
import { statProofQuery } from '$lib/server/queries';
import { requireRole, recordAudit } from '$lib/server/guards';
import { notify } from '$lib/server/notify';
import { refreshCreatorReach } from '$lib/server/score-service';
import { statProofDecision } from '$lib/schemas';

export const load: PageServerLoad = async ({ url }) => {
	/* Opens on what is waiting; `?status=all` is outside the filter's vocabulary,
	   so it drops out and every proof shows — as on the verification queue. */
	const scope = url.searchParams.get('status') ? [] : [eq(t.statProofs.status, 'pending')];

	const [proofs, statusCounts, form] = await Promise.all([
		statProofQuery.run(url, { where: scope }),
		statProofQuery.facet(url, 'status'),
		superValidate(zod4(statProofDecision))
	]);

	return { proofs, statusCounts, form };
};

export const actions: Actions = {
	decide: async (event) => {
		const user = requireRole(event, 'admin');
		const form = await superValidate(event.request, zod4(statProofDecision));
		if (!form.valid) return fail(400, { message: m.srv_invalid_request() });

		const proof = (
			await db.select().from(t.statProofs).where(eq(t.statProofs.id, form.data.id)).limit(1)
		).at(0);
		if (!proof) return fail(404, { message: m.srv_case_not_found() });
		if (proof.status !== 'pending') return fail(409, { message: m.srv_case_closed() });

		/* The creator reads this note, and "rejected" alone tells them nothing to fix. */
		if (form.data.status === 'rejected' && !form.data.adminNotes.trim()) {
			return fail(400, { message: m.srv_need_reason() });
		}

		const now = new Date();

		await db
			.update(t.statProofs)
			.set({
				status: form.data.status,
				adminNotes: form.data.adminNotes || null,
				reviewedBy: user.id,
				reviewedAt: now,
				updatedBy: user.id
			})
			.where(eq(t.statProofs.id, proof.id));

		/*
		 * Approval is the only thing that moves the figures. They are written as
		 * the proof stated them, not as the channel holds them now: the operator
		 * approved what they compared against the screenshot. An engagement rate
		 * the proof did not state is left exactly as it was, source included.
		 */
		if (form.data.status === 'approved') {
			await db
				.update(t.socialAccounts)
				.set({
					followers: proof.followers,
					followersSource: 'proof',
					followersUpdatedAt: now,
					...(proof.engagementRate === null
						? {}
						: {
								engagementRate: proof.engagementRate,
								engagementSource: 'proof' as const,
								engagementUpdatedAt: now
							}),
					updatedBy: user.id
				})
				.where(eq(t.socialAccounts.id, proof.socialAccountId));

			await refreshCreatorReach(proof.creatorId);
		}

		await recordAudit({
			actorId: user.id,
			actorLabel: user.name,
			entity: 'stat_proof',
			entityId: proof.id,
			action: 'decision',
			fromState: proof.status,
			toState: form.data.status,
			reason: form.data.adminNotes || undefined
		});

		const owner = (
			await db
				.select({ userId: t.creators.userId })
				.from(t.creators)
				.where(eq(t.creators.id, proof.creatorId))
				.limit(1)
		).at(0);

		await notify(owner?.userId, {
			category: 'account',
			kind: 'stat_proof',
			title:
				form.data.status === 'approved'
					? m.notif_stat_proof_approved_title()
					: m.notif_stat_proof_rejected_title(),
			body: form.data.adminNotes || null,
			link: '/dashboard/channels',
			actionLabel: m.mail_open_channels(),
			footnote: m.mail_prefs_footnote(),
			actorId: user.id
		});

		return { decided: form.data.status };
	}
};
