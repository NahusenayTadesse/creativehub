<script lang="ts">
	import AppImage from '$lib/components/app-image.svelte';
	import CrudSection from '$lib/components/crud-section.svelte';
	import type { CrudField } from '$lib/components/Table/crud-dialog.svelte';
	import { assetUrl } from '$lib/assets';
	import { ImageOff } from '@lucide/svelte';
	import * as m from '$lib/paraglide/messages';

	let { data } = $props();

	const fields: CrudField[] = $derived([
		{ name: 'image', label: m.hs_image(), type: 'file', placeholder: m.hs_image_hint() },
		{ name: 'alt', label: m.hs_alt(), placeholder: m.hs_alt_placeholder() },
		{ name: 'sortOrder', label: m.common_sort_order(), type: 'number' },
		{
			name: 'isActive',
			label: m.common_visible(),
			type: 'checkboxSingle',
			placeholder: m.hs_visible_hint()
		}
	]);
</script>

<svelte:head><title>{m.hs_meta_title()}</title></svelte:head>

<CrudSection
	eyebrow={m.sb_reference_data()}
	title={m.hs_title()}
	description={m.hs_description()}
	label={m.hs_label()}
	rows={data.rows}
	list={data.list}
	{fields}
	fileFields={['image']}
	nameKey="alt"
	emptyMessage={m.hs_empty()}
	addForm={data.addForm}
	editForm={data.editForm}
	deleteForm={data.deleteForm}
	canDelete={data.canDelete}
>
	{#snippet row(slide)}
		<div class="space-y-3">
			<div
				class="relative aspect-[4/5] overflow-hidden rounded-2xl border-2 border-edge bg-well shadow-[2px_2px_0px_0px_rgb(var(--bento-shadow))]"
			>
				{#if slide.image}
					<AppImage
						src={assetUrl(slide.image)}
						alt={slide.alt || m.hs_label()}
						kind="cover"
						seed={String(slide.id)}
						class="h-full w-full object-cover"
						loading="lazy"
						decoding="async"
					/>
				{:else}
					<div class="flex h-full w-full items-center justify-center text-ink-faint">
						<ImageOff class="h-6 w-6" />
					</div>
				{/if}

				<span
					class="absolute top-2 left-2 rounded-md border border-edge bg-surface px-2 py-0.5 text-[10px] font-black text-ink"
				>
					#{slide.sortOrder}
				</span>

				{#if !slide.isActive}
					<span
						class="absolute top-2 right-2 rounded-md border border-edge-mid bg-well px-2 py-0.5 text-[10px] font-black tracking-wider text-ink-soft uppercase"
					>
						{m.common_hidden()}
					</span>
				{/if}
			</div>

			<p class="line-clamp-2 text-xs font-medium text-ink-soft">
				{slide.alt || m.hs_no_alt()}
			</p>
		</div>
	{/snippet}
</CrudSection>
