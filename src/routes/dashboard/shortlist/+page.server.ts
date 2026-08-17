import { fail } from '@sveltejs/kit';
import { and, desc, eq } from 'drizzle-orm';
import type { PageServerLoad, Actions } from './$types';
import { db } from '$lib/server/db';
import * as t from '$lib/server/db/schema';
import { requireOrganization } from '$lib/server/guards';

export const load: PageServerLoad = async (event) => {
	const { organization } = await requireOrganization(event);

	const saved = await db
		.select({
			id: t.savedCreators.id,
			note: t.savedCreators.note,
			createdAt: t.savedCreators.createdAt,
			creatorId: t.creators.id,
			username: t.creators.username,
			fullName: t.creators.fullName,
			avatar: t.creators.avatar,
			bio: t.creators.bio,
			city: t.creators.city,
			score: t.creators.score,
			totalReach: t.creators.totalReach,
			startingPrice: t.creators.startingPrice,
			currencyCode: t.creators.currencyCode,
			averageRating: t.creators.averageRating,
			verificationLevel: t.creators.verificationLevel,
			countryFlag: t.countries.flag,
			countryName: t.countries.name,
			platformName: t.platforms.name
		})
		.from(t.savedCreators)
		.innerJoin(t.creators, eq(t.creators.id, t.savedCreators.creatorId))
		.leftJoin(t.countries, eq(t.countries.id, t.creators.countryId))
		.leftJoin(t.platforms, eq(t.platforms.id, t.creators.primaryPlatformId))
		.where(eq(t.savedCreators.organizationId, organization.id))
		.orderBy(desc(t.savedCreators.createdAt));

	return { saved };
};

export const actions: Actions = {
	remove: async (event) => {
		const { organization } = await requireOrganization(event);
		const form = await event.request.formData();
		const creatorId = Number(form.get('creatorId'));
		if (!creatorId) return fail(400, { message: 'Unknown creator' });

		await db
			.delete(t.savedCreators)
			.where(
				and(
					eq(t.savedCreators.organizationId, organization.id),
					eq(t.savedCreators.creatorId, creatorId)
				)
			);

		return { removed: true };
	}
};
