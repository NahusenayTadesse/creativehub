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
		}

		// interface Error {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
