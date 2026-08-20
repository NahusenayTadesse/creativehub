<script lang="ts">
	import CrudSection from '$lib/components/crud-section.svelte';
	import type { CrudField } from '$lib/components/Table/crud-dialog.svelte';
	import * as m from '$lib/paraglide/messages';

	let { data } = $props();

	const fields: CrudField[] = $derived([
		{ name: 'name', label: m.pl_name(), required: true },
		{ name: 'color', label: m.pl_color(), required: true, placeholder: '#0f172a' },
		{ name: 'sortOrder', label: m.common_sort_order(), type: 'number' },
		{
			name: 'isActive',
			label: m.common_visible(),
			type: 'checkboxSingle',
			placeholder: m.common_show_in_filters()
		}
	]);
</script>

<svelte:head><title>{m.pl_meta_title()}</title></svelte:head>

<CrudSection
	eyebrow={m.sb_reference_data()}
	title={m.pl_title()}
	description={m.pl_description()}
	label={m.pl_label()}
	rows={data.rows}
	list={data.list}
	{fields}
	addForm={data.addForm}
	editForm={data.editForm}
	deleteForm={data.deleteForm}
>
	{#snippet row(platform)}
		<div class="flex items-center justify-between gap-3">
			<div class="flex items-center gap-3">
				<span
					class="h-8 w-8 rounded-xl border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]"
					style="background-color: {platform.color}"
				></span>
				<div>
					<h3 class="text-sm font-black text-slate-900">{platform.name}</h3>
					<p class="font-mono text-[11px] font-bold text-slate-500">{platform.color}</p>
				</div>
			</div>
			{#if !platform.isActive}
				<span
					class="rounded-md border border-slate-400 bg-slate-100 px-2 py-0.5 text-[10px] font-black tracking-wider text-slate-600 uppercase"
				>
					{m.common_hidden()}
				</span>
			{/if}
		</div>
	{/snippet}
</CrudSection>
