<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import * as m from '$lib/paraglide/messages';
	import BlogCard from '$lib/components/blog-card.svelte';
	import PaginationBar from '$lib/components/pagination-bar.svelte';
	import SearchInput from '$lib/components/search-input.svelte';
	import NoResults from '$lib/components/no-results.svelte';
	import { accentTile } from '$lib/blog';
	import { withParams } from '$lib/query';
	import { Newspaper, Rss, Tag } from '@lucide/svelte';

	let { data } = $props();

	const listState = $derived(data.posts.state);
	const selectedCategory = $derived(listState.values.category ?? 'all');
	const selectedTag = $derived(listState.values.tag ?? '');

	const categoryLink = (slug: string) =>
		withParams(page.url, { category: slug === 'all' ? null : slug, page: null });
	const tagLink = (tag: string) =>
		withParams(page.url, { tag: tag === selectedTag ? null : tag, page: null });

	const countFor = (slug: string) => data.categoryCounts[slug] ?? 0;

	/* The lead article is rendered above the grid, so showing it again inside
	   the grid would be the same piece twice on one screen. */
	const rows = $derived(data.posts.rows.filter((post) => post.id !== data.featured?.id));
</script>

<svelte:head>
	<title>{m.blog_meta_title()}</title>
	<meta name="description" content={m.blog_meta_description()} />
	<link rel="alternate" type="application/rss+xml" title={m.blog_title()} href="/blog/rss.xml" />
</svelte:head>

<div class="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
	<div
		class="flex flex-col justify-between gap-4 border-b-2 border-edge pb-6 sm:flex-row sm:items-end"
	>
		<div>
			<span class="text-xs font-black tracking-widest text-ink-dim uppercase">
				{m.blog_eyebrow()}
			</span>
			<h1 class="text-2xl font-black text-ink sm:text-3xl">{m.blog_title()}</h1>
			<p class="mt-1 max-w-2xl text-xs font-medium text-ink-soft">{m.blog_subtitle()}</p>
		</div>

		<a
			href={resolve('/blog/rss.xml')}
			rel="alternate"
			type="application/rss+xml"
			class="inline-flex shrink-0 items-center gap-1.5 rounded-xl border-2 border-edge bg-surface px-3 py-2 text-xs font-black text-ink shadow-[2px_2px_0px_0px_rgb(var(--bento-shadow))] transition-all hover:bg-panel"
		>
			<Rss class="h-3.5 w-3.5" />
			{m.blog_rss()}
		</a>
	</div>

	<!-- Sections. Each chip is a link that rewrites the URL, and the counts come
	     from the same query the articles do. -->
	<div class="flex flex-wrap items-center gap-2">
		<a
			href={categoryLink('all')}
			data-sveltekit-noscroll
			class="rounded-xl border-2 border-edge px-3 py-1.5 text-[11px] font-black tracking-wider uppercase transition-all {selectedCategory ===
			'all'
				? 'bg-inverse text-inverse-ink shadow-[2px_2px_0px_0px_rgb(var(--bento-shadow))]'
				: 'bg-surface text-ink-soft hover:bg-panel'}"
		>
			{m.blog_all_sections()}
		</a>
		{#each data.categories as category (category.id)}
			<a
				href={categoryLink(category.slug)}
				data-sveltekit-noscroll
				class="rounded-xl border-2 border-edge px-3 py-1.5 text-[11px] font-black tracking-wider text-ink uppercase transition-all {selectedCategory ===
				category.slug
					? `${accentTile(category.accent)} shadow-[2px_2px_0px_0px_rgb(var(--bento-shadow))]`
					: 'bg-surface text-ink-soft hover:bg-panel'}"
			>
				{category.name} · {countFor(category.slug)}
			</a>
		{/each}
	</div>

	<div class="flex flex-wrap items-center justify-between gap-3">
		<SearchInput value={listState.search} class="w-full sm:w-80" />
		{#if data.posts.total > 0}
			<span class="text-xs font-bold text-ink-soft">
				{m.pg_showing({ start: data.posts.from, end: data.posts.to, total: data.posts.total })}
			</span>
		{/if}
	</div>

	{#if selectedTag}
		<div class="flex items-center gap-2">
			<span class="text-[11px] font-black tracking-wider text-ink-dim uppercase">
				{m.blog_filtered_by_tag()}
			</span>
			<a
				href={tagLink(selectedTag)}
				data-sveltekit-noscroll
				class="inline-flex items-center gap-1 rounded-lg border-2 border-edge bg-inverse px-2.5 py-1 text-[11px] font-black text-inverse-ink"
			>
				<Tag class="h-3 w-3" />
				{selectedTag}
				<span aria-hidden="true">×</span>
			</a>
		</div>
	{/if}

	{#if data.featured}
		<BlogCard post={data.featured} size="lead" />
	{/if}

	{#if rows.length === 0 && !data.featured}
		{#if listState.search}
			<NoResults search={listState.search} />
		{:else}
			<div class="bento-card bento-card-static space-y-3 py-16 text-center">
				<Newspaper class="mx-auto h-10 w-10 text-ink-faint" />
				<h3 class="text-base font-black text-ink">{m.blog_empty()}</h3>
				<p class="mx-auto max-w-sm text-xs font-medium text-ink-soft">{m.blog_empty_hint()}</p>
			</div>
		{/if}
	{:else}
		<div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
			{#each rows as post (post.id)}
				<BlogCard {post} />
			{/each}
		</div>

		<PaginationBar result={data.posts} />
	{/if}

	{#if data.tags.length}
		<section class="space-y-3 border-t-2 border-edge pt-6">
			<h2 class="bento-eyebrow">{m.blog_browse_tags()}</h2>
			<div class="flex flex-wrap gap-2">
				{#each data.tags as entry (entry.tag)}
					<a
						href={tagLink(entry.tag)}
						data-sveltekit-noscroll
						class="inline-flex items-center gap-1 rounded-lg border-2 px-2.5 py-1 text-[11px] font-bold transition-colors {selectedTag ===
						entry.tag
							? 'border-edge bg-inverse text-inverse-ink'
							: 'border-edge-mid bg-surface text-ink-soft hover:bg-panel'}"
					>
						<Tag class="h-3 w-3" />
						{entry.tag}
						<span class="text-ink-faint">{entry.count}</span>
					</a>
				{/each}
			</div>
		</section>
	{/if}
</div>
