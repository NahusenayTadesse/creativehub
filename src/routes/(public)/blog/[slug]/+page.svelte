<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import * as m from '$lib/paraglide/messages';
	import AppImage from '$lib/components/app-image.svelte';
	import BlogCard from '$lib/components/blog-card.svelte';
	import PostGallery from '$lib/components/post-gallery.svelte';
	import { accentTile, formatPostDate } from '$lib/blog';
	import { assetUrl } from '$lib/assets';
	import { withParams, type ParamValue } from '$lib/query';
	import { ArrowLeft, Clock, Eye, Tag } from '@lucide/svelte';

	let { data } = $props();

	const post = $derived(data.post);

	const canonical = $derived(new URL(`/blog/${post.slug}`, page.url.origin).href);

	/* A link back to the index with one filter set. Built through `withParams`
	   like every other list link in the app, rather than by concatenating a
	   query string onto a path — that is what keeps it base-path correct. */
	const indexLink = (changes: Record<string, ParamValue>) =>
		withParams(new URL(resolve('/blog'), page.url.origin), changes);
	const metaTitle = $derived(post.metaTitle || post.title);
	const metaDescription = $derived(post.metaDescription || post.excerpt || '');

	/* The social card image, as an absolute URL: a crawler fetching the page has
	   no base to resolve `/files/abc.png` against. */
	const socialImage = $derived.by(() => {
		const stored = post.ogImage || post.featuredImage;
		if (!stored) return '';
		const url = assetUrl(stored);
		return url.startsWith('http') ? url : new URL(url, page.url.origin).href;
	});

	const published = $derived(post.publishedAt ? new Date(post.publishedAt).toISOString() : '');
	const modified = $derived(post.updatedAt ? new Date(post.updatedAt).toISOString() : published);

	/**
	 * The article, described for a search engine.
	 *
	 * Built from the same values the page renders rather than from a second set
	 * of fields, so the structured data cannot describe an article different
	 * from the one on screen. Serialised with `JSON.stringify`, which escapes
	 * the quotes and backslashes an operator's title may contain — and the
	 * `<` that would otherwise be able to close the script tag early.
	 */
	const jsonLd = $derived(
		JSON.stringify({
			'@context': 'https://schema.org',
			'@type': 'BlogPosting',
			headline: post.title,
			description: metaDescription,
			...(socialImage ? { image: [socialImage] } : {}),
			...(published ? { datePublished: published } : {}),
			...(modified ? { dateModified: modified } : {}),
			...(post.authorName ? { author: { '@type': 'Person', name: post.authorName } } : {}),
			mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
			...(post.categoryName ? { articleSection: post.categoryName } : {}),
			...(post.tags?.length ? { keywords: post.tags.join(', ') } : {})
		}).replace(/</g, '\\u003c')
	);

	/*
	 * The whole tag, assembled here rather than written in the markup.
	 *
	 * Svelte's parser treats a `<script>` in a template as a script *block*, not
	 * an element, so structured data cannot be written literally. Building the
	 * string means the closing tag has to be broken up — hence the escaped
	 * slash, which is the same trick every inline JSON-LD block uses.
	 */
	/* eslint-disable-next-line no-useless-escape --
	   The backslash is unnecessary to JavaScript and necessary to everything
	   else: an unescaped closing script tag inside this block ends the
	   component's own script element, whatever the string literal around it
	   says — the HTML parser never sees the quotes. */
	const jsonLdTag = $derived(`<script type="application/ld+json">${jsonLd}<\/script>`);
</script>

