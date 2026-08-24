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
					'script-src': ['self'],
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
					'form-action': ['self'],
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
