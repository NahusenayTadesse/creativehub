import type { LayoutServerLoad } from './$types';
import { getReferenceData, getSettings } from '$lib/server/queries';
import { normaliseTiers } from '$lib/domain/commission';

/**
 * Reference data and the signed-in user, loaded once for every page. The filter
 * panels, currency conversion and navigation all read from here rather than
 * fetching their own copies.
 */
export const load: LayoutServerLoad = async ({ locals }) => {
	const [reference, settings] = await Promise.all([getReferenceData(), getSettings()]);

	return {
		user: locals.user
			? {
					id: locals.user.id,
					name: locals.user.name,
					email: locals.user.email,
					image: locals.user.image ?? null,
					role: (locals.user as { role?: string }).role ?? 'creator'
				}
			: null,
		reference,
		/*
		 * The named fields rather than the row, for the same reason the
		 * reference lists above are narrowed: this is returned from the root
		 * layout, so whatever it holds is written into the markup of every page
		 * on the site. The row carries audit columns — which operator last
		 * changed the take rate, and when — and those have no reader.
		 */
		settings: settings
			? {
					siteName: settings.siteName,
					tagline: settings.tagline,
					heroTitle: settings.heroTitle,
					heroAccent: settings.heroAccent,
					heroTitleEnd: settings.heroTitleEnd,
					heroSubtitle: settings.heroSubtitle,
					galleryIntervalSeconds: settings.galleryIntervalSeconds,
					heroIntervalSeconds: settings.heroIntervalSeconds,
					/* The platform's own channels: the strip under the hero and the
					   footer on every page both read them. */
					socials: {
						instagram: {
							url: settings.socialInstagramUrl,
							followers: settings.socialInstagramFollowers
						},
						tiktok: { url: settings.socialTiktokUrl, followers: settings.socialTiktokFollowers },
						facebook: {
							url: settings.socialFacebookUrl,
							followers: settings.socialFacebookFollowers
						},
						youtube: { url: settings.socialYoutubeUrl, followers: settings.socialYoutubeFollowers }
					},
					landingSections: settings.landingSections,
					/* The four brand slots, forwarded raw. `resolveLogos` turns them
					   into URLs at the point of use, so a page that draws no logo
					   pays nothing for them. */
					logoWordmark: settings.logoWordmark,
					logoWordmarkDark: settings.logoWordmarkDark,
					logoMark: settings.logoMark,
					logoPartners: settings.logoPartners,
					/* The rate card in brief, for the public pages that explain
					   what the platform charges. */
					commission: (() => {
						const rates = normaliseTiers(settings.commissionTiers).map((tier) => tier.percent);
						return {
							low: Math.min(...rates),
							high: Math.max(...rates),
							minCommission: settings.minCommission,
							brandServiceFeePercent: settings.brandServiceFeePercent
						};
					})(),
					supportEmail: settings.supportEmail,
					supportPhone: settings.supportPhone
				}
			: null
	};
};
