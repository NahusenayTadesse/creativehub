<script lang="ts">
	import { Search, Plus, Briefcase, Ticket, Gift, Globe } from '@lucide/svelte';
	import CampaignCard from '$lib/components/campaign-card.svelte';

	let { data } = $props();

	let selectedType = $state<'all' | 'paid' | 'event_pass' | 'barter'>('all');
	let selectedCountryId = $state<'all' | number>('all');
	let query = $state('');

	const filtered = $derived.by(() => {
		const q = query.trim().toLowerCase();
		return data.campaigns.filter((campaign) => {
			if (selectedType !== 'all' && campaign.compensationType !== selectedType) return false;

			if (selectedCountryId !== 'all') {
				const country = data.reference.countries.find((c) => c.id === selectedCountryId);
				const targeted = country && campaign.targetRegions?.includes(country.name);
				// A campaign with no country set is open to every market.
				if (campaign.countryId !== null && campaign.countryId !== selectedCountryId && !targeted) {
					return false;
				}
			}

			if (q) {
				const haystack = [
					campaign.title,
					campaign.organizationName,
					campaign.categoryName ?? '',
					campaign.countryName ?? '',
					campaign.description ?? ''
				]
					.join(' ')
					.toLowerCase();
				if (!haystack.includes(q)) return false;
			}

			return true;
		});
	});

	const countFor = (type: string) =>
		data.campaigns.filter((c) => c.compensationType === type).length;

	const canApply = $derived(Boolean(data.creatorId));
</script>

<svelte:head><title>Campaign briefs — Creator Network</title></svelte:head>

