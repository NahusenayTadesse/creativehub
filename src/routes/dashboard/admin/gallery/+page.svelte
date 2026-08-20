<script lang="ts">
	import CrudSection from '$lib/components/crud-section.svelte';
	import type { CrudField } from '$lib/components/Table/crud-dialog.svelte';
	import { assetUrl } from '$lib/assets';
	import { ExternalLink, ImageOff } from '@lucide/svelte';
	import * as m from '$lib/paraglide/messages';

	let { data } = $props();

	const fields: CrudField[] = $derived([
		{ name: 'title', label: m.gal_slide_title(), required: true },
		{ name: 'subtitle', label: m.gal_subtitle(), type: 'textarea', rows: 3 },
		{ name: 'image', label: m.gal_image(), type: 'file', placeholder: m.gal_image_hint() },
		{ name: 'linkUrl', label: m.gal_link_url(), placeholder: '/discover' },
		{ name: 'linkLabel', label: m.gal_link_label(), placeholder: m.home_gallery_cta() },
		{ name: 'sortOrder', label: m.common_sort_order(), type: 'number' },
		{
			name: 'isActive',
			label: m.common_visible(),
			type: 'checkboxSingle',
			placeholder: m.gal_visible_hint()
		}
	]);

	/*
	 * The picker is left empty on edit: an empty file field means "keep the
	 * stored image", and the current one is shown next to it as a preview.
	 */
	const editValues = (slide: Record<string, any>) => ({
		id: slide.id,
		title: slide.title,
		subtitle: slide.subtitle ?? '',
		linkUrl: slide.linkUrl ?? '',
		linkLabel: slide.linkLabel ?? '',
		sortOrder: slide.sortOrder,
		isActive: slide.isActive
	});
</script>

<svelte:head><title>{m.gal_meta_title()}</title></svelte:head>

<CrudSection
	eyebrow={m.sb_reference_data()}
	title={m.gal_title()}
	description={m.gal_description()}
	label={m.gal_label()}
	rows={data.rows}
	list={data.list}
	{fields}
	{editValues}
	fileFields={['image']}
	nameKey="title"
	emptyMessage={m.gal_empty()}
	addForm={data.addForm}
	editForm={data.editForm}
	deleteForm={data.deleteForm}
>
	{#snippet row(slide)}
		<div class="space-y-3">
			<div
				class="relative h-32 overflow-hidden rounded-2xl border-2 border-slate-900 bg-slate-100 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]"
			>
				{#if slide.image}
					<img src={assetUrl(slide.image)} alt={slide.title} class="h-full w-full object-cover" />
				{:else}
					<div class="flex h-full w-full items-center justify-center text-slate-400">
						<ImageOff class="h-6 w-6" />
					</div>
				{/if}

				<span
					class="absolute top-2 left-2 rounded-md border border-slate-900 bg-white px-2 py-0.5 text-[10px] font-black text-slate-900"
				>
					#{slide.sortOrder}
				</span>

				{#if !slide.isActive}
					<span
						class="absolute top-2 right-2 rounded-md border border-slate-400 bg-slate-100 px-2 py-0.5 text-[10px] font-black tracking-wider text-slate-600 uppercase"
					>
						{m.common_hidden()}
					</span>
				{/if}
			</div>

			<div>
				<h3 class="text-sm font-black text-slate-900">{slide.title}</h3>
				{#if slide.subtitle}
					<p class="mt-1 line-clamp-2 text-xs font-medium text-slate-600">{slide.subtitle}</p>
				{/if}
			</div>

			{#if slide.linkUrl}
				<a
					href={slide.linkUrl}
					class="flex items-center gap-1 truncate text-[11px] font-bold text-emerald-700 hover:text-emerald-800"
				>
					<ExternalLink class="h-3 w-3 shrink-0" />
					<span class="truncate">{slide.linkLabel || slide.linkUrl}</span>
				</a>
			{/if}
		</div>
	{/snippet}
</CrudSection>
