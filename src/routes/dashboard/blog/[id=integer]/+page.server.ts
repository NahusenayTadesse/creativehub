import * as m from '$lib/paraglide/messages';
import { message, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { and, eq, isNull } from 'drizzle-orm';
import type { RequestEvent } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { db } from '$lib/server/db';
import * as t from '$lib/server/db/schema';
import { contentCrud, uploadErrorText } from '$lib/server/crud';
import { recordAudit } from '$lib/server/guards';
import { notify } from '$lib/server/notify';
import {
	requireBlogAuthor,
	authorScope,
	getAuthoredPost,
	type BlogAuthor
} from '$lib/server/blog-authorship';
import { deleteUploadedFile, saveUploadedFile } from '$lib/server/upload';
import { uniqueSlug } from '$lib/server/slug';
import { htmlToText, readingMinutes, sanitizeArticleHtml, summarize } from '$lib/server/sanitize';
import { listAdminIds, listBlogCategories, listPostImages } from '$lib/server/queries';
import {
	authorMayEdit,
	authorMaySubmit,
	authorMayWithdraw,
	statusAfterAuthorSave,
	type BlogStatus
} from '$lib/domain/blog-post';
import { blogAuthorPostSchema, blogImageAdd, blogImageEdit, idSchema, linesOf } from '$lib/schemas';

const postId = (event: RequestEvent) => Number(event.params.id);

/**
 * The gallery beneath the article.
 *
 * Two scopes, not one. `contentCrud`'s own confines every read and write to
 * this post's images; the `guard` re-establishes that the post is this
 * author's before any of that runs. Either alone is a hole: without the first
 * a posted id moves a picture between articles, and without the second it
 * moves one inside somebody else's.
 */
const galleryCrud = (author: BlogAuthor, id: number) =>
	contentCrud({
		table: t.blogPostImages,
		label: () => m.bi_label(),
		addSchema: blogImageAdd,
		editSchema: blogImageEdit,
		fileFields: ['image'],
		scope: { column: t.blogPostImages.postId, key: 'postId', value: id },
		guard: () => getAuthoredPost(author, id)
	});

export const load: PageServerLoad = async (event) => {
	const author = await requireBlogAuthor(event);
	const post = await getAuthoredPost(author, postId(event));

	const [images, categories] = await Promise.all([listPostImages(post.id), listBlogCategories()]);

	const [form, withdrawForm, imageAddForm, imageEditForm, imageDeleteForm] = await Promise.all([
		superValidate(zod4(blogAuthorPostSchema)),
		superValidate(zod4(idSchema)),
		superValidate(zod4(blogImageAdd)),
		superValidate(zod4(blogImageEdit)),
		superValidate(zod4(idSchema))
	]);

	/*
	 * The stored row, poured into the form. The file picker is left empty on
	 * purpose: an empty picker is what "keep the stored image" looks like on the
	 * wire, and prefilling it with the stored name would post that name back as
	 * though it were a fresh upload.
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
		metaDescription: post.metaDescription ?? ''
	};

	return {
		author: { kind: author.kind, byline: author.byline, profileHref: author.profileHref },
		post,
		images,
		categories,
		form,
		withdrawForm,
		imageAddForm,
		imageEditForm,
		imageDeleteForm
	};
};

/**
 * Writes the author's edit, and says where the post ended up.
 *
 * `save` and `submit` post the same form and differ in one thing: whether the
 * author is finished. Sharing the write is what stops "submit" from becoming a
 * second, slightly different idea of what an article is — and it means a
 * submission can never hand an operator a version older than what the author
 * is looking at, which is exactly what a separate submit button on an unsaved
 * editor would do.
 */
async function persist(event: RequestEvent, options: { submitting: boolean }) {
	const author = await requireBlogAuthor(event);
	const id = postId(event);
	const post = await getAuthoredPost(author, id);

	const form = await superValidate(event.request, zod4(blogAuthorPostSchema));
	if (!form.valid) {
		return message(form, { type: 'error', text: m.srv_please_check_form() }, { status: 400 });
	}

	const current = post.status as BlogStatus;
	if (!authorMayEdit(current)) {
		return message(form, { type: 'error', text: m.ba_locked() }, { status: 409 });
	}
	if (options.submitting && !authorMaySubmit(current) && current !== 'published') {
		return message(form, { type: 'error', text: m.ba_already_submitted() }, { status: 409 });
	}

	const data = form.data;

	try {
		/* The one narrowing that matters: everything downstream reads this
		   column with `{@html}`. See $lib/server/sanitize.ts. */
		const body = sanitizeArticleHtml(data.body);
		const text = htmlToText(body);

		/* An empty article is a fine draft and a poor submission — an operator's
		   queue full of blank titles is a queue nobody reads. */
		if (options.submitting && !text.trim()) {
			return message(form, { type: 'error', text: m.val_body_required() }, { status: 400 });
		}

		const featuredImage =
			data.featuredImage instanceof File && data.featuredImage.size > 0
				? await saveUploadedFile(data.featuredImage)
				: typeof data.featuredImage === 'string' && data.featuredImage
					? data.featuredImage
					: post.featuredImage;

		/* A renamed article moves; one whose title is unchanged keeps its
		   permalink, which is what `ignoreId` buys. */
		const slug = await uniqueSlug(t.blogPosts, t.blogPosts.slug, t.blogPosts.id, data.title, {
			ignoreId: id,
			fallback: 'post'
		});

		/*
		 * Where this leaves the post. Editing a live article sends it back for a
		 * decision whether or not the author pressed "submit" — see
		 * `statusAfterAuthorSave`. Submitting a draft is the only thing that
		 * moves one out of `draft`, and nothing here can reach `published`.
		 */
		const next: BlogStatus = options.submitting ? 'pending' : statusAfterAuthorSave(current);
		const handedOver = next === 'pending' && current !== 'pending';

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
				metaDescription: data.metaDescription || null,
				status: next,
				/* `publishedAt` is left exactly as it is. A live article sent back
				   for a re-read is the same article on the same date; re-stamping it
				   on approval would silently re-date every correction. */
				...(handedOver ? { submittedAt: new Date() } : {}),
				updatedBy: author.user.id
			})
			.where(and(eq(t.blogPosts.id, id), isNull(t.blogPosts.deletedAt), authorScope(author)));

		/* Superseded upload, now that the row no longer names it. After the
		   write: the other order loses the file if the update then fails. */
		if (post.featuredImage && featuredImage !== post.featuredImage) {
			await deleteUploadedFile(post.featuredImage);
		}

		if (next !== current) {
			await recordAudit({
				actorId: author.user.id,
				actorLabel: author.byline,
				entity: 'blog_post',
				entityId: id,
				action: 'status_changed',
				fromState: current,
				toState: next,
				reason: data.title
			});
		}

		if (handedOver) {
			/* Nobody watches a queue that never announces itself. */
			await notify(await listAdminIds(), {
				category: 'account',
				kind: 'blog_review',
				title: m.notif_blog_submitted_title({ author: author.byline }),
				body: data.title,
				link: '/dashboard/admin/blog/approvals',
				actionLabel: m.notif_blog_review_action(),
				actorId: author.user.id
			});
		}

		return message(form, {
			type: 'success',
			text: handedOver
				? current === 'published'
					? m.ba_resubmitted()
					: m.ba_submitted()
				: m.bp_saved()
		});
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
}

export const actions: Actions = {
	save: (event) => persist(event, { submitting: false }),
	submit: (event) => persist(event, { submitting: true }),

	/** Pulls a submission back while nobody has answered it. */
	withdraw: async (event) => {
		const author = await requireBlogAuthor(event);
		const id = postId(event);
		const post = await getAuthoredPost(author, id);
		const form = await superValidate(event.request, zod4(idSchema));

		if (!form.valid) {
			return message(form, { type: 'error', text: m.srv_invalid_request() }, { status: 400 });
		}
		if (!authorMayWithdraw(post.status as BlogStatus)) {
			return message(form, { type: 'error', text: m.ba_cannot_withdraw() }, { status: 409 });
		}

		await db
			.update(t.blogPosts)
			.set({ status: 'draft', submittedAt: null, updatedBy: author.user.id })
			.where(and(eq(t.blogPosts.id, id), eq(t.blogPosts.status, 'pending'), authorScope(author)));

		await recordAudit({
			actorId: author.user.id,
			actorLabel: author.byline,
			entity: 'blog_post',
			entityId: id,
			action: 'status_changed',
			fromState: 'pending',
			toState: 'draft',
			reason: post.title
		});

		return message(form, { type: 'success', text: m.ba_withdrawn() });
	},

	addImage: async (event) =>
		galleryCrud(await requireBlogAuthor(event), postId(event)).actions.add(event),
	editImage: async (event) =>
		galleryCrud(await requireBlogAuthor(event), postId(event)).actions.edit(event),
	deleteImage: async (event) =>
		galleryCrud(await requireBlogAuthor(event), postId(event)).actions.delete(event)
};
