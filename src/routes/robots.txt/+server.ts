import { DISALLOWED_ROBOTS } from '$lib/server/bots';
import type { RequestHandler } from './$types';

/**
 * A route rather than a file in `static/`, for two reasons: the `Sitemap:`
 * directive has to be an absolute URL and only the request knows the origin,
 * and the list of collectors turned away below is generated from the same
 * array `$lib/server/bots.ts` refuses at the door. A crawler told "no" here
 * and served content anyway learns that this file is decorative; one refused
 * without ever being asked has a fair complaint. Keeping both from one list
 * means neither can happen through drift.
 *
 * Everything disallowed for ordinary crawlers is either behind a session, has
 * no business in an index, or is the machine-readable twin of a page that is
 * already indexed — `/files` serves uploads, `/login` carries a `?next=` that
 * would be crawled and cached, `/health` is for the proxy, and `__data.json`
 * is the same profile a crawler can already read as HTML, in the form a
 * scraper would prefer.
 */
export const GET: RequestHandler = ({ url, setHeaders }) => {
	setHeaders({ 'content-type': 'text/plain', 'cache-control': 'public, max-age=3600' });

	/*
	 * Named individually rather than as one grouped record. Several of these
	 * crawlers are documented as matching only the first group whose token they
	 * find, and a shared group is where a token quietly stops applying.
	 */
	const harvesters = DISALLOWED_ROBOTS.map((token) => `User-agent: ${token}\nDisallow: /\n`).join(
		'\n'
	);

	return new Response(
		`# Creators here are people, and their reach, rates and contact details are
# their livelihood rather than a public dataset. Bulk collection is refused
# below and enforced in the application, not merely requested. If you want
# this data for something, write to us — the answer may well be yes.

${harvesters}
User-agent: *
Disallow: /dashboard
Disallow: /files
Disallow: /login
Disallow: /register
Disallow: /logout
Disallow: /health
Disallow: /verify-email
Disallow: /reset-password
Disallow: /forgot-password
# The JSON behind every page, and the JSON behind the review lists.
Disallow: /*__data.json$
Disallow: /creators/*/reviews
# One page at a time is plenty; the sitemap says what is worth fetching.
Crawl-delay: 10

Sitemap: ${new URL('/sitemap.xml', url.origin).href}
`
	);
};
