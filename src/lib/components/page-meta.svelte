<script lang="ts">
	import type { Snippet } from 'svelte';
	import { page } from '$app/state';
	import { assetUrl } from '$lib/assets';
	import { jsonLdScript, metaSummary } from '$lib/seo';

	/**
	 * Everything a public page tells a search engine and a link preview.
	 *
	 * One component rather than a block of tags per page, for two reasons. The
	 * tags that matter travel together — a title with no `og:title` is a link
	 * pasted into a chat that previews as the bare domain — and the one tag that
	 * is dangerous to write by hand, the JSON-LD script, is built here once with
	 * its escaping, instead of being copied into every page that wants it.
	 */
	let {
		title,
		description = '',
		/** Site-relative, without a query string: `/creators/abebe`. */
		path,
		/** A stored upload name or a URL. Made absolute, because a crawler has no base. */
		image = null,
		type = 'website',
		noIndex = false,
		/** A schema.org object. Serialised and escaped here. */
		jsonLd = null,
		/**
		 * Whether the image is a wide banner. A square — an avatar, a logo — asks
		 * for the small card, since the large one crops it to a letterbox.
		 */
		wideImage = true,
		/** Page-specific tags — `article:published_time`, `profile:username`. */
		children
	}: {
		title: string;
		description?: string | null;
		path: string;
		image?: string | null;
		type?: 'website' | 'article' | 'profile';
		noIndex?: boolean;
		jsonLd?: Record<string, unknown> | null;
		wideImage?: boolean;
		children?: Snippet;
	} = $props();

	/* A sentence for a results page, not the whole bio — see `metaSummary`. */
	const summary = $derived(metaSummary(description));

	/* `page.url.origin` is the configured `ORIGIN` behind the proxy, so these
	   are the public https addresses rather than the loopback the app listens on. */
	const canonical = $derived(new URL(path, page.url.origin).href);

	const socialImage = $derived.by(() => {
		const url = assetUrl(image);
		if (!url) return '';
		return /^https?:\/\//.test(url) ? url : new URL(url, page.url.origin).href;
	});

	const siteName = $derived(
		(page.data.settings as { siteName?: string } | null | undefined)?.siteName ?? ''
	);

	/* Built and escaped by `jsonLdScript`, which is tested against values that
	   try to close the element early. */
	const jsonLdTag = $derived(jsonLd ? jsonLdScript(jsonLd) : '');
</script>

<svelte:head>
	<title>{title}</title>
	{#if summary}
		<meta name="description" content={summary} />
	{/if}
	<link rel="canonical" href={canonical} />
	{#if noIndex}
		<meta name="robots" content="noindex, nofollow" />
	{/if}

	{#if siteName}
		<meta property="og:site_name" content={siteName} />
	{/if}
	<meta property="og:type" content={type} />
	<meta property="og:title" content={title} />
	<meta property="og:url" content={canonical} />
	{#if summary}
		<meta property="og:description" content={summary} />
	{/if}
	{#if socialImage}
		<meta property="og:image" content={socialImage} />
		<meta name="twitter:card" content={wideImage ? 'summary_large_image' : 'summary'} />
	{:else}
		<meta name="twitter:card" content="summary" />
	{/if}

	{@render children?.()}

	{#if jsonLdTag}
		<!--
			Structured data, not authored content: every value in it went through
			`JSON.stringify`, and `<` is escaped above. A template has no other way
			to emit a script element, which is why the rule is waived here.
		-->
		<!-- eslint-disable-next-line svelte/no-at-html-tags -->
		{@html jsonLdTag}
	{/if}
</svelte:head>
