<script lang="ts">
	import type { ResolvedPathname } from '$app/types';
	import { page } from '$app/state';
	import { locales, localizeHref } from '$lib/paraglide/runtime';
	import './layout.css';
	import { ModeWatcher } from 'mode-watcher';
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
	<link rel="icon" href="/favicon.png" type="image/png" />
	<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
</svelte:head>

<!--
	The theme follows the operating system unless the reader has said otherwise,
	and mode-watcher stamps the choice on <html> from an inline script that runs
	before first paint — so a dark-mode reader never sees a white flash.

	That script is inline by necessity: it has to run before the browser paints,
	and a nonce cannot be handed to a component. Its hash is pinned in
	`kit.csp` in vite.config.ts, so changing the props here changes the script
	and invalidates that hash. e2e/csp.e2e.ts fails loudly if the two drift.
-->
<ModeWatcher />
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
