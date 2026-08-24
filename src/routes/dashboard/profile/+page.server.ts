import * as m from '$lib/paraglide/messages';
import { fail } from '@sveltejs/kit';
import { superValidate, message } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { PageServerLoad, Actions } from './$types';
import { db } from '$lib/server/db';
import * as t from '$lib/server/db/schema';
import { requireCreator, recordAudit } from '$lib/server/guards';
import { saveUploadedFile } from '$lib/server/upload';
import { uploadErrorText } from '$lib/server/crud';
import { creatorSelfEdit } from '$lib/schemas';
import { getReferenceData } from '$lib/server/queries';
import { refreshCreatorScore } from '$lib/server/score-service';
import { liveSocialFilter } from '$lib/server/db/rollups';

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
				.where(and(eq(t.socialAccounts.creatorId, creator.id), liveSocialFilter()))
		])
	]);

	const form = await superValidate(zod4(creatorSelfEdit));
	Object.assign(form.data, {
		id: creator.id,
		fullName: creator.fullName,
		bio: creator.bio ?? '',
		/* The two pickers stay empty: the stored files are previewed beside them
		   rather than prefilled into them, and an empty picker posts as "keep". */
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
			return message(form, { type: 'error', text: m.srv_check_form() }, { status: 400 });
		}

		/*
		 * A picture only moves when a new file was actually picked. An empty
		 * picker leaves the column alone, which is what lets a creator edit their
		 * city without losing the avatar they uploaded last week.
		 */
		let pictures: { avatar?: string; cover?: string };
		try {
			pictures = Object.fromEntries(
				await Promise.all(
					(['avatar', 'cover'] as const)
						.map((field) => [field, form.data[field]] as const)
						.filter(([, value]) => value instanceof File && value.size > 0)
						.map(async ([field, value]) => [field, await saveUploadedFile(value as File)])
				)
			);
		} catch (error) {
			/* A rejected type or an oversized file is the creator's mistake to fix,
			   not a 500. `uploadErrorText` is what the managed tables answer with,
			   so the wording is the same wherever an upload is refused. */
			const text = uploadErrorText(error);
			if (!text) throw error;
			return message(form, { type: 'error', text }, { status: 400 });
		}

		/*
		 * Only ids that actually exist. `categoryIds` and `languageIds` arrive as
		 * bare numbers from the client, and one bad id used to raise a foreign-key
		 * error partway through the loop below — after the delete had already run,
		 * leaving the creator with a half-wiped list.
		 */
		const [validCategories, validLanguages] = await Promise.all([
			form.data.categoryIds.length
				? db
						.select({ id: t.categories.id })
						.from(t.categories)
						.where(inArray(t.categories.id, form.data.categoryIds))
				: [],
			form.data.languageIds.length
				? db
						.select({ id: t.languages.id })
						.from(t.languages)
						.where(inArray(t.languages.id, form.data.languageIds))
				: []
		]);

		/*
		 * One transaction: the profile row, its categories and its languages move
		 * together or not at all. Delete-then-insert across three statements with
		 * no transaction could leave the lists empty if a later one failed.
		 */
		await db.transaction(async (tx) => {
			await tx
				.update(t.creators)
				.set({
					fullName: form.data.fullName,
					bio: form.data.bio,
					...pictures,
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

			await tx.delete(t.creatorCategories).where(eq(t.creatorCategories.creatorId, creator.id));
			if (validCategories.length) {
				/* One statement rather than one round trip per row. */
				await tx
					.insert(t.creatorCategories)
					.values(validCategories.map((c) => ({ creatorId: creator.id, categoryId: c.id })));
			}

			await tx.delete(t.creatorLanguages).where(eq(t.creatorLanguages.creatorId, creator.id));
			if (validLanguages.length) {
				await tx
					.insert(t.creatorLanguages)
					.values(validLanguages.map((l) => ({ creatorId: creator.id, languageId: l.id })));
			}
		});

		await refreshCreatorScore(creator.id);
		await recordAudit({
			actorId: user.id,
			actorLabel: creator.fullName,
			entity: 'creator',
			entityId: creator.id,
			action: 'profile_updated'
		});

		return message(form, { type: 'success', text: m.srv_profile_updated() });
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
					/* Deleted channels used to satisfy this gate, so a creator could
					   publish with no live channel at all (PRD FR-014). */
					.where(and(eq(t.socialAccounts.creatorId, creator.id), liveSocialFilter())),
				db
					.select({ n: sql<number>`count(*)` })
					.from(t.packages)
					.where(and(eq(t.packages.creatorId, creator.id), isNull(t.packages.deletedAt)))
			]);

			const missing: string[] = [];
			/* These are interpolated into a translated sentence, so they are
			   translated too — English fragments inside an Amharic message read
			   as a bug to the person being asked to fix their profile. */
			if (!creator.bio || creator.bio.length < 20) missing.push(m.pub_needs_bio());
			if (Number(channels[0]?.n ?? 0) === 0) missing.push(m.pub_needs_channel());
			if (Number(packages[0]?.n ?? 0) === 0) missing.push(m.pub_needs_package());

			if (missing.length) {
				return fail(400, { message: m.srv_add_before_publishing({ missing: missing.join(', ') }) });
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
