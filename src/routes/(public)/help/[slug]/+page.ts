import { error } from '@sveltejs/kit';
import { helpArticle, helpArticles } from '$lib/domain/help';
import * as m from '$lib/paraglide/messages';
import type { PageLoad } from './$types';

/**
 * One help article, resolved in the reader's language.
 *
 * Universal rather than server-only: the catalogue is shipped code, so a
 * client-side navigation between two articles needs no round trip. A slug that
 * is not in the catalogue is a 404 rather than an empty page, so a renamed
 * article does not quietly answer 200 to a crawler.
 */
export const load: PageLoad = ({ params }) => {
	const article = helpArticle(params.slug);
	if (!article) error(404, m.help_not_found());

	const siblings = helpArticles().filter(
		(one) => one.category === article.category && one.slug !== article.slug
	);

	return { article, siblings };
};
