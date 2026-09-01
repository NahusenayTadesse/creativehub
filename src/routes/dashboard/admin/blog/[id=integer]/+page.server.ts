import * as m from '$lib/paraglide/messages';
import { error } from '@sveltejs/kit';
import { message, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { and, eq, isNull } from 'drizzle-orm';
import type { RequestEvent } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { db } from '$lib/server/db';
import * as t from '$lib/server/db/schema';
import { contentCrud, uploadErrorText } from '$lib/server/crud';
import { recordAudit, requireRole } from '$lib/server/guards';
import { deleteUploadedFile, saveUploadedFile } from '$lib/server/upload';
import { uniqueSlug } from '$lib/server/slug';
import { htmlToText, readingMinutes, sanitizeArticleHtml, summarize } from '$lib/server/sanitize';
import { listBlogCategories, listPostImages } from '$lib/server/queries';
import { blogImageAdd, blogImageEdit, blogPostSchema, idSchema, linesOf } from '$lib/schemas';

/** The post this page is editing, or a 404. Soft-deleted counts as gone. */
async function getPost(id: number) {
	const rows = await db
		.select()
		.from(t.blogPosts)
		.where(and(eq(t.blogPosts.id, id), isNull(t.blogPosts.deletedAt)))
		.limit(1);
	const post = rows.at(0);
	if (!post) error(404, m.bp_not_found());
	return post;
}

/**
 * The gallery beneath the article, managed by the shared CRUD.
 *
 * The scope is what makes the ids on the wire harmless: every read and write
 * is confined to this post's images, and `postId` is stamped from the route
 * rather than taken from the form, so a posted id cannot move a picture from
 * one article to another.
 */
const galleryCrud = (postId: number) =>
	contentCrud({
		table: t.blogPostImages,
		label: () => m.bi_label(),
		addSchema: blogImageAdd,
		editSchema: blogImageEdit,
		fileFields: ['image'],
		scope: { column: t.blogPostImages.postId, key: 'postId', value: postId },
		guard: (event) => requireRole(event, 'admin')
	});

const postId = (event: RequestEvent) => Number(event.params.id);

export const load: PageServerLoad = async (event) => {
	requireRole(event, 'admin');
	const id = postId(event);

	const [post, images, categories] = await Promise.all([
		getPost(id),
		listPostImages(id),
		listBlogCategories()
	]);

	const [form, imageAddForm, imageEditForm, imageDeleteForm] = await Promise.all([
		superValidate(zod4(blogPostSchema)),
		superValidate(zod4(blogImageAdd)),
		superValidate(zod4(blogImageEdit)),
		superValidate(zod4(idSchema))
	]);

	/*
	 * The stored row, poured into the form.
	 *
	 * The two file fields are deliberately left empty: an empty picker is what
	 * "keep the stored image" looks like on the wire, and prefilling one with
	 * the stored name would post that name back as though it were an upload.
	 * The current pictures are shown beside the pickers instead.
	 */
	form.data = {
		...form.data,
		id: post.id,
		title: post.title,
		excerpt: post.excerpt ?? '',
		body: post.body ?? '',
		featuredImage: '',
		featuredImageAlt: post.featuredImageAlt ?? '',
		categoryId: post.categoryId ?? 0,
		tags: (post.tags ?? []).join('\n'),
		status: post.status,
		publishedOn: post.publishedAt ? post.publishedAt.toISOString().slice(0, 10) : '',
		isFeatured: post.isFeatured,
		sortOrder: post.sortOrder,
		metaTitle: post.metaTitle ?? '',
		metaDescription: post.metaDescription ?? '',
		ogImage: '',
		noIndex: post.noIndex,
		authorName: post.authorName ?? ''
	};

	return { post, images, categories, form, imageAddForm, imageEditForm, imageDeleteForm };
};

/**
 * The instant a post goes live, given what the operator asked for.
 *
 * A blank date on a post that is already live keeps the date it has, so
 * re-saving a published article does not silently re-date it. A blank date on
 * one going live for the first time is now. A date typed in the future is
 * honoured, which is what makes scheduling work: the public query hides
 * anything dated later than the moment it runs, so nothing has to release it.
 */
function publishedAtFor(status: string, typed: string, current: Date | null): Date | null {
	if (status !== 'published') return current;
	if (typed) {
		const parsed = new Date(typed);
		if (!Number.isNaN(parsed.getTime())) return parsed;
	}
	return current ?? new Date();
}

export const actions: Actions = {
	/**
	 * Saves the article.
	 *
	 * Four values are derived here rather than posted, because each of them is
	 * a fact about the body that a form could otherwise contradict: the
	 * sanitised HTML, its plain text, the reading time, and the excerpt when
	 * none was written.
	 */
	save: async (event) => {
		const user = requireRole(event, 'admin');
		const id = postId(event);
		const post = await getPost(id);

		const form = await superValidate(event.request, zod4(blogPostSchema));
		if (!form.valid) {
			return message(form, { type: 'error', text: m.srv_please_check_form() }, { status: 400 });
		}

		const data = form.data;

		try {
			/* The one narrowing that matters: everything downstream reads this
			   column with `{@html}`. See $lib/server/sanitize.ts. */
			const body = sanitizeArticleHtml(data.body);
			const text = htmlToText(body);

			/* An upload replaces what is stored; an untouched picker keeps it. */
			const featuredImage =
				data.featuredImage instanceof File && data.featuredImage.size > 0
					? await saveUploadedFile(data.featuredImage)
					: typeof data.featuredImage === 'string' && data.featuredImage
						? data.featuredImage
						: post.featuredImage;

			const ogImage =
				data.ogImage instanceof File && data.ogImage.size > 0
					? await saveUploadedFile(data.ogImage)
					: typeof data.ogImage === 'string' && data.ogImage
						? data.ogImage
						: post.ogImage;

			/* A renamed article moves; one whose title is unchanged keeps its
			   permalink, which is what `ignoreId` buys. */
			const slug = await uniqueSlug(t.blogPosts, t.blogPosts.slug, t.blogPosts.id, data.title, {
				ignoreId: id,
				fallback: 'post'
			});

			await db
				.update(t.blogPosts)
				.set({
					title: data.title,
					slug,
					excerpt: data.excerpt || summarize(text),
					body,
					searchText: text,
					readingMinutes: readingMinutes(text),
					featuredImage,
					featuredImageAlt: data.featuredImageAlt || null,
					/* 0 is the empty choice in the select, and the column is a foreign
					   key — a literal 0 would fail the constraint. */
					categoryId: data.categoryId || null,
					tags: linesOf(data.tags),
					status: data.status,
					publishedAt: publishedAtFor(data.status, data.publishedOn, post.publishedAt),
					isFeatured: data.isFeatured,
					sortOrder: data.sortOrder,
					metaTitle: data.metaTitle || null,
					metaDescription: data.metaDescription || null,
					ogImage: ogImage || null,
					noIndex: data.noIndex,
					authorName: data.authorName || null,
					updatedBy: user.id
				})
				.where(and(eq(t.blogPosts.id, id), isNull(t.blogPosts.deletedAt)));

			/* Superseded uploads, now that the row no longer names them. Done
			   after the write: the other order loses the file if the update
			   then fails. */
			if (post.featuredImage && featuredImage !== post.featuredImage) {
				await deleteUploadedFile(post.featuredImage);
			}
			if (post.ogImage && ogImage !== post.ogImage) {
				await deleteUploadedFile(post.ogImage);
			}

			/* Only a change of state is worth a line in the audit log; saving a
			   typo is not, and a log full of `updated` hides the publications. */
			if (post.status !== data.status) {
				await recordAudit({
					actorId: user.id,
					actorLabel: user.name,
					entity: 'blog_post',
					entityId: id,
					action: 'status_changed',
					fromState: post.status,
					toState: data.status,
					reason: data.title
				});
			}

			return message(form, { type: 'success', text: m.bp_saved() });
		} catch (err) {
			const rejected = uploadErrorText(err);
			if (rejected) return message(form, { type: 'error', text: rejected }, { status: 400 });

			console.error('Failed to save post:', err);
			return message(
				form,
				{ type: 'error', text: m.srv_crud_update_failed({ label: m.bp_label() }) },
				{ status: 500 }
			);
		}
	},

	addImage: (event) => galleryCrud(postId(event)).actions.add(event),
	editImage: (event) => galleryCrud(postId(event)).actions.edit(event),
	deleteImage: (event) => galleryCrud(postId(event)).actions.delete(event)
};
