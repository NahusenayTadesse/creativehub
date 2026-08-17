<script lang="ts">
	import { page } from '$app/state';
	import { enhance } from '$app/forms';
	import { toast } from 'svelte-sonner';
	import { Search, RotateCcw, SlidersHorizontal, Globe, X, Sparkles } from '@lucide/svelte';
	import CreatorCard from '$lib/components/creator-card.svelte';
	import CreatorQuickView from '$lib/components/creator-quick-view.svelte';
	import { calculateMatch } from '$lib/domain/match';
	import * as Select from '$lib/components/ui/select/index.js';

	let { data } = $props();

	/* ---------------- filter state ---------------- */
	const initialCategory = page.url.searchParams.get('category') ?? 'all';
	const initialQuery = page.url.searchParams.get('q') ?? '';

	let query = $state(initialQuery);
	let categorySlug = $state(initialCategory);
	let regionId = $state('all');
	let platformId = $state('all');
	let verification = $state('all');
	let availableOnly = $state(false);
	let maxPrice = $state(1500000);
	let sortBy = $state('score');
	let selectedCountryIds = $state<number[]>([]);
	let matchCampaignId = $state(String(data.campaigns[0]?.id ?? ''));
	let matchFilterOn = $state(false);
	let quickView = $state<any>(null);
	let savedIds = $state<number[]>(data.savedIds);

	const isBusiness = $derived(data.user?.role === 'business' || data.user?.role === 'admin');

	const selectedCampaign = $derived(
		data.campaigns.find((c) => String(c.id) === matchCampaignId) ?? null
	);

	/* Adjacency lets a fintech brief still surface a business creator. */
	const ADJACENCY: Record<string, string[]> = {
		technology: ['business', 'finance', 'education'],
		finance: ['technology', 'business', 'lifestyle'],
		business: ['technology', 'finance', 'lifestyle', 'education'],
		entertainment: ['lifestyle', 'food-dining', 'beauty-fashion'],
		'beauty-fashion': ['lifestyle', 'entertainment', 'health-wellness'],
		'food-dining': ['lifestyle', 'travel-tourism', 'entertainment'],
		'travel-tourism': ['food-dining', 'lifestyle', 'entertainment'],
		'sports-fitness': ['health-wellness', 'lifestyle'],
		'health-wellness': ['sports-fitness', 'lifestyle', 'food-dining'],
		lifestyle: ['beauty-fashion', 'food-dining', 'travel-tourism', 'entertainment'],
		agriculture: ['business', 'technology', 'finance'],
		education: ['technology', 'business', 'finance']
	};

	const categoryById = $derived(
		new Map(data.reference.categories.map((c) => [c.id, c] as const))
	);

	const matchScores = $derived.by(() => {
		const map = new Map<number, number>();
		if (!selectedCampaign) return map;

		const campaignCategory = selectedCampaign.categoryId
			? categoryById.get(selectedCampaign.categoryId)
			: null;
		const adjacentIds = (ADJACENCY[campaignCategory?.slug ?? ''] ?? [])
			.map((slug) => data.reference.categories.find((c) => c.slug === slug)?.id)
			.filter((id): id is number => id !== undefined);

		for (const creator of data.creators) {
			map.set(
				creator.id,
				calculateMatch({
					campaign: {
						categoryId: selectedCampaign.categoryId,
						platformIds: selectedCampaign.platformIds ?? [],
						countryId: selectedCampaign.countryId,
						targetRegions: selectedCampaign.targetRegions ?? [],
						budgetMax: selectedCampaign.budgetMax,
						followerMin: selectedCampaign.followerMin,
						followerMax: selectedCampaign.followerMax,
						compensationType: selectedCampaign.compensationType,
						categoryName: campaignCategory?.name
					},
					creator: {
						categoryIds: creator.categoryIds,
						categories: creator.categories,
						platformIds: creator.platformIds,
						platformId: creator.platformId,
						platformName: creator.platformName,
						countryId: creator.countryId,
						countryName: creator.countryName,
						regionName: creator.regionName,
						city: creator.city,
						startingPrice: creator.startingPrice,
						totalReach: creator.totalReach,
						engagementRate: creator.engagementRate,
						averageRating: creator.averageRating,
						completedBookings: creator.completedBookings,
						verificationLevel: creator.verificationLevel,
						overseasPercentage: creator.overseasPercentage,
						topCountries: creator.topCountries ?? []
					},
					adjacentCategoryIds: adjacentIds
				}).total
			);
		}
		return map;
	});

	/** The ids the AI filter narrows to: the top ten by match score. */
	const topMatchIds = $derived(
		[...matchScores.entries()]
			.sort((a, b) => b[1] - a[1])
			.slice(0, 10)
			.map(([id]) => id)
	);

	const filtered = $derived.by(() => {
		const q = query.trim().toLowerCase();

		const rows = data.creators.filter((creator) => {
			if (matchFilterOn && !topMatchIds.includes(creator.id)) return false;

			if (q) {
				const haystack = [
					creator.fullName,
					creator.username,
					creator.bio ?? '',
					creator.city ?? '',
					creator.countryName ?? '',
					...creator.categories
				]
					.join(' ')
					.toLowerCase();
				if (!haystack.includes(q)) return false;
			}

			if (selectedCountryIds.length && !selectedCountryIds.includes(creator.countryId ?? -1)) {
				return false;
			}

			if (categorySlug !== 'all') {
				const category = data.reference.categories.find((c) => c.slug === categorySlug);
				if (!category || !creator.categoryIds.includes(category.id)) return false;
			}

			if (regionId !== 'all' && String(creator.regionId) !== regionId) return false;
			if (platformId !== 'all' && String(creator.platformId) !== platformId) return false;
			if (verification !== 'all' && creator.verificationLevel !== verification) return false;
			if (availableOnly && creator.availability !== 'available') return false;
			if (creator.startingPrice > maxPrice) return false;

			return true;
		});

		return rows.sort((a, b) => {
			switch (sortBy) {
				case 'match':
					return (matchScores.get(b.id) ?? 0) - (matchScores.get(a.id) ?? 0);
				case 'reach':
					return b.totalReach - a.totalReach;
				case 'price_low':
					return a.startingPrice - b.startingPrice;
				case 'price_high':
					return b.startingPrice - a.startingPrice;
				case 'rating':
					return b.averageRating - a.averageRating;
				default:
					return b.score - a.score;
			}
		});
	});

	/* Ethiopian regions only make sense while Ethiopia is in scope. */
	const ethiopia = $derived(data.reference.countries.find((c) => c.code === 'ET'));
	const ethiopiaActive = $derived(
		!selectedCountryIds.length || (ethiopia ? selectedCountryIds.includes(ethiopia.id) : false)
	);
	const visibleRegions = $derived(
		data.reference.regions.filter((r) => !ethiopia || r.countryId === ethiopia.id)
	);

	const countryCount = (countryId: number) =>
		data.creators.filter((c) => c.countryId === countryId).length;

	function toggleCountry(countryId: number) {
		selectedCountryIds = selectedCountryIds.includes(countryId)
			? selectedCountryIds.filter((id) => id !== countryId)
			: [...selectedCountryIds, countryId];
		if (!ethiopiaActive) regionId = 'all';
	}

	function reset() {
		query = '';
		categorySlug = 'all';
		regionId = 'all';
		platformId = 'all';
		verification = 'all';
		availableOnly = false;
		maxPrice = 1500000;
		sortBy = 'score';
		selectedCountryIds = [];
		matchFilterOn = false;
	}

	const sortLabels: Record<string, string> = {
		match: '✨ AI match score',
		score: 'Creator score',
		reach: 'Total reach',
		price_low: 'Price: low to high',
		price_high: 'Price: high to low',
		rating: 'Rating'
	};

	const verificationLabels: Record<string, string> = {
		all: 'Any verification level',
		cn_verified: 'CN Verified (highest)',
		identity_verified: 'Identity verified',
		social_verified: 'Social verified',
		unverified: 'Unverified'
	};
