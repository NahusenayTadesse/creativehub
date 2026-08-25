import * as m from '$lib/paraglide/messages';
import { fail, redirect } from '@sveltejs/kit';
import { superValidate, message } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { and, eq, isNull } from 'drizzle-orm';
import type { PageServerLoad, Actions } from './$types';
import { db, insertedId } from '$lib/server/db';
import * as t from '$lib/server/db/schema';
import {
	findClaimCandidates,
	getClaimableByUsername,
	getLastClaimDecisionFor,
	getOpenClaimFor
} from '$lib/server/queries';
import { requireRole, getCreatorFor, recordAudit } from '$lib/server/guards';
import { canDecideClaim } from '$lib/domain/claim';
import type { ClaimStatus } from '$lib/domain/claim';
import { claimRequest, claimWithdraw } from '$lib/schemas';

/**
 * Taking over a profile that was imported before the creator arrived.
 *
 * The page never grants anything. It collects a request, shows what is already
 * in flight, and hands the decision to /dashboard/admin/claims — the same shape
 * as verification, for the same reason: an imported profile carries somebody's
 * audience figures and any deals opened against it.
 */
export const load: PageServerLoad = async (event) => {
	const user = requireRole(event, 'creator', 'admin');

	/* One profile per account, so an account that has one has nothing to claim. */
	if (await getCreatorFor(user.id)) redirect(303, '/dashboard/profile');

	const open = await getOpenClaimFor(user.id);
	const wanted = event.url.searchParams.get('username');

	const [candidates, lastRejected, target, form] = await Promise.all([
		/* Neither list is worth a query while a claim is already waiting. */
		open ? [] : findClaimCandidates({ name: user.name, email: user.email }),
		open ? undefined : getLastClaimDecisionFor(user.id),
		open || !wanted ? undefined : getClaimableByUsername(wanted),
		superValidate(zod4(claimRequest))
	]);

	return {
		open: open ?? null,
		candidates,
		lastRejected: lastRejected ?? null,
		target: target ?? null,
		form
	};
};

export const actions: Actions = {
	claim: async (event) => {
		const user = requireRole(event, 'creator', 'admin');
		const form = await superValidate(event.request, zod4(claimRequest));

		if (await getCreatorFor(user.id)) redirect(303, '/dashboard/profile');
		if (!form.valid) {
			return message(form, { type: 'error', text: m.srv_check_form() }, { status: 400 });
		}

		/*
		 * One open claim per account. Without it a single sign-up can put every
		 * imported profile it likes the look of into the queue, and "withdraw"
		 * stops having an unambiguous subject.
		 */
		if (await getOpenClaimFor(user.id)) {
			return message(form, { type: 'error', text: m.srv_already_claiming() }, { status: 409 });
		}

		/*
		 * The id arrives from the form, so the row it names is re-checked here
		 * rather than trusted: a profile that has been claimed, unpublished or
		 * deleted since the page rendered is not open to a claim.
		 */
		const rows = await db
			.select()
			.from(t.creators)
			.where(
				and(
					eq(t.creators.id, form.data.creatorId),
					isNull(t.creators.userId),
					eq(t.creators.isClaimed, false),
					eq(t.creators.isPublished, true),
					eq(t.creators.isActive, true),
					isNull(t.creators.deletedAt)
				)
			)
			.limit(1);
		const creator = rows.at(0);
		if (!creator) {
			return message(form, { type: 'error', text: m.srv_profile_not_claimable() }, { status: 400 });
		}

		const inserted = await db.insert(t.creatorClaims).values({
			creatorId: creator.id,
			claimantId: user.id,
			status: 'pending',
			evidence: form.data.evidence,
			proofUrl: form.data.proofUrl || null,
			createdBy: user.id
		});

		await recordAudit({
			actorId: user.id,
			actorLabel: user.name,
			entity: 'claim',
			/* The claim, not the creator: every other line under this entity is a
			   claim id, and one entity name spanning two id spaces makes the log
			   unreadable exactly when somebody is trying to reconstruct a dispute. */
			entityId: insertedId(inserted),
			action: 'requested',
			toState: 'pending',
			reason: form.data.evidence
		});

		return message(form, { type: 'success', text: m.cl_sent_toast() });
	},

	withdraw: async (event) => {
		const user = requireRole(event, 'creator', 'admin');
		const form = await superValidate(event.request, zod4(claimWithdraw));
		if (!form.valid) return fail(400, { message: m.srv_invalid_request() });

		const rows = await db
			.select()
			.from(t.creatorClaims)
			.where(eq(t.creatorClaims.id, form.data.id))
			.limit(1);
		const claim = rows.at(0);
		if (!claim) return fail(404, { message: m.srv_claim_not_found() });
		/* Ownership is checked on the record, never taken from the form. */
		if (claim.claimantId !== user.id) return fail(403, { message: m.srv_claim_not_yours() });

		const from = claim.status as ClaimStatus;
		if (!canDecideClaim(from, 'withdrawn')) {
			return fail(409, { message: m.srv_bad_claim() });
		}

		await db
			.update(t.creatorClaims)
			.set({ status: 'withdrawn', updatedBy: user.id })
			.where(eq(t.creatorClaims.id, claim.id));

		await recordAudit({
			actorId: user.id,
			actorLabel: user.name,
			entity: 'claim',
			entityId: claim.id,
			action: 'withdrawn',
			fromState: from,
			toState: 'withdrawn'
		});

		return { withdrawn: true };
	}
};
