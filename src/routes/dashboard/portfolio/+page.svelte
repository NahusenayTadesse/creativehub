<script lang="ts">
	import CrudSection from '$lib/components/crud-section.svelte';
	import type { CrudField } from '$lib/components/Table/crud-dialog.svelte';
	import { assetUrl } from '$lib/assets';

	let { data } = $props();

	const fields: CrudField[] = [
		{ name: 'url', label: 'Image or video URL', required: true, placeholder: 'https://…' },
		{ name: 'caption', label: 'Caption', placeholder: 'What this piece was and how it performed' },
		{
			name: 'mediaType',
			label: 'Media type',
			type: 'select',
			items: [
				{ value: 'image', name: 'Image' },
				{ value: 'video', name: 'Video' }
			]
		},
		{
			name: 'platformId',
			label: 'Platform',
			type: 'select',
			items: data.platforms.map((p) => ({ value: p.id, name: p.name }))
		},
		{ name: 'views', label: 'Views', type: 'number' },
		{ name: 'likes', label: 'Likes', type: 'number' },
		{ name: 'sortOrder', label: 'Sort order', type: 'number' },
		{ name: 'isActive', label: 'Live', type: 'checkboxSingle', placeholder: 'Show on my profile' }
	];

	const platformName = (id: number | null) => data.platforms.find((p) => p.id === id)?.name;
</script>

<svelte:head><title>Portfolio — Creator Network</title></svelte:head>

<CrudSection
	eyebrow="Creator studio"
	title="Portfolio"
	description="Work samples brands see on your profile. Real numbers on real posts do more than a showreel."
	label="Portfolio item"
	rows={data.rows}
	{fields}
	addForm={data.addForm}
	editForm={data.editForm}
	deleteForm={data.deleteForm}
	nameKey="caption"
	emptyMessage="No portfolio items yet"
>
	{#snippet row(item)}
		<div class="space-y-3">
			<div class="relative h-40 overflow-hidden rounded-2xl border-2 border-slate-900 bg-slate-100">
				<img src={assetUrl(item.url)} alt={item.caption ?? ''} class="h-full w-full object-cover" />
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
						Hidden
					</span>
				{/if}
			</div>

			<p class="line-clamp-2 text-xs font-bold text-slate-900">{item.caption}</p>

			<div class="flex items-center justify-between text-[11px] font-bold text-slate-500">
				<span>👁 {item.views.toLocaleString()} views</span>
				<span>❤️ {item.likes.toLocaleString()} likes</span>
			</div>
		</div>
	{/snippet}
</CrudSection>
