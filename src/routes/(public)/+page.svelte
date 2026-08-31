<script lang="ts">
	import AppImage from '$lib/components/app-image.svelte';
	import InputComp from '$lib/formComponents/InputComp.svelte';
	import type { ResolvedPathname } from '$app/types';
	import { resolve } from '$app/paths';
	import { goto } from '$app/navigation';
	import {
		Search,
		ArrowRight,
		ShieldCheck,
		TrendingUp,
		Briefcase,
		Gift,
		Ticket,
		Star
	} from '@lucide/svelte';
	import CreatorCard from '$lib/components/creator-card.svelte';
	import * as Carousel from '$lib/components/ui/carousel/index.js';
	import GalleryCarousel from '$lib/components/gallery-carousel.svelte';
	import DynamicIcon from '$lib/components/dynamic-icon.svelte';
	import { formatReach } from '$lib/domain/money';
	import * as m from '$lib/paraglide/messages';

	let { data } = $props();

	let query = $state('');

	const hero = $derived(data.featured[0] ?? data.trending[0] ?? null);

	/* Resolved once, then given its query string — appending to a resolved path
	   keeps it resolved, which is what `goto` needs to be handed. */
	const searchHref = $derived(
		`${resolve('/discover')}${query ? `?q=${encodeURIComponent(query)}` : ''}` as ResolvedPathname
	);
	const search = () => goto(searchHref);

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

<svelte:head>
	<title>{m.home_meta_title()}</title>
	<meta name="description" content={m.home_meta_description()} />
</svelte:head>

<!-- Sections sit closer together on a phone: at 16 units the gaps read as the
     page having ended rather than as one section giving way to the next. -->
