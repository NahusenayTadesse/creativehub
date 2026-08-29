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
	list={data.list}
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
				<h3 class="text-sm font-black text-ink">{pkg.title}</h3>
				<div class="flex shrink-0 items-center gap-1.5">
					{#if platformName(pkg.platformId)}
						<span
							class="rounded-md bg-brand-soft px-2 py-0.5 text-[10px] font-black text-brand-soft-fg"
						>
							{platformName(pkg.platformId)}
						</span>
					{/if}
					{#if !pkg.isActive}
						<span
							class="rounded-md border border-edge-mid bg-well px-2 py-0.5 text-[10px] font-black tracking-wider text-ink-soft uppercase"
						>
							{m.common_hidden()}
						</span>
					{/if}
				</div>
			</div>

			{#if pkg.description}
				<p class="line-clamp-2 text-xs font-medium text-ink-soft">{pkg.description}</p>
			{/if}

			{#if pkg.deliverables?.length}
				<ul class="space-y-1">
					{#each pkg.deliverables as item (item)}
						<li class="flex items-start gap-1.5 text-[11px] font-medium text-ink-soft">
							<Check class="mt-0.5 h-3 w-3 shrink-0 text-brand-fg" />
							<span>{item}</span>
						</li>
					{/each}
				</ul>
			{/if}

			<div
				class="flex items-center justify-between rounded-xl border-2 border-edge bg-tile-mint px-3 py-2"
			>
				<div class="text-[10px] font-black tracking-wider text-brand-soft-fg uppercase">
					{m.pk_summary({ days: pkg.deliveryDays, revisions: pkg.revisions })}
				</div>
				<div class="text-sm font-black text-ink">
					{pkg.price.toLocaleString()}
					<span class="text-xs text-brand-soft-fg">{pkg.currencyCode}</span>
				</div>
			</div>
		</div>
	{/snippet}
</CrudSection>
