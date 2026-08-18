<script lang="ts">
	import CrudSection from '$lib/components/crud-section.svelte';
	import type { CrudField } from '$lib/components/Table/crud-dialog.svelte';
	import * as m from '$lib/paraglide/messages';

	let { data } = $props();

	const fields: CrudField[] = $derived([
		{
			name: 'countryId',
			label: m.pf_country(),
			type: 'select',
			required: true,
			items: data.countries.map((c) => ({ value: c.id, name: `${c.flag} ${c.name}` }))
		},
		{ name: 'name', label: m.re_name(), required: true },
		{
			name: 'majorCities',
			label: m.re_major_cities(),
			type: 'textarea',
			rows: 4,
			placeholder: m.re_major_cities_placeholder()
		},
		{ name: 'sortOrder', label: m.common_sort_order(), type: 'number' },
		{
			name: 'isActive',
			label: m.common_visible(),
			type: 'checkboxSingle',
			placeholder: m.common_show_in_filters()
		}
	]);

	const countryFor = (id: number) => data.countries.find((c) => c.id === id);
</script>

<svelte:head><title>{m.re_meta_title()}</title></svelte:head>

<CrudSection
	eyebrow={m.sb_reference_data()}
	title={m.re_title()}
	description={m.re_description()}
	label={m.re_label()}
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
						{country?.name ?? m.re_unknown_country()}
					</p>
				</div>
				{#if !region.isActive}
					<span
						class="rounded-md border border-slate-400 bg-slate-100 px-2 py-0.5 text-[10px] font-black tracking-wider text-slate-600 uppercase"
					>
						{m.common_hidden()}
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
