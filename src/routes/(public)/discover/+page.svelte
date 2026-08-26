<script lang="ts">
	import InputComp from '$lib/formComponents/InputComp.svelte';
	import type { ParamValue } from '$lib/query';
	import type { CreatorCard as CreatorCardRow } from '$lib/server/queries';
	import * as m from '$lib/paraglide/messages';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { enhance } from '$app/forms';
	import { toast } from 'svelte-sonner';
	import { RotateCcw, SlidersHorizontal, Globe, X, Sparkles, Search } from '@lucide/svelte';
	import CreatorCard from '$lib/components/creator-card.svelte';
	import CreatorQuickView from '$lib/components/creator-quick-view.svelte';
	import PaginationBar from '$lib/components/pagination-bar.svelte';
	import SearchInput from '$lib/components/search-input.svelte';
	import { withParams, toggleValue } from '$lib/query';
	import * as Select from '$lib/components/ui/select/index.js';

	let { data } = $props();

	/*
	 * Discovery is filtered in the database, so every control writes to the URL
	 * and the server answers with one page. Nothing here filters an array: the
	 * creators that match may well not be among the twenty-four in the browser.
	 */
	/** Above this the price filter means "any", so the parameter is dropped. */
	const MAX_PRICE = 1_500_000;

	const listState = $derived(data.creators.state);
	const go = (changes: Record<string, ParamValue>) =>
		goto(withParams(page.url, changes), { noScroll: true, keepFocus: true });

	const selectedCountryIds = $derived(listState.filters.country ?? []);
	const categorySlug = $derived(listState.values.category ?? 'all');
	const regionId = $derived(listState.values.region ?? 'all');
	const platformId = $derived(listState.values.platform ?? 'all');
	const verification = $derived(listState.values.verification ?? 'all');
	const availableOnly = $derived(listState.values.availability === 'available');
	const maxPrice = $derived(Number(listState.values.maxPrice ?? MAX_PRICE));
	const sortBy = $derived(listState.sort);

	const matchCampaignId = $derived(String(data.matchCampaignId ?? data.campaigns[0]?.id ?? ''));
	const selectedCampaign = $derived(
		data.campaigns.find((c) => String(c.id) === matchCampaignId) ?? null
	);
	const matchOn = $derived(sortBy === 'match' && data.matchCampaignId !== null);

	let quickView = $state<CreatorCardRow | null>(null);

	/* Optimistic shortlist state, as a writable `$derived`: toggling a badge
	   assigns to it for the round trip, and the next server answer re-seeds it.
	   A plain `$state(data.savedIds)` captured the first render only, so the
	   badges kept showing stale state after an invalidation or a navigation. */
	let savedIds = $derived(data.savedIds);

	const isBusiness = $derived(data.user?.role === 'business' || data.user?.role === 'admin');

	/* Ethiopian regions only make sense while Ethiopia is in scope. */
	const ethiopia = $derived(data.reference.countries.find((c) => c.code === 'ET'));
	const ethiopiaActive = $derived(
		!selectedCountryIds.length ||
			(ethiopia ? selectedCountryIds.includes(String(ethiopia.id)) : false)
	);
	const visibleRegions = $derived(
		data.reference.regions.filter((r) => !ethiopia || r.countryId === ethiopia.id)
	);

	/**
	 * The link a market chip points at.
	 *
	 * The region select is the one control whose relevance depends on another
	 * control, so the link has to carry that dependency now that the link *is*
	 * the state: picking a market that takes Ethiopia out of scope hides the
	 * select, and a `region` left in the URL would keep filtering from a control
	 * the reader can no longer see or clear.
	 */
	const countryLink = (id: string) => {
		const next = toggleValue(selectedCountryIds, id);
		const stillEthiopian = !next.length || (ethiopia ? next.includes(String(ethiopia.id)) : false);
		return withParams(page.url, { country: next, ...(stillEthiopian ? {} : { region: null }) });
	};

	/*
	 * The select offers directions as separate choices — "price: low to high" is
	 * one thing to a reader — while the URL keeps sort and direction apart, so
	 * every listing speaks the same two parameters.
	 */
	const SORTS: Record<string, { sort: string; dir?: 'asc' | 'desc' }> = {
		match: { sort: 'match' },
		score: { sort: 'score' },
		reach: { sort: 'reach' },
		rating: { sort: 'rating' },
		price_low: { sort: 'price', dir: 'asc' },
		price_high: { sort: 'price', dir: 'desc' },
		newest: { sort: 'newest' }
	};

	const sortLabels: Record<string, string> = $derived({
		match: m.discover_sort_match(),
		score: m.discover_sort_score(),
		reach: m.discover_sort_reach(),
		rating: m.discover_sort_rating(),
		price_low: m.discover_sort_price_low(),
		price_high: m.discover_sort_price_high(),
		newest: m.discover_sort_newest()
	});

	const sortChoice = $derived(
		Object.entries(SORTS).find(
			([, spec]) =>
				spec.sort === listState.sort && (spec.dir ?? listState.direction) === listState.direction
		)?.[0] ?? 'score'
	);

	const verificationLabels: Record<string, string> = $derived({
		all: m.discover_verif_all(),
		cn_verified: m.discover_verif_cn(),
		identity_verified: m.discover_verif_identity(),
		social_verified: m.discover_verif_social(),
		unverified: m.discover_verif_unverified()
	});

	/* Filter options. Each carries an "all" entry, because clearing a filter is
	   a choice the control has to offer rather than something only Reset can do. */
	const categoryFilterItems = $derived([
		{ value: 'all', name: m.discover_all_categories({ count: data.reference.categories.length }) },
		...data.reference.categories.map((c) => ({ value: c.slug, name: c.name }))
	]);
	const regionFilterItems = $derived([
		{ value: 'all', name: m.discover_all_regions() },
		...visibleRegions.map((r) => ({ value: String(r.id), name: r.name }))
	]);
	const platformFilterItems = $derived([
		{ value: 'all', name: m.discover_all_platforms() },
		...data.reference.platforms.map((p) => ({ value: String(p.id), name: p.name }))
	]);
	const verificationFilterItems = $derived(
		Object.entries(verificationLabels).map(([value, name]) => ({ value, name }))
	);

	/**
	 * A local slider that only asks the server once the reader lets go.
	 *
	 * A writable `$derived`: dragging assigns to it, and the next server answer
	 * re-seeds it, so the handle can never sit somewhere the results are not.
	 */
	let priceDraft = $derived(maxPrice);
