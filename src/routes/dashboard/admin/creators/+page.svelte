<script lang="ts">
	import CrudSection from '$lib/components/crud-section.svelte';
	import VerificationBadge from '$lib/components/verification-badge.svelte';
	import type { CrudField } from '$lib/components/Table/crud-dialog.svelte';
	import { Award, Star, ExternalLink } from '@lucide/svelte';
	import { formatReach } from '$lib/domain/money';

	let { data } = $props();

	const fields: CrudField[] = [
		{ name: 'fullName', label: 'Full name', required: true },
		{ name: 'username', label: 'Handle', required: true },
		{ name: 'bio', label: 'Bio', type: 'textarea', rows: 4 },
		{ name: 'avatar', label: 'Avatar URL' },
		{ name: 'cover', label: 'Cover URL' },
		{
			name: 'countryId',
			label: 'Country',
			type: 'select',
			items: data.reference.countries.map((c) => ({ value: c.id, name: `${c.flag} ${c.name}` }))
		},
		{
			name: 'regionId',
			label: 'Region',
			type: 'select',
			items: data.reference.regions.map((r) => ({ value: r.id, name: r.name }))
		},
		{ name: 'city', label: 'City' },
		{
			name: 'primaryPlatformId',
			label: 'Primary platform',
			type: 'select',
			items: data.reference.platforms.map((p) => ({ value: p.id, name: p.name }))
		},
		{ name: 'totalReach', label: 'Total reach', type: 'number' },
		{ name: 'startingPrice', label: 'Starting price', type: 'number' },
		{
			name: 'currencyCode',
			label: 'Currency',
			type: 'select',
			items: ['ETB', 'KES', 'NGN', 'ZAR', 'GHS', 'RWF', 'EGP', 'AED', 'GBP', 'USD'].map((c) => ({
				value: c,
				name: c
			}))
		},
		{
			name: 'verificationLevel',
			label: 'Verification badge',
			type: 'select',
			items: [
				{ value: 'unverified', name: 'Unverified' },
				{ value: 'social_verified', name: 'Social verified' },
				{ value: 'identity_verified', name: 'Identity verified' },
				{ value: 'cn_verified', name: 'CN Verified' }
			]
		},
		{
			name: 'availability',
			label: 'Availability',
			type: 'select',
			items: [
				{ value: 'available', name: 'Available' },
				{ value: 'busy', name: 'Busy' },
				{ value: 'away', name: 'Away' }
			]
		},
		{ name: 'overseasPercentage', label: 'Overseas audience %', type: 'number' },
		{ name: 'topCountries', label: 'Top audience countries (one per line)', type: 'textarea', rows: 3 },
		{ name: 'isFeatured', label: 'Featured', type: 'checkboxSingle', placeholder: 'Show on the homepage' },
		{ name: 'isTrending', label: 'Trending', type: 'checkboxSingle', placeholder: 'Show in the trending strip' },
		{ name: 'isPublished', label: 'Published', type: 'checkboxSingle', placeholder: 'Visible in discovery' },
		{ name: 'sortOrder', label: 'Sort order', type: 'number' },
		{ name: 'isActive', label: 'Active', type: 'checkboxSingle', placeholder: 'Account is active' }
	];

	const published = $derived(data.rows.filter((r) => r.isPublished).length);
</script>

<svelte:head><title>Creators — Creator Network</title></svelte:head>

<CrudSection
	eyebrow="Marketplace"
	title="Creator supply"
	description="Every creator record, published or not. Imported profiles stay hidden from discovery until an operator publishes them."
	label="Creator"
	rows={data.rows}
	{fields}
	addForm={data.addForm}
	editForm={data.editForm}
	deleteForm={data.deleteForm}
	nameKey="fullName"
	emptyMessage="No creators yet"
>
	{#snippet extraActions()}
		<span
			class="rounded-2xl border-2 border-slate-900 bg-[#dcfce7] px-4 py-2.5 text-xs font-black text-slate-900 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)]"
		>
			{published} of {data.rows.length} published
		</span>
	{/snippet}

	{#snippet row(creator)}
		<div class="space-y-3">
			<div class="flex items-start justify-between gap-2">
				<div class="flex min-w-0 items-center gap-3">
					<img
						src={creator.avatar ?? ''}
						alt=""
						class="h-10 w-10 shrink-0 rounded-2xl border-2 border-slate-900 object-cover"
					/>
					<div class="min-w-0">
						<h3 class="truncate text-sm font-black text-slate-900">{creator.fullName}</h3>
						<p class="truncate text-[11px] font-bold text-slate-500">@{creator.username}</p>
					</div>
				</div>
				<div class="flex shrink-0 flex-col items-end gap-1">
					{#if creator.isPublished}
						<a
							href="/creators/{creator.username}"
							target="_blank"
							class="inline-flex items-center gap-1 text-[10px] font-black text-emerald-700 hover:underline"
						>
							<ExternalLink class="h-3 w-3" />
							Live
						</a>
					{:else}
						<span
							class="rounded-md border border-amber-500 bg-amber-100 px-2 py-0.5 text-[10px] font-black tracking-wider text-amber-900 uppercase"
						>
							Unpublished
						</span>
					{/if}
				</div>
			</div>

			<div class="flex flex-wrap items-center gap-1.5">
				<VerificationBadge level={creator.verificationLevel} />
				{#if creator.isFeatured}
					<span
						class="rounded-md border border-slate-900 bg-[#e0e7ff] px-2 py-0.5 text-[10px] font-black tracking-wider text-indigo-950 uppercase"
					>
						Featured
					</span>
				{/if}
				{#if creator.isTrending}
					<span
						class="rounded-md border border-slate-900 bg-[#fef9c3] px-2 py-0.5 text-[10px] font-black tracking-wider text-amber-950 uppercase"
					>
						Trending
					</span>
				{/if}
			</div>

			<div class="grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-2 text-center text-xs">
				<div>
					<div class="text-[9px] font-black tracking-wider text-slate-500 uppercase">Reach</div>
					<div class="font-black text-slate-900">{formatReach(creator.totalReach)}</div>
				</div>
				<div>
					<div class="text-[9px] font-black tracking-wider text-slate-500 uppercase">Score</div>
					<div class="flex items-center justify-center gap-0.5 font-black text-slate-900">
						<Award class="h-3 w-3 text-emerald-600" />
						{creator.score}
					</div>
				</div>
				<div>
					<div class="text-[9px] font-black tracking-wider text-slate-500 uppercase">Rating</div>
					<div class="flex items-center justify-center gap-0.5 font-black text-slate-900">
						<Star class="h-3 w-3 fill-amber-400 text-slate-900" />
						{creator.averageRating.toFixed(1)}
					</div>
				</div>
			</div>
		</div>
	{/snippet}
</CrudSection>
