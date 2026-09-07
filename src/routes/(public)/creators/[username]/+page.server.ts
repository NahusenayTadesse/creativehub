import * as m from '$lib/paraglide/messages';
import { error, redirect } from '@sveltejs/kit';
import { superValidate, message } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { and, eq, isNull } from 'drizzle-orm';
import type { PageServerLoad, Actions } from './$types';
import { db, insertedId } from '$lib/server/db';
import * as t from '$lib/server/db/schema';
import { notify } from '$lib/server/notify';
import { getCreatorByUsername, getSettings } from '$lib/server/queries';
import { getOrganizationFor, recordAudit } from '$lib/server/guards';
import { bookingCreate } from '$lib/schemas';
import { bookingReference, splitFee } from '$lib/domain/booking';

export const load: PageServerLoad = async ({ params, locals }) => {
	const creator = await getCreatorByUsername(params.username);
	if (!creator) error(404, m.srv_creator_not_found());

	/* Unpublished profiles are visible only to their owner and to operators. */
	const isOwner = locals.user?.id && creator.userId === locals.user.id;
	const isAdmin = (locals.user as { role?: string })?.role === 'admin';
	if (!creator.isPublished && !isOwner && !isAdmin) {
		error(404, m.srv_creator_not_published());
	}

	const organization = locals.user ? await getOrganizationFor(locals.user.id) : undefined;

	return {
		creator: publicView(creator),
		canBook: Boolean(organization),
		organizationName: organization?.name ?? null,
		bookingForm: await superValidate(zod4(bookingCreate))
	};
};

/**
 * The profile as the page draws it, and nothing besides.
 *
 * `getCreatorByUsername` hands back the whole row plus whole rows for the
 * country, region and platform it joins — which is what the checks above want,
 * and far more than a reader wants. Everything a `load` returns is serialised
 * into the HTML of a public page, so the difference between the row and this
 * projection was being published on every profile: the account id behind a
 * claimed profile, who imported it and when, whether it is flagged as trending
 * or featured, the operator ids on every audit column, the currency's USD rate.
 *
 * None of that was ever rendered. It was simply there, in the markup, for
 * anybody who thought to read past the parts that look like a page — which,
 * for a scraper, is the first thing you do and the cheapest thing you find.
 *
 * The rule this encodes: a public loader returns the fields its template names,
 * chosen deliberately, rather than a row minus whatever somebody remembered to
 * remove. Adding a column to `creators` should not silently publish it.
 */
function publicView(creator: NonNullable<Awaited<ReturnType<typeof getCreatorByUsername>>>) {
	return {
		id: creator.id,
		username: creator.username,
		fullName: creator.fullName,
		avatar: creator.avatar,
		cover: creator.cover,
		bio: creator.bio,
		city: creator.city,
		totalReach: creator.totalReach,
		startingPrice: creator.startingPrice,
		currencyCode: creator.currencyCode,
		score: creator.score,
		verificationLevel: creator.verificationLevel,
		availability: creator.availability,
		reviewsCount: creator.reviewsCount,
		averageRating: creator.averageRating,
		completedBookings: creator.completedBookings,
		/* Whether anyone is on the other side of a booking. The badge says so. */
		isClaimed: creator.isClaimed,
		country: creator.country && { name: creator.country.name, flag: creator.country.flag },
		region: creator.region && { name: creator.region.name },
		platform: creator.platform && { name: creator.platform.name },
		categories: creator.categories,
		languages: creator.languages,
		socialAccounts: creator.socialAccounts,
		packages: creator.packages,
		portfolio: creator.portfolio,
		reviews: creator.reviews,
		ratingBreakdown: creator.ratingBreakdown
	};
}

