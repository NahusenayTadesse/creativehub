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

<div id="landing-page-view" class="space-y-16 pb-16">
	<!-- ================= HERO ================= -->
	<section class="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
		<div class="grid grid-cols-1 gap-6 lg:grid-cols-12">
			<div
				class="relative flex min-h-[460px] flex-col justify-between overflow-hidden rounded-3xl border-2 border-slate-900 bg-slate-900 p-8 text-white shadow-[6px_6px_0px_0px_rgba(15,23,42,1)] sm:p-10 lg:col-span-8"
			>
				<div class="relative z-10 space-y-6">
					<div
						class="inline-flex items-center gap-2 rounded-full border-2 border-slate-900 bg-[#dcfce7] px-4 py-1.5 text-xs font-black tracking-wider text-slate-900 uppercase shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]"
					>
						<ShieldCheck class="h-4 w-4 text-emerald-700" />
						<span>{m.home_badge_marketplace()}</span>
					</div>

					<h1 class="text-3xl leading-[1.1] font-black tracking-tight sm:text-5xl">
						{m.hero_title()} <br />
						<span class="text-emerald-400">{m.hero_title_accent()}</span>
					</h1>

					<p class="max-w-xl text-sm leading-relaxed font-medium text-slate-300 sm:text-base">
						{data.settings?.heroSubtitle ?? m.hero_subtitle()}
					</p>

					<form
						onsubmit={(e) => {
							e.preventDefault();
							search();
						}}
						class="flex flex-col items-center gap-2 rounded-2xl border-2 border-slate-900 bg-white p-2 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] sm:flex-row"
					>
						<div class="flex w-full items-center gap-2 px-3 text-slate-900">
							<Search class="h-5 w-5 shrink-0 text-emerald-600" />
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
							class="w-full shrink-0 rounded-xl border-2 border-slate-900 bg-emerald-600 px-6 py-3 text-xs font-black text-white shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] transition-colors hover:bg-emerald-700 sm:w-auto"
						>
							{m.nav_discover()}
						</button>
					</form>

					<div class="flex flex-wrap items-center gap-3 pt-2">
						<a
							href={resolve('/campaigns')}
							class="flex items-center gap-1.5 rounded-xl border-2 border-slate-900 bg-white px-5 py-2.5 text-xs font-black text-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] transition-all hover:bg-slate-100"
						>
							<span>{m.home_cta_view_briefs()}</span>
							<ArrowRight class="h-4 w-4" />
						</a>
						<a
							href={resolve('/register')}
							class="flex items-center gap-2 rounded-xl border-2 border-slate-900 bg-[#fef9c3] px-5 py-2.5 text-xs font-black text-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] transition-all hover:shadow-[3px_3px_0px_0px_rgba(15,23,42,1)]"
						>
							<span>{m.home_cta_create_account()}</span>
						</a>
					</div>
				</div>

				<!-- Live figures, read from the database rather than written into the page -->
				<div
					class="relative z-10 mt-6 grid grid-cols-3 gap-4 border-t-2 border-slate-800 pt-6 text-xs"
				>
					<div>
						<div class="text-xl font-black text-white sm:text-2xl">{data.stats.creators}</div>
						<div class="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
							{m.home_stat_published_creators()}
						</div>
					</div>
					<div>
						<div class="text-xl font-black text-emerald-400 sm:text-2xl">
							{formatReach(data.stats.totalReach)}
						</div>
						<div class="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
							{m.home_stat_combined_reach()}
						</div>
					</div>
					<div>
						<div class="text-xl font-black text-white sm:text-2xl">{data.stats.campaigns}</div>
						<div class="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
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
							class="rounded-full border border-slate-900 bg-slate-900 px-2.5 py-1 text-[10px] font-black tracking-widest text-white uppercase"
						>
							{m.home_featured_creator()}
						</span>
						{#if hero}
							<span
								class="flex items-center gap-1 rounded-full border border-slate-900 bg-white px-2 py-0.5 text-xs font-black text-slate-900"
							>
								<Star class="h-3 w-3 fill-amber-400 text-amber-500" />
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
								class="h-14 w-14 rounded-2xl border-2 border-slate-900 object-cover shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]"
								loading="lazy"
								decoding="async"
								width="56"
								height="56"
							/>
							<div class="min-w-0">
								<h3 class="text-base font-black text-slate-900">{hero.fullName}</h3>
								<p class="text-xs font-bold text-slate-700">@{hero.username}</p>
								{#if hero.categories?.[0]}
									<span
										class="mt-1 inline-block rounded border border-slate-900 bg-white px-2 py-0.5 text-[10px] font-black tracking-wider text-emerald-900 uppercase"
									>
										{hero.categories[0]}
									</span>
								{/if}
							</div>
						</div>

						<p class="line-clamp-2 text-xs leading-relaxed font-medium text-slate-800">
							"{hero.bio}"
						</p>

						<div
							class="flex items-center justify-between rounded-2xl border-2 border-slate-900 bg-white p-3 text-xs shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]"
						>
							<div>
								<span class="block text-[9px] font-black tracking-wider text-slate-500 uppercase">
									{m.home_reach()}
								</span>
								<span class="font-black text-slate-900">{formatReach(hero.totalReach)}</span>
							</div>
							<div>
								<span class="block text-[9px] font-black tracking-wider text-slate-500 uppercase">
									{m.home_score()}
								</span>
								<span class="font-black text-emerald-700">{hero.score}/100</span>
							</div>
							<a
								href={resolve(`/creators/${hero.username}`)}
								class="rounded-xl border border-slate-900 bg-slate-900 px-3.5 py-1.5 text-xs font-black text-white shadow-[1px_1px_0px_0px_rgba(15,23,42,1)] hover:bg-slate-800"
							>
								{m.home_view()}
							</a>
						</div>
					{/if}
				</div>

				<div class="bento-card-yellow space-y-2">
					<span class="block text-[10px] font-black tracking-widest text-slate-800 uppercase">
						{m.home_agreements_eyebrow()}
					</span>
					<h4 class="text-base font-black text-slate-900">{m.home_agreements_title()}</h4>
					<p class="text-xs font-medium text-slate-700">
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
							class="flex items-center gap-2 text-xs font-bold tracking-wider text-emerald-600 uppercase"
						>
							<TrendingUp class="h-4 w-4" />
							<span>{m.home_trending_eyebrow()}</span>
						</div>
						<h2 class="mt-1 text-xl font-extrabold text-gray-900 sm:text-2xl">
							{m.home_trending_title()}
						</h2>
					</div>

					<div class="flex items-center gap-4">
						<a
							href={resolve('/discover')}
							class="flex items-center gap-1 text-xs font-bold text-emerald-700 hover:text-emerald-800"
						>
							<span>{m.home_view_all({ count: data.stats.creators })}</span>
							<ArrowRight class="h-3.5 w-3.5" />
						</a>

						<div class="flex items-center gap-2">
							<Carousel.Previous
								aria-label={m.tbl_previous()}
								class="static inset-auto my-0 size-9 rounded-xl border-2 border-slate-900 bg-white text-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] transition-colors hover:bg-emerald-50 disabled:opacity-40 disabled:shadow-none"
							/>
							<Carousel.Next
								aria-label={m.tbl_next()}
								class="static inset-auto my-0 size-9 rounded-xl border-2 border-slate-900 bg-white text-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] transition-colors hover:bg-emerald-50 disabled:opacity-40 disabled:shadow-none"
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
			<span class="text-xs font-black tracking-widest text-slate-500 uppercase">
				{m.home_categories_eyebrow()}
			</span>
			<h2 class="text-xl font-black text-slate-900 sm:text-3xl">{m.home_categories_title()}</h2>
			<p class="text-xs font-medium text-slate-600">
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
							class="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl border-2 border-slate-900 bg-slate-900 text-white shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] transition-colors group-hover:bg-emerald-600"
						>
							<DynamicIcon name={category.icon} class="h-5 w-5" />
						</div>
						<h3
							class="text-sm font-black text-slate-900 transition-colors group-hover:text-emerald-600"
						>
							{category.name}
						</h3>
						<p class="mt-1 line-clamp-2 text-[11px] leading-relaxed font-medium text-slate-600">
							{category.description}
						</p>
					</div>
				</a>
			{/each}
		</div>
	</section>

	<!-- ================= COMPENSATION MODELS ================= -->
	<section class="py-12">
		<div class="mx-auto max-w-7xl space-y-8 px-4 sm:px-6 lg:px-8">
			<div class="mx-auto max-w-2xl space-y-2 text-center">
				<span
					class="inline-block rounded-full border border-slate-900 bg-[#dcfce7] px-3 py-1 text-xs font-black tracking-widest text-emerald-700 uppercase"
				>
					{m.home_comp_eyebrow()}
				</span>
				<h2 class="text-xl font-black text-slate-900 sm:text-3xl">{m.home_comp_title()}</h2>
				<p class="text-xs font-medium text-slate-600">
					{m.home_comp_body()}
				</p>
			</div>

			<div class="grid grid-cols-1 gap-6 md:grid-cols-3">
				<div class="bento-card-mint space-y-3">
					<div
						class="flex h-12 w-12 items-center justify-center rounded-2xl border-2 border-slate-900 bg-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]"
					>
						<Briefcase class="h-6 w-6 text-emerald-400" />
					</div>
					<h3 class="text-lg font-black text-slate-900">{m.home_comp_paid_title()}</h3>
					<p class="text-xs leading-relaxed font-medium text-slate-800">
						{m.home_comp_paid_body()}
					</p>
					<span
						class="inline-block rounded-lg border border-slate-900 bg-white px-2.5 py-1 text-[11px] font-black text-emerald-900"
					>
						{m.home_comp_paid_tag()}
					</span>
				</div>

				<div class="bento-card-indigo space-y-3">
					<div
						class="flex h-12 w-12 items-center justify-center rounded-2xl border-2 border-slate-900 bg-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]"
					>
						<Ticket class="h-6 w-6 text-indigo-300" />
					</div>
					<h3 class="text-lg font-black text-slate-900">{m.home_comp_event_title()}</h3>
					<p class="text-xs leading-relaxed font-medium text-slate-800">
						{m.home_comp_event_body()}
					</p>
					<span
						class="inline-block rounded-lg border border-slate-900 bg-white px-2.5 py-1 text-[11px] font-black text-indigo-950"
					>
						{m.home_comp_event_tag()}
					</span>
				</div>

				<div class="bento-card-yellow space-y-3">
					<div
						class="flex h-12 w-12 items-center justify-center rounded-2xl border-2 border-slate-900 bg-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]"
					>
						<Gift class="h-6 w-6 text-amber-300" />
					</div>
					<h3 class="text-lg font-black text-slate-900">{m.home_comp_barter_title()}</h3>
					<p class="text-xs leading-relaxed font-medium text-slate-800">
						{m.home_comp_barter_body()}
					</p>
					<span
						class="inline-block rounded-lg border border-slate-900 bg-white px-2.5 py-1 text-[11px] font-black text-amber-950"
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
					class="inline-block rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-xs font-black tracking-widest text-emerald-400 uppercase"
				>
					{m.home_brands_eyebrow()}
				</span>
				<h2 class="text-2xl font-black text-white sm:text-3xl">{m.home_brands_title()}</h2>

				<div class="space-y-4 text-xs">
					{#each brandSteps as step (step.n)}
						<div class="flex gap-4">
							<span
								class="flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl border border-white bg-emerald-500 font-black text-slate-950"
							>
								{step.n}
							</span>
							<div>
								<h4 class="text-sm font-black text-white">{step.title}</h4>
								<p class="mt-0.5 text-slate-300">{step.body}</p>
							</div>
						</div>
					{/each}
				</div>

				<a
					href={resolve('/register?role=business')}
					class="block w-full rounded-2xl border-2 border-slate-900 bg-emerald-500 py-3.5 text-center text-xs font-black text-slate-950 shadow-[2px_2px_0px_0px_rgba(255,255,255,1)] transition-all hover:bg-emerald-400"
				>
					{m.home_brands_cta()}
				</a>
			</div>

			<div class="bento-card-mint space-y-6">
				<span
					class="inline-block rounded-full border border-slate-900 bg-white px-3 py-1 text-xs font-black tracking-widest text-emerald-950 uppercase"
				>
					{m.home_creators_eyebrow()}
				</span>
				<h2 class="text-2xl font-black text-slate-900 sm:text-3xl">{m.home_creators_title()}</h2>

				<div class="space-y-4 text-xs">
					{#each creatorSteps as step (step.n)}
						<div class="flex gap-4">
							<span
								class="flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl border border-slate-900 bg-slate-900 font-black text-white"
							>
								{step.n}
							</span>
							<div>
								<h4 class="text-sm font-black text-slate-900">{step.title}</h4>
								<p class="mt-0.5 font-medium text-slate-800">{step.body}</p>
							</div>
						</div>
					{/each}
				</div>

				<a
					href={resolve('/register?role=creator')}
					class="block w-full rounded-2xl border-2 border-slate-900 bg-slate-900 py-3.5 text-center text-xs font-black text-white shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] transition-all hover:bg-slate-800"
				>
					{m.home_creators_cta()}
				</a>
			</div>
		</div>
	</section>
</div>
