import * as m from '$lib/paraglide/messages';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getPostBySlug, getRelatedPosts, listPostImages } from '$lib/server/queries';

export const load: PageServerLoad = async ({ params, locals }) => {
	const post = await getPostBySlug(params.slug);
	if (!post) error(404, m.bp_not_found());

	/*
	 * A draft is a real page for the operator who is writing it and a 404 for
	 * everyone else, so that a link pasted into a chat before publication does
	 * not leak the piece. Same for one dated in the future: the index hides it,
	 * and the article has to agree.
	 */
	const isOperator = (locals.user as { role?: string } | undefined)?.role === 'admin';
	const live =
		post.status === 'published' &&
		post.publishedAt &&
		new Date(post.publishedAt).getTime() <= Date.now();

	if (!live && post.status !== 'archived' && !isOperator) error(404, m.bp_not_found());
	if (post.status === 'archived' && !isOperator && !post.publishedAt) error(404, m.bp_not_found());

	const [images, related] = await Promise.all([
		listPostImages(post.id, { visibleOnly: true }),
		getRelatedPosts(post)
	]);

	return { post, images, related, isPreview: !live };
};
