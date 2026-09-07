import type { Handle } from '@sveltejs/kit';
import { building } from '$app/environment';
import { classifyAgent, type AgentKind } from '$lib/server/bots';
import { take, type Limit } from '$lib/server/ratelimit';

/**
 * Making the directory expensive to take and free to read.
 *
 * The data on the public side of this app — who the creators are, what they
 * reach, what they charge — is the product. It is also, laid out over a
 * paginated grid and one URL per profile, a database with a slow API in front
 * of it, and that is exactly how a competitor or a dataset builder sees it.
 * None of what follows makes the site unscrapable; nothing does, short of not
 * publishing. What it does is change the arithmetic, so that taking the whole
 * thing costs days of patient, obviously-abnormal traffic rather than one
 * afternoon of `for page in range(1, 400)`.
 *
 * Three moves, in increasing order of how much they can be trusted:
 *
 *  1. Declared bulk collectors are refused. Cheap, honest, and only works on
 *     crawlers honest enough to say what they are — which, usefully, is most
 *     of the ones that take everything.
 *  2. Everyone else is rate limited by address, in tiers, so that traffic
 *     which does not look like a person reading gets a much smaller budget
 *     than traffic that does.
 *  3. Nothing here is allowed to reach a signed-in user's form submission or
 *     a health check, because a scraping defence that causes an outage has
 *     lost more than the scraper could have taken.
 *
 * What is deliberately *not* here: obfuscated markup, text rendered to canvas,
 * fields split across elements to defeat selectors. Each of those costs a
 * screen-reader user the page and a search engine the listing, and costs a
 * determined scraper about twenty minutes.
 */

/**
 * How many proxies sit in front of this app.
 *
 * The client address is read from the *right* of `X-Forwarded-For`, counting
 * in this many hops, and from nowhere else. A client can put anything it likes
 * on the left of that header — including a forged `X-Real-IP` or
 * `CF-Connecting-IP`, which is why neither is consulted — but it cannot forge
 * what OpenLiteSpeed appends, and that is the address the limits are keyed on.
 *
 * One, for the LiteSpeed reverse proxy described in `server.js`. Put another
 * proxy or a CDN in front and this has to grow to match, or the limits end up
 * keyed on the CDN's egress address, which is to say on nothing.
 */
const XFF_DEPTH = Number(process.env.XFF_DEPTH ?? 1) || 1;

/**
 * Requests that are never counted and never refused.
 *
 * `/health` is what the proxy, the deploy script and any uptime monitor ask,
 * on a schedule, forever — the one caller whose traffic is *supposed* to look
 * robotic. `/files` serves every avatar, cover and portfolio image on a page,
 * so counting it would mean a single grid of creators spending a browsing
 * reader's entire minute of allowance. The webhook is Chapa's, and a payment
 * confirmation dropped for looking automated is a booking stuck in escrow.
 */
