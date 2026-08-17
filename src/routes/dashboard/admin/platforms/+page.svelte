<script lang="ts">
	import CrudSection from '$lib/components/crud-section.svelte';
	import type { CrudField } from '$lib/components/Table/crud-dialog.svelte';

	let { data } = $props();

	const fields: CrudField[] = [
		{ name: 'name', label: 'Platform name', required: true },
		{ name: 'color', label: 'Brand colour (hex)', required: true, placeholder: '#0f172a' },
		{ name: 'sortOrder', label: 'Sort order', type: 'number' },
		{ name: 'isActive', label: 'Visible', type: 'checkboxSingle', placeholder: 'Show in filters' }
	];
</script>

<svelte:head><title>Platforms — Creator Network</title></svelte:head>

<CrudSection
	eyebrow="Reference data"
	title="Social platforms"
	description="The channels creators can link and campaigns can target."
	label="Platform"
	rows={data.rows}
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
					Hidden
				</span>
			{/if}
		</div>
	{/snippet}
</CrudSection>
