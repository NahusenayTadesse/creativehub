<script lang="ts">
	import { resolve } from '$app/paths';
	import * as m from '$lib/paraglide/messages';
	import { page } from '$app/state';
	import { Search, Plus, Briefcase, Ticket, Gift, Globe } from '@lucide/svelte';
	import CampaignCard from '$lib/components/campaign-card.svelte';
	import PaginationBar from '$lib/components/pagination-bar.svelte';
	import SearchInput from '$lib/components/search-input.svelte';
	import { withParams } from '$lib/query';

	let { data } = $props();

	/* Filtered in the database. Every control is a link that rewrites the URL,
	   and the counts come from the same query the rows do. */
	const listState = $derived(data.campaigns.state);
	const selectedType = $derived(listState.values.type ?? 'all');
	const selectedMarket = $derived(listState.values.market ?? 'all');

	const typeLink = (type: string) => withParams(page.url, { type: type === 'all' ? null : type });
	const marketLink = (id: number | 'all') =>
		withParams(page.url, { market: id === 'all' ? null : id });

	const countFor = (type: string) => data.typeCounts[type] ?? 0;

	/* The type facet excludes only the type filter, so this is "briefs in the
	   market currently chosen" — which is what the tile above the type chips
	   means. The market chips need a different number; see below. */
	const totalBriefs = $derived(Object.values(data.typeCounts).reduce((sum, n) => sum + n, 0));

	const canApply = $derived(Boolean(data.creatorId));
</script>

<svelte:head><title>{m.campaigns_meta_title()}</title></svelte:head>

