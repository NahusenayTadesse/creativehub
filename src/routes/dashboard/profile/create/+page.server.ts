import * as m from '$lib/paraglide/messages';
import { redirect } from '@sveltejs/kit';
import { superValidate, message } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { eq } from 'drizzle-orm';
import type { PageServerLoad, Actions } from './$types';
import { db, insertedId } from '$lib/server/db';
import * as t from '$lib/server/db/schema';
import { creatorCreateProfile } from '$lib/schemas';
import { requireRole, getCreatorFor, recordAudit } from '$lib/server/guards';
import { refreshCreatorScore } from '$lib/server/score-service';
import { findClaimCandidates, getReferenceData } from '$lib/server/queries';

export const load: PageServerLoad = async (event) => {
	const user = requireRole(event, 'creator', 'admin');
	const existing = await getCreatorFor(user.id);
	if (existing) redirect(303, '/dashboard/profile');

	const form = await superValidate(zod4(creatorCreateProfile));
	form.data.fullName = user.name;
	form.data.username = user.email
		.split('@')[0]
		.toLowerCase()
		.replace(/[^a-z0-9_.]/g, '');

	/*
	 * Supply is imported before creators sign up, so the person filling this in
	 * may already have a page here — with their audience figures on it, and
	 * possibly with offers waiting. Offered before the form rather than after,
	 * because a second profile is not something they can undo themselves.
	 */
	const [reference, candidates] = await Promise.all([
		getReferenceData(),
		findClaimCandidates({ name: user.name, email: user.email })
	]);

	return { form, reference, candidates };
};

export const actions: Actions = {
	default: async (event) => {
		const user = requireRole(event, 'creator', 'admin');
		const form = await superValidate(event.request, zod4(creatorCreateProfile));
		if (!form.valid) {
			return message(form, { type: 'error', text: m.srv_check_form() }, { status: 400 });
		}

		/*
		 * The `load` above redirects when a profile already exists, but a `load`
		 * never runs before an action — a double-submit or a direct POST would
		 * otherwise leave this account with two profiles and no defined answer to
		 * which one it is. The unique index on `creators.userId` is the backstop.
		 */
		const already = await getCreatorFor(user.id);
		if (already) redirect(303, '/dashboard/profile');

		const taken = await db
			.select({
				id: t.creators.id,
				userId: t.creators.userId,
				isClaimed: t.creators.isClaimed,
				isPublished: t.creators.isPublished,
				deletedAt: t.creators.deletedAt
			})
			.from(t.creators)
			.where(eq(t.creators.username, form.data.username))
			.limit(1);

		const owner = taken.at(0);
		if (owner) {
			/*
			 * A handle held by a profile nobody is behind is the common case here,
			 * not a collision: it is usually this creator's own imported page, and
			 * "that handle is taken" is a dead end for the one person entitled to
			 * it. They are pointed at the claim route instead.
			 */
			const claimable =
				owner.userId === null && !owner.isClaimed && owner.isPublished && !owner.deletedAt;
			return message(
				form,
				{ type: 'error', text: claimable ? m.srv_handle_taken_claimable() : m.srv_handle_taken() },
				{ status: 409 }
			);
		}

		let creatorId: number;
		try {
			const result = await db.insert(t.creators).values({
				userId: user.id,
				username: form.data.username,
				fullName: form.data.fullName,
				bio: form.data.bio,
				countryId: form.data.countryId,
				city: form.data.city,
				primaryPlatformId: form.data.primaryPlatformId,
				startingPrice: form.data.startingPrice,
				currencyCode: form.data.currencyCode,
				isClaimed: true,
				// Profiles stay unpublished until the creator has channels and a package.
				isPublished: false,
				createdBy: user.id
			});
			creatorId = insertedId(result);
		} catch (err) {
			console.error('Creator profile creation failed:', err);
			return message(form, { type: 'error', text: m.srv_profile_create_failed() }, { status: 500 });
		}

		await refreshCreatorScore(creatorId);
		await recordAudit({
			actorId: user.id,
			actorLabel: form.data.fullName,
			entity: 'creator',
			entityId: creatorId,
			action: 'created',
			toState: 'unpublished'
		});

		redirect(303, '/dashboard/channels');
	}
};
