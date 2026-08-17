<script lang="ts">
	import CrudSection from '$lib/components/crud-section.svelte';
	import VerificationBadge from '$lib/components/verification-badge.svelte';
	import type { CrudField } from '$lib/components/Table/crud-dialog.svelte';
	import { ExternalLink } from '@lucide/svelte';

	let { data } = $props();

	const fields: CrudField[] = [
		{ name: 'name', label: 'Organisation name', required: true },
		{ name: 'slug', label: 'URL slug', required: true },
		{
			name: 'orgType',
			label: 'Type',
			type: 'select',
			items: [
				{ value: 'company', name: 'Company' },
				{ value: 'startup', name: 'Startup' },
				{ value: 'agency', name: 'Agency' },
				{ value: 'ngo', name: 'NGO' },
				{ value: 'government', name: 'Government' },
				{ value: 'event_organizer', name: 'Event organiser' }
			]
		},
		{ name: 'logo', label: 'Logo URL' },
		{ name: 'website', label: 'Website' },
		{ name: 'bio', label: 'About', type: 'textarea', rows: 3 },
		{
			name: 'countryId',
			label: 'Country',
			type: 'select',
			items: data.reference.countries.map((c) => ({ value: c.id, name: `${c.flag} ${c.name}` }))
		},
		{ name: 'city', label: 'City' },
		{
			name: 'verificationLevel',
			label: 'Verification badge',
			type: 'select',
			items: [
				{ value: 'unverified', name: 'Unverified' },
				{ value: 'social_verified', name: 'Social verified' },
				{ value: 'identity_verified', name: 'Identity verified' },
				{ value: 'cn_verified', name: 'CN Verified' }
			]
		},
		{ name: 'monthlyBudgetCap', label: 'Monthly budget cap', type: 'number' },
		{ name: 'sortOrder', label: 'Sort order', type: 'number' },
		{ name: 'isActive', label: 'Active', type: 'checkboxSingle', placeholder: 'Account is active' }
	];
</script>

<svelte:head><title>Organisations — Creator Network</title></svelte:head>

<CrudSection
	eyebrow="Marketplace"
	title="Organisations"
	description="Brands, agencies, NGOs and event organisers on the platform."
	label="Organisation"
	rows={data.rows}
	{fields}
	addForm={data.addForm}
	editForm={data.editForm}
	deleteForm={data.deleteForm}
	emptyMessage="No organisations yet"
>
	{#snippet row(org)}
		<div class="space-y-3">
			<div class="flex items-start gap-3">
				<img
					src={org.logo ?? ''}
					alt=""
					class="h-10 w-10 shrink-0 rounded-2xl border-2 border-slate-900 object-cover"
				/>
				<div class="min-w-0">
					<h3 class="truncate text-sm font-black text-slate-900">{org.name}</h3>
					<p class="truncate text-[11px] font-bold text-slate-500">
						{org.orgType?.replace('_', ' ')}{org.city ? ` · ${org.city}` : ''}
					</p>
				</div>
			</div>

			<div class="flex flex-wrap items-center gap-1.5">
				<VerificationBadge level={org.verificationLevel} />
				{#if org.website}
					<a
						href={org.website}
						target="_blank"
						rel="noreferrer"
						class="inline-flex items-center gap-1 text-[10px] font-black text-emerald-700 hover:underline"
					>
						<ExternalLink class="h-3 w-3" />
						Website
					</a>
				{/if}
			</div>

			{#if org.bio}
				<p class="line-clamp-2 text-xs font-medium text-slate-600">{org.bio}</p>
			{/if}
		</div>
	{/snippet}
</CrudSection>