<div id="landing-page-view" class="space-y-10 pb-10 sm:space-y-16 sm:pb-16">
	<!-- ================= HERO ================= -->
	<section class="mx-auto max-w-7xl px-4 pt-5 sm:px-6 sm:pt-6 lg:px-8">
		<div class="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-12">
			<!--
				`min-h` only from `sm`. On a 390px phone the content is taller than
				460px anyway, so the floor did nothing but risk dead space on the
				short viewports where it would have bitten.
			-->
			<div
				class="relative flex flex-col justify-between overflow-hidden rounded-3xl border-2 border-edge bg-inverse p-5 text-inverse-ink shadow-[6px_6px_0px_0px_rgb(var(--bento-shadow))] sm:min-h-[460px] sm:p-10 lg:col-span-8"
			>
				<div class="relative z-10 space-y-5 sm:space-y-6">
					<div
						class="inline-flex items-center gap-2 rounded-full border-2 border-edge bg-tile-mint px-4 py-1.5 text-xs font-black tracking-wider text-ink uppercase shadow-[2px_2px_0px_0px_rgb(var(--bento-shadow))]"
					>
						<ShieldCheck class="h-4 w-4 text-brand-soft-fg" />
						<span>{m.home_badge_marketplace()}</span>
					</div>

					<h1 class="text-3xl leading-[1.1] font-black tracking-tight sm:text-5xl">
						{m.hero_title()} <br />
						<span class="text-inverse-brand">{m.hero_title_accent()}</span>
					</h1>

					<p class="max-w-xl text-sm leading-relaxed font-medium text-inverse-ink-dim sm:text-base">
						{data.settings?.heroSubtitle ?? m.hero_subtitle()}
					</p>

					<form
						onsubmit={(e) => {
							e.preventDefault();
							search();
						}}
						class="flex flex-col items-center gap-2 rounded-2xl border-2 border-edge bg-surface p-2 shadow-[4px_4px_0px_0px_rgb(var(--bento-shadow))] sm:flex-row"
					>
						<div class="flex w-full items-center gap-2 px-3 text-ink">
							<Search class="h-5 w-5 shrink-0 text-brand-fg" />
							<InputComp
								name="q"
								label={m.search_placeholder()}
								labelHidden
								placeholder={m.search_placeholder()}
								bind:value={query}
								className="border-none bg-transparent shadow-none focus-visible:ring-0"
							/>
						</div>
						<button
							type="submit"
							class="w-full shrink-0 rounded-xl border-2 border-edge bg-brand px-6 py-3 text-xs font-black text-brand-ink shadow-[2px_2px_0px_0px_rgb(var(--bento-shadow))] transition-colors hover:bg-brand-strong sm:w-auto"
						>
							{m.nav_discover()}
						</button>
					</form>

					<!--
						Stacked to one width on a phone. Wrapped, the two sat on separate
						lines at whatever width their own labels happened to be, which
						read as a mistake rather than as a pair of choices.
					-->
					<div class="grid grid-cols-1 gap-2 pt-2 sm:flex sm:flex-wrap sm:items-center sm:gap-3">
						<a
							href={resolve('/campaigns')}
							class="flex items-center justify-center gap-1.5 rounded-xl border-2 border-edge bg-surface px-5 py-3 text-xs font-black text-ink shadow-[2px_2px_0px_0px_rgb(var(--bento-shadow))] transition-all hover:bg-well sm:py-2.5"
						>
							<span>{m.home_cta_view_briefs()}</span>
							<ArrowRight class="h-4 w-4" />
						</a>
						<a
							href={resolve('/register')}
							class="flex items-center justify-center gap-2 rounded-xl border-2 border-edge bg-tile-yellow px-5 py-3 text-xs font-black text-ink shadow-[2px_2px_0px_0px_rgb(var(--bento-shadow))] transition-all hover:shadow-[3px_3px_0px_0px_rgb(var(--bento-shadow))] sm:py-2.5"
						>
							<span>{m.home_cta_create_account()}</span>
						</a>
					</div>
				</div>

				<!-- Live figures, read from the database rather than written into the page -->
				<div
					class="relative z-10 mt-6 grid grid-cols-3 gap-2 border-t-2 border-edge pt-5 text-xs sm:gap-4 sm:pt-6"
				>
					<div>
						<div class="text-xl font-black text-inverse-ink sm:text-2xl">{data.stats.creators}</div>
						<div class="text-[10px] font-bold tracking-wider text-inverse-ink-dim uppercase">
							{m.home_stat_published_creators()}
						</div>
					</div>
					<div>
						<div class="text-xl font-black text-inverse-brand sm:text-2xl">
							{formatReach(data.stats.totalReach)}
						</div>
						<div class="text-[10px] font-bold tracking-wider text-inverse-ink-dim uppercase">
							{m.home_stat_combined_reach()}
						</div>
					</div>
					<div>
						<div class="text-xl font-black text-inverse-ink sm:text-2xl">
							{data.stats.campaigns}
						</div>
						<div class="text-[10px] font-bold tracking-wider text-inverse-ink-dim uppercase">
							{m.home_stat_live_campaigns()}
						</div>
					</div>
				</div>
			</div>

			<!-- Right column -->
			<div class="flex flex-col gap-6 lg:col-span-4">
				<div class="bento-card-mint flex flex-1 flex-col justify-between space-y-4">
					<div class="flex items-center justify-between">
						<span
							class="rounded-full border border-edge bg-inverse px-2.5 py-1 text-[10px] font-black tracking-widest text-inverse-ink uppercase"
						>
							{m.home_featured_creator()}
						</span>
						{#if hero}
							<span
								class="flex items-center gap-1 rounded-full border border-edge bg-surface px-2 py-0.5 text-xs font-black text-ink"
							>
								<Star class="h-3 w-3 fill-warn text-warn" />
								{hero.averageRating.toFixed(1)}
							</span>
						{/if}
					</div>

					{#if hero}
						<div class="flex items-center gap-3">
							<AppImage
								src={hero.avatar}
								alt={hero.fullName}
								kind="avatar"
								seed={hero.username}
								label={hero.fullName}
								class="h-14 w-14 rounded-2xl border-2 border-edge object-cover shadow-[2px_2px_0px_0px_rgb(var(--bento-shadow))]"
								loading="lazy"
								decoding="async"
								width="56"
								height="56"
							/>
							<div class="min-w-0">
								<h3 class="text-base font-black text-ink">{hero.fullName}</h3>
								<p class="text-xs font-bold text-ink-soft">@{hero.username}</p>
								{#if hero.categories?.[0]}
									<span
										class="mt-1 inline-block rounded border border-edge bg-surface px-2 py-0.5 text-[10px] font-black tracking-wider text-brand-soft-fg uppercase"
									>
										{hero.categories[0]}
									</span>
								{/if}
							</div>
						</div>

						<p class="line-clamp-2 text-xs leading-relaxed font-medium text-ink">
							"{hero.bio}"
						</p>

						<div
							class="flex items-center justify-between rounded-2xl border-2 border-edge bg-surface p-3 text-xs shadow-[2px_2px_0px_0px_rgb(var(--bento-shadow))]"
						>
							<div>
								<span class="block text-[9px] font-black tracking-wider text-ink-dim uppercase">
									{m.home_reach()}
								</span>
								<span class="font-black text-ink">{formatReach(hero.totalReach)}</span>
							</div>
							<div>
								<span class="block text-[9px] font-black tracking-wider text-ink-dim uppercase">
									{m.home_score()}
								</span>
								<span class="font-black text-brand-soft-fg">{hero.score}/100</span>
							</div>
							<a
								href={resolve(`/creators/${hero.username}`)}
								class="rounded-xl border border-edge bg-inverse px-3.5 py-1.5 text-xs font-black text-inverse-ink shadow-[1px_1px_0px_0px_rgb(var(--bento-shadow))] hover:bg-inverse-hover"
							>
								{m.home_view()}
							</a>
						</div>
					{/if}
				</div>

				<div class="bento-card-yellow space-y-2">
					<span class="block text-[10px] font-black tracking-widest text-ink uppercase">
						{m.home_agreements_eyebrow()}
					</span>
					<h4 class="text-base font-black text-ink">{m.home_agreements_title()}</h4>
					<p class="text-xs font-medium text-ink-soft">
						{m.home_agreements_body()}
					</p>
				</div>
			</div>
		</div>
	</section>

	<!-- ================= GALLERY ================= -->
	{#if data.gallery.length}
		<section class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
			<GalleryCarousel slides={data.gallery} />
		</section>
	{/if}

	<!-- ================= TRENDING ================= -->
	{#if data.trending.length}
		<section class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
			<Carousel.Root opts={{ align: 'start', containScroll: 'trimSnaps' }} class="space-y-6">
				<div class="flex flex-wrap items-end justify-between gap-4">
					<div>
						<div
							class="flex items-center gap-2 text-xs font-bold tracking-wider text-brand-fg uppercase"
						>
							<TrendingUp class="h-4 w-4" />
							<span>{m.home_trending_eyebrow()}</span>
						</div>
						<h2 class="mt-1 text-xl font-extrabold text-ink sm:text-2xl">
							{m.home_trending_title()}
						</h2>
					</div>

					<div class="flex items-center gap-4">
						<a
							href={resolve('/discover')}
							class="flex items-center gap-1 text-xs font-bold text-brand-soft-fg hover:text-brand-soft-fg"
						>
							<span>{m.home_view_all({ count: data.stats.creators })}</span>
							<ArrowRight class="h-3.5 w-3.5" />
						</a>

						<!-- Arrows from `sm` up. A phone swipes the carousel, and the two
						     buttons only crowded the row they shared with "view all". -->
						<div class="hidden items-center gap-2 sm:flex">
							<Carousel.Previous
								aria-label={m.tbl_previous()}
								class="static inset-auto my-0 size-9 rounded-xl border-2 border-edge bg-surface text-ink shadow-[2px_2px_0px_0px_rgb(var(--bento-shadow))] transition-colors hover:bg-brand-soft disabled:opacity-40 disabled:shadow-none"
							/>
							<Carousel.Next
								aria-label={m.tbl_next()}
								class="static inset-auto my-0 size-9 rounded-xl border-2 border-edge bg-surface text-ink shadow-[2px_2px_0px_0px_rgb(var(--bento-shadow))] transition-colors hover:bg-brand-soft disabled:opacity-40 disabled:shadow-none"
							/>
						</div>
					</div>
				</div>

				<Carousel.Content class="py-2 pe-2">
					{#each data.trending as creator (creator.id)}
						<Carousel.Item class="basis-[86%] sm:basis-1/2 lg:basis-1/3 xl:basis-1/4">
							<CreatorCard {creator} />
						</Carousel.Item>
					{/each}
				</Carousel.Content>
			</Carousel.Root>
		</section>
	{/if}

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
					class="bento-card group flex flex-col justify-between"
				>
					<div>
						<div
							class="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl border-2 border-edge bg-inverse text-inverse-ink shadow-[2px_2px_0px_0px_rgb(var(--bento-shadow))] transition-colors group-hover:bg-brand"
						>
							<DynamicIcon name={category.icon} class="h-5 w-5" />
						</div>
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
</div>
