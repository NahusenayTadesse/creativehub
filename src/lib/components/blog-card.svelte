<script lang="ts">
	import { resolve } from '$app/paths';
	import * as m from '$lib/paraglide/messages';
	import AppImage from '$lib/components/app-image.svelte';
	import { accentTile, formatPostDate } from '$lib/blog';
	import { Clock } from '@lucide/svelte';

	/**
	 * One article, as it appears in a list.
	 *
	 * `size` is the only variation: `lead` is the index's top slot, which is
	 * wider and shows more of the standfirst. Everything else — the chip, the
	 * byline, the shape of the picture — is deliberately identical, so a reader
	 * scanning the grid is comparing articles rather than layouts.
	 */
	type Post = {
		title: string;
		slug: string;
		excerpt: string | null;
		featuredImage: string | null;
		featuredImageAlt: string | null;
		readingMinutes: number;
		publishedAt: Date | string | null;
		categoryName: string | null;
		categoryAccent: string | null;
		authorName: string | null;
		authorImage?: string | null;
	};

	let { post, size = 'normal' }: { post: Post; size?: 'normal' | 'lead' } = $props();

	const lead = $derived(size === 'lead');
</script>

<article
	class="bento-card group flex h-full flex-col overflow-hidden p-0 {lead ? 'sm:flex-row' : ''}"
>
	<a
		href={resolve(`/blog/${post.slug}`)}
		class="block shrink-0 overflow-hidden border-b-2 border-edge {lead
			? 'sm:w-1/2 sm:border-e-2 sm:border-b-0'
			: ''}"
	>
		<div class={lead ? 'aspect-[16/10] h-full w-full' : 'aspect-[16/9] w-full'}>
			<AppImage
				src={post.featuredImage}
				alt={post.featuredImageAlt ?? post.title}
				kind="cover"
				seed={post.slug}
				class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
				loading={lead ? 'eager' : 'lazy'}
				decoding="async"
			/>
		</div>
	</a>

	<!-- No `justify-center` on the lead: the byline is already pinned to the
	     bottom by `mt-auto`, so centring the rest only opens a gap between the
	     standfirst and it. -->
	<div class="flex flex-1 flex-col gap-3 p-5 {lead ? 'sm:p-7' : ''}">
		<div class="flex flex-wrap items-center gap-2">
			{#if post.categoryName}
				<span
					class="rounded-lg border-2 border-edge px-2 py-0.5 text-[10px] font-black tracking-wider text-ink uppercase {accentTile(
						post.categoryAccent
					)}"
				>
					{post.categoryName}
				</span>
			{/if}
			{#if post.readingMinutes}
				<span class="inline-flex items-center gap-1 text-[10px] font-black text-ink-dim uppercase">
					<Clock class="h-3 w-3" />
					{m.bp_read_minutes({ minutes: post.readingMinutes })}
				</span>
			{/if}
		</div>

		<h2 class={lead ? 'text-xl font-black text-ink sm:text-2xl' : 'text-base font-black text-ink'}>
			<a href={resolve(`/blog/${post.slug}`)} class="hover:underline">{post.title}</a>
		</h2>

		{#if post.excerpt}
			<p
				class="text-xs leading-relaxed font-medium text-ink-soft {lead
					? 'line-clamp-4'
					: 'line-clamp-3'}"
			>
				{post.excerpt}
			</p>
		{/if}

		<div class="mt-auto flex items-center gap-2 border-t-2 border-edge-soft pt-3">
			{#if post.authorImage}
				<AppImage
					src={post.authorImage}
					alt={post.authorName ?? ''}
					kind="avatar"
					seed={post.authorName ?? post.slug}
					label={post.authorName ?? ''}
					class="h-6 w-6 shrink-0 rounded-full border border-edge object-cover"
					loading="lazy"
					decoding="async"
				/>
			{/if}
			<span class="truncate text-[11px] font-bold text-ink-soft">
				{post.authorName || m.brand_name()}
			</span>
			{#if post.publishedAt}
				<span class="ms-auto shrink-0 text-[11px] font-bold text-ink-dim">
					<time datetime={new Date(post.publishedAt).toISOString()}>
						{formatPostDate(post.publishedAt)}
					</time>
				</span>
			{/if}
		</div>
	</div>
</article>
