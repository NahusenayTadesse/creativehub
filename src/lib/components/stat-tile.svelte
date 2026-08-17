<script lang="ts">
	import type { Snippet } from 'svelte';

	/**
	 * The bento stat tile the React dashboards are built from: a tiny uppercase
	 * eyebrow, a heavy figure, and an optional footnote.
	 */
	let {
		label,
		value,
		note = '',
		tone = 'white',
		icon = undefined,
		children = undefined
	}: {
		label: string;
		value: string | number;
		note?: string;
		tone?: 'white' | 'mint' | 'yellow' | 'indigo' | 'peach' | 'dark';
		icon?: Snippet;
		children?: Snippet;
	} = $props();

	const toneClass: Record<string, string> = {
		white: 'bento-card bento-card-static',
		mint: 'bento-card-mint',
		yellow: 'bento-card-yellow',
		indigo: 'bento-card-indigo',
		peach: 'bento-card-peach',
		dark: 'bento-card-dark'
	};

	const noteClass: Record<string, string> = {
		white: 'text-slate-500',
		mint: 'text-emerald-800',
		yellow: 'text-amber-800',
		indigo: 'text-indigo-800',
		peach: 'text-orange-800',
		dark: 'text-slate-400'
	};
</script>

<div class="{toneClass[tone]} flex flex-col justify-between gap-2">
	<div>
		<div class="flex items-start justify-between gap-2">
			<span
				class="block text-[10px] font-black tracking-widest uppercase {tone === 'dark'
					? 'text-emerald-400'
					: 'text-slate-600'}"
			>
				{label}
			</span>
			{#if icon}
				{@render icon()}
			{/if}
		</div>
		<span class="text-3xl font-black {tone === 'dark' ? 'text-white' : 'text-slate-900'}">
			{value}
		</span>
	</div>

	{#if note}
		<p class="mt-1 text-[10px] font-bold {noteClass[tone]}">{note}</p>
	{/if}

	{#if children}
		{@render children()}
	{/if}
</div>
