<script lang="ts">
	import CrudSection from '$lib/components/crud-section.svelte';
	import DynamicIcon, { iconNames } from '$lib/components/dynamic-icon.svelte';
	import type { CrudField } from '$lib/components/Table/crud-dialog.svelte';
	import * as m from '$lib/paraglide/messages';

	let { data } = $props();

	const fields: CrudField[] = $derived([
		{ name: 'name', label: m.ca_name(), required: true },
		{ name: 'slug', label: m.ca_slug(), required: true, placeholder: 'beauty-fashion' },
		{ name: 'description', label: m.common_description(), type: 'textarea', rows: 3 },
		{
			name: 'icon',
			label: m.ca_icon(),
			type: 'select',
			items: iconNames.map((name) => ({ value: name, name }))
		},
		{ name: 'sortOrder', label: m.common_sort_order(), type: 'number' },
		{
			name: 'isActive',
			label: m.common_visible(),
			type: 'checkboxSingle',
			placeholder: m.common_show_in_filters()
		}
	]);
</script>

<svelte:head><title>{m.ca_meta_title()}</title></svelte:head>

<CrudSection
	eyebrow={m.sb_reference_data()}
	title={m.ca_title()}
	description={m.ca_description()}
	label={m.ca_label()}
	rows={data.rows}
	list={data.list}
	{fields}
	addForm={data.addForm}
	editForm={data.editForm}
	deleteForm={data.deleteForm}
>
	{#snippet row(category)}
		<div class="space-y-2">
			<div class="flex items-start justify-between gap-2">
				<div
					class="flex h-10 w-10 items-center justify-center rounded-2xl border-2 border-edge bg-inverse text-inverse-ink shadow-[2px_2px_0px_0px_rgb(var(--bento-shadow))]"
				>
					<DynamicIcon name={category.icon} class="h-5 w-5" />
				</div>
				{#if !category.isActive}
					<span
						class="rounded-md border border-edge-mid bg-well px-2 py-0.5 text-[10px] font-black tracking-wider text-ink-soft uppercase"
					>
						{m.common_hidden()}
					</span>
				{/if}
			</div>
			<div>
				<h3 class="text-sm font-black text-ink">{category.name}</h3>
				<p class="font-mono text-[11px] font-bold text-ink-dim">/{category.slug}</p>
			</div>
			<p class="line-clamp-2 text-xs font-medium text-ink-soft">{category.description}</p>
		</div>
	{/snippet}
</CrudSection>
