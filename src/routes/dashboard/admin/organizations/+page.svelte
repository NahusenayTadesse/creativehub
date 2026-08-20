<script lang="ts">
	import CrudSection from '$lib/components/crud-section.svelte';
	import VerificationBadge from '$lib/components/verification-badge.svelte';
	import type { CrudField } from '$lib/components/Table/crud-dialog.svelte';
	import { ExternalLink } from '@lucide/svelte';
	import * as m from '$lib/paraglide/messages';

	let { data } = $props();

	const fields: CrudField[] = $derived([
		{ name: 'name', label: m.og_name(), required: true },
		{ name: 'slug', label: m.ca_slug(), required: true },
		{
			name: 'orgType',
			label: m.og_type(),
			type: 'select',
			items: [
				{ value: 'company', name: m.og_type_company() },
				{ value: 'startup', name: m.og_type_startup() },
				{ value: 'agency', name: m.og_type_agency() },
				{ value: 'ngo', name: m.ao_type_ngo_short() },
				{ value: 'government', name: m.ao_type_government_short() },
				{ value: 'event_organizer', name: m.og_type_event() }
			]
		},
		{ name: 'logo', label: m.og_logo_url() },
		{ name: 'website', label: m.og_website() },
		{ name: 'bio', label: m.og_about(), type: 'textarea', rows: 3 },
		{
			name: 'countryId',
			label: m.pf_country(),
			type: 'select',
			items: data.reference.countries.map((c) => ({ value: c.id, name: `${c.flag} ${c.name}` }))
		},
		{ name: 'city', label: m.pf_city() },
		{
			name: 'verificationLevel',
			label: m.ac_verification_badge(),
			type: 'select',
			items: [
				{ value: 'unverified', name: m.verif_none_label() },
				{ value: 'social_verified', name: m.verif_social_label() },
				{ value: 'identity_verified', name: m.verif_id_label() },
				{ value: 'cn_verified', name: m.verif_cn_label() }
			]
		},
		{ name: 'monthlyBudgetCap', label: m.og_monthly_cap(), type: 'number' },
		{ name: 'sortOrder', label: m.common_sort_order(), type: 'number' },
		{
			name: 'isActive',
			label: m.common_active(),
			type: 'checkboxSingle',
			placeholder: m.common_account_active()
		}
	]);
</script>

<svelte:head><title>{m.ao_meta_title()}</title></svelte:head>

<CrudSection
	eyebrow={m.sb_marketplace()}
	title={m.ao_title()}
	description={m.ao_description()}
	label={m.ao_label()}
	rows={data.rows}
	list={data.list}
	{fields}
	addForm={data.addForm}
	editForm={data.editForm}
	deleteForm={data.deleteForm}
	emptyMessage={m.ao_empty()}
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
						{m.ao_website_link()}
					</a>
				{/if}
			</div>

			{#if org.bio}
				<p class="line-clamp-2 text-xs font-medium text-slate-600">{org.bio}</p>
			{/if}
		</div>
	{/snippet}
</CrudSection>
