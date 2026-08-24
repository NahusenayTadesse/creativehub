<script lang="ts">
	import AppImage from '$lib/components/app-image.svelte';
	import CrudSection from '$lib/components/crud-section.svelte';
	import type { CrudField } from '$lib/components/Table/crud-dialog.svelte';
	import { assetUrl } from '$lib/assets';
	import * as m from '$lib/paraglide/messages';

	let { data } = $props();

	const fields: CrudField[] = $derived([
		{ name: 'url', label: m.po_url(), required: true, placeholder: 'https://…' },
		{ name: 'caption', label: m.po_caption(), placeholder: m.po_caption_placeholder() },
		{
			name: 'mediaType',
			label: m.po_media_type(),
			type: 'select',
			items: [
				{ value: 'image', name: m.po_image() },
				{ value: 'video', name: m.po_video() }
			]
		},
		{
			name: 'platformId',
			label: m.pk_platform(),
			type: 'select',
			items: data.platforms.map((p) => ({ value: p.id, name: p.name }))
		},
		{ name: 'views', label: m.po_views(), type: 'number' },
		{ name: 'likes', label: m.po_likes(), type: 'number' },
		{ name: 'sortOrder', label: m.common_sort_order(), type: 'number' },
		{
			name: 'isActive',
			label: m.common_live(),
			type: 'checkboxSingle',
			placeholder: m.common_show_on_profile()
		}
	]);

	const platformName = (id: number | null) => data.platforms.find((p) => p.id === id)?.name;
</script>

<svelte:head><title>{m.po_meta_title()}</title></svelte:head>

<CrudSection
	eyebrow={m.dashc_eyebrow()}
	title={m.po_title()}
	description={m.po_description()}
	label={m.po_label()}
	rows={data.rows}
	list={data.list}
	{fields}
	addForm={data.addForm}
	editForm={data.editForm}
	deleteForm={data.deleteForm}
	nameKey="caption"
	emptyMessage={m.po_empty()}
>
	{#snippet row(item)}
		<div class="space-y-3">
			<div class="relative h-40 overflow-hidden rounded-2xl border-2 border-slate-900 bg-slate-100">
				<AppImage
					src={assetUrl(item.url)}
					alt={item.caption ?? ''}
					kind="media"
					seed={String(item.id)}
					class="h-full w-full object-cover"
					loading="lazy"
					decoding="async"
				/>
				{#if platformName(item.platformId)}
					<span
						class="absolute top-2 left-2 rounded-md bg-black/60 px-2 py-0.5 text-[10px] font-bold text-white uppercase backdrop-blur-md"
					>
						{platformName(item.platformId)}
					</span>
				{/if}
				{#if !item.isActive}
					<span
						class="absolute top-2 right-2 rounded-md border border-slate-900 bg-white px-2 py-0.5 text-[10px] font-black tracking-wider text-slate-700 uppercase"
					>
						{m.common_hidden()}
					</span>
				{/if}
			</div>

			<p class="line-clamp-2 text-xs font-bold text-slate-900">{item.caption}</p>

			<div class="flex items-center justify-between text-[11px] font-bold text-slate-500">
				<span>👁 {item.views.toLocaleString()} {m.profile_views()}</span>
				<span>❤️ {item.likes.toLocaleString()} {m.profile_likes()}</span>
			</div>
		</div>
	{/snippet}
</CrudSection>
