<script lang="ts">
	import type { Snippet } from 'svelte';
	import { resolve } from '$app/paths';
	import { CircleHelp } from '@lucide/svelte';
	import * as m from '$lib/paraglide/messages';

	let {
		eyebrow,
		title,
		description = '',
		help = undefined,
		actions = undefined
	}: {
		eyebrow: string;
		title: string;
		description?: string;
		/**
		 * The help article that explains this page, as its slug. Rendered as a
		 * quiet link beside the page's own actions, because the docs are worth
		 * nothing if they are only reachable from the footer of the public site.
		 */
		help?: string;
		actions?: Snippet;
	} = $props();
</script>

<div
	class="flex flex-col justify-between gap-4 border-b-2 border-edge pb-4 sm:flex-row sm:items-end"
>
	<div>
		<span class="text-xs font-black tracking-widest text-ink-dim uppercase">{eyebrow}</span>
		<h1 class="text-2xl font-black text-ink sm:text-3xl">{title}</h1>
		{#if description}
			<p class="mt-1 max-w-2xl text-xs font-medium text-ink-soft">{description}</p>
		{/if}
	</div>

	{#if help || actions}
		<div class="flex flex-wrap items-center gap-2">
			{#if help}
				<a
					href={resolve(`/help/${help}`)}
					class="flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-bold text-ink-dim transition-colors hover:bg-panel hover:text-ink"
				>
					<CircleHelp class="h-4 w-4" />
					{m.help_link_label()}
				</a>
			{/if}
			{@render actions?.()}
		</div>
	{/if}
</div>