</script>

<svelte:head>
	<title>Discover creators — Creator Network</title>
</svelte:head>

<div id="discovery-view-container" class="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
	<!-- Header -->
	<div
		class="flex flex-col justify-between gap-4 border-b-2 border-slate-900 pb-6 md:flex-row md:items-center"
	>
		<div>
			<div class="mb-1 flex items-center gap-2">
				<span class="text-xs font-black tracking-widest text-slate-500 uppercase">
					Marketplace directory
				</span>
				<span
					class="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-100 px-2.5 py-0.5 text-[10px] font-black text-emerald-900"
				>
					<Globe class="h-3 w-3 text-emerald-700" />
					Pan-African & global
				</span>
			</div>
			<h1 class="text-2xl font-black text-slate-900 sm:text-3xl">Discover creators</h1>
			<p class="mt-1 text-xs font-medium text-slate-600">
				{data.creators.length} published creators across {data.reference.countries.length} markets.
			</p>
		</div>

		<div class="flex flex-wrap items-center gap-3 sm:flex-nowrap">
			<div class="relative flex-1 md:w-72">
				<Search class="absolute top-3 left-3 h-4 w-4 text-slate-500" />
				<input
					type="text"
					bind:value={query}
					placeholder="Search by name, country, city, topic…"
					class="w-full rounded-2xl border-2 border-slate-900 bg-white py-2.5 pr-3 pl-9 text-xs font-bold shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] outline-none focus:ring-2 focus:ring-emerald-500"
				/>
			</div>

			<Select.Root type="single" bind:value={sortBy}>
				<Select.Trigger
					class="cursor-pointer rounded-2xl border-2 border-slate-900 bg-white px-3 py-2.5 text-xs font-black text-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]"
				>
					{sortLabels[sortBy]}
				</Select.Trigger>
				<Select.Content>
					{#each Object.entries(sortLabels) as [value, label] (value)}
						<Select.Item {value} class="text-xs font-bold">{label}</Select.Item>
					{/each}
				</Select.Content>
			</Select.Root>
		</div>
	</div>

	<!-- AI match panel -->
	{#if data.campaigns.length}
		<div
			class="rounded-3xl border-2 border-slate-900 bg-slate-900 p-5 text-white shadow-[4px_4px_0px_0px_rgba(16,185,129,1)]"
		>
			<div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
				<div class="space-y-1">
					<span class="flex items-center gap-1.5 text-xs font-black tracking-widest text-emerald-400 uppercase">
						<Sparkles class="h-3.5 w-3.5" />
						Match creators to a brief
					</span>
					<p class="max-w-xl text-xs font-medium text-slate-300">
						Scores five factors — niche, audience geography, past performance, platform fit and
						budget headroom — and shows the arithmetic on each profile. No black box.
					</p>
				</div>

				<div class="flex flex-wrap items-center gap-2">
					<Select.Root type="single" bind:value={matchCampaignId}>
						<Select.Trigger
							class="min-w-56 cursor-pointer rounded-xl border-2 border-slate-900 bg-white px-3 py-2 text-xs font-black text-slate-900"
						>
							{selectedCampaign?.title ?? 'Choose a campaign'}
						</Select.Trigger>
						<Select.Content>
							{#each data.campaigns as campaign (campaign.id)}
								<Select.Item value={String(campaign.id)} class="text-xs font-bold">
									{campaign.title}
								</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>

					<button
						type="button"
						onclick={() => {
							matchFilterOn = !matchFilterOn;
							if (matchFilterOn) sortBy = 'match';
						}}
						class="cursor-pointer rounded-xl border-2 px-4 py-2 text-xs font-black transition-colors {matchFilterOn
							? 'border-slate-900 bg-emerald-500 text-slate-950'
							: 'border-white bg-transparent text-white hover:bg-white/10'}"
					>
						{matchFilterOn ? 'Showing top 10 matches' : 'Show top 10 matches'}
					</button>
				</div>
			</div>
		</div>
	{/if}

	<!-- Country chips -->
	<div
		class="bento-card bento-card-static border-2 border-slate-900 bg-gradient-to-r from-emerald-50/50 via-white to-slate-50 p-4 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] sm:p-5"
	>
		<div class="mb-3 flex items-center justify-between">
			<span class="flex items-center gap-1.5 text-xs font-black tracking-wider text-slate-900 uppercase">
				<Globe class="h-3.5 w-3.5 text-emerald-600" />
				Filter by market
			</span>
			{#if selectedCountryIds.length}
				<button
					type="button"
					onclick={() => (selectedCountryIds = [])}
					class="cursor-pointer text-[10px] font-bold text-rose-600 hover:underline"
				>
					Clear ({selectedCountryIds.length})
				</button>
			{/if}
		</div>
		<div class="flex flex-wrap gap-2">
			{#each data.reference.countries as country (country.id)}
				{@const count = countryCount(country.id)}
				<button
					type="button"
					onclick={() => toggleCountry(country.id)}
					class="flex cursor-pointer items-center gap-1.5 rounded-xl border-2 border-slate-900 px-3 py-1.5 text-xs font-black whitespace-nowrap shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] transition-all {selectedCountryIds.includes(
						country.id
					)
						? 'bg-slate-900 text-white'
						: 'bg-white text-slate-800 hover:bg-slate-100'}"
				>
					<span>{country.flag}</span>
					<span>{country.name}</span>
					<span class="opacity-60">({count})</span>
				</button>
			{/each}
		</div>
	</div>

	<!-- Grid + sidebar -->
	<div class="grid grid-cols-1 gap-8 lg:grid-cols-4">
		<!-- Sidebar -->
		<aside class="bento-card bento-card-static sticky top-24 h-fit space-y-6 p-5 lg:col-span-1">
			<div class="flex items-center justify-between border-b-2 border-slate-900 pb-3">
				<span class="flex items-center gap-1.5 text-xs font-black tracking-wider text-slate-900 uppercase">
					<SlidersHorizontal class="h-4 w-4 text-emerald-600" />
					<span>Filters</span>
				</span>
				<button
					type="button"
					onclick={reset}
					class="flex cursor-pointer items-center gap-1 rounded-md border border-slate-900 bg-slate-100 px-2 py-0.5 text-[11px] font-black text-slate-500 hover:text-emerald-700"
				>
					<RotateCcw class="h-3 w-3" />
					<span>Reset</span>
				</button>
			</div>

			<div>
				<label for="filter-category" class="mb-2 block text-xs font-black tracking-wider text-slate-900 uppercase">
					Category
				</label>
				<select
					id="filter-category"
					bind:value={categorySlug}
					class="w-full rounded-xl border-2 border-slate-900 bg-white px-3 py-2 text-xs font-bold text-slate-900"
				>
					<option value="all">All categories ({data.reference.categories.length})</option>
					{#each data.reference.categories as category (category.id)}
						<option value={category.slug}>{category.name}</option>
					{/each}
				</select>
			</div>

			{#if ethiopiaActive && visibleRegions.length}
				<div>
					<label for="filter-region" class="mb-2 block text-xs font-black tracking-wider text-slate-900 uppercase">
						Ethiopian region
					</label>
					<select
						id="filter-region"
						bind:value={regionId}
						class="w-full rounded-xl border-2 border-slate-900 bg-white px-3 py-2 text-xs font-bold text-slate-900"
					>
						<option value="all">All regions</option>
						{#each visibleRegions as region (region.id)}
							<option value={String(region.id)}>{region.name}</option>
						{/each}
					</select>
				</div>
			{/if}

			<div>
				<label for="filter-platform" class="mb-2 block text-xs font-black tracking-wider text-slate-900 uppercase">
					Primary platform
				</label>
				<select
					id="filter-platform"
					bind:value={platformId}
					class="w-full rounded-xl border-2 border-slate-900 bg-white px-3 py-2 text-xs font-bold text-slate-900"
				>
					<option value="all">All platforms</option>
					{#each data.reference.platforms as platform (platform.id)}
						<option value={String(platform.id)}>{platform.name}</option>
					{/each}
				</select>
			</div>

			<div>
				<div class="mb-1 flex items-center justify-between text-xs">
					<label for="filter-price" class="text-[11px] font-black tracking-wider text-slate-900 uppercase">
						Max starting price
					</label>
					<span
						class="rounded border border-slate-900 bg-[#dcfce7] px-2 py-0.5 text-xs font-black text-emerald-800"
					>
						{maxPrice.toLocaleString()}
					</span>
				</div>
				<input
					id="filter-price"
					type="range"
					min={1000}
					max={1500000}
					step={1000}
					bind:value={maxPrice}
					class="w-full cursor-pointer accent-emerald-600"
				/>
				<p class="mt-1 text-right text-[10px] font-bold text-slate-500">
					In each creator's own currency
				</p>
			</div>

			<div>
				<label for="filter-verification" class="mb-2 block text-xs font-black tracking-wider text-slate-900 uppercase">
					Verification level
				</label>
				<select
					id="filter-verification"
					bind:value={verification}
					class="w-full rounded-xl border-2 border-slate-900 bg-white px-3 py-2 text-xs font-bold text-slate-900"
				>
					{#each Object.entries(verificationLabels) as [value, label] (value)}
						<option {value}>{label}</option>
					{/each}
				</select>
			</div>

			<div class="flex items-center justify-between border-t-2 border-slate-900 pt-3 text-xs">
				<label for="filter-available" class="font-black text-slate-900">Only available now</label>
				<input
					id="filter-available"
					type="checkbox"
					bind:checked={availableOnly}
					class="h-4 w-4 cursor-pointer rounded border-2 border-slate-900 accent-emerald-600"
				/>
			</div>
		</aside>

		<!-- Results -->
		<div class="space-y-4 lg:col-span-3">
			<div class="flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-slate-600">
				<div class="flex items-center gap-2">
					<span>Showing <strong class="text-slate-900">{filtered.length}</strong> creators</span>
					{#if sortBy === 'match'}
						<span
							class="flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-100 px-2 py-0.5 text-[11px] font-black text-emerald-800"
						>
							<Sparkles class="h-3 w-3" />
							<span>Sorted by match score</span>
						</span>
					{/if}
				</div>

				<div class="flex flex-wrap items-center gap-2">
					{#if matchFilterOn}
						<button
							type="button"
							onclick={() => (matchFilterOn = false)}
							class="flex cursor-pointer items-center gap-1 rounded-full border border-slate-900 bg-indigo-100 px-2.5 py-0.5 text-[11px] font-black text-indigo-900 hover:bg-indigo-200"
						>
							<span>Top matches ({topMatchIds.length})</span>
							<X class="h-3 w-3" />
						</button>
					{/if}
					{#each selectedCountryIds as countryId (countryId)}
						{@const country = data.reference.countries.find((c) => c.id === countryId)}
						<button
							type="button"
							onclick={() => toggleCountry(countryId)}
							class="flex cursor-pointer items-center gap-1 rounded-full border border-slate-900 bg-[#e0e7ff] px-2.5 py-0.5 text-[11px] font-black tracking-wider text-indigo-950 uppercase hover:bg-indigo-200"
						>
							<span>{country?.flag}</span>
							<span>{country?.name}</span>
							<X class="h-3 w-3 text-indigo-800" />
						</button>
					{/each}
					{#if categorySlug !== 'all'}
						<span
							class="rounded-full border border-slate-900 bg-[#dcfce7] px-3 py-1 text-[11px] font-black tracking-wider text-slate-900 uppercase"
						>
							{data.reference.categories.find((c) => c.slug === categorySlug)?.name}
						</span>
					{/if}
				</div>
			</div>

			{#if filtered.length === 0}
				<div class="bento-card bento-card-static space-y-3 p-12 text-center">
					<Search class="mx-auto h-10 w-10 text-slate-400" />
					<h3 class="text-base font-black text-slate-900">No creators match these filters</h3>
					<p class="mx-auto max-w-sm text-xs font-medium text-slate-600">
						Try widening the price range, clearing a market, or searching for a broader topic.
					</p>
					<button
						type="button"
						onclick={reset}
						class="cursor-pointer rounded-xl border-2 border-slate-900 bg-emerald-600 px-4 py-2 text-xs font-black text-white shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] hover:bg-emerald-700"
					>
						Reset all filters
					</button>
				</div>
			{:else}
				<div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
					{#each filtered as creator (creator.id)}
						<CreatorCard
							{creator}
							matchScore={sortBy === 'match' || matchFilterOn ? matchScores.get(creator.id) : undefined}
							saved={savedIds.includes(creator.id)}
							onQuickView={(c) => (quickView = c)}
							onSave={isBusiness
								? (c) => {
										const form = document.getElementById('save-form') as HTMLFormElement;
										(form.elements.namedItem('creatorId') as HTMLInputElement).value = String(c.id);
										form.requestSubmit();
									}
								: undefined}
						/>
					{/each}
				</div>
			{/if}
		</div>
	</div>

	<!-- Shortlist toggle posts through a single hidden form -->
	{#if isBusiness}
		<form
			id="save-form"
			method="POST"
			action="?/toggleSave"
			class="hidden"
			use:enhance={() => {
				return async ({ result, update }) => {
					if (result.type === 'success') {
						const creatorId = Number(
							(document.getElementById('save-form') as HTMLFormElement).creatorId.value
						);
						const nowSaved = (result.data as { saved?: boolean })?.saved;
						savedIds = nowSaved
							? [...savedIds, creatorId]
							: savedIds.filter((id) => id !== creatorId);
						toast.success(nowSaved ? 'Saved to shortlist' : 'Removed from shortlist');
					} else if (result.type === 'failure') {
						toast.error((result.data as { message?: string })?.message ?? 'Could not update');
					}
					await update({ reset: false, invalidateAll: false });
				};
			}}
		>
			<input type="hidden" name="creatorId" value="" />
		</form>
	{/if}

	<CreatorQuickView creator={quickView} onClose={() => (quickView = null)} />
</div>
