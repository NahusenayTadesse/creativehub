<script lang="ts">
	import AppImage from '$lib/components/app-image.svelte';
	import type { ResolvedPathname } from '$app/types';
	import { resolve } from '$app/paths';
	import {
		ArrowRight,
		TrendingUp,
		Briefcase,
		Gift,
		Ticket,
		Tag,
		Globe,
		Map,
		MapPin,
		Radio,
		Languages,
		Flame,
		Users,
		ChevronLeft,
		ChevronRight
	} from '@lucide/svelte';
	import CreatorCard from '$lib/components/creator-card.svelte';
	import * as Carousel from '$lib/components/ui/carousel/index.js';
	import type { CarouselAPI } from '$lib/components/ui/carousel/context.js';
	import GalleryCarousel from '$lib/components/gallery-carousel.svelte';
	import LandingHero from '$lib/components/landing-hero.svelte';
	import DynamicIcon from '$lib/components/dynamic-icon.svelte';
	import { TIER_FLOORS, type FollowerTier, type TrendingLaneKind } from '$lib/domain/trending';
	import { heroHeadline, landingLayout } from '$lib/domain/landing';
	import * as m from '$lib/paraglide/messages';
	import PageMeta from '$lib/components/page-meta.svelte';
	import { page } from '$app/state';
	import { resolveLogos } from '$lib/brand';

	let { data } = $props();

	/* ---------------- What a search engine and a link preview see ---------------- */

	const logos = $derived(resolveLogos(page.data.settings));
	const siteName = $derived(page.data.settings?.siteName || 'Creator Network');
	const absoluteUrl = (path: string) => new URL(path, page.url.origin).href;

	/**
	 * The site itself, for a search engine: who runs it, and where its creator
	 * directory can be searched. Built from the operator's settings, so a
	 * renamed install describes itself by its own name.
	 */
	const siteJsonLd = $derived({
		'@context': 'https://schema.org',
		'@graph': [
			{
				'@type': 'Organization',
				'@id': absoluteUrl('/#organization'),
				name: siteName,
				url: absoluteUrl('/'),
				logo: absoluteUrl(logos.mark)
			},
			{
				'@type': 'WebSite',
				'@id': absoluteUrl('/#website'),
				name: siteName,
				url: absoluteUrl('/'),
				publisher: { '@id': absoluteUrl('/#organization') },
				potentialAction: {
					'@type': 'SearchAction',
					target: {
						'@type': 'EntryPoint',
						urlTemplate: `${absoluteUrl('/discover')}?q={search_term_string}`
					},
					'query-input': 'required name=search_term_string'
				}
			}
		]
	});

	/* ---------------- What the operator arranged ----------------
	   Words, picture and section order from /dashboard/admin/landing. Every one
	   falls back to the shipped page, so a fresh install needs none of it. */

	const headline = $derived(heroHeadline(page.data.settings ?? {}));
	const heroSubtitle = $derived(page.data.settings?.heroSubtitle || m.hero_subtitle());
	const heroImage = $derived(page.data.settings?.heroImage ?? '');
	const sections = $derived(
		landingLayout(page.data.settings?.landingSections).filter((section) => section.visible)
	);
	const galleryInterval = $derived((page.data.settings?.galleryIntervalSeconds ?? 6) * 1000);

	/* The collage: featured creators first, then the trending board, once each
	   and only those with a photograph — a card of initials is not a face. */
	const heroCreators = $derived(
		[...data.featured, ...data.trending]
			.filter((creator, index, all) => all.findIndex((one) => one.id === creator.id) === index)
			.filter((creator) => creator.avatar)
	);

	/* ---------------- Trending lanes ----------------
	   One carousel, not ten stacked ones: the board is cut by category, market
	   and channel on the server, and the chips swap which cut is on screen.
	   Everything is already loaded, so switching costs no round trip. */

	const laneIcon = {
		category: Tag,
		country: Globe,
		region: Map,
		city: MapPin,
		platform: Radio,
		language: Languages,
		tier: Users
	};

	const strips = $derived([
		{
			key: 'all',
			kind: null,
			refId: null,
			refKey: null,
			label: m.home_trending_all(),
			creators: data.trending
		},
		...data.lanes
	]);

	let selectedStrip = $state('all');

	/* Falls back rather than empties: a chip can name a lane that a recompute
	   has since dropped, and an empty strip would be the only sign of it. */
	const strip = $derived(strips.find((one) => one.key === selectedStrip) ?? strips[0]);

	/* ---------------- The carousel's own controls ----------------
	   Arrows turn a page, not a card, so the dots count pages a reader can
	   actually land on. The count changes with the viewport — four cards a page
	   on a wide screen, one on a phone — which is why `reInit` re-reads it. */

	let carousel = $state<CarouselAPI>();
	let pageIndex = $state(0);
	let pageCount = $state(0);
	let canPrev = $state(false);
	let canNext = $state(false);

	$effect(() => {
		const api = carousel;
		if (!api) return;
		const sync = () => {
			pageIndex = api.selectedScrollSnap();
			pageCount = api.scrollSnapList().length;
			canPrev = api.canScrollPrev();
			canNext = api.canScrollNext();
		};
		sync();
		api.on('select', sync).on('reInit', sync);
		return () => {
			api.off('select', sync).off('reInit', sync);
		};
	});

	/* Arrow keys page the strip whenever focus is inside it — on a card, a chip
	   or a control — so a keyboard reader is not sent hunting for the buttons. */
	const pageWithKeys = (event: KeyboardEvent) => {
		const target = event.target as HTMLElement | null;
		if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
		if (event.key === 'ArrowLeft' && canPrev) {
			event.preventDefault();
			carousel?.scrollPrev();
		} else if (event.key === 'ArrowRight' && canNext) {
			event.preventDefault();
			carousel?.scrollNext();
		}
	};

	const arrowButton =
		'place-items-center rounded-full border-2 border-edge bg-surface text-ink shadow-[3px_3px_0px_0px_rgb(var(--bento-shadow))] transition-all hover:bg-brand-soft hover:shadow-[4px_4px_0px_0px_rgb(var(--bento-shadow))] focus-visible:ring-2 focus-visible:ring-brand-strong focus-visible:outline-none active:shadow-[1px_1px_0px_0px_rgb(var(--bento-shadow))]';

	/* The discovery filter behind each kind of lane, where there is one. */
	const laneFilter: Partial<Record<TrendingLaneKind, string>> = {
		country: 'country',
		region: 'region',
		platform: 'platform'
	};

	/**
	 * Where "see all" goes for the lane on screen.
	 *
	 * Every one of these is a filter discovery already has, so a chip is a
	 * promise the next page keeps. A language lane has no filter behind it, so
	 * it lands on unfiltered discovery rather than on a URL that does nothing.
	 */
	const stripHref = $derived.by(() => {
		const discover = resolve('/discover');
		const filtered = (search: string) => `${discover}?${search}` as ResolvedPathname;

		if (!strip?.kind) return discover as ResolvedPathname;
		if (strip.kind === 'category') {
			const slug = data.reference.categories.find((one) => one.id === strip.refId)?.slug;
			return slug ? filtered(`category=${slug}`) : (discover as ResolvedPathname);
		}
		/* A city is free text on a profile rather than a reference row, so the
		   search box is the only filter that can carry one. */
		if (strip.kind === 'city') return filtered(`q=${encodeURIComponent(strip.label)}`);
		/* A size band's floor is a filter discovery has; its ceiling is not, so
		   "see all" for micro-creators starts at ten thousand and sorts from there. */
		if (strip.kind === 'tier' && strip.refKey && strip.refKey in TIER_FLOORS) {
			const floor = TIER_FLOORS[strip.refKey as FollowerTier];
			return floor ? filtered(`minReach=${floor}`) : (discover as ResolvedPathname);
		}

		const param = laneFilter[strip.kind];
		return param && strip.refId
			? filtered(`${param}=${strip.refId}`)
			: (discover as ResolvedPathname);
	});

	const brandSteps = $derived([
		{ n: 1, title: m.home_brands_step1_title(), body: m.home_brands_step1_body() },
		{ n: 2, title: m.home_brands_step2_title(), body: m.home_brands_step2_body() },
		{ n: 3, title: m.home_brands_step3_title(), body: m.home_brands_step3_body() },
		{ n: 4, title: m.home_brands_step4_title(), body: m.home_brands_step4_body() }
	]);

	const creatorSteps = $derived([
		{ n: 1, title: m.home_creators_step1_title(), body: m.home_creators_step1_body() },
		{ n: 2, title: m.home_creators_step2_title(), body: m.home_creators_step2_body() },
		{ n: 3, title: m.home_creators_step3_title(), body: m.home_creators_step3_body() },
		{ n: 4, title: m.home_creators_step4_title(), body: m.home_creators_step4_body() }
	]);
