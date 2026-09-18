import * as m from '$lib/paraglide/messages';
import { error, redirect } from '@sveltejs/kit';
import { and, eq, isNull, type SQL } from 'drizzle-orm';
import type { RequestEvent } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import * as t from '$lib/server/db/schema';
import { requireUser, getCreatorFor, getOrganizationFor } from '$lib/server/guards';

/**
 * Who is writing, and which profile the piece will be published under.
 *
 * The author area is one set of routes serving two kinds of account, and the
 * difference between them is exactly two columns on `blog_posts`. Resolving it
 * here — once, from the session — is what keeps every route below from asking
 * "am I a creator or a brand?" and getting a slightly different answer.
 *
 * Nothing in this module reads an id from a request. The profile comes from
 * the signed-in account, so a posted `creatorId` cannot file an article under
 * somebody else's name.
 */
export type BlogAuthor = {
	kind: 'creator' | 'organization';
	/** Set for a creator, null for a brand. Straight onto the column. */
	creatorId: number | null;
	/** Set for a brand, null for a creator. */
	organizationId: number | null;
	/** The byline a new post starts with: the profile's name, not the account's. */
	byline: string;
	/** Where the profile is on the public site, for the "view" link. */
	profileHref: string;
	user: { id: string; name: string };
};

/**
 * The author behind this request, or a redirect to whatever they are missing.
 *
 * A creator with no profile and a brand with no organisation are both sent to
 * create one, which is where every other page in their dashboard sends them —
 * writing for the blog under a profile that does not exist yet is not a state
 * worth building a second answer for.
 *
 * An operator is bounced to their own editor rather than given an author's
 * one: they have no profile to publish under, and the admin blog already does
 * everything this area does and more.
 */
export async function requireBlogAuthor(event: RequestEvent): Promise<BlogAuthor> {
	const user = requireUser(event);
	const role = (user.role ?? 'creator') as string;

	if (role === 'admin') redirect(303, '/dashboard/admin/blog');

	if (role === 'creator') {
		const creator = await getCreatorFor(user.id);
		if (!creator) redirect(303, '/dashboard/profile/create');
		return {
			kind: 'creator',
			creatorId: creator.id,
			organizationId: null,
			byline: creator.fullName,
			profileHref: `/creators/${creator.username}`,
			user: { id: user.id, name: user.name }
		};
	}

	if (role === 'business') {
		const organization = await getOrganizationFor(user.id);
		if (!organization) redirect(303, '/dashboard/organization/create');
		return {
			kind: 'organization',
			creatorId: null,
			organizationId: organization.id,
			byline: organization.name,
			profileHref: `/brands/${organization.slug}`,
			user: { id: user.id, name: user.name }
		};
	}

	/* An encoder enters the catalogue; it is not an account anybody publishes
	   under. Anything else new is refused here rather than silently allowed. */
	error(403, m.srv_no_permission());
}

/**
 * The condition that confines every read and write to this author's own posts.
 *
 * One expression, used by the listing, by the loader of a single post and by
 * every action — so an id arriving on a form can only ever name a row this
 * account already owns. A second, hand-written copy of this predicate is how
 * one of those three ends up missing the `deletedAt` half.
 */
export const authorScope = (author: BlogAuthor): SQL =>
	author.kind === 'creator'
		? (eq(t.blogPosts.creatorId, author.creatorId as number) as SQL)
		: (eq(t.blogPosts.organizationId, author.organizationId as number) as SQL);

/**
 * One of this author's posts, or a 404.
 *
 * The scope is part of the `where`, not a check afterwards: a post belonging to
 * somebody else is indistinguishable from a post that does not exist, which is
 * the only answer that does not confirm the existence of other people's drafts.
 */
export async function getAuthoredPost(author: BlogAuthor, id: number) {
	const rows = await db
		.select()
		.from(t.blogPosts)
		.where(and(eq(t.blogPosts.id, id), isNull(t.blogPosts.deletedAt), authorScope(author)))
		.limit(1);

	const post = rows.at(0);
	if (!post) error(404, m.bp_not_found());
	return post;
}
