import type { RequestHandler } from './$types';

/**
 * A route rather than a file in `static/`, for one reason: the `Sitemap:`
 * directive has to be an absolute URL, and only the request knows the origin.
 * A relative one is outside the spec and most crawlers drop it.
 *
 * Everything disallowed is either behind a session or has no business in an
 * index — `/files` serves uploads, `/login` carries a `?next=` that would be
 * crawled and cached, `/health` is for the proxy.
 */
export const GET: RequestHandler = ({ url, setHeaders }) => {
	setHeaders({ 'content-type': 'text/plain', 'cache-control': 'public, max-age=3600' });

	return new Response(
		`User-agent: *
Disallow: /dashboard
Disallow: /files
Disallow: /login
Disallow: /register
Disallow: /logout
Disallow: /health

Sitemap: ${new URL('/sitemap.xml', url.origin).href}
`
	);
};
