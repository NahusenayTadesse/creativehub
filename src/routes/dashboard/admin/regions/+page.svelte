<script lang="ts">
	import CrudSection from '$lib/components/crud-section.svelte';
	import type { CrudField } from '$lib/components/Table/crud-dialog.svelte';

	let { data } = $props();

	const fields: CrudField[] = [
		{
			name: 'countryId',
			label: 'Country',
			type: 'select',
			required: true,
			items: data.countries.map((c) => ({ value: c.id, name: `${c.flag} ${c.name}` }))
		},
		{ name: 'name', label: 'Region name', required: true },
		{
			name: 'majorCities',
			label: 'Major cities (one per line)',
			type: 'textarea',
			rows: 4,
			placeholder: 'Bole\nKazanchis\nPiassa'
		},
		{ name: 'sortOrder', label: 'Sort order', type: 'number' },
		{ name: 'isActive', label: 'Visible', type: 'checkboxSingle', placeholder: 'Show in filters' }
	];

	const countryFor = (id: number) => data.countries.find((c) => c.id === id);
</script>

<svelte:head><title>Regions — Creator Network</title></svelte:head>

<CrudSection
	eyebrow="Reference data"
	title="Regions & cities"
	description="Sub-national regions used by the discovery filters, each belonging to one country."
	label="Region"
	rows={data.rows}
	{fields}
	addForm={data.addForm}
	editForm={data.editForm}
	deleteForm={data.deleteForm}
>
	{#snippet row(region)}
		{@const country = countryFor(region.countryId)}
		<div class="space-y-2">
			<div class="flex items-start justify-between gap-2">
				<div>
					<h3 class="text-sm font-black text-slate-900">{region.name}</h3>
					<p class="text-[11px] font-bold text-slate-500">
						{country?.flag}
						{country?.name ?? 'Unknown country'}
					</p>
				</div>
				{#if !region.isActive}
					<span
						class="rounded-md border border-slate-400 bg-slate-100 px-2 py-0.5 text-[10px] font-black tracking-wider text-slate-600 uppercase"
					>
						Hidden
					</span>
				{/if}
			</div>

			{#if region.majorCities?.length}
				<div class="flex flex-wrap gap-1">
					{#each region.majorCities as city (city)}
						<span
							class="rounded-md border border-slate-300 bg-slate-50 px-2 py-0.5 text-[10px] font-bold text-slate-700"
						>
							{city}
						</span>
					{/each}
				</div>
			{/if}
		</div>
	{/snippet}
</CrudSection>