</script>

<PageMeta
	title={m.home_meta_title()}
	description={m.home_meta_description()}
	path="/"
	image={logos.mark}
	wideImage={false}
	jsonLd={siteJsonLd}
/>

<!-- Sections sit closer together on a phone: at 16 units the gaps read as the
     page having ended rather than as one section giving way to the next. -->
<div id="landing-page-view" class="space-y-10 pb-10 sm:space-y-16 sm:pb-16">
	<!-- ================= HERO ================= -->
	<LandingHero
		{headline}
		subtitle={heroSubtitle}
		image={heroImage}
		creators={heroCreators}
		partners={data.partners}
		stats={data.stats}
	/>

	<!-- ================= EVERYTHING BELOW THE HERO =================
	     In the order an operator arranged, and only what they left shown. -->
	{#each sections as section (section.key)}
		{#if section.key === 'gallery'}
			{@render gallerySection()}
		{:else if section.key === 'trending'}
			{@render trendingSection()}
		{:else if section.key === 'categories'}
			{@render categoriesSection()}
		{:else if section.key === 'compensation'}
			{@render compensationSection()}
		{:else if section.key === 'howItWorks'}
			{@render howItWorksSection()}
		{/if}
	{/each}
</div>

{#snippet gallerySection()}
	<!-- ================= GALLERY ================= -->
	{#if data.gallery.length}
		<section class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
			<GalleryCarousel slides={data.gallery} interval={galleryInterval} />
		</section>
	{/if}
{/snippet}

{#snippet trendingSection()}
	<!-- ================= TRENDING ================= -->
	{#if data.trending.length}
		<section class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
			<!--
				Keyed on the lane so Embla is rebuilt rather than asked to keep its
				scroll position across a set of slides that has entirely changed.
			-->
			{#key strip.key}
				<Carousel.Root
					opts={{ align: 'start', containScroll: 'trimSnaps', slidesToScroll: 'auto' }}
					setApi={(api) => (carousel = api)}
					onkeydown={pageWithKeys}
					aria-label={strip.kind
						? m.home_trending_in({ lane: strip.label })
						: m.home_trending_title()}
					class="space-y-6"
				>
					<div class="space-y-4">
						<div class="flex flex-wrap items-end justify-between gap-4">
							<div>
								<div
									class="flex items-center gap-2 text-xs font-bold tracking-wider text-brand-fg uppercase"
								>
									<TrendingUp class="h-4 w-4" />
									<span>{m.home_trending_eyebrow()}</span>
								</div>
								<h2 class="mt-1 text-xl font-extrabold text-ink sm:text-2xl">
									{strip.kind ? m.home_trending_in({ lane: strip.label }) : m.home_trending_title()}
								</h2>
							</div>

							<div class="flex items-center gap-4">
								<a
									href={stripHref}
									class="flex items-center gap-1 text-xs font-bold text-brand-soft-fg hover:text-brand-soft-fg"
								>
									<span>
										{strip.kind
											? m.home_view_all_lane({ count: strip.creators.length })
											: m.home_view_all({ count: data.stats.creators })}
									</span>
									<ArrowRight class="h-3.5 w-3.5" />
								</a>

								{#if pageCount > 1}
									<span
										class="rounded-full border-2 border-edge bg-surface px-2.5 py-1 text-[11px] font-black text-ink tabular-nums shadow-[2px_2px_0px_0px_rgb(var(--bento-shadow))]"
										aria-live="polite"
									>
										{m.home_trending_page({ current: pageIndex + 1, total: pageCount })}
									</span>
								{/if}
							</div>
						</div>

						<!--
							The cuts of the board, as one scrolling row. They bleed to the
							screen edge on a phone so that a half-visible chip says there is
							more to scroll, which a neatly clipped row does not.
						-->
						{#if data.lanes.length}
							<div
								class="thin-scroll -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-x-visible sm:px-0"
								aria-label={m.home_trending_lanes_label()}
							>
								{#each strips as one (one.key)}
									{@const Icon = one.kind ? laneIcon[one.kind] : Flame}
									<button
										type="button"
										onclick={() => {
											selectedStrip = one.key;
											/* The strip is rebuilt for the new lane, so it starts on page one. */
											pageIndex = 0;
										}}
										aria-pressed={one.key === strip.key}
										class="flex shrink-0 items-center gap-1.5 rounded-full border-2 border-edge px-3 py-1.5 text-[11px] font-black whitespace-nowrap shadow-[2px_2px_0px_0px_rgb(var(--bento-shadow))] transition-colors {one.key ===
										strip.key
											? 'bg-inverse text-inverse-ink'
											: 'bg-surface text-ink hover:bg-well'}"
									>
										<Icon class="h-3.5 w-3.5" />
										<span>{one.label}</span>
										<span
											class="rounded-full px-1.5 {one.key === strip.key
												? 'text-inverse-ink-dim'
												: 'text-ink-dim'}"
										>
											{one.creators.length}
										</span>
									</button>
								{/each}
							</div>
						{/if}
					</div>

					<div class="space-y-4">
						<!--
							Cards sized to leave the next one peeking in at the edge, at every
							width: a row that ends flush on a card reads as a grid that has
							simply finished, and the half-card is what says "there is more".
						-->
						<div class="relative">
							<Carousel.Content class="py-2">
								{#each strip.creators as creator (creator.id)}
									<Carousel.Item
										class="basis-[84%] last:pe-2 sm:basis-[47%] lg:basis-[31.5%] xl:basis-[23.8%]"
									>
										<CreatorCard {creator} />
									</Carousel.Item>
								{/each}
							</Carousel.Content>

							<!-- A fade on whichever edge has more behind it, so the peeking card
							     reads as cut off by the strip rather than by the page. -->
							<div
								class="pointer-events-none absolute inset-y-0 end-0 w-10 bg-gradient-to-l from-background to-transparent transition-opacity duration-300 sm:w-16 {canNext
									? 'opacity-100'
									: 'opacity-0'}"
							></div>
							<div
								class="pointer-events-none absolute inset-y-0 start-0 w-10 bg-gradient-to-r from-background to-transparent transition-opacity duration-300 sm:w-16 {canPrev
									? 'opacity-100'
									: 'opacity-0'}"
							></div>

							<!-- Arrows on the track itself from `sm` up, where there is room
							     beside the cards. They leave rather than grey out at an end:
							     a dead button in the middle of the strip is noise. -->
							<button
								type="button"
								aria-label={m.tbl_previous()}
								onclick={() => carousel?.scrollPrev()}
								tabindex={canPrev ? 0 : -1}
								class="{arrowButton} absolute -start-3 top-1/2 z-10 hidden size-12 -translate-y-1/2 sm:grid lg:-start-5 {canPrev
									? 'opacity-100'
									: 'pointer-events-none opacity-0'}"
							>
								<ChevronLeft class="h-6 w-6" strokeWidth={3} />
							</button>
							<button
								type="button"
								aria-label={m.tbl_next()}
								onclick={() => carousel?.scrollNext()}
								tabindex={canNext ? 0 : -1}
								class="{arrowButton} absolute -end-3 top-1/2 z-10 hidden size-12 -translate-y-1/2 sm:grid lg:-end-5 {canNext
									? 'opacity-100'
									: 'pointer-events-none opacity-0'}"
							>
								<ChevronRight class="h-6 w-6" strokeWidth={3} />
							</button>
						</div>

						<!-- Where you are, and a way to get anywhere else. On a phone the
						     arrows live here, beside the dots, clear of the cards. -->
						{#if pageCount > 1}
							<div class="flex items-center justify-center gap-3">
								<button
									type="button"
									aria-label={m.tbl_previous()}
									onclick={() => carousel?.scrollPrev()}
									disabled={!canPrev}
									class="{arrowButton} grid size-10 disabled:pointer-events-none disabled:opacity-40 disabled:shadow-none sm:hidden"
								>
									<ChevronLeft class="h-5 w-5" strokeWidth={3} />
								</button>

								<div class="flex flex-wrap items-center justify-center gap-2">
									{#each { length: pageCount }, index (index)}
										<button
											type="button"
											aria-label={m.home_trending_go_to({ index: index + 1 })}
											aria-current={index === pageIndex}
											onclick={() => carousel?.scrollTo(index)}
											class="h-3 rounded-full border-2 border-edge transition-all {index ===
											pageIndex
												? 'w-8 bg-brand-strong'
												: 'w-3 bg-ink-dim hover:bg-brand-strong'}"
										></button>
									{/each}
								</div>

								<button
									type="button"
									aria-label={m.tbl_next()}
									onclick={() => carousel?.scrollNext()}
									disabled={!canNext}
									class="{arrowButton} grid size-10 disabled:pointer-events-none disabled:opacity-40 disabled:shadow-none sm:hidden"
								>
									<ChevronRight class="h-5 w-5" strokeWidth={3} />
								</button>
							</div>
						{/if}
					</div>
				</Carousel.Root>
			{/key}
		</section>
	{/if}
{/snippet}

{#snippet categoriesSection()}
	<!-- ================= CATEGORIES ================= -->
	<section class="mx-auto max-w-7xl space-y-6 px-4 sm:px-6 lg:px-8">
		<div class="mx-auto max-w-2xl space-y-2 text-center">
			<span class="text-xs font-black tracking-widest text-ink-dim uppercase">
				{m.home_categories_eyebrow()}
			</span>
			<h2 class="text-xl font-black text-ink sm:text-3xl">{m.home_categories_title()}</h2>
			<p class="text-xs font-medium text-ink-soft">
				{m.home_categories_body()}
			</p>
		</div>

		<div class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
			{#each data.reference.categories as category (category.id)}
				<a
					href={resolve(`/discover?category=${category.slug}`)}
					class="bento-card group flex flex-col justify-between overflow-hidden focus-visible:ring-2 focus-visible:ring-brand-strong focus-visible:outline-none"
				>
					<div>
						{#if category.image}
							<!-- The card's padding is undone so the picture runs to its edges,
							     with the icon badge overlapping its bottom edge. -->
							<div class="relative -mx-6 -mt-6 mb-7 h-28 border-b-2 border-edge sm:h-32">
								<AppImage
									src={category.image}
									alt=""
									kind="cover"
									seed={category.slug}
									loading="lazy"
									decoding="async"
									class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
								/>
								<div
									class="absolute -bottom-5 left-6 flex h-10 w-10 items-center justify-center rounded-2xl border-2 border-edge bg-inverse text-inverse-ink shadow-[2px_2px_0px_0px_rgb(var(--bento-shadow))] transition-colors group-hover:bg-brand"
								>
									<DynamicIcon name={category.icon} class="h-5 w-5" />
								</div>
							</div>
						{:else}
							<div
								class="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl border-2 border-edge bg-inverse text-inverse-ink shadow-[2px_2px_0px_0px_rgb(var(--bento-shadow))] transition-colors group-hover:bg-brand"
							>
								<DynamicIcon name={category.icon} class="h-5 w-5" />
							</div>
						{/if}
						<h3 class="text-sm font-black text-ink transition-colors group-hover:text-brand-fg">
							{category.name}
						</h3>
						<p class="mt-1 line-clamp-2 text-[11px] leading-relaxed font-medium text-ink-soft">
							{category.description}
						</p>
					</div>
				</a>
			{/each}
		</div>
	</section>
{/snippet}

{#snippet compensationSection()}
	<!-- ================= COMPENSATION MODELS ================= -->
	<section class="py-4 sm:py-12">
		<div class="mx-auto max-w-7xl space-y-6 px-4 sm:space-y-8 sm:px-6 lg:px-8">
			<div class="mx-auto max-w-2xl space-y-2 text-center">
				<span
					class="inline-block rounded-full border border-edge bg-tile-mint px-3 py-1 text-xs font-black tracking-widest text-brand-soft-fg uppercase"
				>
					{m.home_comp_eyebrow()}
				</span>
				<h2 class="text-xl font-black text-ink sm:text-3xl">{m.home_comp_title()}</h2>
				<p class="text-xs font-medium text-ink-soft">
					{m.home_comp_body()}
				</p>
			</div>

			<div class="grid grid-cols-1 gap-6 md:grid-cols-3">
				<div class="bento-card-mint space-y-3">
					<div
						class="flex h-12 w-12 items-center justify-center rounded-2xl border-2 border-edge bg-inverse shadow-[2px_2px_0px_0px_rgb(var(--bento-shadow))]"
					>
						<Briefcase class="h-6 w-6 text-inverse-brand" />
					</div>
					<h3 class="text-lg font-black text-ink">{m.home_comp_paid_title()}</h3>
					<p class="text-xs leading-relaxed font-medium text-ink">
						{m.home_comp_paid_body()}
					</p>
					<span
						class="inline-block rounded-lg border border-edge bg-surface px-2.5 py-1 text-[11px] font-black text-brand-soft-fg"
					>
						{m.home_comp_paid_tag()}
					</span>
				</div>

				<div class="bento-card-indigo space-y-3">
					<div
						class="flex h-12 w-12 items-center justify-center rounded-2xl border-2 border-edge bg-inverse shadow-[2px_2px_0px_0px_rgb(var(--bento-shadow))]"
					>
						<Ticket class="h-6 w-6 text-info" />
					</div>
					<h3 class="text-lg font-black text-ink">{m.home_comp_event_title()}</h3>
					<p class="text-xs leading-relaxed font-medium text-ink">
						{m.home_comp_event_body()}
					</p>
					<span
						class="inline-block rounded-lg border border-edge bg-surface px-2.5 py-1 text-[11px] font-black text-info-fg"
					>
						{m.home_comp_event_tag()}
					</span>
				</div>

				<div class="bento-card-yellow space-y-3">
					<div
						class="flex h-12 w-12 items-center justify-center rounded-2xl border-2 border-edge bg-inverse shadow-[2px_2px_0px_0px_rgb(var(--bento-shadow))]"
					>
						<Gift class="h-6 w-6 text-warn" />
					</div>
					<h3 class="text-lg font-black text-ink">{m.home_comp_barter_title()}</h3>
					<p class="text-xs leading-relaxed font-medium text-ink">
						{m.home_comp_barter_body()}
					</p>
					<span
						class="inline-block rounded-lg border border-edge bg-surface px-2.5 py-1 text-[11px] font-black text-warn-fg"
					>
						{m.home_comp_barter_tag()}
					</span>
				</div>
			</div>
		</div>
	</section>
{/snippet}

{#snippet howItWorksSection()}
	<!-- ================= HOW IT WORKS ================= -->
	<section class="mx-auto max-w-7xl space-y-8 px-4 sm:px-6 lg:px-8">
		<div class="grid grid-cols-1 gap-8 lg:grid-cols-2">
			<div class="bento-card-dark space-y-6">
				<span
					class="inline-block rounded-full border border-edge-mid bg-inverse-hover px-3 py-1 text-xs font-black tracking-widest text-inverse-brand uppercase"
				>
					{m.home_brands_eyebrow()}
				</span>
				<h2 class="text-2xl font-black text-inverse-ink sm:text-3xl">{m.home_brands_title()}</h2>

				<div class="space-y-4 text-xs">
					{#each brandSteps as step (step.n)}
						<div class="flex gap-4">
							<span
								class="flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl border border-inverse-ink bg-brand font-black text-brand-ink-deep"
							>
								{step.n}
							</span>
							<div>
								<h4 class="text-sm font-black text-inverse-ink">{step.title}</h4>
								<p class="mt-0.5 text-inverse-ink-dim">{step.body}</p>
							</div>
						</div>
					{/each}
				</div>

				<a
					href={resolve('/register?role=business')}
					class="block w-full rounded-2xl border-2 border-edge bg-brand py-3.5 text-center text-xs font-black text-brand-ink-deep shadow-[2px_2px_0px_0px_rgba(255,255,255,1)] transition-all hover:bg-brand-strong"
				>
					{m.home_brands_cta()}
				</a>
			</div>

			<div class="bento-card-mint space-y-6">
				<span
					class="inline-block rounded-full border border-edge bg-surface px-3 py-1 text-xs font-black tracking-widest text-brand-soft-fg uppercase"
				>
					{m.home_creators_eyebrow()}
				</span>
				<h2 class="text-2xl font-black text-ink sm:text-3xl">{m.home_creators_title()}</h2>

				<div class="space-y-4 text-xs">
					{#each creatorSteps as step (step.n)}
						<div class="flex gap-4">
							<span
								class="flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl border border-edge bg-inverse font-black text-inverse-ink"
							>
								{step.n}
							</span>
							<div>
								<h4 class="text-sm font-black text-ink">{step.title}</h4>
								<p class="mt-0.5 font-medium text-ink">{step.body}</p>
							</div>
						</div>
					{/each}
				</div>

				<a
					href={resolve('/register?role=creator')}
					class="block w-full rounded-2xl border-2 border-edge bg-inverse py-3.5 text-center text-xs font-black text-inverse-ink shadow-[2px_2px_0px_0px_rgb(var(--bento-shadow))] transition-all hover:bg-inverse-hover"
				>
					{m.home_creators_cta()}
				</a>
			</div>
		</div>
	</section>
{/snippet}
