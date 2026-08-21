import { sequence } from '@sveltejs/kit/hooks';
import { building, dev } from '$app/environment';
import { randomUUID } from 'node:crypto';
import { auth } from '$lib/server/auth';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import type { Handle, HandleServerError } from '@sveltejs/kit';
import { getTextDirection } from '$lib/paraglide/runtime';
import { paraglideMiddleware } from '$lib/paraglide/server';
import * as m from '$lib/paraglide/messages';

const handleParaglide: Handle = ({ event, resolve }) =>
	paraglideMiddleware(event.request, ({ request, locale }) => {
		event.request = request;

		return resolve(event, {
			transformPageChunk: ({ html }) =>
				html
					.replace('%paraglide.lang%', locale)
					.replace('%paraglide.dir%', getTextDirection(locale))
		});
	});

/**
 * Headers every response carries.
 *
 * A Content-Security-Policy is not set here — SvelteKit generates one from
 * `kit.csp` in `vite.config.ts`, because only the build knows the hashes of the
 * inline scripts it emits for hydration. These are the headers that need no
 * such knowledge.
 */
const handleSecurityHeaders: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);

	/* No page here is meant to be framed, and clickjacking a form that moves a
	   booking through its lifecycle is the thing worth refusing. */
	response.headers.set('X-Frame-Options', 'DENY');
	/* A sniffed Content-Type is how an uploaded "image" becomes a script. */
	response.headers.set('X-Content-Type-Options', 'nosniff');
	/* Full URLs carry `?next=`, search terms and creator names; other origins
	   get the origin only. */
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	/* Nothing in this app asks for any of these. */
	response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

	return response;
};

const handleBetterAuth: Handle = async ({ event, resolve }) => {
	const session = await auth.api.getSession({ headers: event.request.headers });

	if (session) {
		event.locals.session = session.session;
		event.locals.user = session.user;
	}

	return svelteKitHandler({ event, resolve, auth, building });
};

export const handle: Handle = sequence(handleSecurityHeaders, handleParaglide, handleBetterAuth);

/**
 * What happens when something throws that nobody expected.
 *
 * Two jobs. The log line gets everything needed to find it — the id, the route,
 * the method, the actor — because "it broke" from a user is otherwise
 * untraceable. The reader gets the id and nothing else: a stack trace on an
 * error page tells an attacker about the file layout and tells everyone else
 * nothing they can act on.
 */
export const handleError: HandleServerError = ({ error, event, status, message }) => {
	/* 404s are not incidents. */
	if (status === 404) return { message };

	const id = randomUUID();

	console.error(
		JSON.stringify({
			level: 'error',
			id,
			at: new Date().toISOString(),
			status,
			method: event.request.method,
			route: event.route.id ?? event.url.pathname,
			userId: event.locals.user?.id ?? null,
			message: error instanceof Error ? error.message : String(error)
		})
	);
	if (error instanceof Error && error.stack) console.error(error.stack);

	return {
		/* In development the real message is far more useful than a reference. */
		message: dev && error instanceof Error ? error.message : m.err_unexpected(),
		id
	};
};
