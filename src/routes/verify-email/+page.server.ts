import type { PageServerLoad } from './$types';

/**
 * Where the confirmation link lands, after it has already worked.
 *
 * The link in the message points at better-auth's `/api/auth/verify-email`,
 * which is what actually reads the token, marks the address confirmed and opens
 * a session. It then redirects here — plainly on success, or with `?error=<code>`
 * when the token was expired, spent or malformed. So this page reports an
 * outcome it did not produce, and there is nothing to do on load but read which
 * one it was.
 */
export const load: PageServerLoad = async ({ url, locals }) => ({
	ok: !url.searchParams.get('error'),
	signedIn: Boolean(locals.user)
});
