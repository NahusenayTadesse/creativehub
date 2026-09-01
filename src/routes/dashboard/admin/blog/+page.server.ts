import * as m from '$lib/paraglide/messages';
import { redirect } from '@sveltejs/kit';
import { message, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { and, eq, isNull } from 'drizzle-orm';
import type { PageServerLoad, Actions } from './$types';
import { db, insertedId } from '$lib/server/db';
import * as t from '$lib/server/db/schema';
import { recordAudit, requireRole } from '$lib/server/guards';
import { uniqueSlug } from '$lib/server/slug';
import { listAllPosts, blogStatusFacet, listBlogCategories } from '$lib/server/queries';
import { blogPostCreate, idSchema } from '$lib/schemas';

/**
 * The operator's list of articles.
 *
 * Drafts are included, which is what makes it different from `/blog`: the
 * public list passes a published-only scope and this one does not. Both go
 * through the same definition, so a column cannot mean one thing here and
 * another there.
 */
export const load: PageServerLoad = async (event) => {
	requireRole(event, 'admin');

	const [posts, statusCounts, categories, createForm, deleteForm] = await Promise.all([
		listAllPosts(event.url),
		blogStatusFacet(event.url),
		listBlogCategories(),
		superValidate(zod4(blogPostCreate)),
		superValidate(zod4(idSchema))
	]);

	return { posts, statusCounts, categories, createForm, deleteForm };
};

export const actions: Actions = {
	/**
	 * Starts an article and opens it.
	 *
	 * A post is created from a title alone rather than from the full form: the
	 * body, the pictures and the SEO fields all need the post to exist before
	 * they have anywhere to attach to — an uploaded gallery image needs a
	 * `postId`, and so does an inline picture's place in the body.
	 */
	create: async (event) => {
		const user = requireRole(event, 'admin');
		const form = await superValidate(event.request, zod4(blogPostCreate));

		if (!form.valid) {
			return message(form, { type: 'error', text: m.srv_please_check_form() }, { status: 400 });
		}

		let id: number;
		try {
			const slug = await uniqueSlug(
				t.blogPosts,
				t.blogPosts.slug,
				t.blogPosts.id,
				form.data.title,
				{ fallback: 'post' }
			);

			const result = await db.insert(t.blogPosts).values({
				title: form.data.title,
				slug,
				status: 'draft',
				authorId: user.id,
				authorName: user.name,
				createdBy: user.id
			});
			id = insertedId(result);
		} catch (err) {
			console.error('Failed to create post:', err);
			return message(
				form,
				{ type: 'error', text: m.srv_crud_add_failed({ label: m.bp_label() }) },
				{ status: 500 }
			);
		}

		await recordAudit({
			actorId: user.id,
			actorLabel: user.name,
			entity: 'blog_post',
			entityId: id,
			action: 'created',
			toState: 'draft',
			reason: form.data.title
		});

		/* Outside the try: a redirect is thrown, and catching it here would turn
		   a successful create into a 500. */
		redirect(303, `/dashboard/admin/blog/${id}`);
	},

	delete: async (event) => {
		const user = requireRole(event, 'admin');
		const form = await superValidate(event.request, zod4(idSchema));

		if (!form.valid) {
			return message(form, { type: 'error', text: m.srv_invalid_request() }, { status: 400 });
		}

		try {
			/*
			 * Soft delete, like every other content table. The row keeps its slug,
			 * so a post removed by mistake can be brought back at the URL people
			 * have already linked to — which a hard delete plus a re-create at a
			 * new auto-increment id could not promise.
			 */
			await db
				.update(t.blogPosts)
				.set({ deletedAt: new Date(), updatedBy: user.id })
				.where(and(eq(t.blogPosts.id, form.data.id), isNull(t.blogPosts.deletedAt)));

			await recordAudit({
				actorId: user.id,
				actorLabel: user.name,
				entity: 'blog_post',
				entityId: form.data.id,
				action: 'deleted'
			});

			return message(form, { type: 'success', text: m.srv_crud_deleted({ label: m.bp_label() }) });
		} catch (err) {
			console.error('Failed to delete post:', err);
			return message(
				form,
				{ type: 'error', text: m.srv_crud_delete_failed({ label: m.bp_label() }) },
				{ status: 500 }
			);
		}
	}
};
