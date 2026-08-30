import { env } from '$env/dynamic/private';

/**
 * A site-relative path, made absolute.
 *
 * Anything leaving the building has to carry a whole URL: a link in an email is
 * clicked from an inbox, and a callback handed to a payment provider is fetched
 * from their servers. `ORIGIN` is the value the rest of the app already trusts
 * for this — better-auth signs cookies against it and adapter-node checks form
 * posts against it — so a wrong one is visible long before it reaches here.
 *
 * A URL that is already absolute is returned untouched, so callers can pass
 * either without checking which they hold.
 */
export function absoluteUrl(path: string): string {
	if (/^https?:\/\//i.test(path)) return path;
	const origin = (env.ORIGIN || '').replace(/\/$/, '');
	return `${origin}${path.startsWith('/') ? path : `/${path}`}`;
}