<div id="campaigns-view-container" class="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
	<!-- Header -->
	<div
		class="flex flex-col justify-between gap-4 border-b-2 border-slate-900 pb-6 sm:flex-row sm:items-center"
	>
		<div>
			<div class="mb-1 flex items-center gap-2">
				<span class="text-xs font-black tracking-widest text-slate-500 uppercase">
					Live opportunities
				</span>
				<span
					class="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-100 px-2.5 py-0.5 text-[10px] font-black text-emerald-900"
				>
					<Globe class="h-3 w-3 text-emerald-700" />
					Pan-African & global
				</span>
			</div>
			<h1 class="text-2xl font-black text-slate-900 sm:text-3xl">Brand briefs & campaigns</h1>
			<p class="mt-1 text-xs font-medium text-slate-600">
				Paid briefs, event access passes and barter partnerships — all with the deliverables and
				deadline stated up front.
			</p>
		</div>

		{#if data.user?.role === 'business' || data.user?.role === 'admin'}
			<a
				href="/dashboard/campaigns"
				class="flex shrink-0 items-center gap-2 rounded-2xl border-2 border-slate-900 bg-slate-900 px-4 py-2.5 text-xs font-black text-white shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] transition-all hover:bg-slate-800"
			>
				<Plus class="h-4 w-4 text-emerald-400" />
				<span>Post a new campaign</span>
			</a>
		{/if}
	</div>

	<!-- Type selector -->
	<div class="grid grid-cols-1 gap-4 sm:grid-cols-4">
		<button
			type="button"
			onclick={() => (selectedType = 'all')}
			class="cursor-pointer rounded-2xl border-2 border-slate-900 p-4 text-left transition-all {selectedType ===
			'all'
				? 'bg-slate-900 text-white shadow-[4px_4px_0px_0px_rgba(16,185,129,1)]'
				: 'bg-white text-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] hover:bg-slate-50'}"
		>
			<span class="block text-[10px] font-black tracking-widest uppercase opacity-70">
				All opportunities
			</span>
			<span class="mt-1 block text-lg font-black">{data.campaigns.length} briefs live</span>
		</button>

		<button
			type="button"
			onclick={() => (selectedType = 'paid')}
			class="cursor-pointer rounded-2xl border-2 border-slate-900 p-4 text-left transition-all {selectedType ===
			'paid'
				? 'bg-[#dcfce7] font-black text-slate-900 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)]'
				: 'bg-white text-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] hover:bg-slate-50'}"
		>
			<div class="flex items-center gap-1.5 text-xs font-black tracking-wider text-emerald-800 uppercase">
				<Briefcase class="h-3.5 w-3.5" />
				<span>Paid</span>
			</div>
			<span class="mt-1 block text-sm font-black">{countFor('paid')} cash-budget briefs</span>
		</button>

		<button
			type="button"
			onclick={() => (selectedType = 'event_pass')}
			class="cursor-pointer rounded-2xl border-2 border-slate-900 p-4 text-left transition-all {selectedType ===
			'event_pass'
				? 'bg-[#e0e7ff] font-black text-slate-900 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)]'
				: 'bg-white text-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] hover:bg-slate-50'}"
		>
			<div class="flex items-center gap-1.5 text-xs font-black tracking-wider text-indigo-900 uppercase">
				<Ticket class="h-3.5 w-3.5" />
				<span>Event passes</span>
			</div>
			<span class="mt-1 block text-sm font-black">{countFor('event_pass')} summits & festivals</span>
		</button>

		<button
			type="button"
			onclick={() => (selectedType = 'barter')}
			class="cursor-pointer rounded-2xl border-2 border-slate-900 p-4 text-left transition-all {selectedType ===
			'barter'
				? 'bg-[#fef9c3] font-black text-slate-900 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)]'
				: 'bg-white text-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] hover:bg-slate-50'}"
		>
			<div class="flex items-center gap-1.5 text-xs font-black tracking-wider text-amber-900 uppercase">
				<Gift class="h-3.5 w-3.5" />
				<span>Barter</span>
			</div>
			<span class="mt-1 block text-sm font-black">{countFor('barter')} stays & products</span>
		</button>
	</div>

	<!-- Market filter + search -->
	<div class="flex flex-col justify-between gap-4 md:flex-row md:items-center">
		<div class="scrollbar-none flex flex-1 items-center gap-2 overflow-x-auto pb-1">
			<span class="mr-1 flex items-center gap-1 text-xs font-black whitespace-nowrap text-slate-700">
				<Globe class="h-3.5 w-3.5 text-emerald-600" />
				Market:
			</span>
			<button
				type="button"
				onclick={() => (selectedCountryId = 'all')}
				class="cursor-pointer rounded-xl border-2 border-slate-900 px-3 py-1.5 text-xs font-black whitespace-nowrap shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] transition-all {selectedCountryId ===
				'all'
					? 'bg-emerald-600 text-white'
					: 'bg-white text-slate-800 hover:bg-slate-100'}"
			>
				🌍 All markets ({data.campaigns.length})
			</button>
			{#each data.reference.countries.slice(0, 6) as country (country.id)}
				<button
					type="button"
					onclick={() => (selectedCountryId = country.id)}
					class="flex cursor-pointer items-center gap-1.5 rounded-xl border-2 border-slate-900 px-3 py-1.5 text-xs font-black whitespace-nowrap shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] transition-all {selectedCountryId ===
					country.id
						? 'bg-slate-900 text-white'
						: 'bg-white text-slate-800 hover:bg-slate-100'}"
				>
					<span>{country.flag}</span>
					<span>{country.name}</span>
				</button>
			{/each}
		</div>

		<div class="relative shrink-0 md:w-72">
			<Search class="absolute top-3 left-3 h-4 w-4 text-slate-500" />
			<input
				type="text"
				bind:value={query}
				placeholder="Search briefs, brands, markets…"
				class="w-full rounded-2xl border-2 border-slate-900 bg-white py-2.5 pr-3 pl-9 text-xs font-bold shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] outline-none focus:ring-2 focus:ring-emerald-500"
			/>
		</div>
	</div>

	<!-- Results -->
	{#if filtered.length}
		<div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
			{#each filtered as campaign (campaign.id)}
				<CampaignCard
					{campaign}
					hasApplied={data.appliedCampaignIds.includes(campaign.id)}
					canApply={canApply}
				/>
			{/each}
		</div>
	{:else}
		<div class="bento-card bento-card-static space-y-3 p-12 text-center">
			<Search class="mx-auto h-10 w-10 text-slate-400" />
			<h3 class="text-base font-black text-slate-900">No briefs match this filter</h3>
			<p class="mx-auto max-w-sm text-xs font-medium text-slate-600">
				Try switching back to all markets or clearing your search.
			</p>
			<button
				type="button"
				onclick={() => {
					selectedCountryId = 'all';
					selectedType = 'all';
					query = '';
				}}
				class="cursor-pointer rounded-xl border-2 border-slate-900 bg-emerald-600 px-4 py-2 text-xs font-black text-white shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] hover:bg-emerald-700"
			>
				Reset filters
			</button>
		</div>
	{/if}
</div>