</script>

<svelte:head>
	<title>{m.discover_meta_title()}</title>
</svelte:head>

<div id="discovery-view-container" class="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
	<!-- Header -->
	<div
		class="flex flex-col justify-between gap-4 border-b-2 border-slate-900 pb-6 md:flex-row md:items-center"
	>
		<div>
			<div class="mb-1 flex items-center gap-2">
				<span class="text-xs font-black tracking-widest text-slate-500 uppercase">
					{m.discover_eyebrow()}
				</span>
				<span
					class="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-100 px-2.5 py-0.5 text-[10px] font-black text-emerald-900"
				>
					<Globe class="h-3 w-3 text-emerald-700" />
					{m.discover_global_badge()}
				</span>
			</div>
			<h1 class="text-2xl font-black text-slate-900 sm:text-3xl">{m.discover_title()}</h1>
			<p class="mt-1 text-xs font-medium text-slate-600">
				{m.discover_subtitle({
					creators: data.creators.total,
					markets: data.reference.countries.length
				})}
			</p>
		</div>

		<!--
			Stacked on a phone, side by side from `sm`. Sharing one row at 390px
			left the search box 131px of actual text area once its two icons took
			their padding, so its own placeholder did not fit in it.
		-->
		<div class="flex flex-col gap-3 sm:flex-row sm:items-center">
			<SearchInput
				value={listState.search}
				placeholder={m.discover_search_placeholder()}
				class="w-full sm:flex-1 md:w-72"
			/>

			<Select.Root
				type="single"
				value={sortChoice}
				onValueChange={(value) =>
					go({ sort: value === 'score' ? null : SORTS[value].sort, dir: SORTS[value].dir ?? null })}
			>
				<Select.Trigger
					class="w-full cursor-pointer rounded-2xl border-2 border-slate-900 bg-white px-3 py-2.5 text-xs font-black text-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] sm:w-auto"
				>
					{sortLabels[sortChoice] ?? sortLabels.score}
				</Select.Trigger>
				<Select.Content>
					{#each Object.entries(sortLabels) as [value, label] (value)}
						<Select.Item {value} class="text-xs font-bold">{label}</Select.Item>
					{/each}
				</Select.Content>
			</Select.Root>
		</div>
	</div>

	<!-- Match panel -->
	{#if data.campaigns.length}
		<div
			class="rounded-3xl border-2 border-slate-900 bg-slate-900 p-5 text-white shadow-[4px_4px_0px_0px_rgba(16,185,129,1)]"
		>
			<div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
				<div class="space-y-1">
					<span
						class="flex items-center gap-1.5 text-xs font-black tracking-widest text-emerald-400 uppercase"
					>
						<Sparkles class="h-3.5 w-3.5" />
						{m.discover_match_eyebrow()}
					</span>
					<p class="max-w-xl text-xs font-medium text-slate-300">
						{m.discover_match_body()}
					</p>
				</div>

				<!-- One column on a phone, so the two controls line up at one width. -->
				<div class="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
					<Select.Root
						type="single"
						value={matchCampaignId}
						onValueChange={(value) => go({ campaign: value, sort: 'match' })}
					>
						<!--
							A campaign title is as long as someone made it, and the trigger
							is `whitespace-nowrap`, so on a narrow phone the text ran past
							the card and took the whole page sideways with it. It truncates
							instead, and only asks for its comfortable width once there is
							room for it.
						-->
						<Select.Trigger
							class="w-full max-w-full min-w-0 cursor-pointer rounded-xl border-2 border-slate-900 bg-white px-3 py-2 text-xs font-black text-slate-900 sm:w-auto sm:min-w-56"
						>
							<span class="truncate">
								{selectedCampaign?.title ?? m.discover_choose_campaign()}
							</span>
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
						onclick={() =>
							matchOn
								? go({ sort: null, campaign: null })
								: go({ sort: 'match', campaign: matchCampaignId })}
						class="w-full cursor-pointer rounded-xl border-2 px-4 py-2 text-xs font-black transition-colors sm:w-auto {matchOn
							? 'border-slate-900 bg-emerald-500 text-slate-950'
							: 'border-white bg-transparent text-white hover:bg-white/10'}"
					>
						{matchOn ? m.discover_showing_top_matches() : m.discover_show_top_matches()}
					</button>
				</div>
			</div>
		</div>
	{/if}

	<!-- Country chips. Counts come from the database, over the whole filtered set. -->
	<div
		class="bento-card bento-card-static border-2 border-slate-900 bg-gradient-to-r from-emerald-50/50 via-white to-slate-50 p-4 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] sm:p-5"
	>
		<div class="mb-3 flex items-center justify-between">
			<span
				class="flex items-center gap-1.5 text-xs font-black tracking-wider text-slate-900 uppercase"
			>
				<Globe class="h-3.5 w-3.5 text-emerald-600" />
				{m.discover_filter_by_market()}
			</span>
			{#if selectedCountryIds.length}
				<button
					type="button"
					onclick={() => go({ country: null, region: null })}
					class="cursor-pointer text-[10px] font-bold text-rose-600 hover:underline"
				>
					{m.discover_clear_count({ count: selectedCountryIds.length })}
				</button>
			{/if}
		</div>
		<div class="flex flex-wrap gap-2">
			{#each data.reference.countries as country (country.id)}
				{@const active = selectedCountryIds.includes(String(country.id))}
				<a
					href={countryLink(String(country.id))}
					data-sveltekit-noscroll
					class="flex cursor-pointer items-center gap-1.5 rounded-xl border-2 border-slate-900 px-3 py-1.5 text-xs font-black whitespace-nowrap shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] transition-all {active
						? 'bg-slate-900 text-white'
						: 'bg-white text-slate-800 hover:bg-slate-100'}"
				>
					<span>{country.flag}</span>
					<span>{country.name}</span>
					<span class="opacity-60">({data.countryCounts[String(country.id)] ?? 0})</span>
				</a>
			{/each}
		</div>
	</div>

	<!-- Grid + sidebar -->
	<div class="grid grid-cols-1 gap-8 lg:grid-cols-4">
		<!-- Sidebar -->
		<aside
			class="bento-card bento-card-static h-fit space-y-6 p-5 lg:sticky lg:top-24 lg:col-span-1"
		>
			<div class="flex items-center justify-between border-b-2 border-slate-900 pb-3">
				<span
					class="flex items-center gap-1.5 text-xs font-black tracking-wider text-slate-900 uppercase"
				>
					<SlidersHorizontal class="h-4 w-4 text-emerald-600" />
					<span>{m.discover_filters()}</span>
				</span>
				<a
					href={page.url.pathname}
					class="flex cursor-pointer items-center gap-1 rounded-md border border-slate-900 bg-slate-100 px-2 py-0.5 text-[11px] font-black text-slate-500 hover:text-emerald-700"
				>
					<RotateCcw class="h-3 w-3" />
					<span>{m.discover_reset()}</span>
				</a>
			</div>

			<InputComp
				name="category"
				type="select"
				label={m.discover_category()}
				items={categoryFilterItems}
				value={categorySlug}
				onChange={(next) => go({ category: next === 'all' ? null : String(next) })}
			/>

			{#if ethiopiaActive && visibleRegions.length}
				<InputComp
					name="region"
					type="select"
					label={m.discover_ethiopian_region()}
					items={regionFilterItems}
					value={regionId}
					onChange={(next) => go({ region: next === 'all' ? null : String(next) })}
				/>
			{/if}

			<InputComp
				name="platform"
				type="select"
				label={m.discover_primary_platform()}
				items={platformFilterItems}
				value={platformId}
				onChange={(next) => go({ platform: next === 'all' ? null : String(next) })}
			/>

			<InputComp
				name="maxPrice"
				type="range"
				label={m.discover_max_starting_price()}
				min={1000}
				max={MAX_PRICE}
				step={1000}
				hint={m.discover_own_currency_note()}
				bind:value={priceDraft}
				onChange={(next) => go({ maxPrice: Number(next) >= MAX_PRICE ? null : Number(next) })}
			/>

			<InputComp
				name="verification"
				type="select"
				label={m.discover_verification_level()}
				items={verificationFilterItems}
				value={verification}
				onChange={(next) => go({ verification: next === 'all' ? null : String(next) })}
			/>

			<div class="border-t-2 border-slate-900 pt-3">
				<InputComp
					name="availability"
					type="checkboxSingle"
					align="between"
					label={m.discover_only_available()}
					labelHidden
					placeholder={m.discover_only_available()}
					value={availableOnly}
					onChange={(next) => go({ availability: next ? 'available' : null })}
				/>
			</div>
		</aside>

		<!-- Results -->
		<div class="space-y-4 lg:col-span-3">
			<div
				class="flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-slate-600"
			>
				<div class="flex items-center gap-2">
					<span>
						{m.discover_showing_creators()}
						<strong class="text-slate-900">{data.creators.total}</strong>
						{m.discover_creators_word()}
					</span>
					{#if matchOn}
						<span
							class="flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-100 px-2 py-0.5 text-[11px] font-black text-emerald-800"
						>
							<Sparkles class="h-3 w-3" />
							<span>{m.discover_sorted_by_match()}</span>
						</span>
					{/if}
				</div>

				<div class="flex flex-wrap items-center gap-2">
					{#each selectedCountryIds as countryId (countryId)}
						{@const country = data.reference.countries.find((c) => String(c.id) === countryId)}
						<a
							href={countryLink(countryId)}
							data-sveltekit-noscroll
							class="flex cursor-pointer items-center gap-1 rounded-full border border-slate-900 bg-[#e0e7ff] px-2.5 py-0.5 text-[11px] font-black tracking-wider text-indigo-950 uppercase hover:bg-indigo-200"
						>
							<span>{country?.flag}</span>
							<span>{country?.name}</span>
							<X class="h-3 w-3 text-indigo-800" />
						</a>
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

			{#if data.creators.rows.length === 0}
				<div class="bento-card bento-card-static space-y-3 p-12 text-center">
					<Search class="mx-auto h-10 w-10 text-slate-400" />
					<h3 class="text-base font-black text-slate-900">{m.discover_empty_title()}</h3>
					<p class="mx-auto max-w-sm text-xs font-medium text-slate-600">
						{m.discover_empty_body()}
					</p>
					<a
						href={page.url.pathname}
						class="inline-block cursor-pointer rounded-xl border-2 border-slate-900 bg-emerald-600 px-4 py-2 text-xs font-black text-white shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] hover:bg-emerald-700"
					>
						{m.discover_reset_all()}
					</a>
				</div>
			{:else}
				<div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
					{#each data.creators.rows as creator (creator.id)}
						<CreatorCard
							{creator}
							matchScore={data.matchScores[creator.id]}
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

				<PaginationBar result={data.creators} />
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
							: savedIds.filter((id: number) => id !== creatorId);
						toast.success(nowSaved ? m.discover_saved_toast() : m.discover_removed_toast());
					} else if (result.type === 'failure') {
						toast.error(
							(result.data as { message?: string })?.message ?? m.common_could_not_update()
						);
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
