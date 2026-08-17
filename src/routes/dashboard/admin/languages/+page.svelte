<script lang="ts">
	import CrudSection from '$lib/components/crud-section.svelte';
	import type { CrudField } from '$lib/components/Table/crud-dialog.svelte';

	let { data } = $props();

	const fields: CrudField[] = [
		{ name: 'name', label: 'Language name', required: true },
		{ name: 'code', label: 'ISO code', required: true, placeholder: 'am' },
		{ name: 'sortOrder', label: 'Sort order', type: 'number' },
		{ name: 'isActive', label: 'Visible', type: 'checkboxSingle', placeholder: 'Show in filters' }
	];
</script>

<svelte:head><title>Languages — Creator Network</title></svelte:head>

<CrudSection
	eyebrow="Reference data"
	title="Languages"
	description="The languages creators can list as working languages."
	label="Language"
	rows={data.rows}
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
					Hidden
				</span>
			{/if}
		</div>
	{/snippet}
</CrudSection>
