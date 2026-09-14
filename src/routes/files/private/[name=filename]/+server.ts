import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import * as t from '$lib/server/db/schema';
import { getCreatorFor, getOrganizationFor, isAdmin } from '$lib/server/guards';
import { PRIVATE_DIR, serveStoredFile } from '$lib/server/serveFile';

/**
 * Uploads that carry an authorisation check — verification evidence, and the
 * analytics screenshots behind a channel's figures.
 *
 * An identity document used to sit in the same directory as avatars and be
 * served by the public file route to anyone holding the URL: unguessable in
 * practice, but it leaks through referrers, proxy logs and browser history, and
 * nothing stood behind it. Here the request must come from an operator or from
 * the subject who submitted the document.
 */
export const GET: RequestHandler = async ({ params, request, locals }) => {
	const user = locals.user;
	if (!user) return new Response('unauthorized', { status: 401 });

	/* The stored column holds the path relative to the upload root. */
	const stored = `private/${params.name}`;

	/* Whichever row names this file says whose it is. */
	const [verification, proof] = await Promise.all([
		db
			.select({
				creatorId: t.verificationRequests.creatorId,
				organizationId: t.verificationRequests.organizationId
			})
			.from(t.verificationRequests)
			.where(eq(t.verificationRequests.documentUrl, stored))
			.limit(1),
		db
			.select({ creatorId: t.statProofs.creatorId })
			.from(t.statProofs)
			.where(eq(t.statProofs.screenshot, stored))
			.limit(1)
	]);

	const owner =
		verification.at(0) ??
		(proof.at(0) ? { creatorId: proof[0].creatorId, organizationId: null } : undefined);
	if (!owner) return new Response('not found', { status: 404 });

	if (!isAdmin(user)) {
		const [creator, organization] = await Promise.all([
			getCreatorFor(user.id),
			getOrganizationFor(user.id)
		]);

		const mine =
			(owner.creatorId !== null && creator?.id === owner.creatorId) ||
			(owner.organizationId !== null && organization?.id === owner.organizationId);

		if (!mine) return new Response('forbidden', { status: 403 });
	}

	return serveStoredFile(params.name, request, { dir: PRIVATE_DIR, isPrivate: true });
};
