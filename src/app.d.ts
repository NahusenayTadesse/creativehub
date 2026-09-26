import type { User, Session } from 'better-auth';

/**
 * `role` and `phone` are declared as better-auth additionalFields in
 * $lib/server/auth.ts, so they exist at runtime but are absent from the base
 * User type. Widening it here keeps every guard and load honest about them.
 */
type AppUser = User & {
	role?: string | null;
	phone?: string | null;
};

// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		interface Locals {
			user?: AppUser;
			session?: Session;
			/**
			 * One flight of reference data per request, shared by the root layout
			 * and by every form that needs the same option lists. The promise is
			 * what is cached, so parallel loads join it rather than racing.
			 */
			referenceData?: Promise<import('$lib/server/queries').ReferenceData>;
			/**
			 * Where the reader is, resolved at most once per request — see
			 * $lib/server/viewer-location.ts. `null` once resolved means we could
			 * not tell, which is a settled answer rather than a missing one.
			 */
			viewerLocation?: Promise<import('$lib/server/viewer-location').ResolvedViewerLocation | null>;
			/**
			 * The market whose own trending board this reader is served, or null
			 * for the shared board — see `getViewerMarket` in
			 * $lib/server/trending-service.ts.
			 */
			trendingMarket?: Promise<number | null>;
			/**
			 * The site settings row, read at most once per request. Listings ask
			 * it who may be shown publicly and which market leads, so without
			 * this every strip on the homepage would read it again.
			 */
			siteSettings?: Promise<
				Awaited<ReturnType<typeof import('$lib/server/queries').loadSettings>>
			>;
		}

		// interface Error {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
