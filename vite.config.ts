import { paraglideVitePlugin } from '@inlang/paraglide-js';
import tailwindcss from '@tailwindcss/vite';
import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			/**
			 * A Content-Security-Policy, generated at build time.
			 *
			 * It has to live here rather than in `hooks.server.ts`: SvelteKit
			 * emits inline scripts for hydration and only the build knows their
			 * hashes, so a hand-written header would either break the app or have
			 * to allow `unsafe-inline`, which is the same as having no policy.
			 *
			 * `img-src` includes `data:` for the inline blank favicon in
			 * `+layout.svelte`, and `blob:` for the client-side image previews
			 * `FileUpload` makes before an upload is sent.
			 */
			csp: {
				mode: 'auto',
				directives: {
					'default-src': ['self'],
					/*
					 * Two hashes, for the two inline scripts this app genuinely needs.
					 *
					 * The first is `mode-watcher`'s theme-init script. It runs before
					 * paint to set the colour scheme, so it has to be inline, and the
					 * component emits it without a nonce — SvelteKit mints the nonce
					 * per response and has no way to hand one to a component. Blocked,
					 * it costs the very thing the script exists for: the theme lands
					 * after first paint instead of before it. The script embeds
					 * `ModeWatcher`'s props, so changing `defaultMode` or `track` in the
					 * root layout changes this hash.
					 *
					 * The second is Svelte's event replay hook. Svelte puts
					 * `onload="this.__e=event"` and `onerror="this.__e=event"` on every
					 * server-rendered `<img>` — unconditionally, whether or not the
					 * component declares a handler — so that an event firing before
					 * hydration can be replayed afterwards. That is what `AppImage`
					 * relies on to draw a placeholder for an image that failed while
					 * the page was still parsing. Blocked, it was 96 refusals on a
					 * single discovery page, which is also enough console noise to bury
					 * a real one.
					 *
					 * `unsafe-hashes` is what lets a hash match an event-handler
					 * attribute rather than a `<script>` block. It is narrower than it
					 * sounds: it permits exactly these two strings and nothing else,
					 * and the second of them stores an event object on an element. It
					 * does not admit inline script generally.
					 *
					 * `e2e/csp.e2e.ts` fails if either hash drifts, rather than leaving
					 * it to be noticed in a console months later.
					 */
					'script-src': [
						'self',
						'unsafe-hashes',
						/* mode-watcher theme init */
						'sha256-Cr3r+iKjDTUxJaxM3r/Iq0ow6clOB9AqoT6j0wMFMIM=',
						/* Svelte event replay: this.__e=event */
						'sha256-7dQwUgLau1NFCCGjfn9FsYptB6ZtWxJin6VohGIu20I='
					],
					'style-src': ['self', 'unsafe-inline'],
					/*
					 * `https:` rather than a host list: creator avatars, covers and
					 * portfolio items are URLs from rows — scraped profiles, imports,
					 * whatever an operator pastes — so no fixed set of hosts covers
					 * them. The cost is that a row can point a viewer's browser at any
					 * https host, which leaks that viewer's IP to it. Nothing is
					 * executed: `img-src` only governs images, and `AppImage` draws a
					 * placeholder for whatever fails to arrive.
					 */
					'img-src': ['self', 'data:', 'blob:', 'https:'],
					'font-src': ['self', 'data:'],
					'connect-src': ['self'],
					/*
					 * `accounts.google.com` because the Google sign-in button is a
					 * real form post: it submits to this origin, and the action
					 * answers with a 303 to Google's consent screen. Browsers apply
					 * `form-action` to the *redirect target* of a submission as well
					 * as the action URL, so `self` alone silently kills the button —
					 * the POST succeeds and the navigation is blocked.
					 */
					'form-action': ['self', 'https://accounts.google.com'],
					'frame-ancestors': ['none'],
					'base-uri': ['self'],
					'object-src': ['none']
				}
			},
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter(),
			typescript: {
				config: (config) => {
					config.include.push('../drizzle.config.ts');
				}
			}
		}),

		paraglideVitePlugin({
			project: './project.inlang',
			outdir: './src/lib/paraglide',
			emitTsDeclarations: true
		})
	],

	/**
	 * Everything the server bundle needs, inside the server bundle.
	 *
	 * The deploy ships `build/` and nothing else — there are no `node_modules`
	 * on the server — so a dependency Vite decides to leave as a bare import is
	 * a 500 the moment a route touches it, and only that route. That is exactly
	 * how it went unnoticed: `@internationalized/date` reaches the server bundle
	 * through the date pickers inside `InputComp`, so every signed-in form page
	 * was failing while the public pages, which had no `InputComp`, were fine.
	 *
	 * `scripts/verify-build.ts` fails the build if any bare specifier survives,
	 * so the next one cannot reach production the same quiet way.
	 */
	ssr: {
		noExternal: ['@internationalized/date', 'browser-image-compression']
	},

	/**
	 * Unit tests.
	 *
	 * Two projects, because they need opposite environments. `domain` is pure
	 * arithmetic and lifecycle rules and runs in node; `client` renders Svelte
	 * components and needs a DOM. Server code that talks to the database is
	 * deliberately not covered here — that is what the Playwright suite is for.
	 */
	test: {
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'domain',
					environment: 'node',
					include: ['src/lib/**/*.test.ts', 'src/**/*.server.test.ts'],
					exclude: ['src/**/*.svelte.test.ts']
				}
			}
		],
		coverage: {
			include: ['src/lib/domain/**', 'src/lib/query.ts', 'src/lib/server/query.ts'],
			reporter: ['text', 'html']
		}
	}
});
