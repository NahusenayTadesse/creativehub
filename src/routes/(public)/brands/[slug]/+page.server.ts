import * as m from '$lib/paraglide/messages';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import {
	getBrandBySlug,
	listBrandBriefs,
	listBrandReviews,
	listProfilePosts
} from '$lib/server/queries';

/**
 * A brand's public page.
 *
 * Brands had no page of their own before: an organisation existed in the
 * dashboard, on a brief and in a review, and nowhere a reader could be sent.
 * Articles are what made that a gap rather than an omission — a piece written
 * by a brand has a byline, and a byline that links nowhere is a byline that
 * says nothing.
 *
 * So the page is the brand as the rest of the site already refers to it: who
 * they are, what they are hiring for, and what they have written.
 */
export const load: PageServerLoad = async ({ params }) => {
	const brand = await getBrandBySlug(params.slug);
	if (!brand) error(404, m.br_not_found());

	const [briefs, articles, reviews] = await Promise.all([
		listBrandBriefs(brand.id),
		listProfilePosts({ organizationId: brand.id }),
		listBrandReviews(brand.id)
	]);

	return { brand, briefs, articles, reviews };
};
