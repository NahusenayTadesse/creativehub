import { fail } from '@sveltejs/kit';
import { superValidate, message } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { and, eq, isNull, sql } from 'drizzle-orm';
import type { PageServerLoad, Actions } from './$types';
import { db } from '$lib/server/db';
import * as t from '$lib/server/db/schema';
import { requireCreator, recordAudit } from '$lib/server/guards';
import { creatorSelfEdit } from '$lib/schemas';
import { getReferenceData } from '$lib/server/queries';
import { refreshCreatorScore } from '$lib/server/score-service';

export const load: PageServerLoad = async (event) => {
	const { creator } = await requireCreator(event);

	const [reference, categories, languages, counts] = await Promise.all([
		getReferenceData(),
		db
			.select({ categoryId: t.creatorCategories.categoryId })
			.from(t.creatorCategories)
			.where(eq(t.creatorCategories.creatorId, creator.id)),
		db
			.select({ languageId: t.creatorLanguages.languageId })
			.from(t.creatorLanguages)
			.where(eq(t.creatorLanguages.creatorId, creator.id)),
		Promise.all([
			db
				.select({ n: sql<number>`count(*)` })
				.from(t.packages)
				.where(and(eq(t.packages.creatorId, creator.id), isNull(t.packages.deletedAt))),
			db
				.select({ n: sql<number>`count(*)` })
				.from(t.socialAccounts)
				.where(eq(t.socialAccounts.creatorId, creator.id))
		])
	]);

	const form = await superValidate(zod4(creatorSelfEdit));
	Object.assign(form.data, {
		id: creator.id,
		fullName: creator.fullName,
		bio: creator.bio ?? '',
		avatar: creator.avatar ?? '',
		cover: creator.cover ?? '',
		countryId: creator.countryId ?? undefined,
		regionId: creator.regionId ?? undefined,
		city: creator.city ?? '',
		primaryPlatformId: creator.primaryPlatformId ?? undefined,
		startingPrice: creator.startingPrice,
		currencyCode: creator.currencyCode,
		availability: creator.availability,
		categoryIds: categories.map((c) => c.categoryId),
		languageIds: languages.map((l) => l.languageId)
	});

	return {
		creator,
		reference,
		form,
		readiness: {
			packages: Number(counts[0][0]?.n ?? 0),
			channels: Number(counts[1][0]?.n ?? 0)
		}
	};
};

export const actions: Actions = {
	save: async (event) => {
		const { user, creator } = await requireCreator(event);
		const form = await superValidate(event.request, zod4(creatorSelfEdit));
		if (!form.valid) {
			return message(form, { type: 'error', text: 'Check the form for errors' }, { status: 400 });
		}

		await db
			.update(t.creators)
			.set({
				fullName: form.data.fullName,
				bio: form.data.bio,
				avatar: form.data.avatar || null,
				cover: form.data.cover || null,
				countryId: form.data.countryId ?? null,
				regionId: form.data.regionId ?? null,
				city: form.data.city,
				primaryPlatformId: form.data.primaryPlatformId ?? null,
				startingPrice: form.data.startingPrice,
				currencyCode: form.data.currencyCode,
				availability: form.data.availability,
				updatedBy: user.id
			})
			// Scoped to the signed-in creator; the posted id is never trusted alone.
			.where(eq(t.creators.id, creator.id));

		await db.delete(t.creatorCategories).where(eq(t.creatorCategories.creatorId, creator.id));
		for (const categoryId of form.data.categoryIds) {
			await db.insert(t.creatorCategories).values({ creatorId: creator.id, categoryId });
		}

		await db.delete(t.creatorLanguages).where(eq(t.creatorLanguages.creatorId, creator.id));
		for (const languageId of form.data.languageIds) {
			await db.insert(t.creatorLanguages).values({ creatorId: creator.id, languageId });
		}

		await refreshCreatorScore(creator.id);
		await recordAudit({
			actorId: user.id,
			actorLabel: creator.fullName,
			entity: 'creator',
			entityId: creator.id,
			action: 'profile_updated'
		});

		return message(form, { type: 'success', text: 'Profile updated' });
	},

	/**
	 * Publishing needs the minimum a brand has to see to make a decision:
	 * a bio, at least one channel and at least one package (PRD FR-014).
	 */
	togglePublish: async (event) => {
		const { user, creator } = await requireCreator(event);

		if (!creator.isPublished) {
			const [channels, packages] = await Promise.all([
				db
					.select({ n: sql<number>`count(*)` })
					.from(t.socialAccounts)
					.where(eq(t.socialAccounts.creatorId, creator.id)),
				db
					.select({ n: sql<number>`count(*)` })
					.from(t.packages)
					.where(and(eq(t.packages.creatorId, creator.id), isNull(t.packages.deletedAt)))
			]);

			const missing: string[] = [];
			if (!creator.bio || creator.bio.length < 20) missing.push('a bio');
			if (Number(channels[0]?.n ?? 0) === 0) missing.push('at least one channel');
			if (Number(packages[0]?.n ?? 0) === 0) missing.push('at least one package');

			if (missing.length) {
				return fail(400, { message: `Add ${missing.join(', ')} before publishing.` });
			}
		}

		await db
			.update(t.creators)
			.set({ isPublished: !creator.isPublished, updatedBy: user.id })
			.where(eq(t.creators.id, creator.id));

		await recordAudit({
			actorId: user.id,
			actorLabel: creator.fullName,
			entity: 'creator',
			entityId: creator.id,
			action: creator.isPublished ? 'unpublished' : 'published'
		});

		return { published: !creator.isPublished };
	}
};
