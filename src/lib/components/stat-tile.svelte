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

	/**
	 * Each pastel tile has an ink drawn against that tile rather than against the
	 * page, so the footnote keeps its contrast in both themes — the tiles go deep
	 * in dark rather than pale, and their inks go light with them.
	 *
	 * `dark` is the emphatic tile: it inverts, so its ink is the inverse scale.
	 */
	const noteClass: Record<string, string> = {
		white: 'text-ink-dim',
		mint: 'text-tile-mint-ink',
		yellow: 'text-tile-yellow-ink',
		indigo: 'text-tile-indigo-ink',
		peach: 'text-tile-peach-ink',
		dark: 'text-inverse-ink-dim'
	};
</script>

<div class="{toneClass[tone]} flex flex-col justify-between gap-2">
	<div>
		<div class="flex items-start justify-between gap-2">
			<span
				class="block text-[10px] font-black tracking-widest uppercase {tone === 'dark'
					? 'text-inverse-brand'
					: 'text-ink-soft'}"
			>
				{label}
			</span>
			{#if icon}
				{@render icon()}
			{/if}
		</div>
		<span class="text-3xl font-black {tone === 'dark' ? 'text-inverse-ink' : 'text-ink'}">
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
