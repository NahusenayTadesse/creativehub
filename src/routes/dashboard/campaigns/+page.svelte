<script lang="ts">
	import CrudSection from '$lib/components/crud-section.svelte';
	import BookingStatusBadge from '$lib/components/booking-status-badge.svelte';
	import CompensationBadge from '$lib/components/compensation-badge.svelte';
	import type { CrudField } from '$lib/components/Table/crud-dialog.svelte';
	import { Users, Send, Calendar, ExternalLink } from '@lucide/svelte';
	import * as m from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';

	let { data } = $props();

	const fields: CrudField[] = $derived([
		/* A brand's campaigns are stamped from its session; only an operator,
		   who acts across every organisation, has to name the owner. */
		...(data.isOperator
			? [
					{
						name: 'organizationId',
						label: m.cf_organisation(),
						type: 'select',
						required: true,
						items: data.organizations.map((o) => ({ value: o.id, name: o.name }))
					} satisfies CrudField
				]
			: []),
		{ name: 'title', label: m.cf_title(), required: true },
		{
			name: 'description',
			label: m.cf_brief(),
			type: 'textarea',
			rows: 6,
			required: true,
			placeholder: m.cf_brief_placeholder()
		},
		{ name: 'objective', label: m.cf_objective(), type: 'textarea', rows: 2 },
		{
			name: 'compensationType',
			label: m.cf_comp_model(),
			type: 'select',
			required: true,
			items: [
				{ value: 'paid', name: m.cf_comp_paid() },
				{ value: 'barter', name: m.cf_comp_barter() },
				{ value: 'event_pass', name: m.cf_comp_event() }
			]
		},
		{
			name: 'categoryId',
			label: m.cf_category(),
			type: 'select',
			items: data.reference.categories.map((c) => ({ value: c.id, name: c.name }))
		},
		{
			name: 'countryId',
			label: m.cf_primary_market(),
			type: 'select',
			items: data.reference.countries.map((c) => ({ value: c.id, name: `${c.flag} ${c.name}` }))
		},
		{
			name: 'targetRegions',
			label: m.cf_target_regions(),
			type: 'textarea',
			rows: 3,
			placeholder: m.cf_target_regions_placeholder()
		},
		{ name: 'creatorsNeeded', label: m.cf_creators_needed(), type: 'number' },
		{ name: 'followerMin', label: m.cf_follower_min(), type: 'number' },
		{ name: 'followerMax', label: m.cf_follower_max(), type: 'number' },
		{ name: 'budgetMin', label: m.cf_budget_from(), type: 'number' },
		{ name: 'budgetMax', label: m.cf_budget_to(), type: 'number' },
		{
			name: 'currencyCode',
			label: m.campaign_currency(),
			type: 'select',
			items: ['ETB', 'KES', 'NGN', 'ZAR', 'GHS', 'RWF', 'EGP', 'AED', 'GBP', 'USD'].map((c) => ({
				value: c,
				name: c
			}))
		},
		{
			name: 'barterDetails',
			label: m.cf_barter_details(),
			type: 'textarea',
			rows: 3,
			placeholder: m.cf_barter_placeholder()
		},
		{ name: 'eventName', label: m.cf_event_name(), placeholder: m.cf_event_name_placeholder() },
		{ name: 'eventDate', label: m.cf_event_date(), type: 'date' },
		{ name: 'eventLocation', label: m.cf_event_location() },
		{ name: 'passType', label: m.cf_pass_type() },
		{
			name: 'deliverables',
			label: m.cf_deliverables(),
			type: 'textarea',
			rows: 4
		},
		{ name: 'deadline', label: m.cf_deadline(), type: 'date' },
		{ name: 'language', label: m.cf_language() },
		{ name: 'tags', label: m.cf_tags(), type: 'textarea', rows: 3 },
		{
			name: 'status',
			label: m.cf_status(),
			type: 'select',
			items: [
				{ value: 'draft', name: m.cf_status_draft() },
				{ value: 'published', name: m.cf_status_published() },
				{ value: 'closed', name: m.cf_status_closed() },
				{ value: 'completed', name: m.cf_status_completed() },
				{ value: 'cancelled', name: m.cf_status_cancelled() }
			]
		},
		{ name: 'sortOrder', label: m.cf_sort_order(), type: 'number' }
	]);

	const countFor = (campaignId: number) =>
		data.applications.filter((a) => a.campaignId === campaignId).length;

	const formatDate = (value: string | Date | null) =>
		value
			? new Date(value).toLocaleDateString(getLocale() === 'am' ? 'am-ET' : 'en-GB', {
					day: 'numeric',
					month: 'short',
					year: 'numeric'
				})
			: m.dc_no_deadline();

	/** The edit dialog needs dates as yyyy-mm-dd and JSON arrays as lines. */
	const editValues = (row: any) => ({
		id: row.id,
		organizationId: row.organizationId ?? undefined,
		title: row.title,
		description: row.description ?? '',
		objective: row.objective ?? '',
		compensationType: row.compensationType,
		categoryId: row.categoryId ?? undefined,
		countryId: row.countryId ?? undefined,
		targetRegions: (row.targetRegions ?? []).join('\n'),
		creatorsNeeded: row.creatorsNeeded,
		followerMin: row.followerMin,
		followerMax: row.followerMax,
		budgetMin: row.budgetMin,
		budgetMax: row.budgetMax,
		currencyCode: row.currencyCode,
		barterDetails: row.barterDetails ?? '',
		eventName: row.eventName ?? '',
		eventDate: row.eventDate ? String(row.eventDate).slice(0, 10) : '',
		eventLocation: row.eventLocation ?? '',
		passType: row.passType ?? '',
		deliverables: (row.deliverables ?? []).join('\n'),
		deadline: row.deadline ? String(row.deadline).slice(0, 10) : '',
		language: row.language,
		tags: (row.tags ?? []).join('\n'),
		status: row.status,
		sortOrder: row.sortOrder
	});
