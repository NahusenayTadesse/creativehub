<script lang="ts">
	import CrudSection from '$lib/components/crud-section.svelte';
	import type { CrudField } from '$lib/components/Table/crud-dialog.svelte';
	import { Check } from '@lucide/svelte';
	import * as m from '$lib/paraglide/messages';

	let { data } = $props();

	const fields: CrudField[] = $derived([
		{ name: 'title', label: m.pk_name(), required: true, placeholder: m.pk_name_placeholder() },
		{
			name: 'platformId',
			label: m.pk_platform(),
			type: 'select',
			items: data.platforms.map((p) => ({ value: p.id, name: p.name }))
		},
		{ name: 'description', label: m.pk_what_brand_gets(), type: 'textarea', rows: 3 },
		{
			name: 'deliverables',
			label: m.pk_deliverables(),
			type: 'textarea',
			rows: 5,
			placeholder: m.pk_deliverables_placeholder()
		},
		{ name: 'price', label: m.pk_price(), type: 'number', required: true },
		{
			name: 'currencyCode',
			label: m.campaign_currency(),
			type: 'select',
			items: ['ETB', 'KES', 'NGN', 'ZAR', 'GHS', 'RWF', 'EGP', 'AED', 'GBP', 'USD'].map((c) => ({
				value: c,
				name: c
			}))
		},
		{ name: 'deliveryDays', label: m.pk_delivery_days(), type: 'number' },
		{ name: 'revisions', label: m.pk_revisions(), type: 'number' },
		{ name: 'sortOrder', label: m.common_sort_order(), type: 'number' },
		{
			name: 'isActive',
			label: m.common_live(),
			type: 'checkboxSingle',
			placeholder: m.common_show_on_profile()
		}
	]);

	const platformName = (id: number | null) => data.platforms.find((p) => p.id === id)?.name ?? null;
</script>

<svelte:head><title>{m.pk_meta_title()}</title></svelte:head>

<CrudSection
	eyebrow={m.dashc_eyebrow()}
	title={m.pk_title()}
	description={m.pk_description()}
	label={m.pk_label()}
	rows={data.rows}
	{fields}
	addForm={data.addForm}
	editForm={data.editForm}
	deleteForm={data.deleteForm}
	nameKey="title"
	emptyMessage={m.pk_empty()}
>
	{#snippet row(pkg)}
		<div class="space-y-3">
			<div class="flex items-start justify-between gap-2">
				<h3 class="text-sm font-black text-slate-900">{pkg.title}</h3>
				<div class="flex shrink-0 items-center gap-1.5">
					{#if platformName(pkg.platformId)}
						<span
							class="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-black text-emerald-800"
						>
							{platformName(pkg.platformId)}
						</span>
					{/if}
					{#if !pkg.isActive}
						<span
							class="rounded-md border border-slate-400 bg-slate-100 px-2 py-0.5 text-[10px] font-black tracking-wider text-slate-600 uppercase"
						>
							{m.common_hidden()}
						</span>
					{/if}
				</div>
			</div>

			{#if pkg.description}
				<p class="line-clamp-2 text-xs font-medium text-slate-600">{pkg.description}</p>
			{/if}

			{#if pkg.deliverables?.length}
				<ul class="space-y-1">
					{#each pkg.deliverables as item (item)}
						<li class="flex items-start gap-1.5 text-[11px] font-medium text-slate-700">
							<Check class="mt-0.5 h-3 w-3 shrink-0 text-emerald-600" />
							<span>{item}</span>
						</li>
					{/each}
				</ul>
			{/if}

			<div
				class="flex items-center justify-between rounded-xl border-2 border-slate-900 bg-[#dcfce7] px-3 py-2"
			>
				<div class="text-[10px] font-black tracking-wider text-emerald-900 uppercase">
					{m.pk_summary({ days: pkg.deliveryDays, revisions: pkg.revisions })}
				</div>
				<div class="text-sm font-black text-slate-900">
					{pkg.price.toLocaleString()}
					<span class="text-xs text-emerald-700">{pkg.currencyCode}</span>
				</div>
			</div>
		</div>
	{/snippet}
</CrudSection>