const EXEMPT = [/^\/health$/, /^\/files\//, /^\/api\/chapa\//];

/** Whether a path is counted at all. Exported for the tests. */
export const isExempt = (pathname: string) => EXEMPT.some((pattern) => pattern.test(pathname));

/** Endpoints that answer in JSON or XML: the shape a scraper actually wants. */
const STRUCTURED =
	/(?:\/__data\.json$)|(?:^\/creators\/[^/]+\/reviews$)|(?:^\/sitemap\.xml$)|(?:^\/blog\/rss\.xml$)/;

/**
 * The budgets.
 *
 * Each tier is a burst and a sustained rate, and a request has to satisfy
 * both. The burst is what makes a page of thirty cards possible at all; the
 * sustained figure is the one that matters against a harvest, because it is
 * the only number a patient scraper cannot wait out.
 *
 * `page` is sized for the worst honest case rather than the average one: a
 * mobile carrier in this market puts a great many subscribers behind one
 * address, so the limit a shared address gets has to hold a crowd. It is still
 * an order of magnitude below what a scraper wants.
 *
 * `automation` is what a request gets when nothing about it resembles somebody
 * reading — see `looksAutomated`. It is deliberately small. A well-behaved
 * crawler stays under it without trying; a scraper wearing a browser's name
 * but none of a browser's habits does not.
 */
export type Tier = 'page' | 'structured' | 'automation';

const TIERS: Record<Tier, { burst: Limit; sustained: Limit }> = {
	page: {
		burst: { limit: 240, windowMs: 60_000 },
		sustained: { limit: 1_800, windowMs: 3_600_000 }
	},
	structured: {
		burst: { limit: 60, windowMs: 60_000 },
		sustained: { limit: 600, windowMs: 3_600_000 }
	},
	automation: {
		burst: { limit: 30, windowMs: 60_000 },
		sustained: { limit: 300, windowMs: 3_600_000 }
	}
};

/**
 * The address the limits are keyed on, or `null` when there isn't one worth
 * keying on.
 *
 * Null is the important case. If the proxy is misconfigured and forwards no
 * `X-Forwarded-For`, every request arrives from the loopback and every reader
 * looks like the same caller — at which point rate limiting stops being a
 * defence and becomes a site-wide outage with a plausible explanation. So a
 * loopback or link-local peer with no forwarding header means "we cannot tell
 * these apart", and the answer to that is to let them through. Which is also
 * exactly what `vite dev` looks like.
 */
export function clientKey(event: Parameters<Handle>[0]['event']): string | null {
	const forwarded = event.request.headers.get('x-forwarded-for');

	if (forwarded) {
		const hops = forwarded
			.split(',')
			.map((hop) => hop.trim())
			.filter(Boolean);
		const address = hops.at(-XFF_DEPTH) ?? hops.at(0);
		if (address) return normaliseAddress(address);
	}

	let peer: string;
	try {
		peer = event.getClientAddress();
	} catch {
		return null;
	}

	return isLocal(peer) ? null : normaliseAddress(peer);
}

const isLocal = (address: string) =>
	address === '::1' ||
	address === '127.0.0.1' ||
	address.startsWith('127.') ||
	address.startsWith('::ffff:127.');

/**
 * One subscriber, one key.
 *
 * IPv4 keeps its address. IPv6 is truncated to a /64, because a single
 * subscriber is routinely handed a whole /64 and often more — limiting a v6
 * address individually is limiting nothing at all, since the next request can
 * come from a different one at no cost.
 */
export function normaliseAddress(address: string): string {
	let value = address.trim().toLowerCase();

	/* `[2001:db8::1]:443`, and the bracketless `1.2.3.4:5678` some proxies send. */
	if (value.startsWith('[')) value = value.slice(1, value.indexOf(']'));
	else if (value.split(':').length === 2) value = value.split(':')[0];

	value = value.replace(/^::ffff:/, '');

	if (!value.includes(':')) return value;

	const groups = value.split(':');
	/* `::` elides zeroes, and expanding it properly is more machinery than a
	   bucket key deserves — an address that short is already its own prefix. */
	if (value.includes('::') && groups.length < 5) return value;
	return groups.slice(0, 4).join(':') + '::/64';
}

/**
 * Whether a request carries the marks of a browser with a person behind it.
 *
 * Two signals, and it takes the absence of *both* to be judged automated.
 * `Sec-Fetch-*` is sent by every current browser and by almost no scraper, but
 * Safari only started sending it in 16.4, so on its own it would put a real
 * reader on an old iPhone into the automation tier. `Accept-Language` is sent
 * by every browser ever shipped and is the sort of header a scraper author
 * forgets. Together they are hard to be missing both of by accident and easy
 * to be missing both of by writing four lines of Python.
 *
 * Note what this does not do: it does not block, and it does not care whether
 * the values are plausible. A scraper that sets both headers is simply treated
 * as a reader and held to a reader's rate, which is the intended outcome —
 * the point was never to identify robots, only to price bulk collection.
 */
export function looksAutomated(headers: Headers, kind: AgentKind): boolean {
	if (kind === 'tool') return true;
	if (kind === 'search' || kind === 'preview') return false;

	const fetchMetadata = headers.get('sec-fetch-site') ?? headers.get('sec-fetch-mode');
	return !fetchMetadata && !headers.get('accept-language');
}

/**
 * Which budget a request draws on.
 *
 * A `__data.json` fetched by the app itself during a client-side navigation is
 * a page view wearing different clothes, and the browser says so: only a
 * same-origin fetch carries `Sec-Fetch-Site: same-origin`. Anything asking for
 * the same payload without it has skipped the page and gone straight for the
 * machine-readable version, which is a preference worth pricing.
 */
export function tierFor(pathname: string, headers: Headers, kind: AgentKind): Tier {
	if (looksAutomated(headers, kind)) return 'automation';
	if (STRUCTURED.test(pathname) && headers.get('sec-fetch-site') !== 'same-origin') {
		return 'structured';
	}
	return 'page';
}

const refuse = (body: string, status: number, headers: Record<string, string> = {}) =>
	new Response(body, {
		status,
		headers: {
			'content-type': 'text/plain; charset=utf-8',
			'cache-control': 'no-store',
			'x-robots-tag': 'noindex',
			...headers
		}
	});

export const handleBotDefence: Handle = async ({ event, resolve }) => {
	if (building) return resolve(event);

	const { pathname } = event.url;
	if (EXEMPT.some((pattern) => pattern.test(pathname))) return resolve(event);

	const kind = classifyAgent(event.request.headers.get('user-agent'));

	/*
	 * Refused before the rate limiter rather than through it. A collector that
	 * is not welcome at any rate should be told so plainly, and told the same
	 * thing on every request, rather than being let through in a trickle that
	 * reads as a flaky site and invites a retry loop. It costs nothing to
	 * answer: this handle runs after the session lookup, but a crawler carries
	 * no cookie and a cookieless lookup never reaches the database.
	 */
	if (kind === 'harvester') {
		return refuse(
			'This site is not available to automated collection agents. See /robots.txt.\n',
			403
		);
	}

	/*
	 * Only reads are counted.
	 *
	 * A scrape is a read; a form submission is not one, and the two failure
	 * modes are not comparable. Throttling a GET costs a reader a page they can
	 * ask for again in a moment. Throttling the POST that accepts a booking's
	 * terms costs somebody a deal at the point where they had already decided,
	 * and it would do so under load, which is precisely when they are least
	 * able to tell it from a bug. Form posts are already origin-checked and are
	 * not how anybody takes a database.
	 */
	if (event.request.method !== 'GET' && event.request.method !== 'HEAD') {
		return resolve(event);
	}

	const structured = STRUCTURED.test(pathname);
	const tier = tierFor(pathname, event.request.headers, kind);

	/*
	 * Whose allowance this spends.
	 *
	 * Signed-in readers are counted as themselves rather than as their address.
	 * A brand's staff sharing an office — or a whole carrier's subscribers
	 * sharing one carrier-grade NAT address, which is the common case in this
	 * market — must not be able to spend each other's budget. It also means a
	 * scraper cannot dilute itself by signing in: an account is a name, and a
	 * name that harvests the directory is a name that can be suspended.
	 *
	 * The tier is part of the key either way, and that is what lets a reader and
	 * a scraper share an address without sharing a fate. On a carrier-grade NAT
	 * they very often do share one: the scraper drains the small automation
	 * budget for that address while the reader beside it, whose requests carry
	 * the marks of a browser, still has the whole page budget. Crossing into the
	 * reader's bucket costs a scraper a browser's headers — at which point it is
	 * held to a reader's rate, which was the point. It also keeps each bucket to
	 * one capacity, rather than resizing a caller's bucket underneath them as
	 * they move between tiers.
	 */
	const identity = event.locals.user?.id ? `u:${event.locals.user.id}` : clientKey(event);
	const key = identity && `${tier}:${identity}`;

	if (key) {
		const budget = TIERS[tier];
		const burst = take(`${key}#b`, budget.burst);
		const sustained = burst.ok ? take(`${key}#s`, budget.sustained) : burst;

		if (!burst.ok || !sustained.ok) {
			const retryAfter = Math.max(
				burst.ok ? 0 : burst.retryAfter,
				sustained.ok ? 0 : sustained.retryAfter
			);

			return refuse(
				`Too many requests. Try again in ${retryAfter}s.\n\nIf you need this data in bulk, ask: the answer may well be yes.\n`,
				429,
				{ 'retry-after': String(retryAfter) }
			);
		}
	}

	const response = await resolve(event);

	/* A JSON payload has no business in an index, whoever fetched it. */
	if (structured && !pathname.endsWith('.xml')) {
		response.headers.set('x-robots-tag', 'noindex');
	}

	return response;
};
