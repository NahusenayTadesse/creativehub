import * as m from '$lib/paraglide/messages';
import { fail, redirect } from '@sveltejs/kit';
import { superValidate, message } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { eq } from 'drizzle-orm';
import type { PageServerLoad, Actions } from './$types';
import { db } from '$lib/server/db';
import * as t from '$lib/server/db/schema';
import { requireRole, recordAudit } from '$lib/server/guards';
import { settingsSchema, logoResetSchema, LOGO_SLOTS, type LogoSlot } from '$lib/schemas';
import { getSettings } from '$lib/server/queries';
import { saveUploadedFile, UploadError } from '$lib/server/upload';

export const load: PageServerLoad = async () => {
	const settings = await getSettings();
	const form = await superValidate(zod4(settingsSchema));

	if (settings) {
		Object.assign(form.data, {
			id: settings.id,
			siteName: settings.siteName,
			tagline: settings.tagline,
			heroTitle: settings.heroTitle,
			heroSubtitle: settings.heroSubtitle ?? '',
			platformFeePercent: settings.platformFeePercent,
			disputeWindowDays: settings.disputeWindowDays,
			supportEmail: settings.supportEmail ?? '',
			supportPhone: settings.supportPhone ?? ''
		});
	}

	/*
	 * The stored names are *not* copied into `form.data`.
	 *
	 * `FileUpload` takes what is already on disk as its `image` prop and the
	 * form field itself as the picker, so seeding the field with a filename
	 * would make an untouched form post that name back as a string — which the
	 * save below would then have to tell apart from a real edit. The page reads
	 * the current marks from `settings` instead.
	 */
	return { form, settings };
};

/**
 * Stores whichever of the four pickers actually holds a file.
 *
 * A slot the operator did not touch is absent from the result rather than
 * empty, so spreading this over the row leaves the stored mark alone — the same
 * rule `contentCrud` applies to every other image in the app. Clearing a slot is
 * the reset action below, never an empty picker.
 */
async function uploadedLogos(
	picked: Partial<Record<LogoSlot, string | File>>
): Promise<
	| { ok: true; logos: Partial<Record<LogoSlot, string>> }
	| { ok: false; error: 'too_large' | 'bad_type' | 'content_mismatch' }
> {
	const logos: Partial<Record<LogoSlot, string>> = {};

	for (const slot of LOGO_SLOTS) {
		const file = picked[slot];
		if (!(file instanceof File) || file.size === 0) continue;

		try {
			logos[slot] = await saveUploadedFile(file);
		} catch (err) {
			if (err instanceof UploadError) return { ok: false, error: err.reason };
			throw err;
		}
	}

	return { ok: true, logos };
}

export const actions: Actions = {
	save: async (event) => {
		const user = requireRole(event, 'admin');
		const form = await superValidate(event.request, zod4(settingsSchema));
		if (!form.valid) {
			return message(form, { type: 'error', text: m.srv_check_form() }, { status: 400 });
		}

		/* The four pickers come out by name rather than being deleted from a bag
		   of values: they are the only fields whose type is `string | File`, and
		   separating them here is what keeps the rest assignable to a row. */
		const { id, logoWordmark, logoWordmarkDark, logoMark, logoPartners, ...values } = form.data;

		const uploaded = await uploadedLogos({
			logoWordmark,
			logoWordmarkDark,
			logoMark,
			logoPartners
		});
		if (!uploaded.ok) {
			/* The three reasons `saveUploadedFile` refuses, each said plainly:
			   an operator who picked a 20MB TIFF needs to know which it was. */
			const text =
				uploaded.error === 'too_large'
					? m.as_logo_too_large()
					: uploaded.error === 'bad_type'
						? m.as_logo_bad_type()
						: m.as_logo_content_mismatch();
			return message(form, { type: 'error', text }, { status: 400 });
		}

		const { logos } = uploaded;
		const row = { ...values, ...logos };
		const existing = await getSettings();

		if (existing) {
			await db
				.update(t.siteSettings)
				.set({ ...row, updatedBy: user.id })
				.where(eq(t.siteSettings.id, existing.id));
		} else {
			await db.insert(t.siteSettings).values({ ...row, createdBy: user.id });
		}

		await recordAudit({
			actorId: user.id,
			actorLabel: user.name,
			entity: 'settings',
			action: 'updated',
			reason: Object.keys(logos).length
				? `Fee set to ${values.platformFeePercent}%; replaced ${Object.keys(logos).join(', ')}`
				: `Fee set to ${values.platformFeePercent}%`
		});

		return message(form, { type: 'success', text: m.srv_settings_saved() });
	},

	/**
	 * Puts one brand slot back to the mark that ships with the app.
	 *
	 * The column is emptied rather than filled with the default path, because
	 * empty is what `resolveLogos` reads as "use the shipped one" — writing
	 * `/brand/wordmark.webp` into the row would pin this install to today's
	 * filename and quietly survive the next time that asset is rebuilt.
	 *
	 * The uploaded file is left on disk. It may still be referenced by a copy of
	 * this row in a backup, and an orphan under `.tempFiles` costs a few tens of
	 * kilobytes — `npm run uploads:prune` is what clears those.
	 */
	resetLogo: async (event) => {
		const user = requireRole(event, 'admin');
		const form = await superValidate(event.request, zod4(logoResetSchema));
		if (!form.valid) return fail(400, { message: m.srv_invalid_request() });

		const existing = await getSettings();
		if (!existing) return fail(409, { message: m.srv_invalid_request() });

		await db
			.update(t.siteSettings)
			.set({ [form.data.slot]: '', updatedBy: user.id })
			.where(eq(t.siteSettings.id, existing.id));

		await recordAudit({
			actorId: user.id,
			actorLabel: user.name,
			entity: 'settings',
			action: 'updated',
			reason: `Reset ${form.data.slot} to the default mark`
		});

		/* This form is deliberately not enhanced — it carries one field and has
		   no errors to render — so without a redirect the browser is left sitting
		   on `?/resetLogo` and a refresh re-posts it. */
		redirect(303, '/dashboard/admin/settings');
	}
};
