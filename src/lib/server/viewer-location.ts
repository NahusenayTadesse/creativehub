import { and, asc, eq, isNull } from 'drizzle-orm';
import { getRequestEvent } from '$app/server';
import { db } from '$lib/server/db';
import * as t from '$lib/server/db/schema';
import type { ViewerLocation } from '$lib/domain/trending';

/**
 * Where the reader is, for the lists that put their own market first.
 *
 * Nothing here asks the browser. A creator's or a brand's own profile already
 * says where they are, and it says so more reliably than an IP does — a reader
 * who told us their country once should not be re-guessed on every request.
 * The proxy header is the fallback for the signed-out visitor, and "we do not
 * know" is a perfectly good third answer: it turns the personalisation off for
 * that reader rather than inventing a location for them.
 */

export type ResolvedViewerLocation = ViewerLocation & {
	source: 'creator' | 'organization' | 'header';
};

/**
 * Country codes the proxies in front of this app may set.
 *
 * Nothing sets one in the default deployment; the entry exists so that putting
 * Cloudflare in front of the site starts personalising signed-out readers
 * without a code change.
 */
const GEO_HEADERS = ['cf-ipcountry', 'x-vercel-ip-country', 'x-geo-country', 'x-country-code'];

/** A country header that means "no idea", which several proxies send. */
const UNKNOWN_CODES = new Set(['', 'XX', 'T1', 'ZZ']);

/**
 * The reader's location, worked out once per request.
 *
 * Memoised on `locals` the way reference data is: the homepage strip and the
 * discovery grid both want this, and the profile lookup behind it is a query
 * neither of them should pay for twice.
 */
export function getViewerLocation(): Promise<ResolvedViewerLocation | null> {
	let event: ReturnType<typeof getRequestEvent> | undefined;
	try {
		event = getRequestEvent();
	} catch {
		/* Outside a request — a script, a test. Nobody is reading. */
		return Promise.resolve(null);
	}
	return (event.locals.viewerLocation ??= resolveViewerLocation(event));
}

async function resolveViewerLocation(
	event: ReturnType<typeof getRequestEvent>
): Promise<ResolvedViewerLocation | null> {
	const userId = event.locals.user?.id;

	if (userId) {
		const creator = (
			await db
				.select({
					countryId: t.creators.countryId,
					regionId: t.creators.regionId,
					city: t.creators.city
				})
				.from(t.creators)
				.where(and(eq(t.creators.userId, userId), isNull(t.creators.deletedAt)))
				.orderBy(asc(t.creators.id))
				.limit(1)
		).at(0);
		if (creator?.countryId) return { ...creator, source: 'creator' };

		const organization = (
			await db
				.select({ countryId: t.organizations.countryId, city: t.organizations.city })
				.from(t.organizations)
				.where(and(eq(t.organizations.ownerId, userId), isNull(t.organizations.deletedAt)))
				.orderBy(asc(t.organizations.id))
				.limit(1)
		).at(0);
		/* Organisations carry no region — a brand states a country and a city. */
		if (organization?.countryId) {
			return { ...organization, regionId: null, source: 'organization' };
		}
	}

	return fromHeaders(event.request.headers);
}

/** The country a proxy says the request came from, if one said anything. */
async function fromHeaders(headers: Headers): Promise<ResolvedViewerLocation | null> {
	const code = GEO_HEADERS.map((header) => headers.get(header)?.trim().toUpperCase())
		.filter((value): value is string => !!value && !UNKNOWN_CODES.has(value))
		.at(0);
	if (!code) return null;

	const country = (
		await db
			.select({ id: t.countries.id })
			.from(t.countries)
			/* Only a market the platform actually operates in. Anywhere else is the
			   same as no answer: there are no creators there to put first. */
			.where(
				and(
					eq(t.countries.code, code),
					eq(t.countries.isActive, true),
					isNull(t.countries.deletedAt)
				)
			)
			.limit(1)
	).at(0);
	if (!country) return null;

	return { countryId: country.id, regionId: null, city: null, source: 'header' };
}
