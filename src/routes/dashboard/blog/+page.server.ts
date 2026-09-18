import * as m from '$lib/paraglide/messages';
import { redirect } from '@sveltejs/kit';
import { message, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { and, eq, isNull } from 'drizzle-orm';
import type { PageServerLoad, Actions } from './$types';
import { db, insertedId } from '$lib/server/db';
import * as t from '$lib/server/db/schema';
import { recordAudit } from '$lib/server/guards';
import { requireBlogAuthor, authorScope } from '$lib/server/blog-authorship';
import { uniqueSlug } from '$lib/server/slug';
import { listAuthoredPosts, authoredStatusFacet } from '$lib/server/queries';
import { blogPostCreate, idSchema } from '$lib/schemas';

/**
 * A creator's or a brand's own articles.
 *
 * The same listing an operator gets, narrowed to one profile. Both go through
 * `blogPostsQuery`, so a column cannot mean one thing here and another there —
 * what differs is the `where`, and it comes from the session.
 */
export const load: PageServerLoad = async (event) => {
	const author = await requireBlogAuthor(event);
	const scope = authorScope(author);

	const [posts, statusCounts, createForm, deleteForm] = await Promise.all([
		listAuthoredPosts(event.url, scope),
		authoredStatusFacet(event.url, scope),
		superValidate(zod4(blogPostCreate)),
		superValidate(zod4(idSchema))
	]);

	return {
		author: { kind: author.kind, byline: author.byline },
		posts,
		statusCounts,
		createForm,
		deleteForm
	};
};

export const actions: Actions = {
	/**
	 * Starts an article and opens it.
	 *
	 * A post is created from a title alone, for the same reason the operator's
	 * is: the body, the pictures and the standfirst all need the row to exist
	 * before they have anywhere to attach to.
	 *
	 * `authorName` is deliberately left null. The byline then resolves through
	 * the profile — see the `coalesce` in `blogPostColumns` — so a creator who
	 * changes their name is credited by the name they now use, on everything
	 * they have ever written, rather than by a copy taken the day they started
	 * a draft.
	 */
	create: async (event) => {
		const author = await requireBlogAuthor(event);
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
				authorId: author.user.id,
				/* Stamped from the session. A form cannot name a profile. */
				creatorId: author.creatorId,
				organizationId: author.organizationId,
				createdBy: author.user.id
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
			actorId: author.user.id,
			actorLabel: author.byline,
			entity: 'blog_post',
			entityId: id,
			action: 'created',
			toState: 'draft',
			reason: form.data.title
		});

		/* Outside the try: a redirect is thrown, and catching it here would turn
		   a successful create into a 500. */
		redirect(303, `/dashboard/blog/${id}`);
	},

	/**
	 * Removes one of this author's own posts.
	 *
	 * Soft, like every other content table, and scoped: the id arrives from a
	 * form, so the author condition is part of the `where` rather than a check
	 * afterwards. An id belonging to somebody else matches no row and the
	 * update silently affects nothing, which is the right amount to say about
	 * a post that is none of their business.
	 */
	delete: async (event) => {
		const author = await requireBlogAuthor(event);
		const form = await superValidate(event.request, zod4(idSchema));

		if (!form.valid) {
			return message(form, { type: 'error', text: m.srv_invalid_request() }, { status: 400 });
		}

		try {
			await db
				.update(t.blogPosts)
				.set({ deletedAt: new Date(), updatedBy: author.user.id })
				.where(
					and(eq(t.blogPosts.id, form.data.id), isNull(t.blogPosts.deletedAt), authorScope(author))
				);

			await recordAudit({
				actorId: author.user.id,
				actorLabel: author.byline,
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
