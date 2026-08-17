<script lang="ts">
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
		locales.map((locale) => ({ locale, href: localizeHref(page.url.pathname, { locale }) }))
	);
</script>

<svelte:head>
	<!--
		An empty data URL claims the icon slot, so the browser renders a blank tab
		icon instead of falling back to a request for /favicon.ico.
	-->
	<link rel="icon" href="data:," />
</svelte:head>

<!--
	The design is a single, deliberately light visual world — the same one the
	React app ships. Following the operating system here would flip the whole
	marketing surface to a palette the design was never drawn for, so the theme
	is pinned rather than inherited.
-->
<ModeWatcher defaultMode="light" track={false} />
<Toaster
	position="bottom-right"
	toastOptions={{
		class:
			'!rounded-2xl !border-2 !border-slate-900 !shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] !font-black !text-xs'
	}}
/>

{@render children()}

<div style="display:none" aria-hidden="true">
	{#each localeLinks as link (link.locale)}
		<a href={link.href}>{link.locale}</a>
	{/each}
</div>
