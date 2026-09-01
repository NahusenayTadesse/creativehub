<script lang="ts">
	import CrudSection from '$lib/components/crud-section.svelte';
	import type { CrudField } from '$lib/components/Table/crud-dialog.svelte';
	import { accentTile, BLOG_ACCENTS } from '$lib/blog';
	import { resolve } from '$app/paths';
	import { ArrowLeft } from '@lucide/svelte';
	import * as m from '$lib/paraglide/messages';

	let { data } = $props();

	const fields: CrudField[] = $derived([
		{ name: 'name', label: m.bc_name(), required: true, placeholder: m.bc_name_hint() },
		{ name: 'description', label: m.bc_description(), type: 'textarea', rows: 2 },
		{
			name: 'accent',
			label: m.bc_accent(),
			type: 'select',
			items: BLOG_ACCENTS.map((accent) => ({ value: accent, name: accent }))
		},
		{ name: 'sortOrder', label: m.common_sort_order(), type: 'number' },
		{
			name: 'isActive',
			label: m.common_visible(),
			type: 'checkboxSingle',
			placeholder: m.bc_visible_hint()
		}
	]);
</script>

<svelte:head><title>{m.bc_meta_title()}</title></svelte:head>

<CrudSection
	eyebrow={m.sb_blog()}
	title={m.bc_title()}
	description={m.bc_description_page()}
	label={m.bc_label()}
	rows={data.rows}
	list={data.list}
	{fields}
	nameKey="name"
	emptyMessage={m.bc_empty()}
	addForm={data.addForm}
	editForm={data.editForm}
	deleteForm={data.deleteForm}
>
	{#snippet extraActions()}
		<a
			href={resolve('/dashboard/admin/blog')}
			class="inline-flex items-center gap-1.5 rounded-xl border-2 border-edge bg-surface px-3 py-2 text-xs font-black text-ink shadow-[2px_2px_0px_0px_rgb(var(--bento-shadow))] transition-all hover:bg-panel"
		>
			<ArrowLeft class="h-3.5 w-3.5" />
			{m.bp_title()}
		</a>
	{/snippet}

	{#snippet row(category)}
		<div class="space-y-2">
			<div class="flex items-start justify-between gap-2">
				<span
					class="inline-flex items-center rounded-lg border-2 border-edge px-2.5 py-1 text-xs font-black text-ink {accentTile(
						category.accent
					)}"
				>
					{category.name}
				</span>
				<span class="shrink-0 text-[10px] font-black text-ink-faint">#{category.sortOrder}</span>
			</div>

			<p class="font-mono text-[11px] font-bold text-ink-dim">/blog?category={category.slug}</p>

			{#if category.description}
				<p class="line-clamp-2 text-xs font-medium text-ink-soft">{category.description}</p>
			{/if}

			{#if !category.isActive}
				<span
					class="inline-block rounded-md border border-edge-mid bg-well px-2 py-0.5 text-[10px] font-black tracking-wider text-ink-soft uppercase"
				>
					{m.common_hidden()}
				</span>
			{/if}
		</div>
	{/snippet}
</CrudSection>
