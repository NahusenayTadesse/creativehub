import { superValidate, message } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { eq } from 'drizzle-orm';
import type { PageServerLoad, Actions } from './$types';
import { db } from '$lib/server/db';
import * as t from '$lib/server/db/schema';
import { requireRole, recordAudit } from '$lib/server/guards';
import { settingsSchema } from '$lib/schemas';
import { getSettings } from '$lib/server/queries';

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
			supportEmail: settings.supportEmail ?? '',
			supportPhone: settings.supportPhone ?? ''
		});
	}

	return { form, settings };
};

export const actions: Actions = {
	default: async (event) => {
		const user = requireRole(event, 'admin');
		const form = await superValidate(event.request, zod4(settingsSchema));
		if (!form.valid) {
			return message(form, { type: 'error', text: 'Check the form for errors' }, { status: 400 });
		}

		const { id, ...values } = form.data;
		const existing = await getSettings();

		if (existing) {
			await db
				.update(t.siteSettings)
				.set({ ...values, updatedBy: user.id })
				.where(eq(t.siteSettings.id, existing.id));
		} else {
			await db.insert(t.siteSettings).values({ ...values, createdBy: user.id });
		}

		await recordAudit({
			actorId: user.id,
			actorLabel: user.name,
			entity: 'settings',
			action: 'updated',
			reason: `Fee set to ${values.platformFeePercent}%`
		});

		return message(form, { type: 'success', text: 'Settings saved' });
	}
};
