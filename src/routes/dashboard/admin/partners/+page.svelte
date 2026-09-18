<script lang="ts">
	import AppImage from '$lib/components/app-image.svelte';
	import CrudSection from '$lib/components/crud-section.svelte';
	import type { CrudField } from '$lib/components/Table/crud-dialog.svelte';
	import { ExternalLink } from '@lucide/svelte';
	import * as m from '$lib/paraglide/messages';

	let { data } = $props();

	const fields: CrudField[] = $derived([
		{ name: 'name', label: m.pt_name(), required: true },
		{ name: 'logo', label: m.pt_logo(), type: 'file', placeholder: m.pt_logo_hint() },
		{ name: 'websiteUrl', label: m.pt_website(), placeholder: 'https://' },
		{ name: 'sortOrder', label: m.common_sort_order(), type: 'number' },
		{
			name: 'isActive',
			label: m.common_visible(),
			type: 'checkboxSingle',
			placeholder: m.pt_visible_hint()
		}
	]);
</script>

<svelte:head><title>{m.pt_meta_title()}</title></svelte:head>

<CrudSection
	eyebrow={m.dash_platform_operations()}
	title={m.pt_title()}
	description={m.pt_description()}
	label={m.pt_label()}
	rows={data.rows}
	list={data.list}
	{fields}
	fileFields={['logo']}
	nameKey="name"
	emptyMessage={m.pt_empty()}
	addForm={data.addForm}
	editForm={data.editForm}
	deleteForm={data.deleteForm}
	canDelete={data.canDelete}
>
	{#snippet row(partner)}
		<div class="space-y-3">
			<!-- On white, the way the hero's partner strip draws it in the light theme. -->
			<div
				class="relative flex h-24 items-center justify-center rounded-2xl border-2 border-edge bg-white p-4"
			>
				<AppImage
					src={partner.logo}
					alt={partner.name}
					kind="logo"
					seed={partner.name}
					class="max-h-full max-w-full object-contain"
					loading="lazy"
					decoding="async"
				/>
				<span
					class="absolute top-2 left-2 rounded-md border border-edge bg-surface px-2 py-0.5 text-[10px] font-black text-ink"
				>
					#{partner.sortOrder}
				</span>
				{#if !partner.isActive}
					<span
						class="absolute top-2 right-2 rounded-md border border-edge-mid bg-well px-2 py-0.5 text-[10px] font-black tracking-wider text-ink-soft uppercase"
					>
						{m.common_hidden()}
					</span>
				{/if}
			</div>
			<h3 class="text-sm font-black text-ink">{partner.name}</h3>
			{#if partner.websiteUrl}
				<a
					href={partner.websiteUrl}
					rel="external noopener"
					target="_blank"
					class="flex items-center gap-1 truncate text-[11px] font-bold text-brand-soft-fg"
				>
					<ExternalLink class="h-3 w-3 shrink-0" />
					<span class="truncate">{partner.websiteUrl}</span>
				</a>
			{/if}
		</div>
	{/snippet}
</CrudSection>