<svelte:head>
	<title>{metaTitle}</title>
	{#if metaDescription}
		<meta name="description" content={metaDescription} />
	{/if}
	<link rel="canonical" href={canonical} />
	{#if post.noIndex || data.isPreview}
		<!-- A draft an operator is previewing must never be indexed, whatever the
		     post's own setting says. -->
		<meta name="robots" content="noindex, nofollow" />
	{/if}

	<meta property="og:type" content="article" />
	<meta property="og:title" content={metaTitle} />
	<meta property="og:url" content={canonical} />
	{#if metaDescription}
		<meta property="og:description" content={metaDescription} />
	{/if}
	{#if socialImage}
		<meta property="og:image" content={socialImage} />
		<meta name="twitter:card" content="summary_large_image" />
	{:else}
		<meta name="twitter:card" content="summary" />
	{/if}
	{#if published}
		<meta property="article:published_time" content={published} />
	{/if}

	<!--
		Structured data, not authored content: every value in it came out of
		`JSON.stringify`, and `<` is escaped above so that an operator's title
		cannot end the tag early. A template has no other way to emit a script
		element, which is why the rule is waived here.
	-->
	<!-- eslint-disable-next-line svelte/no-at-html-tags -->
	{@html jsonLdTag}
</svelte:head>

<div class="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
	{#if data.isPreview}
		<div class="bento-card-yellow mb-6 flex items-center gap-2 text-[11px] font-black text-warn-fg">
			<Eye class="h-4 w-4 shrink-0" />
			{m.blog_preview_notice()}
		</div>
	{/if}

	<a
		href={resolve('/blog')}
		class="mb-6 inline-flex items-center gap-1.5 text-[11px] font-black tracking-wider text-ink-soft uppercase transition-colors hover:text-ink"
	>
		<ArrowLeft class="h-3.5 w-3.5" />
		{m.blog_back_to_index()}
	</a>

	<article class="space-y-6">
		<header class="space-y-4">
			<div class="flex flex-wrap items-center gap-2">
				{#if post.categoryName}
					<a
						href={indexLink({ category: post.categorySlug })}
						class="rounded-lg border-2 border-edge px-2.5 py-1 text-[10px] font-black tracking-wider text-ink uppercase {accentTile(
							post.categoryAccent
						)}"
					>
						{post.categoryName}
					</a>
				{/if}
				{#if post.readingMinutes}
					<span
						class="inline-flex items-center gap-1 text-[10px] font-black text-ink-dim uppercase"
					>
						<Clock class="h-3 w-3" />
						{m.bp_read_minutes({ minutes: post.readingMinutes })}
					</span>
				{/if}
			</div>

			<h1 class="text-3xl font-black tracking-tight text-ink sm:text-4xl">{post.title}</h1>

			{#if post.excerpt}
				<p class="text-base leading-relaxed font-medium text-ink-soft">{post.excerpt}</p>
			{/if}

			<div class="flex items-center gap-3 border-y-2 border-edge-soft py-3">
				{#if post.authorImage}
					<AppImage
						src={post.authorImage}
						alt={post.authorName ?? ''}
						kind="avatar"
						seed={post.authorName ?? post.slug}
						label={post.authorName ?? ''}
						class="h-9 w-9 shrink-0 rounded-full border-2 border-edge object-cover"
						decoding="async"
					/>
				{/if}
				<div class="min-w-0">
					<p class="truncate text-xs font-black text-ink">{post.authorName || m.brand_name()}</p>
					{#if post.publishedAt}
						<p class="text-[11px] font-bold text-ink-dim">
							<time datetime={published}>{formatPostDate(post.publishedAt)}</time>
						</p>
					{/if}
				</div>
			</div>
		</header>

		{#if post.featuredImage}
			<figure
				class="overflow-hidden rounded-3xl border-2 border-edge bg-well shadow-[6px_6px_0px_0px_rgb(var(--bento-shadow))]"
			>
				<AppImage
					src={post.featuredImage}
					alt={post.featuredImageAlt ?? post.title}
					kind="cover"
					seed={post.slug}
					class="aspect-[16/9] w-full object-cover"
					loading="eager"
					decoding="async"
				/>
			</figure>
		{/if}

		{#if post.body}
			<!--
				The only `{@html}` on the public site.

				What it renders was narrowed to an allowlist by
				`sanitizeArticleHtml` on the way *into* the database, not here — see
				`$lib/server/sanitize.ts` for why that side. Nothing may write this
				column by another path, which is what the rule below is being told.
			-->
			<!-- eslint-disable-next-line svelte/no-at-html-tags -->
			<div class="article-body">{@html post.body}</div>
		{/if}

		{#if post.tags?.length}
			<div class="flex flex-wrap items-center gap-2 border-t-2 border-edge-soft pt-5">
				{#each post.tags as tag (tag)}
					<a
						href={indexLink({ tag })}
						class="inline-flex items-center gap-1 rounded-lg border-2 border-edge-mid bg-surface px-2.5 py-1 text-[11px] font-bold text-ink-soft transition-colors hover:bg-panel"
					>
						<Tag class="h-3 w-3" />
						{tag}
					</a>
				{/each}
			</div>
		{/if}
	</article>

	{#if data.images.length}
		<div class="mt-10">
			<PostGallery images={data.images} />
		</div>
	{/if}

	{#if data.related.length}
		<section class="mt-12 space-y-4 border-t-2 border-edge pt-8">
			<h2 class="bento-eyebrow">{m.blog_read_next()}</h2>
			<div class="grid grid-cols-1 gap-6 sm:grid-cols-3">
				{#each data.related as related (related.id)}
					<BlogCard post={related} />
				{/each}
			</div>
		</section>
	{/if}
</div>
