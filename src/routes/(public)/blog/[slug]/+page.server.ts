import * as m from '$lib/paraglide/messages';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getPostBySlug, getRelatedPosts, listPostImages } from '$lib/server/queries';
import { getCreatorFor, getOrganizationFor } from '$lib/server/guards';

/**
 * Whether this viewer is the profile the piece is filed under.
 *
 * Read from their own account, never from the request: the point is to let a
 * creator or a brand look at what they submitted, and anything a URL could
 * assert would let everybody else look at it too.
 */
async function isItsAuthor(
	post: { creatorId: number | null; organizationId: number | null },
	user: { id: string } | null | undefined
): Promise<boolean> {
	if (!user) return false;
	if (post.creatorId) return (await getCreatorFor(user.id))?.id === post.creatorId;
	if (post.organizationId) {
		return (await getOrganizationFor(user.id))?.id === post.organizationId;
	}
	return false;
}

export const load: PageServerLoad = async ({ params, locals }) => {
	const post = await getPostBySlug(params.slug);
	if (!post) error(404, m.bp_not_found());

	/*
	 * A draft is a real page for the operator who is writing it and a 404 for
	 * everyone else, so that a link pasted into a chat before publication does
	 * not leak the piece. Same for one dated in the future: the index hides it,
	 * and the article has to agree.
	 *
	 * The author of a piece is the second person who may look: a creator or a
	 * brand waiting on a decision needs to see what they are waiting on, and
	 * their own submission is not a leak to them.
	 */
	const isOperator = (locals.user as { role?: string } | undefined)?.role === 'admin';
	const mayPreview = isOperator || (await isItsAuthor(post, locals.user));
	const live =
		post.status === 'published' &&
		post.publishedAt &&
		new Date(post.publishedAt).getTime() <= Date.now();

	if (!live && post.status !== 'archived' && !mayPreview) error(404, m.bp_not_found());
	if (post.status === 'archived' && !mayPreview && !post.publishedAt) error(404, m.bp_not_found());

	const [images, related] = await Promise.all([
		listPostImages(post.id, { visibleOnly: true }),
		getRelatedPosts(post)
	]);

	return { post, images, related, isPreview: !live };
};