</script>

<svelte:head><title>{m.dc_meta_title()}</title></svelte:head>

<CrudSection
	eyebrow={data.organizationName}
	title={m.dc_title()}
	description={m.dc_description()}
	label={m.dc_label()}
	rows={data.rows}
	{fields}
	addForm={data.addForm}
	editForm={data.editForm}
	deleteForm={data.deleteForm}
	nameKey="title"
	layout="list"
	{editValues}
	emptyMessage={m.dc_empty()}
>
	{#snippet row(campaign)}
		<div class="space-y-3">
			<div class="flex flex-wrap items-start justify-between gap-3">
				<div class="min-w-0">
					<div class="mb-1 flex flex-wrap items-center gap-2">
						<BookingStatusBadge status={campaign.status} kind="campaign" />
						<CompensationBadge type={campaign.compensationType} />
						{#if campaign.status === 'published'}
							<a
								href="/campaigns/{campaign.slug}"
								target="_blank"
								class="inline-flex items-center gap-1 text-[11px] font-black text-emerald-700 hover:underline"
							>
								<ExternalLink class="h-3 w-3" />
								{m.dc_view_public()}
							</a>
						{/if}
					</div>
					<h3 class="text-base font-black text-slate-900">{campaign.title}</h3>
					<p class="mt-1 line-clamp-2 max-w-2xl text-xs font-medium text-slate-600">
						{campaign.description}
					</p>
				</div>

				<div class="shrink-0 text-right">
					{#if campaign.compensationType === 'paid'}
						<span class="block text-[10px] font-black tracking-wider text-slate-500 uppercase">
							{m.dc_budget()}
						</span>
						<span class="text-sm font-black text-slate-900">
							{campaign.budgetMin.toLocaleString()} – {campaign.budgetMax.toLocaleString()}
							<span class="text-emerald-600">{campaign.currencyCode}</span>
						</span>
					{:else if campaign.compensationType === 'event_pass'}
						<span class="text-xs font-black text-indigo-900">{m.dc_event_access()}</span>
					{:else}
						<span class="text-xs font-black text-amber-900">{m.dc_barter()}</span>
					{/if}
				</div>
			</div>

			<div class="flex flex-wrap items-center gap-2 text-[11px]">
				<span
					class="flex items-center gap-1 rounded-lg border border-slate-300 bg-slate-50 px-2 py-1 font-bold text-slate-700"
				>
					<Users class="h-3 w-3 text-emerald-600" />
					{m.dc_needed({ count: campaign.creatorsNeeded })}
				</span>
				<a
					href="/dashboard/applications"
					class="flex items-center gap-1 rounded-lg border border-slate-300 bg-slate-50 px-2 py-1 font-bold text-slate-700 hover:border-slate-900"
				>
					<Send class="h-3 w-3 text-emerald-600" />
					{m.dc_applications({ count: countFor(campaign.id) })}
				</a>
				<span
					class="flex items-center gap-1 rounded-lg border border-slate-300 bg-slate-50 px-2 py-1 font-bold text-slate-700"
				>
					<Calendar class="h-3 w-3 text-emerald-600" />
					{formatDate(campaign.deadline)}
				</span>
			</div>
		</div>
	{/snippet}
</CrudSection>
