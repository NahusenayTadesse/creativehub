<script lang="ts">
	import type { ResolvedPathname } from '$app/types';
	import { page } from '$app/state';
	import { BRAND_VERSION } from '$lib/brand';
	import { locales, localizeHref } from '$lib/paraglide/runtime';
	import './layout.css';
	import { Toaster } from 'svelte-sonner';

	let { children } = $props();

	/**
	 * Paraglide needs a link per locale somewhere in the tree to keep its static
	 * analysis happy. These are hidden and never navigated to by a person.
	 */
	const localeLinks = $derived(
		locales.map((locale) => ({
			locale,
			/* `localizeHref` builds from the current pathname, which already carries
			   `paths.base` — so this is resolved, not a route id to resolve. */
			href: localizeHref(page.url.pathname, { locale }) as ResolvedPathname
		}))
	);
</script>

<svelte:head>
	<!--
		The tab icon is the textless square, which is the only one of the three
		marks that survives being drawn at 16px.

		It is a static path rather than the operator's uploaded `logoMark`: this
		is the root layout, and reading settings here would put a `<link>` that
		changes per install into the head of every page including the ones that
		render before any database call. An operator who replaces the mark on the
		settings page changes it everywhere it is drawn on a page; the browser
		chrome keeps the shipped one.
	-->
	<!-- Versioned so a rebuilt icon is not hidden behind Cloudflare's copy of the
	     old one — see BRAND_VERSION in $lib/brand. -->
	<link rel="icon" href="/favicon.png?v={BRAND_VERSION}" type="image/png" />
	<link rel="apple-touch-icon" href="/apple-touch-icon.png?v={BRAND_VERSION}" />
</svelte:head>

<!--
	The site is light, for everybody, whatever their operating system says.

	`<ModeWatcher />` used to sit here and stamp `.dark` on <html> before first
	paint. It is removed rather than configured to prefer light, because its
	props cannot force anything: `defaultMode` only supplies a starting value,
	and the mode it derives comes from `userPrefersMode` — the reader's own
	`mode-watcher-mode` in localStorage. Every reader who had already chosen dark
	would have stayed dark, which is the one case this change is about.

	With nothing stamping the class, `.dark` in layout.css and every `dark:`
	utility are inert, and `color-scheme: light` on `:root` keeps the browser's
	own furniture — scrollbars, date pickers, form controls — from going dark
	underneath a light page.

	To put the choice back: restore this component and the four places that
	rendered `ThemeToggle` / `ThemeChoice` (site-nav, the dashboard layout and
	the settings page); both components are still here, untouched. The inline
	script it injects needs its hash back in `kit.csp` in vite.config.ts.
-->
<Toaster
	position="bottom-right"
	toastOptions={{
		class:
			'!rounded-2xl !border-2 !border-edge !shadow-[4px_4px_0px_0px_rgb(var(--bento-shadow))] !font-black !text-xs'
	}}
/>

{@render children()}

<div style="display:none" aria-hidden="true">
	{#each localeLinks as link (link.locale)}
		<a href={link.href}>{link.locale}</a>
	{/each}
</div>
