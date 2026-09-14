<script lang="ts">
	import { untrack } from 'svelte';
	import { superForm } from 'sveltekit-superforms';
	import { toast } from 'svelte-sonner';
	import CrudSection from '$lib/components/crud-section.svelte';
	import StatSourceNote from '$lib/components/stat-source-note.svelte';
	import type { CrudField } from '$lib/components/Table/crud-dialog.svelte';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import InputComp from '$lib/formComponents/InputComp.svelte';
	import Errors from '$lib/formComponents/Errors.svelte';
	import LoadingBtn from '$lib/formComponents/LoadingBtn.svelte';
	import {
		CircleCheckBig,
		CircleAlert,
		CircleHelp,
		ExternalLink,
		Clock,
		ChartNoAxesColumnIncreasing
	} from '@lucide/svelte';
	import { formatReach } from '$lib/domain/money';
	import { resolve } from '$app/paths';
	import * as m from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';

	let { data } = $props();

	/* ---------------------------------------------------------------- *
	 * Proof of figures — a screenshot of the creator's own analytics,
	 * for an operator to compare against the numbers they state.
	 * ---------------------------------------------------------------- */

	let proofOpen = $state(false);
	let proofAccount = $state<{ id: number; platform: string; handle: string } | null>(null);

	const {
		form: proofForm,
		errors: proofErrors,
		enhance: proofEnhance,
		delayed: proofDelayed,
		allErrors: proofAllErrors,
		message: proofMessage
	} = superForm(
		untrack(() => data.proofForm),
		{
			id: 'stat-proof',
			onUpdated: ({ form }) => {
				if (form.valid && form.message?.type === 'success') proofOpen = false;
			}
		}
	);

	$effect(() => {
		if (!$proofMessage) return;
		if ($proofMessage.type === 'error') toast.error($proofMessage.text);
		else toast.success($proofMessage.text);
	});

	type ChannelRow = {
		id: number;
		platformId: number;
		handle: string;
		followers: number;
		engagementRate: number;
	};

	function openProof(account: ChannelRow) {
		proofAccount = {
			id: account.id,
			platform: platformName(account.platformId),
			handle: account.handle
		};
		/* Prefilled with what the channel says now: most proofs confirm the number
		   already there, and the creator corrects it if the screenshot differs. */
		$proofForm.socialAccountId = account.id;
		$proofForm.followers = account.followers;
		$proofForm.engagementRate = account.engagementRate > 0 ? account.engagementRate : undefined;
		proofOpen = true;
	}

	/** The newest proof sent for a channel, if any — the only one its row describes. */
	const proofOf = (accountId: number) => data.latestProof[accountId];

	const formatDate = (value: string | Date) =>
		new Date(value).toLocaleDateString(getLocale() === 'am' ? 'am-ET' : 'en-GB', {
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		});

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

			<StatSourceNote
				platform={platformName(account.platformId)}
				followersSource={account.followersSource}
				followersUpdatedAt={account.followersUpdatedAt}
				engagementSource={account.engagementSource}
				engagementUpdatedAt={account.engagementUpdatedAt}
				engagementRate={account.engagementRate}
			/>

			{#if proofOf(account.id)?.status === 'pending'}
				<p
					class="inline-flex items-center gap-1 rounded-md border border-warn-edge bg-warn-soft px-2 py-0.5 text-[10px] font-bold text-warn-fg"
				>
					<Clock class="h-3 w-3" />
					{m.ch_proof_pending({ date: formatDate(proofOf(account.id).createdAt) })}
				</p>
			{:else if account.followersSource !== 'platform'}
				{#if proofOf(account.id)?.status === 'rejected' && proofOf(account.id).adminNotes}
					<p class="rounded-lg bg-danger-soft p-2 text-[11px] font-medium text-danger-fg">
						<strong class="font-black">{m.ch_proof_rejected_note()}</strong>
						{proofOf(account.id).adminNotes}
					</p>
				{/if}
				<button
					type="button"
					onclick={() => openProof(account)}
					class="inline-flex items-center gap-1 rounded-lg border-2 border-edge bg-surface px-2.5 py-1 text-[11px] font-black text-ink hover:bg-well"
				>
					<ChartNoAxesColumnIncreasing class="h-3.5 w-3.5" />
					{m.ch_proof_button()}
				</button>
			{/if}

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

<Dialog.Root bind:open={proofOpen}>
	<Dialog.Content class="w-lg! max-w-[95vw]!">
		<Dialog.Header>
			<Dialog.Title class="text-base font-black">
				{m.ch_proof_title({ platform: proofAccount?.platform ?? '' })}
			</Dialog.Title>
			<Dialog.Description class="text-xs font-medium text-ink-soft">
				{m.ch_proof_description()}
			</Dialog.Description>
		</Dialog.Header>

		<form
			method="POST"
			action="?/proof"
			enctype="multipart/form-data"
			use:proofEnhance
			class="space-y-3 text-xs"
		>
			<Errors allErrors={$proofAllErrors} />
			<input type="hidden" name="socialAccountId" value={proofAccount?.id ?? ''} />

			<InputComp
				form={proofForm}
				errors={proofErrors}
				name="screenshot"
				type="file"
				label={m.ch_proof_screenshot()}
				placeholder={m.ch_proof_screenshot_hint()}
				required
			/>

			<div class="grid grid-cols-2 gap-2">
				<InputComp
					form={proofForm}
					errors={proofErrors}
					name="followers"
					type="number"
					min="1"
					label={m.ch_followers()}
					required
				/>
				<InputComp
					form={proofForm}
					errors={proofErrors}
					name="engagementRate"
					type="number"
					min="0"
					max="100"
					label={m.ch_engagement_rate()}
					placeholder={m.ch_proof_engagement_optional()}
				/>
			</div>

			<p class="text-[11px] font-medium text-ink-dim">{m.ch_proof_privacy()}</p>

			<button
				type="submit"
				disabled={$proofDelayed}
				class="w-full rounded-2xl border-2 border-edge bg-brand py-3 text-xs font-black text-brand-ink shadow-[3px_3px_0px_0px_rgb(var(--bento-shadow))] hover:bg-brand-strong disabled:opacity-60"
			>
				{#if $proofDelayed}
					<LoadingBtn name={m.bk_submitting()} />
				{:else}
					{m.bk_submit_for_review()}
				{/if}
			</button>
		</form>
	</Dialog.Content>
</Dialog.Root>