export const actions: Actions = {
	/**
	 * Opens a direct booking. It starts at `proposed` and carries no frozen
	 * terms — the snapshot is written only when both sides accept a proposal.
	 */
	book: async (event) => {
		if (!event.locals.user) redirect(303, `/login?next=${event.url.pathname}`);

		const organization = await getOrganizationFor(event.locals.user.id);
		const form = await superValidate(event.request, zod4(bookingCreate));

		if (!organization) {
			return message(form, { type: 'error', text: m.srv_brands_only_book() }, { status: 403 });
		}
		if (!form.valid) {
			return message(form, { type: 'error', text: m.srv_check_form() }, { status: 400 });
		}

		/*
		 * The id comes from the form, so the row it names has to be one that is
		 * actually open to bookings — this used to accept any id at all, including
		 * a soft-deleted or never-published profile.
		 */
		const creatorRows = await db
			.select()
			.from(t.creators)
			.where(
				and(
					eq(t.creators.id, form.data.creatorId),
					eq(t.creators.isPublished, true),
					eq(t.creators.isActive, true),
					isNull(t.creators.deletedAt)
				)
			)
			.limit(1);
		const creator = creatorRows.at(0);
		if (!creator) {
			return message(form, { type: 'error', text: m.srv_unknown_creator() }, { status: 400 });
		}

		/*
		 * Nobody is behind an unclaimed profile. The deal is still written — the
		 * brand's intent is real and losing it helps no one — but it opens as a
		 * lead an operator has to chase rather than a negotiation the creator
		 * can answer, and both the queue and the brand's own page say so.
		 */
		const needsIntroduction = !creator.isClaimed && creator.userId === null;

		const settings = await getSettings();
		const { platformFee, creatorPayout } = splitFee(
			form.data.price,
			settings?.platformFeePercent ?? 15
		);

		const deliverables = form.data.deliverables
			.split('\n')
			.map((line) => line.trim())
			.filter(Boolean);

		try {
			const result = await db.insert(t.bookings).values({
				reference: bookingReference(),
				creatorId: creator.id,
				organizationId: organization.id,
				packageId: form.data.packageId ?? null,
				campaignId: form.data.campaignId ?? null,
				title: form.data.title,
				deliverables,
				compensationType: form.data.compensationType,
				price: form.data.price,
				currencyCode: form.data.currencyCode,
				platformFee,
				creatorPayout,
				status: 'proposed',
				escrowStatus: 'unfunded',
				introductionStatus: needsIntroduction ? 'pending' : 'none',
				deadline: form.data.deadline || null,
				revisionsAllowed: form.data.revisionsAllowed,
				createdBy: event.locals.user.id
			});

			const bookingId = insertedId(result);

			/* The opening offer is the first link in the negotiation chain. */
			await db.insert(t.termProposals).values({
				bookingId,
				proposedBy: 'organization',
				price: form.data.price,
				currencyCode: form.data.currencyCode,
				deliverables,
				deadline: form.data.deadline || null,
				revisionsAllowed: form.data.revisionsAllowed,
				note: form.data.note || null,
				status: 'pending',
				createdBy: event.locals.user.id
			});

			/* An unclaimed profile has no account behind it — `notify` drops a
			   missing id rather than making every caller check for one. */
			await notify(creator.userId, {
				category: 'deals',
				kind: 'booking',
				title: m.notif_booking_request_title({ organisation: organization.name }),
				body: form.data.title,
				link: `/dashboard/bookings/${bookingId}`,
				actionLabel: m.mail_open_booking(),
				footnote: m.mail_prefs_footnote(),
				actorId: event.locals.user.id
			});

			await recordAudit({
				actorId: event.locals.user.id,
				actorLabel: organization.name,
				entity: 'booking',
				entityId: bookingId,
				action: 'created',
				toState: 'proposed',
				reason: needsIntroduction
					? 'Direct booking from creator profile — creator unclaimed, introduction queued'
					: 'Direct booking from creator profile'
			});

			redirect(303, `/dashboard/bookings/${bookingId}`);
		} catch (err) {
			if (err instanceof Response || (err as { status?: number })?.status === 303) throw err;
			console.error('Booking failed:', err);
			return message(form, { type: 'error', text: m.srv_booking_failed() }, { status: 500 });
		}
	}
};
