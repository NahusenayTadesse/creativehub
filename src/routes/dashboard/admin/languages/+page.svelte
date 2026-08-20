<script lang="ts">
	import CrudSection from '$lib/components/crud-section.svelte';
	import type { CrudField } from '$lib/components/Table/crud-dialog.svelte';
	import * as m from '$lib/paraglide/messages';

	let { data } = $props();

	const fields: CrudField[] = $derived([
		{ name: 'name', label: m.la_name(), required: true },
		{ name: 'code', label: m.co_iso(), required: true, placeholder: 'am' },
		{ name: 'sortOrder', label: m.common_sort_order(), type: 'number' },
		{
			name: 'isActive',
			label: m.common_visible(),
			type: 'checkboxSingle',
			placeholder: m.common_show_in_filters()
		}
	]);
</script>

<svelte:head><title>{m.la_meta_title()}</title></svelte:head>

<CrudSection
	eyebrow={m.sb_reference_data()}
	title={m.la_title()}
	description={m.la_description()}
	label={m.la_label()}
	rows={data.rows}
	list={data.list}
	{fields}
	addForm={data.addForm}
	editForm={data.editForm}
	deleteForm={data.deleteForm}
>
	{#snippet row(language)}
		<div class="flex items-center justify-between gap-3">
			<div>
				<h3 class="text-sm font-black text-slate-900">{language.name}</h3>
				<p class="font-mono text-[11px] font-bold text-slate-500">{language.code}</p>
			</div>
			{#if !language.isActive}
				<span
					class="rounded-md border border-slate-400 bg-slate-100 px-2 py-0.5 text-[10px] font-black tracking-wider text-slate-600 uppercase"
				>
					{m.common_hidden()}
				</span>
			{/if}
		</div>
	{/snippet}
</CrudSection>
