import * as m from '$lib/paraglide/messages';
import { fail, redirect } from '@sveltejs/kit';
import { superValidate, message } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { eq } from 'drizzle-orm';
import type { PageServerLoad, Actions } from './$types';
import { db } from '$lib/server/db';
import * as t from '$lib/server/db/schema';
import { requireRole, recordAudit } from '$lib/server/guards';
import { landingSchema } from '$lib/schemas';
import { getSettings, listGallerySlides } from '$lib/server/queries';
import { saveUploadedFile, UploadError } from '$lib/server/upload';
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
	const [settings, slides] = await Promise.all([getSettings(), listGallerySlides()]);
	const layout = landingLayout(settings?.landingSections);

	const form = await superValidate(zod4(landingSchema));
	Object.assign(form.data, {
		heroTitle: settings?.heroTitle ?? '',
		heroAccent: settings?.heroAccent ?? '',
		heroTitleEnd: settings?.heroTitleEnd ?? '',
		heroSubtitle: settings?.heroSubtitle ?? '',
		galleryIntervalSeconds: settings?.galleryIntervalSeconds ?? 6,
		sectionOrder: layout.map((section) => section.key),
		...Object.fromEntries(
			layout.map((section) => [SECTION_VISIBILITY_FIELD[section.key], section.visible])
		)
	});
	/* The stored picture is not copied into the field — see the note on logos in
	   the settings screen. The page previews it from `heroImage` instead. */

	return { form, heroImage: settings?.heroImage ?? '', slideCount: slides.length };
};

export const actions: Actions = {
	save: async (event) => {
		const user = requireRole(event, 'admin');
		const form = await superValidate(event.request, zod4(landingSchema));
		if (!form.valid) {
			return message(form, { type: 'error', text: m.srv_check_form() }, { status: 400 });
		}

		const { heroImage, sectionOrder, ...rest } = form.data;

		let image: string | undefined;
		if (heroImage instanceof File && heroImage.size > 0) {
			try {
				image = await saveUploadedFile(heroImage);
			} catch (err) {
				if (!(err instanceof UploadError)) throw err;
				const text =
					err.reason === 'too_large'
						? m.as_logo_too_large()
						: err.reason === 'bad_type'
							? m.as_logo_bad_type()
							: m.as_logo_content_mismatch();
				return message(form, { type: 'error', text }, { status: 400 });
			}
		}

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
			landingSections,
			...(image ? { heroImage: image } : {})
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

		const hidden = landingSections.filter((section) => !section.visible).map((s) => s.key);
		await recordAudit({
			actorId: user.id,
			actorLabel: user.name,
			entity: 'settings',
			action: 'updated',
			reason: [
				`Landing order ${landingSections.map((section) => section.key).join(' → ')}`,
				hidden.length ? `hidden ${hidden.join(', ')}` : null,
				image ? 'replaced hero image' : null
			]
				.filter(Boolean)
				.join('; ')
		});

		return message(form, { type: 'success', text: m.lp_saved() });
	},

	/**
	 * Takes the hero picture away, back to the plain panel.
	 *
	 * The file stays on disk, as a reset logo's does: a backup of this row may
	 * still name it, and `npm run uploads:prune` clears true orphans.
	 */
	removeHeroImage: async (event) => {
		const user = requireRole(event, 'admin');
		const existing = await getSettings();
		if (!existing) return fail(409, { message: m.srv_invalid_request() });

		await db
			.update(t.siteSettings)
			.set({ heroImage: '', updatedBy: user.id })
			.where(eq(t.siteSettings.id, existing.id));

		await recordAudit({
			actorId: user.id,
			actorLabel: user.name,
			entity: 'settings',
			action: 'updated',
			reason: 'Removed the hero image'
		});

		/* Unenhanced, so redirect rather than leave the browser on `?/removeHeroImage`. */
		redirect(303, '/dashboard/admin/landing');
	}
};
