<script lang="ts">
	import CrudSection from '$lib/components/crud-section.svelte';
	import type { CrudField } from '$lib/components/Table/crud-dialog.svelte';

	let { data } = $props();

	const fields: CrudField[] = [
		{ name: 'name', label: 'Country name', required: true },
		{ name: 'code', label: 'ISO code', required: true, placeholder: 'ET' },
		{ name: 'flag', label: 'Flag emoji', placeholder: '🇪🇹' },
		{ name: 'currencyCode', label: 'Currency code', required: true, placeholder: 'ETB' },
		{ name: 'currencySymbol', label: 'Currency symbol', placeholder: 'ETB' },
		{
			name: 'usdRate',
			label: 'Units per 1 USD',
			type: 'number',
			required: true,
			placeholder: '132.5'
		},
		{
			name: 'paymentRails',
			label: 'Payment rails (one per line)',
			type: 'textarea',
			rows: 4,
			placeholder: 'Telebirr\nChapa\nCBE Birr'
		},
		{ name: 'description', label: 'Description', type: 'textarea', rows: 3 },
		{ name: 'sortOrder', label: 'Sort order', type: 'number' },
		{ name: 'isActive', label: 'Visible', type: 'checkboxSingle', placeholder: 'Show in filters' }
	];
</script>

<svelte:head><title>Countries — Creator Network</title></svelte:head>

<CrudSection
	eyebrow="Reference data"
	title="Countries & currencies"
	description="The single source of truth for markets and exchange rates. Every price shown anywhere in the product converts through the rate stored here."
	label="Country"
	rows={data.rows}
	{fields}
	addForm={data.addForm}
	editForm={data.editForm}
	deleteForm={data.deleteForm}
>
	{#snippet row(country)}
		<div class="space-y-2">
			<div class="flex items-start justify-between gap-2">
				<div class="flex items-center gap-2">
					<span class="text-2xl">{country.flag}</span>
					<div>
						<h3 class="text-sm font-black text-slate-900">{country.name}</h3>
						<p class="text-[11px] font-bold text-slate-500">{country.code}</p>
					</div>
				</div>
				{#if !country.isActive}
					<span
						class="rounded-md border border-slate-400 bg-slate-100 px-2 py-0.5 text-[10px] font-black tracking-wider text-slate-600 uppercase"
					>
						Hidden
					</span>
				{/if}
			</div>

			<div class="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-xs">
				<span class="font-bold text-slate-600">{country.currencyCode}</span>
				<span class="font-black text-slate-900">
					{country.usdRate.toLocaleString()} per USD
				</span>
			</div>

			{#if country.paymentRails?.length}
				<div class="flex flex-wrap gap-1">
					{#each country.paymentRails as rail (rail)}
						<span
							class="rounded-md border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-900"
						>
							{rail}
						</span>
					{/each}
				</div>
			{/if}
		</div>
	{/snippet}
</CrudSection>
