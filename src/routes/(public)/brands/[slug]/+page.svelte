<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import * as m from '$lib/paraglide/messages';
	import AppImage from '$lib/components/app-image.svelte';
	import BlogCard from '$lib/components/blog-card.svelte';
	import PageMeta from '$lib/components/page-meta.svelte';
	import VerificationBadge from '$lib/components/verification-badge.svelte';
	import CompensationBadge from '$lib/components/compensation-badge.svelte';
	import { formatPostDate } from '$lib/blog';
	import {
		ArrowLeft,
		Calendar,
		ExternalLink,
		Globe,
		MapPin,
		Newspaper,
		Star
	} from '@lucide/svelte';

	let { data } = $props();

	const brand = $derived(data.brand);

	/* The organisation, as a search engine understands one. The page is the only
	   public description of this brand, so it is the one that should carry it. */
	const jsonLd = $derived({
		'@context': 'https://schema.org',
		'@type': 'Organization',
		name: brand.name,
		url: new URL(`/brands/${brand.slug}`, page.url.origin).href,
		...(brand.bio ? { description: brand.bio } : {}),
		...(brand.website ? { sameAs: [brand.website] } : {}),
		...(brand.city || brand.countryName
			? {
					address: {
						'@type': 'PostalAddress',
						...(brand.city ? { addressLocality: brand.city } : {}),
						...(brand.countryName ? { addressCountry: brand.countryName } : {})
					}
				}
			: {})
	});
</script>

<PageMeta
	title={m.br_meta_title({ name: brand.name })}
	description={brand.bio}
	path={`/brands/${brand.slug}`}
	image={brand.logo}
	wideImage={false}
	{jsonLd}
/>

