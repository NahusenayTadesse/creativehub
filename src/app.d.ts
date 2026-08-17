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
		}

		// interface Error {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
