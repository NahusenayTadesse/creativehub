import * as m from '$lib/paraglide/messages';
import { superValidate, message } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { eq } from 'drizzle-orm';
import type { PageServerLoad, Actions } from './$types';
import { db } from '$lib/server/db';
import * as t from '$lib/server/db/schema';
import { requireRole, recordAudit } from '$lib/server/guards';
import { landingSchema } from '$lib/schemas';
import {
	forgetSettings,
	getSettings,
	listGallerySlides,
	listHeroSlides
} from '$lib/server/queries';
import { SECTION_VISIBILITY_FIELD, landingLayout } from '$lib/domain/landing';

/**
 * The landing page's words, pictures and running order.
 *
 * Kept apart from site settings because the two are edited by different
 * questions: settings is "how does the platform charge and who answers the
 * phone", this is "what does a visitor see first". Both write `site_settings`.
 */

export const load: PageServerLoad = async (event) => {
	requireRole(event, 'admin');
	const [settings, slides, heroSlides] = await Promise.all([
		getSettings(),
		listGallerySlides(),
		listHeroSlides()
	]);
	const layout = landingLayout(settings?.landingSections);

	const form = await superValidate(zod4(landingSchema));
	Object.assign(form.data, {
		heroTitle: settings?.heroTitle ?? '',
		heroAccent: settings?.heroAccent ?? '',
		heroTitleEnd: settings?.heroTitleEnd ?? '',
		heroSubtitle: settings?.heroSubtitle ?? '',
		galleryIntervalSeconds: settings?.galleryIntervalSeconds ?? 6,
		heroIntervalSeconds: settings?.heroIntervalSeconds ?? 6,
		socialInstagramUrl: settings?.socialInstagramUrl ?? '',
		socialInstagramFollowers: settings?.socialInstagramFollowers ?? undefined,
		socialTiktokUrl: settings?.socialTiktokUrl ?? '',
		socialTiktokFollowers: settings?.socialTiktokFollowers ?? undefined,
		socialFacebookUrl: settings?.socialFacebookUrl ?? '',
		socialFacebookFollowers: settings?.socialFacebookFollowers ?? undefined,
		socialYoutubeUrl: settings?.socialYoutubeUrl ?? '',
		socialYoutubeFollowers: settings?.socialYoutubeFollowers ?? undefined,
		sectionOrder: layout.map((section) => section.key),
		...Object.fromEntries(
			layout.map((section) => [SECTION_VISIBILITY_FIELD[section.key], section.visible])
		)
	});
	return { form, slideCount: slides.length, heroSlideCount: heroSlides.length };
};

export const actions: Actions = {
	save: async (event) => {
		const user = requireRole(event, 'admin');
		const form = await superValidate(event.request, zod4(landingSchema));
		if (!form.valid) {
			return message(form, { type: 'error', text: m.srv_check_form() }, { status: 400 });
		}

		const { sectionOrder, ...rest } = form.data;

		/* Order from the hidden fields, visibility from the checkboxes, and then
		   through `landingLayout` so a tampered or partial post still stores
		   every section exactly once. */
		const landingSections = landingLayout(
			sectionOrder.map((key) => ({ key, visible: rest[SECTION_VISIBILITY_FIELD[key]] }))
		);

		const row = {
			heroTitle: rest.heroTitle,
			heroAccent: rest.heroAccent,
			heroTitleEnd: rest.heroTitleEnd,
			/* Null rather than empty, so "use the translated subtitle" has one spelling. */
			heroSubtitle: rest.heroSubtitle || null,
			galleryIntervalSeconds: rest.galleryIntervalSeconds,
			heroIntervalSeconds: rest.heroIntervalSeconds,
			landingSections,
			/* A blank count is "not stated", which is null — never a zero shown
			   under a platform the site plainly has followers on. */
			socialInstagramUrl: rest.socialInstagramUrl,
			socialInstagramFollowers: rest.socialInstagramFollowers ?? null,
			socialTiktokUrl: rest.socialTiktokUrl,
			socialTiktokFollowers: rest.socialTiktokFollowers ?? null,
			socialFacebookUrl: rest.socialFacebookUrl,
			socialFacebookFollowers: rest.socialFacebookFollowers ?? null,
			socialYoutubeUrl: rest.socialYoutubeUrl,
			socialYoutubeFollowers: rest.socialYoutubeFollowers ?? null
		};

		const existing = await getSettings();
		if (existing) {
			await db
				.update(t.siteSettings)
				.set({ ...row, updatedBy: user.id })
				.where(eq(t.siteSettings.id, existing.id));
		} else {
			await db.insert(t.siteSettings).values({ ...row, createdBy: user.id });
		}
		forgetSettings();

		const hidden = landingSections.filter((section) => !section.visible).map((s) => s.key);
		await recordAudit({
			actorId: user.id,
			actorLabel: user.name,
			entity: 'settings',
			action: 'updated',
			reason: [
				`Landing order ${landingSections.map((section) => section.key).join(' → ')}`,
				hidden.length ? `hidden ${hidden.join(', ')}` : null
			]
				.filter(Boolean)
				.join('; ')
		});

		return message(form, { type: 'success', text: m.lp_saved() });
	}
};
