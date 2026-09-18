import * as m from '$lib/paraglide/messages';
import { fail } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { and, eq, isNull } from 'drizzle-orm';
import type { PageServerLoad, Actions } from './$types';
import { db } from '$lib/server/db';
import * as t from '$lib/server/db/schema';
import { recordAudit, requireRole } from '$lib/server/guards';
import { notify } from '$lib/server/notify';
import { listPostsAwaitingReview } from '$lib/server/queries';
import { blogReviewDecision } from '$lib/schemas';

/**
 * What creators and brands are waiting on.
 *
 * A queue rather than a filter on the main listing, because it is a different
 * job: the blog index is editorial work an operator chose to do, and this is
 * other people's work blocked on an answer. The sidebar counts it for the same
 * reason it counts verifications and claims — a queue nobody can see the depth
 * of is a queue that grows.
 */
export const load: PageServerLoad = async (event) => {
	requireRole(event, 'admin');

	return { posts: await listPostsAwaitingReview(event.url) };
};

export const actions: Actions = {
	/**
	 * Publishes a submission, or sends it back with a note.
	 *
	 * One action for both answers rather than two, because everything except
	 * the resulting status is the same work — re-read the row, refuse if it is
	 * no longer waiting, stamp the reviewer, log it, tell the author — and two
	 * copies of that are two places for the notification to go missing from.
	 */
	decide: async (event) => {
		const user = requireRole(event, 'admin');
		const form = await superValidate(event.request, zod4(blogReviewDecision));

		if (!form.valid) return fail(400, { message: m.srv_invalid_request() });

		/* Turning a piece down has to say why: the author is shown this note and
		   it is the only thing telling them what to change. */
		if (form.data.decision === 'reject' && !form.data.note.trim()) {
			return fail(400, { message: m.bq_need_reason() });
		}

		/*
		 * Re-read at the moment of the write rather than trusted from the page:
		 * another operator may have answered this while the queue was open, and
		 * the author may have withdrawn it. Both show up as a row that is no
		 * longer `pending`.
		 */
		const rows = await db
			.select()
			.from(t.blogPosts)
			.where(
				and(
					eq(t.blogPosts.id, form.data.id),
					eq(t.blogPosts.status, 'pending'),
					isNull(t.blogPosts.deletedAt)
				)
			)
			.limit(1);

		const post = rows.at(0);
		if (!post) return fail(409, { message: m.bq_already_decided() });

		const approved = form.data.decision === 'approve';

		try {
			await db
				.update(t.blogPosts)
				.set({
					status: approved ? 'published' : 'draft',
					/*
					 * Stamped only the first time a piece goes live. An article sent
					 * back for a correction and approved again is the same article on
					 * the same date — re-dating it would move every correction to the
					 * top of the index and rewrite the byline's date underneath
					 * anybody who had already read it.
					 */
					publishedAt: approved ? (post.publishedAt ?? new Date()) : post.publishedAt,
					reviewNote: form.data.note || null,
					reviewedAt: new Date(),
					reviewedBy: user.id,
					updatedBy: user.id
				})
				.where(and(eq(t.blogPosts.id, post.id), eq(t.blogPosts.status, 'pending')));
		} catch (err) {
			console.error('Failed to decide on post:', err);
			return fail(500, { message: m.srv_crud_update_failed({ label: m.bp_label() }) });
		}

		await recordAudit({
			actorId: user.id,
			actorLabel: user.name,
			entity: 'blog_post',
			entityId: post.id,
			action: 'status_changed',
			fromState: 'pending',
			toState: approved ? 'published' : 'draft',
			reason: form.data.note || post.title
		});

		/*
		 * The author, not the account that happens to own the profile: a brand's
		 * article is written by whichever member was signed in, and they are the
		 * one who has been waiting for the answer.
		 */
		await notify(post.authorId, {
			category: 'account',
			kind: 'blog_review',
			title: approved
				? m.notif_blog_approved_title({ title: post.title })
				: m.notif_blog_rejected_title({ title: post.title }),
			body: form.data.note || null,
			link: approved ? `/blog/${post.slug}` : `/dashboard/blog/${post.id}`,
			actionLabel: approved ? m.bp_view() : m.notif_blog_open_draft(),
			footnote: m.mail_prefs_footnote(),
			actorId: user.id
		});

		return { decided: form.data.decision };
	}
};
