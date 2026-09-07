<script lang="ts">
	import CrudSection from '$lib/components/crud-section.svelte';
	import type { CrudField } from '$lib/components/Table/crud-dialog.svelte';
	import { CircleCheckBig, CircleAlert, CircleHelp, ExternalLink } from '@lucide/svelte';
	import { formatReach } from '$lib/domain/money';
	import { resolve } from '$app/paths';
	import * as m from '$lib/paraglide/messages';

	let { data } = $props();

	const fields: CrudField[] = $derived([
		{
			name: 'platformId',
			label: m.pk_platform(),
			type: 'select',
			required: true,
			items: data.platforms.map((p) => ({ value: p.id, name: p.name }))
		},
		{
			name: 'handle',
			label: m.ch_handle(),
			required: true,
			placeholder: m.ch_handle_placeholder(),
			/* Asks the platform whether this account exists before the form is
			   saved. The save runs the same check itself — this one is so the
			   answer arrives while the handle can still be corrected. */
			check: { endpoint: resolve('/dashboard/channels/check'), label: m.ch_check() }
		},
		{ name: 'followers', label: m.ch_followers(), type: 'number', required: true },
		{
			name: 'engagementRate',
			label: m.ch_engagement_rate(),
			type: 'number',
			placeholder: '6.8'
		},
		{ name: 'profileUrl', label: m.ch_channel_url(), placeholder: 'https://…' },
		{
			name: 'isVerified',
			label: m.ch_ownership_confirmed(),
			type: 'checkboxSingle',
			placeholder: m.ch_ownership_note()
		},
		{ name: 'sortOrder', label: m.common_sort_order(), type: 'number' },
		{
			name: 'isActive',
			label: m.common_live(),
			type: 'checkboxSingle',
			placeholder: m.common_show_on_profile()
		}
	]);

	const platformName = (id: number) =>
		data.platforms.find((p) => p.id === id)?.name ?? m.ch_fallback_name();

	/* When the platform was last asked about this handle, in the reader's
	   language. `unchecked` shows nothing: a row written before this existed has
	   no verdict, and an empty space says that better than a label would. */
	const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });
	const checkedOn = (value: string | Date | null) =>
		value ? dateFormat.format(new Date(value)) : '';

	const totalReach = $derived(
		data.rows.filter((r) => r.isActive).reduce((sum, r) => sum + r.followers, 0)
	);
</script>

<svelte:head><title>{m.ch_meta_title()}</title></svelte:head>

<CrudSection
	eyebrow={m.dashc_eyebrow()}
	title={m.ch_title()}
	description={m.ch_description()}
	label={m.ch_label()}
	rows={data.rows}
	list={data.list}
	{fields}
	addForm={data.addForm}
	editForm={data.editForm}
	deleteForm={data.deleteForm}
	nameKey="handle"
	emptyMessage={m.ch_empty()}
>
	{#snippet extraActions()}
		<span
			class="rounded-2xl border-2 border-edge bg-tile-yellow px-4 py-2.5 text-xs font-black text-ink shadow-[3px_3px_0px_0px_rgb(var(--bento-shadow))]"
		>
			{m.ch_total_reach({ reach: formatReach(totalReach) })}
		</span>
	{/snippet}

	{#snippet row(account)}
		<div class="space-y-3">
			<div class="flex items-start justify-between gap-2">
				<div>
					<h3 class="text-sm font-black text-ink">{platformName(account.platformId)}</h3>
					<p class="text-[11px] font-bold text-ink-dim">{account.handle}</p>
				</div>
				<div class="flex shrink-0 flex-col items-end gap-1">
					{#if account.isVerified}
						<span
							class="inline-flex items-center gap-1 rounded-md bg-brand-soft px-2 py-0.5 text-[10px] font-bold text-brand-soft-fg"
						>
							<CircleCheckBig class="h-3 w-3" />
							{m.ch_confirmed()}
						</span>
					{/if}
					{#if account.linkStatus === 'not_found'}
						<span
							class="inline-flex items-center gap-1 rounded-md bg-danger-soft px-2 py-0.5 text-[10px] font-bold text-danger-fg"
							title={m.ch_link_checked_on({ date: checkedOn(account.linkCheckedAt) })}
						>
							<CircleAlert class="h-3 w-3" />
							{m.ch_link_missing()}
						</span>
					{:else if account.linkStatus === 'found'}
						<span
							class="inline-flex items-center gap-1 rounded-md border border-edge-mid bg-well px-2 py-0.5 text-[10px] font-bold text-ink-soft"
							title={m.ch_link_checked_on({ date: checkedOn(account.linkCheckedAt) })}
						>
							<CircleCheckBig class="h-3 w-3" />
							{m.ch_link_live()}
						</span>
					{:else if account.linkStatus === 'unknown'}
						<span
							class="inline-flex items-center gap-1 rounded-md border border-edge-mid bg-well px-2 py-0.5 text-[10px] font-bold text-ink-dim"
							title={m.ch_link_checked_on({ date: checkedOn(account.linkCheckedAt) })}
						>
							<CircleHelp class="h-3 w-3" />
							{m.ch_link_unknown()}
						</span>
					{/if}
					{#if !account.isActive}
						<span
							class="rounded-md border border-edge-mid bg-well px-2 py-0.5 text-[10px] font-black tracking-wider text-ink-soft uppercase"
						>
							{m.common_hidden()}
						</span>
					{/if}
				</div>
			</div>

			<div class="flex items-center justify-between rounded-xl bg-panel px-3 py-2 text-xs">
				<div>
					<span class="block text-[9px] font-black tracking-wider text-ink-dim uppercase">
						{m.ch_followers()}
					</span>
					<span class="font-black text-ink">{formatReach(account.followers)}</span>
				</div>
				<div class="text-right">
					<span class="block text-[9px] font-black tracking-wider text-ink-dim uppercase">
						{m.profile_engagement()}
					</span>
					<span class="font-black text-brand-soft-fg">{account.engagementRate.toFixed(1)}%</span>
				</div>
			</div>

			{#if account.profileUrl}
				<a
					href={account.profileUrl}
					target="_blank"
					rel="noreferrer"
					class="inline-flex items-center gap-1 text-[11px] font-bold text-brand-soft-fg hover:underline"
				>
					<ExternalLink class="h-3 w-3" />
					{m.ch_open_channel()}
				</a>
			{/if}
		</div>
	{/snippet}
</CrudSection>