<div class="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
	<a
		href={resolve('/campaigns')}
		class="inline-flex items-center gap-1.5 rounded-lg border border-edge-soft bg-surface px-3 py-1.5 text-xs font-semibold text-ink-soft shadow-2xs hover:text-ink"
	>
		<ArrowLeft class="h-3.5 w-3.5" />
		{m.br_back_to_campaigns()}
	</a>

	<div class="bento-card bento-card-static space-y-4">
		<div class="flex flex-wrap items-start gap-4">
			<AppImage
				src={brand.logo}
				alt={brand.name}
				kind="logo"
				seed={brand.slug}
				class="h-16 w-16 shrink-0 rounded-2xl border-2 border-edge object-cover shadow-[2px_2px_0px_0px_rgb(var(--bento-shadow))]"
				loading="eager"
				decoding="async"
				width="64"
				height="64"
			/>

			<div class="min-w-0 flex-1 space-y-1.5">
				<div class="flex flex-wrap items-center gap-2">
					<h1 class="text-2xl font-black text-ink sm:text-3xl">{brand.name}</h1>
					<VerificationBadge level={brand.verificationLevel} />
					{#if brand.reviewsCount}
						<span
							class="inline-flex items-center gap-1 rounded-full border border-edge bg-warn-soft px-2 py-0.5 text-[11px] font-black text-warn-fg"
						>
							<Star class="h-3 w-3 fill-current" />
							{brand.averageRating.toFixed(1)}
							<span class="font-bold text-ink-dim">
								· {m.br_review_count({ count: brand.reviewsCount })}
							</span>
						</span>
					{/if}
				</div>

				<div class="flex flex-wrap items-center gap-2 text-[11px] font-bold text-ink-dim">
					<span
						class="rounded-full border border-edge bg-well px-2 py-0.5 text-[9px] font-black tracking-wider text-ink uppercase"
					>
						{brand.orgType?.replace('_', ' ')}
					</span>
					{#if brand.city || brand.countryName}
						<span class="inline-flex items-center gap-1">
							<MapPin class="h-3.5 w-3.5" />
							{[brand.city, brand.countryName].filter(Boolean).join(', ')}
							{brand.countryFlag ?? ''}
						</span>
					{/if}
					{#if brand.website}
						<a
							href={brand.website}
							target="_blank"
							rel="noopener noreferrer nofollow"
							class="inline-flex items-center gap-1 hover:text-brand-fg hover:underline"
						>
							<Globe class="h-3.5 w-3.5" />
							{brand.website.replace(/^https?:\/\//, '')}
							<ExternalLink class="h-3 w-3" />
						</a>
					{/if}
				</div>
			</div>
		</div>

		{#if brand.bio}
			<p class="text-sm leading-relaxed whitespace-pre-line text-ink-soft">{brand.bio}</p>
		{/if}
	</div>

	<!-- What creators said about working with them: the creators' half of
	     the two-way review, written after a completed deal. -->
	{#if data.reviews.length}
		<section class="space-y-3">
			<h2 class="text-base font-black tracking-wider text-ink uppercase">{m.br_reviews()}</h2>
			<ul class="grid gap-3 sm:grid-cols-2">
				{#each data.reviews as review (review.id)}
					<li class="bento-card bento-card-static space-y-2">
						<div class="flex items-center justify-between gap-2">
							<a
								href={resolve(`/creators/${review.creatorUsername}`)}
								class="flex min-w-0 items-center gap-2"
							>
								<AppImage
									src={review.creatorAvatar}
									alt={review.creatorName}
									kind="avatar"
									seed={review.creatorUsername}
									class="size-8 shrink-0 rounded-full border-2 border-edge object-cover"
									width="32"
									height="32"
									loading="lazy"
								/>
								<span class="truncate text-xs font-black text-ink">{review.creatorName}</span>
							</a>
							<span
								class="inline-flex shrink-0 items-center gap-0.5 text-xs font-black text-warn-fg"
								aria-label={m.br_review_rating({ rating: review.rating })}
							>
								<Star class="h-3.5 w-3.5 fill-current" />
								{review.rating}
							</span>
						</div>
						{#if review.body}
							<p class="text-xs leading-relaxed text-ink-soft">{review.body}</p>
						{/if}
						<p class="text-[10px] font-bold text-ink-faint">{formatPostDate(review.createdAt)}</p>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	<!-- What they are hiring for. A brand page with open work on it is a page
	     worth landing on; one without is still a byline's destination. -->
	{#if data.briefs.length}
		<section class="space-y-3">
			<h2 class="text-base font-black tracking-wider text-ink uppercase">{m.br_open_briefs()}</h2>
			<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
				{#each data.briefs as brief (brief.id)}
					<a href={resolve(`/campaigns/${brief.slug}`)} class="bento-card group space-y-2 p-4">
						<div class="flex flex-wrap items-center gap-2">
							<CompensationBadge type={brief.compensationType} />
							{#if brief.categoryName}
								<span class="text-[10px] font-black tracking-wider text-ink-dim uppercase">
									{brief.categoryName}
								</span>
							{/if}
						</div>
						<h3 class="line-clamp-2 text-sm font-black text-ink group-hover:text-brand-fg">
							{brief.title}
						</h3>
						<p class="line-clamp-2 text-xs font-medium text-ink-soft">{brief.description}</p>
						<p class="inline-flex items-center gap-1 text-[11px] font-bold text-ink-dim">
							<Calendar class="h-3.5 w-3.5" />
							{brief.deadline
								? m.campaign_closes({ date: formatPostDate(brief.deadline) })
								: m.campaign_open()}
						</p>
					</a>
				{/each}
			</div>
		</section>
	{/if}

	<section class="space-y-3">
		<h2 class="text-base font-black tracking-wider text-ink uppercase">{m.br_articles()}</h2>

		{#if data.articles.length}
			<div class="grid grid-cols-1 gap-5 sm:grid-cols-2">
				{#each data.articles as article (article.id)}
					<BlogCard post={article} />
				{/each}
			</div>
		{:else}
			<div
				class="rounded-2xl border-2 border-dashed border-edge-mid py-12 text-center text-ink-faint"
			>
				<Newspaper class="mx-auto h-8 w-8" />
				<p class="mt-2 text-xs font-bold text-ink-soft">{m.br_no_articles()}</p>
			</div>
		{/if}
	</section>
</div>
