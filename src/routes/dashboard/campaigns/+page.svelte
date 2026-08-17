<script lang="ts">
	import CrudSection from '$lib/components/crud-section.svelte';
	import BookingStatusBadge from '$lib/components/booking-status-badge.svelte';
	import CompensationBadge from '$lib/components/compensation-badge.svelte';
	import type { CrudField } from '$lib/components/Table/crud-dialog.svelte';
	import { Users, Send, Calendar, ExternalLink } from '@lucide/svelte';

	let { data } = $props();

	const fields: CrudField[] = [
		{ name: 'title', label: 'Campaign title', required: true },
		{
			name: 'description',
			label: 'The brief',
			type: 'textarea',
			rows: 6,
			required: true,
			placeholder: 'What you need made, for whom, and what good looks like.'
		},
		{ name: 'objective', label: 'Objective', type: 'textarea', rows: 2 },
		{
			name: 'compensationType',
			label: 'Compensation model',
			type: 'select',
			required: true,
			items: [
				{ value: 'paid', name: 'Paid — cash budget' },
				{ value: 'barter', name: 'Barter — product or stay' },
				{ value: 'event_pass', name: 'Event access pass' }
			]
		},
		{
			name: 'categoryId',
			label: 'Category',
			type: 'select',
			items: data.reference.categories.map((c) => ({ value: c.id, name: c.name }))
		},
		{
			name: 'countryId',
			label: 'Primary market',
			type: 'select',
			items: data.reference.countries.map((c) => ({ value: c.id, name: `${c.flag} ${c.name}` }))
		},
		{
			name: 'targetRegions',
			label: 'Also target these markets (one per line)',
			type: 'textarea',
			rows: 3,
			placeholder: 'Ethiopia\nKenya\nUnited Kingdom'
		},
		{ name: 'creatorsNeeded', label: 'Creators needed', type: 'number' },
		{ name: 'followerMin', label: 'Minimum audience', type: 'number' },
		{ name: 'followerMax', label: 'Maximum audience (0 = no cap)', type: 'number' },
		{ name: 'budgetMin', label: 'Budget from', type: 'number' },
		{ name: 'budgetMax', label: 'Budget to', type: 'number' },
		{
			name: 'currencyCode',
			label: 'Currency',
			type: 'select',
			items: ['ETB', 'KES', 'NGN', 'ZAR', 'GHS', 'RWF', 'EGP', 'AED', 'GBP', 'USD'].map((c) => ({
				value: c,
				name: c
			}))
		},
		{
			name: 'barterDetails',
			label: 'Barter — what the creator receives',
			type: 'textarea',
			rows: 3,
			placeholder: 'Required when the model is barter.'
		},
		{ name: 'eventName', label: 'Event name', placeholder: 'Required for event access' },
		{ name: 'eventDate', label: 'Event date', type: 'date' },
		{ name: 'eventLocation', label: 'Event location' },
		{ name: 'passType', label: 'Pass type & perks' },
		{
			name: 'deliverables',
			label: 'Required deliverables (one per line)',
			type: 'textarea',
			rows: 4
		},
		{ name: 'deadline', label: 'Applications close', type: 'date' },
		{ name: 'language', label: 'Content language' },
		{ name: 'tags', label: 'Tags (one per line)', type: 'textarea', rows: 3 },
		{
			name: 'status',
			label: 'Status',
			type: 'select',
			items: [
				{ value: 'draft', name: 'Draft — not visible' },
				{ value: 'published', name: 'Published — accepting applications' },
				{ value: 'closed', name: 'Closed — no new applications' },
				{ value: 'completed', name: 'Completed' },
				{ value: 'cancelled', name: 'Cancelled' }
			]
		},
		{ name: 'sortOrder', label: 'Sort order', type: 'number' }
	];

	const countFor = (campaignId: number) =>
		data.applications.filter((a) => a.campaignId === campaignId).length;

	const formatDate = (value: string | Date | null) =>
		value
			? new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
			: 'No deadline';

	/** The edit dialog needs dates as yyyy-mm-dd and JSON arrays as lines. */
	const editValues = (row: any) => ({
		id: row.id,
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

<svelte:head><title>Campaigns — Creator Network</title></svelte:head>

<CrudSection
	eyebrow={data.organizationName}
	title="Campaign briefs"
	description="A campaign only appears publicly once its status is Published — and publishing is refused unless the terms for its compensation model are complete."
	label="Campaign"
	rows={data.rows}
	{fields}
	addForm={data.addForm}
	editForm={data.editForm}
	deleteForm={data.deleteForm}
	nameKey="title"
	layout="list"
	{editValues}
	emptyMessage="No campaigns yet"
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
								View public page
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
							Budget
						</span>
						<span class="text-sm font-black text-slate-900">
							{campaign.budgetMin.toLocaleString()} – {campaign.budgetMax.toLocaleString()}
							<span class="text-emerald-600">{campaign.currencyCode}</span>
						</span>
					{:else if campaign.compensationType === 'event_pass'}
						<span class="text-xs font-black text-indigo-900">Event access</span>
					{:else}
						<span class="text-xs font-black text-amber-900">Barter</span>
					{/if}
				</div>
			</div>

			<div class="flex flex-wrap items-center gap-2 text-[11px]">
				<span
					class="flex items-center gap-1 rounded-lg border border-slate-300 bg-slate-50 px-2 py-1 font-bold text-slate-700"
				>
					<Users class="h-3 w-3 text-emerald-600" />
					{campaign.creatorsNeeded} needed
				</span>
				<a
					href="/dashboard/applications"
					class="flex items-center gap-1 rounded-lg border border-slate-300 bg-slate-50 px-2 py-1 font-bold text-slate-700 hover:border-slate-900"
				>
					<Send class="h-3 w-3 text-emerald-600" />
					{countFor(campaign.id)} applications
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
