<script lang="ts">
	import CrudSection from '$lib/components/crud-section.svelte';
	import type { CrudField } from '$lib/components/Table/crud-dialog.svelte';
	import { CircleCheckBig, ExternalLink } from '@lucide/svelte';
	import { formatReach } from '$lib/domain/money';

	let { data } = $props();

	const fields: CrudField[] = [
		{
			name: 'platformId',
			label: 'Platform',
			type: 'select',
			required: true,
			items: data.platforms.map((p) => ({ value: p.id, name: p.name }))
		},
		{ name: 'handle', label: 'Handle', required: true, placeholder: '@yourhandle' },
		{ name: 'followers', label: 'Followers', type: 'number', required: true },
		{
			name: 'engagementRate',
			label: 'Engagement rate (%)',
			type: 'number',
			placeholder: '6.8'
		},
		{ name: 'profileUrl', label: 'Channel URL', placeholder: 'https://…' },
		{
			name: 'isVerified',
			label: 'Ownership confirmed',
			type: 'checkboxSingle',
			placeholder: 'An operator has confirmed I own this channel'
		},
		{ name: 'sortOrder', label: 'Sort order', type: 'number' },
		{ name: 'isActive', label: 'Live', type: 'checkboxSingle', placeholder: 'Show on my profile' }
	];

	const platformName = (id: number) => data.platforms.find((p) => p.id === id)?.name ?? 'Channel';

	const totalReach = $derived(
		data.rows.filter((r) => r.isActive).reduce((sum, r) => sum + r.followers, 0)
	);
</script>

<svelte:head><title>Channels — Creator Network</title></svelte:head>

<CrudSection
	eyebrow="Creator studio"
	title="Linked channels"
	description="Your audience across platforms. Total reach on your profile is the sum of the live channels here, so keep the numbers honest — brands compare them against your delivered results."
	label="Channel"
	rows={data.rows}
	{fields}
	addForm={data.addForm}
	editForm={data.editForm}
	deleteForm={data.deleteForm}
	nameKey="handle"
	emptyMessage="No channels linked yet"
>
	{#snippet extraActions()}
		<span
			class="rounded-2xl border-2 border-slate-900 bg-[#fef9c3] px-4 py-2.5 text-xs font-black text-slate-900 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)]"
		>
			{formatReach(totalReach)} total reach
		</span>
	{/snippet}

	{#snippet row(account)}
		<div class="space-y-3">
			<div class="flex items-start justify-between gap-2">
				<div>
					<h3 class="text-sm font-black text-slate-900">{platformName(account.platformId)}</h3>
					<p class="text-[11px] font-bold text-slate-500">{account.handle}</p>
				</div>
				<div class="flex shrink-0 flex-col items-end gap-1">
					{#if account.isVerified}
						<span
							class="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800"
						>
							<CircleCheckBig class="h-3 w-3" />
							Confirmed
						</span>
					{/if}
					{#if !account.isActive}
						<span
							class="rounded-md border border-slate-400 bg-slate-100 px-2 py-0.5 text-[10px] font-black tracking-wider text-slate-600 uppercase"
						>
							Hidden
						</span>
					{/if}
				</div>
			</div>

			<div class="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-xs">
				<div>
					<span class="block text-[9px] font-black tracking-wider text-slate-500 uppercase">
						Followers
					</span>
					<span class="font-black text-slate-900">{formatReach(account.followers)}</span>
				</div>
				<div class="text-right">
					<span class="block text-[9px] font-black tracking-wider text-slate-500 uppercase">
						Engagement
					</span>
					<span class="font-black text-emerald-700">{account.engagementRate.toFixed(1)}%</span>
				</div>
			</div>

			{#if account.profileUrl}
				<a
					href={account.profileUrl}
					target="_blank"
					rel="noreferrer"
					class="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:underline"
				>
					<ExternalLink class="h-3 w-3" />
					Open channel
				</a>
			{/if}
		</div>
	{/snippet}
</CrudSection>
