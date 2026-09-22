<script lang="ts">
	import { resolve } from '$app/paths';
	import { ArrowRight } from '@lucide/svelte';
	import * as m from '$lib/paraglide/messages';
	import { helpCategoryTitle, type HelpArticle } from '$lib/domain/help';

	/**
	 * One article, as the help index and an article's "more in this topic" list
	 * both draw it. Shared so a search result and a topic listing cannot end up
	 * describing the same article differently.
	 */
	let { article, showCategory = false }: { article: HelpArticle; showCategory?: boolean } =
		$props();

	/* Only the two sided badges are worth the room: "for everyone" on most of
	   the catalogue is noise that says nothing about the article. */
	const sideLabel = $derived(
		article.audience === 'brands'
			? m.help_badge_brands()
			: article.audience === 'creators'
				? m.help_badge_creators()
				: ''
	);
</script>

<a href={resolve(`/help/${article.slug}`)} class="bento-card group flex h-full flex-col gap-2 p-5!">
	<div class="flex flex-wrap items-center gap-2">
		{#if showCategory}
			<span class="text-[11px] font-black tracking-widest text-ink-dim uppercase">
				{helpCategoryTitle(article.category)}
			</span>
		{/if}
		{#if sideLabel}
			<span
				class="rounded-full border border-edge-soft bg-panel px-2 py-0.5 text-[11px] font-black text-ink-soft"
			>
				{sideLabel}
			</span>
		{/if}
	</div>

	<h3 class="text-base font-black text-ink">{article.title}</h3>
	<p class="text-sm leading-relaxed font-medium text-ink-soft">{article.summary}</p>

	<span class="mt-auto pt-2 text-ink-dim transition-transform group-hover:translate-x-1">
		<ArrowRight class="h-4 w-4 rtl:rotate-180" />
	</span>
</a>
