<script lang="ts">
	import type { ResolvedPathname } from '$app/types';
	import { page } from '$app/state';
	import { onNavigate } from '$app/navigation';
	import { BRAND_VERSION } from '$lib/brand';
	import { splashLinks } from '$lib/pwa-splash';
	import { locales, localizeHref } from '$lib/paraglide/runtime';
	import './layout.css';
	import { Toaster } from 'svelte-sonner';
	import Pwa from '$lib/components/pwa.svelte';

	let { children } = $props();

	/**
	 * Paraglide needs a link per locale somewhere in the tree to keep its static
	 * analysis happy. These are hidden and never navigated to by a person.
	 */
	/**
	 * Cross-fades between pages, where the browser can.
	 *
	 * `startViewTransition` takes a snapshot of the old page, lets SvelteKit
	 * swap in the new one, and animates between the two — which is the single
	 * cheapest thing that stops a navigation reading as a page load. The promise
	 * handed back to `onNavigate` is what tells SvelteKit to wait until the
	 * snapshot is taken before it touches the DOM.
	 *
	 * Skipped entirely for a reader who has asked for less motion, and on every
	 * browser without the API — in both cases navigation is exactly what it was.
	 */
	onNavigate((navigation) => {
		if (!document.startViewTransition) return;
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		/* A hash on the same page is not a navigation worth animating. */
		if (navigation.from?.url.pathname === navigation.to?.url.pathname) return;

		return new Promise((resolve) => {
			document.startViewTransition(async () => {
				resolve();
				await navigation.complete;
			});
		});
	});

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

	<!--
		Installing the site as an app.

		The manifest is versioned with the icons it names, for the reason above:
		Cloudflare keeps a static file for up to a week, and a manifest pointing
		at icons that no longer exist installs an app with a blank square on the
		home screen.

		`theme_color` in the manifest colours the window; this tag is what colours
		the browser's own bar before the manifest is read, so the two say the same
		thing. White, because the header underneath it is white — a status bar
		that does not match the top of the page is the clearest tell that a thing
		is a web page in a costume.
	-->
	<link rel="manifest" href="/manifest.webmanifest?v={BRAND_VERSION}" />
	<meta name="theme-color" content="#ffffff" />
	<meta name="mobile-web-app-capable" content="yes" />
	<!-- iOS reads neither of the two above. These are its spellings. -->
	<meta name="apple-mobile-web-app-capable" content="yes" />
	<meta name="apple-mobile-web-app-status-bar-style" content="default" />
	<meta name="apple-mobile-web-app-title" content="Influencer" />

	<!--
		iOS shows a white rectangle while an installed app boots unless it is
		handed a launch image matching the device exactly. See `$lib/pwa-splash`.
	-->
	{#each splashLinks(BRAND_VERSION) as splash (splash.href + splash.media)}
		<link rel="apple-touch-startup-image" media={splash.media} href={splash.href} />
	{/each}
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
<!--
	Lifted clear of the bottom bar on a phone, where the bar is the primary
	navigation and a toast landing on it covers the way out of the page it is
	complaining about. Above `md` there is no bar and the offset is zero.
-->
<Toaster
	position="bottom-right"
	offset={{ bottom: 'calc(4.5rem + env(safe-area-inset-bottom))' }}
	mobileOffset={{
		bottom: 'calc(4.5rem + env(safe-area-inset-bottom))',
		left: '0.75rem',
		right: '0.75rem'
	}}
	toastOptions={{
		/*
		 * The `max-w` is load-bearing, not decoration: measured on a 412px screen
		 * a toast came out 543px wide and pushed the whole page sideways. Sonner
		 * sizes toasts from its own `--width` and its mobile rules did not win
		 * here; clamping to the viewport is the fix that holds whatever it does
		 * internally, and costs nothing on a wide screen where the toast is
		 * narrower than the bound anyway.
		 */
		class:
			'!rounded-2xl !border-2 !border-edge !shadow-[4px_4px_0px_0px_rgb(var(--bento-shadow))] !font-black !text-xs !max-w-[calc(100vw-1.5rem)]'
	}}
/>

<Pwa />

{@render children()}

<div style="display:none" aria-hidden="true">
	{#each localeLinks as link (link.locale)}
		<a href={link.href}>{link.locale}</a>
	{/each}
</div>
