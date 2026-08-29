<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		eyebrow,
		title,
		description = '',
		actions = undefined
	}: {
		eyebrow: string;
		title: string;
		description?: string;
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

	{#if actions}
		<div class="flex flex-wrap items-center gap-2">
			{@render actions()}
		</div>
	{/if}
</div>