<div id="campaigns-view-container" class="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
	<!-- Header -->
	<div
		class="flex flex-col justify-between gap-4 border-b-2 border-edge pb-6 sm:flex-row sm:items-center"
	>
		<div>
			<div class="mb-1 flex items-center gap-2">
				<span class="text-xs font-black tracking-widest text-ink-dim uppercase">
					{m.campaigns_eyebrow()}
				</span>
				<span
					class="inline-flex items-center gap-1 rounded-full border border-brand-edge bg-brand-soft px-2.5 py-0.5 text-[10px] font-black text-brand-soft-fg"
				>
					<Globe class="h-3 w-3 text-brand-soft-fg" />
					{m.discover_global_badge()}
				</span>
			</div>
			<h1 class="text-2xl font-black text-ink sm:text-3xl">{m.campaigns_title()}</h1>
			<p class="mt-1 text-xs font-medium text-ink-soft">
				{m.campaigns_subtitle()}
			</p>
		</div>

		{#if data.user?.role === 'business' || data.user?.role === 'admin'}
			<a
				href={resolve('/dashboard/campaigns')}
				class="flex shrink-0 items-center gap-2 rounded-2xl border-2 border-edge bg-inverse px-4 py-2.5 text-xs font-black text-inverse-ink shadow-[3px_3px_0px_0px_rgb(var(--bento-shadow))] transition-all hover:bg-inverse-hover"
			>
				<Plus class="h-4 w-4 text-inverse-brand" />
				<span>{m.campaigns_post_new()}</span>
			</a>
		{/if}
	</div>

	<!-- Type selector -->
	<div class="grid grid-cols-1 gap-4 sm:grid-cols-4">
		<a
			href={typeLink('all')}
			data-sveltekit-noscroll
			class="block cursor-pointer rounded-2xl border-2 border-edge p-4 text-left transition-all {selectedType ===
			'all'
				? 'bg-inverse text-inverse-ink shadow-[4px_4px_0px_0px_rgb(var(--bento-shadow-accent))]'
				: 'bg-surface text-ink shadow-[2px_2px_0px_0px_rgb(var(--bento-shadow))] hover:bg-panel'}"
		>
			<span class="block text-[10px] font-black tracking-widest uppercase opacity-70">
				{m.campaigns_all_opportunities()}
			</span>
			<span class="mt-1 block text-lg font-black"
				>{m.campaigns_briefs_live({ count: totalBriefs })}</span
			>
		</a>

		<a
			href={typeLink('paid')}
			data-sveltekit-noscroll
			class="block cursor-pointer rounded-2xl border-2 border-edge p-4 text-left transition-all {selectedType ===
			'paid'
				? 'bg-tile-mint font-black text-ink shadow-[4px_4px_0px_0px_rgb(var(--bento-shadow))]'
				: 'bg-surface text-ink shadow-[2px_2px_0px_0px_rgb(var(--bento-shadow))] hover:bg-panel'}"
		>
			<div
				class="flex items-center gap-1.5 text-xs font-black tracking-wider text-brand-soft-fg uppercase"
			>
				<Briefcase class="h-3.5 w-3.5" />
				<span>{m.campaigns_type_paid()}</span>
			</div>
			<span class="mt-1 block text-sm font-black"
				>{m.campaigns_paid_count({ count: countFor('paid') })}</span
			>
		</a>

		<a
			href={typeLink('event_pass')}
			data-sveltekit-noscroll
			class="block cursor-pointer rounded-2xl border-2 border-edge p-4 text-left transition-all {selectedType ===
			'event_pass'
				? 'bg-tile-indigo font-black text-ink shadow-[4px_4px_0px_0px_rgb(var(--bento-shadow))]'
				: 'bg-surface text-ink shadow-[2px_2px_0px_0px_rgb(var(--bento-shadow))] hover:bg-panel'}"
		>
			<div
				class="flex items-center gap-1.5 text-xs font-black tracking-wider text-info-fg uppercase"
			>
				<Ticket class="h-3.5 w-3.5" />
				<span>{m.campaigns_type_event()}</span>
			</div>
			<span class="mt-1 block text-sm font-black">
				{m.campaigns_event_count({ count: countFor('event_pass') })}
			</span>
		</a>

		<a
			href={typeLink('barter')}
			data-sveltekit-noscroll
			class="block cursor-pointer rounded-2xl border-2 border-edge p-4 text-left transition-all {selectedType ===
			'barter'
				? 'bg-tile-yellow font-black text-ink shadow-[4px_4px_0px_0px_rgb(var(--bento-shadow))]'
				: 'bg-surface text-ink shadow-[2px_2px_0px_0px_rgb(var(--bento-shadow))] hover:bg-panel'}"
		>
			<div
				class="flex items-center gap-1.5 text-xs font-black tracking-wider text-warn-fg uppercase"
			>
				<Gift class="h-3.5 w-3.5" />
				<span>{m.campaigns_type_barter()}</span>
			</div>
			<span class="mt-1 block text-sm font-black"
				>{m.campaigns_barter_count({ count: countFor('barter') })}</span
			>
		</a>
	</div>

	<!-- Market filter + search -->
	<div class="flex flex-col justify-between gap-4 md:flex-row md:items-center">
		<div class="flex flex-1 scrollbar-none items-center gap-2 overflow-x-auto pb-1">
			<span class="mr-1 flex items-center gap-1 text-xs font-black whitespace-nowrap text-ink-soft">
				<Globe class="h-3.5 w-3.5 text-brand-fg" />
				{m.campaigns_market_label()}
			</span>
			<a
				href={marketLink('all')}
				data-sveltekit-noscroll
				class="cursor-pointer rounded-xl border-2 border-edge px-3 py-1.5 text-xs font-black whitespace-nowrap shadow-[2px_2px_0px_0px_rgb(var(--bento-shadow))] transition-all {selectedMarket ===
				'all'
					? 'bg-brand text-brand-ink'
					: 'bg-surface text-ink hover:bg-well'}"
			>
				{m.campaigns_all_markets({ count: data.allMarketsTotal })}
			</a>
			{#each data.reference.countries.slice(0, 6) as country (country.id)}
				<a
					href={marketLink(country.id)}
					data-sveltekit-noscroll
					class="flex cursor-pointer items-center gap-1.5 rounded-xl border-2 border-edge px-3 py-1.5 text-xs font-black whitespace-nowrap shadow-[2px_2px_0px_0px_rgb(var(--bento-shadow))] transition-all {selectedMarket ===
					String(country.id)
						? 'bg-inverse text-inverse-ink'
						: 'bg-surface text-ink hover:bg-well'}"
				>
					<span>{country.flag}</span>
					<span>{country.name}</span>
				</a>
			{/each}
		</div>

		<SearchInput
			value={listState.search}
			placeholder={m.campaigns_search_placeholder()}
			class="shrink-0 md:w-72"
		/>
	</div>

	<!-- Results -->
	{#if data.campaigns.rows.length}
		<div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
			{#each data.campaigns.rows as campaign (campaign.id)}
				<CampaignCard
					{campaign}
					hasApplied={data.appliedCampaignIds.includes(campaign.id)}
					{canApply}
				/>
			{/each}
		</div>

		<PaginationBar result={data.campaigns} />
	{:else}
		<div class="bento-card bento-card-static space-y-3 p-12 text-center">
			<Search class="mx-auto h-10 w-10 text-ink-faint" />
			<h3 class="text-base font-black text-ink">{m.campaigns_empty_title()}</h3>
			<p class="mx-auto max-w-sm text-xs font-medium text-ink-soft">
				{m.campaigns_empty_body()}
			</p>
			<a
				href={page.url.pathname}
				class="inline-block cursor-pointer rounded-xl border-2 border-edge bg-brand px-4 py-2 text-xs font-black text-brand-ink shadow-[2px_2px_0px_0px_rgb(var(--bento-shadow))] hover:bg-brand-strong"
			>
				{m.campaigns_reset_filters()}
			</a>
		</div>
	{/if}
</div>
