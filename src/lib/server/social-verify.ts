/**
 * The channels form's side of the link check.
 *
 * `social-check.ts` knows how to ask a platform about a handle. This knows what
 * a form has just posted — a `platformId` rather than a name — and what the
 * answer should mean for the row being written. Two callers share it so they
 * cannot disagree: the "Check" button, which reports, and the save, which
 * refuses.
 */
import * as m from '$lib/paraglide/messages';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import * as t from '$lib/server/db/schema';
import { checkSocialAccount, isCheckablePlatform, type LinkCheck } from '$lib/server/social-check';

/** The platform's name, or null if the id names no row. */
async function platformName(platformId: number): Promise<string | null> {
	if (!Number.isFinite(platformId) || platformId <= 0) return null;
	const rows = await db
		.select({ name: t.platforms.name })
		.from(t.platforms)
		.where(eq(t.platforms.id, platformId))
		.limit(1);
	return rows.at(0)?.name ?? null;
}

export type VerifiedLink = LinkCheck & {
	platform: string | null;
	/** Whether this platform can be checked at all — see `social-check.ts`. */
	checkable: boolean;
	/** One sentence for the reader, in their language. */
	text: string;
};

/** The sentence that goes with a verdict. */
function describe(check: LinkCheck, platform: string | null, checkable: boolean): string {
	if (!platform) return m.sc_no_platform();
	if (!checkable) return m.sc_unknown_platform({ platform });
	switch (check.status) {
		case 'found':
			return m.sc_found({ platform });
		case 'not_found':
			return m.sc_not_found({ platform });
		default:
			return m.sc_unknown({ platform });
	}
}

/**
 * Checks the handle a channels form posted.
 *
 * Never throws: a platform that will not answer is a `unknown` verdict, which
 * every caller treats as "carry on".
 */
export async function verifySubmittedLink(
	platformId: number,
	handle: string
): Promise<VerifiedLink> {
	const platform = await platformName(platformId);
	if (!platform) {
		return {
			status: 'unknown',
			url: null,
			detail: 'no_platform',
			platform: null,
			checkable: false,
			text: m.sc_no_platform()
		};
	}

	/* `checkSocialAccount` short-circuits on a platform it has no strategy for,
	   so this costs no request for Instagram — and still returns the address, so
	   the reader can go and look at what the server could not. */
	const checkable = isCheckablePlatform(platform);
	const check = await checkSocialAccount(platform, handle);

	return { ...check, platform, checkable, text: describe(check, platform, checkable) };
}
