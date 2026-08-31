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
	import * as Sheet from '$lib/components/ui/sheet/index.js';

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

	/*
	 * On a phone the filters live behind a button rather than above the results.
	 * Rendered in the page, the sidebar put roughly two screens of controls
	 * between the reader and the first creator — on the page whose whole job is
	 * showing creators. The same snippet fills both the drawer and the desktop
	 * sidebar, so the two can never drift apart.
	 */
	let filtersOpen = $state(false);

	/** How many filters are narrowing the list, for the button's badge. */
	const activeFilterCount = $derived(
		selectedCountryIds.length +
			(categorySlug !== 'all' ? 1 : 0) +
			(regionId !== 'all' ? 1 : 0) +
			(platformId !== 'all' ? 1 : 0) +
			(verification !== 'all' ? 1 : 0) +
			(maxPrice < MAX_PRICE ? 1 : 0) +
			(availableOnly ? 1 : 0)
	);
</script>

{#snippet filterControls(scope: string)}
	<InputComp
		name="category"
		id="{scope}-category"
		type="select"
		label={m.discover_category()}
		items={categoryFilterItems}
		value={categorySlug}
		onChange={(next) => go({ category: next === 'all' ? null : String(next) })}
	/>

	{#if ethiopiaActive && visibleRegions.length}
		<InputComp
			name="region"
			id="{scope}-region"
			type="select"
			label={m.discover_ethiopian_region()}
			items={regionFilterItems}
			value={regionId}
			onChange={(next) => go({ region: next === 'all' ? null : String(next) })}
		/>
	{/if}

	<InputComp
		name="platform"
		id="{scope}-platform"
		type="select"
		label={m.discover_primary_platform()}
		items={platformFilterItems}
		value={platformId}
		onChange={(next) => go({ platform: next === 'all' ? null : String(next) })}
	/>

	<InputComp
		name="maxPrice"
		id="{scope}-maxPrice"
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
		id="{scope}-verification"
		type="select"
		label={m.discover_verification_level()}
		items={verificationFilterItems}
		value={verification}
		onChange={(next) => go({ verification: next === 'all' ? null : String(next) })}
	/>

	<div class="border-t-2 border-edge pt-3">
		<InputComp
			name="availability"
			id="{scope}-availability"
			type="checkboxSingle"
			align="between"
			label={m.discover_only_available()}
			labelHidden
			placeholder={m.discover_only_available()}
			value={availableOnly}
			onChange={(next) => go({ availability: next ? 'available' : null })}
		/>
	</div>
{/snippet}

<svelte:head>
	<title>{m.discover_meta_title()}</title>
</svelte:head>

<div id="discovery-view-container" class="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
	<!-- Header -->
	<div
		class="flex flex-col justify-between gap-4 border-b-2 border-edge pb-6 md:flex-row md:items-center"
	>
		<div>
			<div class="mb-1 flex items-center gap-2">
				<span class="text-xs font-black tracking-widest text-ink-dim uppercase">
					{m.discover_eyebrow()}
				</span>
				<span
					class="inline-flex items-center gap-1 rounded-full border border-brand-edge bg-brand-soft px-2.5 py-0.5 text-[10px] font-black text-brand-soft-fg"
				>
					<Globe class="h-3 w-3 text-brand-soft-fg" />
					{m.discover_global_badge()}
				</span>
			</div>
			<h1 class="text-2xl font-black text-ink sm:text-3xl">{m.discover_title()}</h1>
			<p class="mt-1 text-xs font-medium text-ink-soft">
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

			<div class="flex items-center gap-2">
				<!-- Filters, on every screen too narrow for the sidebar. -->
				<button
					type="button"
					onclick={() => (filtersOpen = true)}
					class="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-2xl border-2 border-edge bg-surface px-3 py-2.5 text-xs font-black text-ink shadow-[2px_2px_0px_0px_rgb(var(--bento-shadow))] sm:flex-none lg:hidden"
				>
					<SlidersHorizontal class="h-3.5 w-3.5 text-brand-fg" />
					<span>{m.discover_filters()}</span>
					{#if activeFilterCount}
						<span
							class="rounded-full border border-edge bg-inverse px-1.5 py-0.5 text-[10px] leading-none font-black text-inverse-ink"
						>
							{activeFilterCount}
						</span>
					{/if}
				</button>

				<Select.Root
					type="single"
					value={sortChoice}
					onValueChange={(value) =>
						go({
							sort: value === 'score' ? null : SORTS[value].sort,
							dir: SORTS[value].dir ?? null
						})}
				>
					<Select.Trigger
						class="flex-1 cursor-pointer rounded-2xl border-2 border-edge bg-surface px-3 py-2.5 text-xs font-black text-ink shadow-[2px_2px_0px_0px_rgb(var(--bento-shadow))] sm:w-auto sm:flex-none"
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
	</div>

	<!-- Match panel -->
	{#if data.campaigns.length}
		<div
			class="rounded-3xl border-2 border-edge bg-inverse p-5 text-inverse-ink shadow-[4px_4px_0px_0px_rgb(var(--bento-shadow-accent))]"
		>
			<div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
				<div class="space-y-1">
					<span
						class="flex items-center gap-1.5 text-xs font-black tracking-widest text-inverse-brand uppercase"
					>
						<Sparkles class="h-3.5 w-3.5" />
						{m.discover_match_eyebrow()}
					</span>
					<p class="max-w-xl text-xs font-medium text-inverse-ink-dim">
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
							is `whitespace-nowrap` at a fixed `h-10`, so on a narrow phone
							the text ran past the card and took the whole page sideways with
							it. It wraps to two lines instead — you can read which campaign
							you picked, which is the whole point of the control. Both of
							those base styles have to be overridden: `h-auto!` because the
							height is set behind a `data-[size=default]` variant that a plain
							`h-auto` loses to on specificity, and `min-h-10` to keep the tap
							target the size it was.
						-->
						<Select.Trigger
							class="h-auto! min-h-10 w-full max-w-full min-w-0 cursor-pointer rounded-xl border-2 border-edge bg-surface px-3 py-2 text-xs font-black whitespace-normal text-ink sm:w-auto sm:min-w-56"
						>
							<span class="line-clamp-2 text-left">
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
							? 'border-edge bg-brand text-brand-ink-deep'
							: 'border-inverse-ink bg-transparent text-inverse-ink hover:bg-inverse-ink/10'}"
					>
						{matchOn ? m.discover_showing_top_matches() : m.discover_show_top_matches()}
					</button>
				</div>
			</div>
		</div>
	{/if}

	<!-- Country chips. Counts come from the database, over the whole filtered set. -->
	<div
		class="bento-card bento-card-static border-2 border-edge bg-gradient-to-r from-brand-soft/50 via-surface to-panel p-4 shadow-[3px_3px_0px_0px_rgb(var(--bento-shadow))] sm:p-5"
	>
		<div class="mb-3 flex items-center justify-between">
			<span class="flex items-center gap-1.5 text-xs font-black tracking-wider text-ink uppercase">
				<Globe class="h-3.5 w-3.5 text-brand-fg" />
				{m.discover_filter_by_market()}
			</span>
			{#if selectedCountryIds.length}
				<button
					type="button"
					onclick={() => go({ country: null, region: null })}
					class="cursor-pointer text-[10px] font-bold text-tint-rose-fg hover:underline"
				>
					{m.discover_clear_count({ count: selectedCountryIds.length })}
				</button>
			{/if}
		</div>
		<!--
			Sixteen markets wrap to eight rows on a phone — about 300px of chips
			above results that are the point of the page. One swipeable row keeps
			them all reachable in a fraction of the height; from `sm` there is
			room to wrap and show the lot at once.
		-->
		<div
			class="thin-scroll -mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-2 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0"
		>
			{#each data.reference.countries as country (country.id)}
				{@const active = selectedCountryIds.includes(String(country.id))}
				<a
					href={countryLink(String(country.id))}
					data-sveltekit-noscroll
					class="flex shrink-0 cursor-pointer snap-start items-center gap-1.5 rounded-xl border-2 border-edge px-3 py-2 text-xs font-black whitespace-nowrap shadow-[2px_2px_0px_0px_rgb(var(--bento-shadow))] transition-all {active
						? 'bg-inverse text-inverse-ink'
						: 'bg-surface text-ink hover:bg-well'}"
				>
					<span>{country.flag}</span>
					<span>{country.name}</span>
					<span class="opacity-60">({data.countryCounts[String(country.id)] ?? 0})</span>
				</a>
			{/each}
		</div>

		<p class="mt-1 text-[10px] font-bold text-ink-dim sm:hidden">
			{m.discover_more_markets()}
		</p>
	</div>

	<!-- Grid + sidebar -->
	<div class="grid grid-cols-1 gap-8 lg:grid-cols-4">
		<!-- Sidebar. Below `lg` these same controls are in the drawer instead. -->
		<aside
			class="bento-card bento-card-static hidden h-fit space-y-6 p-5 lg:sticky lg:top-24 lg:col-span-1 lg:block"
		>
			<div class="flex items-center justify-between border-b-2 border-edge pb-3">
				<span
					class="flex items-center gap-1.5 text-xs font-black tracking-wider text-ink uppercase"
				>
					<SlidersHorizontal class="h-4 w-4 text-brand-fg" />
					<span>{m.discover_filters()}</span>
				</span>
				<a
					href={page.url.pathname}
					class="flex cursor-pointer items-center gap-1 rounded-md border border-edge bg-well px-2 py-0.5 text-[11px] font-black text-ink-dim hover:text-brand-soft-fg"
				>
					<RotateCcw class="h-3 w-3" />
					<span>{m.discover_reset()}</span>
				</a>
			</div>

			{@render filterControls('sidebar')}
		</aside>

		<!-- Results -->
		<div class="space-y-4 lg:col-span-3">
			<div
				class="flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-ink-soft"
			>
				<div class="flex items-center gap-2">
					<span>
						{m.discover_showing_creators()}
						<strong class="text-ink">{data.creators.total}</strong>
						{m.discover_creators_word()}
					</span>
					{#if matchOn}
						<span
							class="flex items-center gap-1 rounded-full border border-brand-edge bg-brand-soft px-2 py-0.5 text-[11px] font-black text-brand-soft-fg"
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
							class="flex cursor-pointer items-center gap-1 rounded-full border border-edge bg-tile-indigo px-2.5 py-0.5 text-[11px] font-black tracking-wider text-info-fg uppercase hover:bg-info-soft"
						>
							<span>{country?.flag}</span>
							<span>{country?.name}</span>
							<X class="h-3 w-3 text-info-fg" />
						</a>
					{/each}
					{#if categorySlug !== 'all'}
						<span
							class="rounded-full border border-edge bg-tile-mint px-3 py-1 text-[11px] font-black tracking-wider text-ink uppercase"
						>
							{data.reference.categories.find((c) => c.slug === categorySlug)?.name}
						</span>
					{/if}
				</div>
			</div>

			{#if data.creators.rows.length === 0}
				<div class="bento-card bento-card-static space-y-3 p-12 text-center">
					<Search class="mx-auto h-10 w-10 text-ink-faint" />
					<h3 class="text-base font-black text-ink">{m.discover_empty_title()}</h3>
					<p class="mx-auto max-w-sm text-xs font-medium text-ink-soft">
						{m.discover_empty_body()}
					</p>
					<a
						href={page.url.pathname}
						class="inline-block cursor-pointer rounded-xl border-2 border-edge bg-brand px-4 py-2 text-xs font-black text-brand-ink shadow-[2px_2px_0px_0px_rgb(var(--bento-shadow))] hover:bg-brand-strong"
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

	<!--
		The filter drawer, for every screen narrower than the sidebar's. It opens
		over the results rather than pushing them down the page, and the footer
		says how many creators are left before you dismiss it, so narrowing to
		nothing is visible while the controls are still in reach.
	-->
	<Sheet.Root bind:open={filtersOpen}>
		<Sheet.Content
			side="bottom"
			class="max-h-[85dvh] rounded-t-3xl border-t-2 border-edge bg-surface p-0 lg:hidden"
		>
			<Sheet.Header class="border-b-2 border-edge px-5 py-4">
				<Sheet.Title
					class="flex items-center gap-2 text-sm font-black tracking-wider text-ink uppercase"
				>
					<SlidersHorizontal class="h-4 w-4 text-brand-fg" />
					{m.discover_filters()}
					{#if activeFilterCount}
						<span
							class="rounded-full border border-edge bg-inverse px-2 py-0.5 text-[10px] font-black text-inverse-ink normal-case"
						>
							{m.discover_filters_active({ count: activeFilterCount })}
						</span>
					{/if}
				</Sheet.Title>
			</Sheet.Header>

			<div class="thin-scroll flex-1 space-y-6 overflow-y-auto px-5 py-5">
				{@render filterControls('drawer')}
			</div>

			<div class="flex items-center gap-3 border-t-2 border-edge bg-panel px-5 py-4">
				<a
					href={page.url.pathname}
					class="flex shrink-0 cursor-pointer items-center gap-1 rounded-xl border-2 border-edge bg-surface px-3 py-3 text-xs font-black text-ink-dim"
				>
					<RotateCcw class="h-3.5 w-3.5" />
					<span>{m.discover_reset()}</span>
				</a>
				<button
					type="button"
					onclick={() => (filtersOpen = false)}
					class="flex-1 cursor-pointer rounded-xl border-2 border-edge bg-brand px-4 py-3 text-xs font-black text-brand-ink shadow-[2px_2px_0px_0px_rgb(var(--bento-shadow))]"
				>
					{m.discover_apply_filters({ count: data.creators.total })}
				</button>
			</div>
		</Sheet.Content>
	</Sheet.Root>

	<CreatorQuickView creator={quickView} onClose={() => (quickView = null)} />
</div>
