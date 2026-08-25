import * as m from '$lib/paraglide/messages';
import { fail } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { and, eq, isNull, ne } from 'drizzle-orm';
import type { PageServerLoad, Actions } from './$types';
import { db } from '$lib/server/db';
import * as t from '$lib/server/db/schema';
import { claimsQuery } from '$lib/server/queries';
import { requireRole, getCreatorFor, recordAudit } from '$lib/server/guards';
import { canDecideClaim } from '$lib/domain/claim';
import type { ClaimStatus } from '$lib/domain/claim';
import { claimDecision } from '$lib/schemas';

/**
 * People asking for a profile that was imported before they arrived.
 *
 * Approval is the only write in the product that attaches an account to an
 * existing creator row, and it hands over audience figures, a score and any
 * deals already opened against the profile. It is checked by a person for the
 * same reason verification is.
 */
export const load: PageServerLoad = async ({ url }) => {
	/*
	 * A queue opens on what is waiting. `?status=all` is not in the column's
	 * vocabulary, so it drops out of the filter and every claim shows — which
	 * is what the "all" tab means.
	 */
	const chosen = url.searchParams.get('status');
	const scope = chosen ? [] : [eq(t.creatorClaims.status, 'pending')];

	const [claims, statusCounts, form] = await Promise.all([
		claimsQuery.run(url, { where: scope }),
		claimsQuery.facet(url, 'status'),
		superValidate(zod4(claimDecision))
	]);

	return { claims, statusCounts, form };
};

export const actions: Actions = {
	decide: async (event) => {
		const user = requireRole(event, 'admin');
		const form = await superValidate(event.request, zod4(claimDecision));
		if (!form.valid) return fail(400, { message: m.srv_invalid_request() });

		const rows = await db
			.select()
			.from(t.creatorClaims)
			.where(eq(t.creatorClaims.id, form.data.id))
			.limit(1);
		const claim = rows.at(0);
		if (!claim) return fail(404, { message: m.srv_claim_not_found() });

		/* The client requests an outcome and never asserts one. */
		const from = claim.status as ClaimStatus;
		if (!canDecideClaim(from, form.data.status)) {
			return fail(409, { message: m.srv_bad_claim() });
		}
		/* Turning somebody down has to say why — they are shown this note. */
		if (form.data.status === 'rejected' && !form.data.adminNotes.trim()) {
			return fail(400, { message: m.srv_need_claim_reason() });
		}

		if (form.data.status === 'approved') {
			/*
			 * Both sides are re-read at the moment of the write, not taken from
			 * the row the page rendered: another operator may have approved a
			 * rival claim, and the claimant may have created a profile of their
			 * own since asking. `creators.userId` is uniquely indexed, so the
			 * second case would otherwise surface as a driver error.
			 */
			const targets = await db
				.select()
				.from(t.creators)
				.where(
					and(
						eq(t.creators.id, claim.creatorId),
						isNull(t.creators.userId),
						eq(t.creators.isClaimed, false),
						isNull(t.creators.deletedAt)
					)
				)
				.limit(1);
			if (!targets.length) return fail(409, { message: m.srv_claim_taken() });
			if (await getCreatorFor(claim.claimantId)) {
				return fail(409, { message: m.srv_claim_taken() });
			}

			await db
				.update(t.creators)
				.set({ userId: claim.claimantId, isClaimed: true, updatedBy: user.id })
				.where(eq(t.creators.id, claim.creatorId));
		}

		await db
			.update(t.creatorClaims)
			.set({
				status: form.data.status,
				adminNotes: form.data.adminNotes || null,
				reviewedBy: user.id,
				reviewedAt: new Date(),
				updatedBy: user.id
			})
			.where(eq(t.creatorClaims.id, claim.id));

		await recordAudit({
			actorId: user.id,
			actorLabel: user.name,
			entity: 'claim',
			entityId: claim.id,
			action: 'decision',
			fromState: from,
			toState: form.data.status,
			reason: form.data.adminNotes || undefined
		});

		/*
		 * A profile can only be handed over once, so every other claim on it is
		 * now unanswerable. Leaving them waiting would keep offering an operator
		 * a decision they can no longer make, so they are closed here — each
		 * with its own note and its own audit line, rather than silently.
		 */
		if (form.data.status === 'approved') {
			const rivals = await db
				.select({ id: t.creatorClaims.id })
				.from(t.creatorClaims)
				.where(
					and(
						eq(t.creatorClaims.creatorId, claim.creatorId),
						eq(t.creatorClaims.status, 'pending'),
						ne(t.creatorClaims.id, claim.id)
					)
				);

			for (const rival of rivals) {
				await db
					.update(t.creatorClaims)
					.set({
						status: 'rejected',
						adminNotes: m.acl_taken_help(),
						reviewedBy: user.id,
						reviewedAt: new Date(),
						updatedBy: user.id
					})
					.where(eq(t.creatorClaims.id, rival.id));

				await recordAudit({
					actorId: user.id,
					actorLabel: user.name,
					entity: 'claim',
					entityId: rival.id,
					action: 'decision',
					fromState: 'pending',
					toState: 'rejected',
					reason: m.acl_taken_help()
				});
			}
		}

		return { decided: form.data.status };
	}
};
