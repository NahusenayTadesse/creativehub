import type { PageServerLoad } from './$types';
import {
	blogCategoryFacet,
	getFeaturedPost,
	listBlogCategories,
	listBlogTags,
	listPublishedPosts
} from '$lib/server/queries';

/**
 * The blog index.
 *
 * The lead article is fetched apart from the list so it can be rendered large
 * at the top; the list then drops it, which is why `featured` is passed down
 * rather than filtered out in SQL — a post excluded from the query would leave
 * a hole in the paging count.
 */
export const load: PageServerLoad = async ({ url }) => {
	const [posts, categoryCounts, categories, tags, featured] = await Promise.all([
		listPublishedPosts(url),
		blogCategoryFacet(url),
		listBlogCategories(),
		listBlogTags(),
		/* Only on the first page of the unfiltered index: a lead article above a
		   filtered list would be an article that does not match the filter. */
		url.searchParams.toString() ? Promise.resolve(null) : getFeaturedPost()
	]);

	return { posts, categoryCounts, categories, tags, featured };
};
