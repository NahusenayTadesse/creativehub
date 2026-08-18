<script lang="ts">
	import CrudSection from '$lib/components/crud-section.svelte';
	import type { CrudField } from '$lib/components/Table/crud-dialog.svelte';
	import * as m from '$lib/paraglide/messages';

	let { data } = $props();

	const fields: CrudField[] = $derived([
		{ name: 'name', label: m.co_name(), required: true },
		{ name: 'code', label: m.co_iso(), required: true, placeholder: 'ET' },
		{ name: 'flag', label: m.co_flag(), placeholder: '🇪🇹' },
		{ name: 'currencyCode', label: m.co_currency_code(), required: true, placeholder: 'ETB' },
		{ name: 'currencySymbol', label: m.co_currency_symbol(), placeholder: 'ETB' },
		{
			name: 'usdRate',
			label: m.co_usd_rate(),
			type: 'number',
			required: true,
			placeholder: '132.5'
		},
		{
			name: 'paymentRails',
			label: m.co_payment_rails(),
			type: 'textarea',
			rows: 4,
			placeholder: m.co_payment_rails_placeholder()
		},
		{ name: 'description', label: m.common_description(), type: 'textarea', rows: 3 },
		{ name: 'sortOrder', label: m.common_sort_order(), type: 'number' },
		{
			name: 'isActive',
			label: m.common_visible(),
			type: 'checkboxSingle',
			placeholder: m.common_show_in_filters()
		}
	]);
</script>

<svelte:head><title>{m.co_meta_title()}</title></svelte:head>

<CrudSection
	eyebrow={m.sb_reference_data()}
	title={m.co_title()}
	description={m.co_description()}
	label={m.co_label()}
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
						{m.common_hidden()}
					</span>
				{/if}
			</div>

			<div class="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-xs">
				<span class="font-bold text-slate-600">{country.currencyCode}</span>
				<span class="font-black text-slate-900">
					{m.co_per_usd({ rate: country.usdRate.toLocaleString() })}
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
