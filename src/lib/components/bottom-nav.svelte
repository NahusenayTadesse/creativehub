<script lang="ts" module>
	import type { Component } from 'svelte';

	/**
	 * One thumb-sized destination.
	 *
	 * Either a link (`url`) or an action (`onSelect`) — the dashboard's last slot
	 * opens the full menu rather than going anywhere, and a bar that could only
	 * hold links would have had to leave it out.
	 */
	export type BottomNavItem = {
		title: string;
		icon: Component;
		url?: string;
		onSelect?: () => void;
		/** A badge, drawn only when it is above zero. */
		counter?: number;
		/**
		 * How the current path decides this is the open one. `prefix` also lights
		 * up for the pages underneath — a booking's detail page is still
		 * Bookings — which is wrong for the two roots, `/` and `/dashboard`,
		 * since every path begins with them.
		 */
		match?: 'exact' | 'prefix';
	};
</script>

<script lang="ts">
	import { page } from '$app/state';

	/**
	 * The row of destinations along the bottom of a phone screen.
	 *
	 * Below `md` this is the primary navigation, because the top of a phone is
	 * the part of the screen a thumb cannot reach. Above `md` it is not rendered
	 * at all: a pointer has no reach problem, and the header and sidebar are
	 * already there.
	 *
	 * Width is `100vw` rather than `inset-x-0`. On a page whose content has any
	 * horizontal scrollable overflow — the trending board's 720px table — the
	 * containing block a `left:0; right:0` box resolves against came out wider
	 * than the screen, and the bar stretched to 567px on a 412px phone, putting
	 * its last item off the side. The viewport unit cannot do that.
	 *
	 * It is `fixed`, so whatever it sits over has to reserve room for it —
	 * `pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0` on the scrolling
	 * element. The inset is the strip iOS keeps for the home indicator; without
	 * it the bottom row of labels sits under the reader's own gesture bar.
	 */
	let { items, class: className = '' }: { items: BottomNavItem[]; class?: string } = $props();

	const isOpen = (item: BottomNavItem) => {
		if (!item.url) return false;
		const here = page.url.pathname.replace(/\/$/, '') || '/';
		const there = item.url.replace(/\/$/, '') || '/';
		return item.match === 'prefix'
			? here === there || here.startsWith(`${there}/`)
			: here === there;
	};

	/* Both branches below draw the same thing; only the element differs. */
	const face =
		'relative flex w-full cursor-pointer flex-col items-center gap-0.5 px-1 py-2 transition-colors';
</script>

{#snippet inside(item: BottomNavItem, open: boolean)}
	{@const Icon = item.icon}
	<span class="relative">
		<Icon class="h-5 w-5" />
		{#if item.counter && item.counter > 0}
			<span
				class="absolute -top-1.5 -right-2 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[9px] font-black text-white"
			>
				{item.counter > 9 ? '9+' : item.counter}
			</span>
		{/if}
	</span>
	<span class="w-full truncate text-center text-[10px] font-black">{item.title}</span>
	<!--
		The open tab is marked twice: by colour, and by a bar. Colour on its own
		leaves a reader who cannot tell these two apart with nothing to go on.
	-->
	{#if open}
		<span class="absolute inset-x-3 top-0 h-0.5 rounded-full bg-brand" aria-hidden="true"></span>
	{/if}
{/snippet}

<nav
	aria-label="Primary"
	class="fixed bottom-0 left-0 z-40 w-screen max-w-[100vw] border-t-2 border-edge bg-surface pb-[env(safe-area-inset-bottom)] md:hidden {className}"
>
	<ul class="grid" style="grid-template-columns: repeat({items.length}, minmax(0, 1fr))">
		{#each items as item (item.title)}
			{@const open = isOpen(item)}
			<li class="min-w-0">
				{#if item.url}
					<!-- Already resolved: every caller builds `url` with `resolve()`, which
					     this rule cannot see from here. -->
					<!-- eslint-disable svelte/no-navigation-without-resolve -->
					<a
						href={item.url}
						aria-current={open ? 'page' : undefined}
						class="{face} {open ? 'text-brand-fg' : 'text-ink-dim hover:text-ink'}"
					>
						{@render inside(item, open)}
					</a>
					<!-- eslint-enable svelte/no-navigation-without-resolve -->
				{:else}
					<button type="button" onclick={item.onSelect} class="{face} text-ink-dim hover:text-ink">
						{@render inside(item, open)}
					</button>
				{/if}
			</li>
		{/each}
	</ul>
</nav>
