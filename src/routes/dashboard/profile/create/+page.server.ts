import { redirect } from '@sveltejs/kit';
import { superValidate, message } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { eq } from 'drizzle-orm';
import type { PageServerLoad, Actions } from './$types';
import { db } from '$lib/server/db';
import * as t from '$lib/server/db/schema';
import { creatorCreateProfile } from '$lib/schemas';
import { requireRole, getCreatorFor, recordAudit } from '$lib/server/guards';
import { refreshCreatorScore } from '$lib/server/score-service';
import { getReferenceData } from '$lib/server/queries';

export const load: PageServerLoad = async (event) => {
	const user = requireRole(event, 'creator', 'admin');
	const existing = await getCreatorFor(user.id);
	if (existing) redirect(303, '/dashboard/profile');

	const form = await superValidate(zod4(creatorCreateProfile));
	form.data.fullName = user.name;
	form.data.username = user.email.split('@')[0].toLowerCase().replace(/[^a-z0-9_.]/g, '');

	return { form, reference: await getReferenceData() };
};

export const actions: Actions = {
	default: async (event) => {
		const user = requireRole(event, 'creator', 'admin');
		const form = await superValidate(event.request, zod4(creatorCreateProfile));
		if (!form.valid) {
			return message(form, { type: 'error', text: 'Check the form for errors' }, { status: 400 });
		}

		const taken = await db
			.select({ id: t.creators.id })
			.from(t.creators)
			.where(eq(t.creators.username, form.data.username))
			.limit(1);

		if (taken.length) {
			return message(
				form,
				{ type: 'error', text: 'That handle is already taken. Try another.' },
				{ status: 409 }
			);
		}

		let creatorId: number;
		try {
			const result: any = await db.insert(t.creators).values({
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
			creatorId = Number(result.insertId ?? result[0]?.insertId);
		} catch (err) {
			console.error('Creator profile creation failed:', err);
			return message(
				form,
				{ type: 'error', text: 'Could not create your profile.' },
				{ status: 500 }
			);
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
