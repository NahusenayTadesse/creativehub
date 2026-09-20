<script lang="ts">
	import { untrack } from 'svelte';
	import { superForm } from 'sveltekit-superforms';
	import { toast } from 'svelte-sonner';
	import CrudSection from '$lib/components/crud-section.svelte';
	import StatSourceNote from '$lib/components/stat-source-note.svelte';
	import OwnershipPanel from '$lib/components/ownership-panel.svelte';
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
		ChartNoAxesColumnIncreasing,
		Link2,
		Link2Off,
		Plug
	} from '@lucide/svelte';
	import { enhance as plainEnhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { page } from '$app/state';
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

	/* ---------------------------------------------------------------- *
	 * Connecting a channel to TikTok
	 * ---------------------------------------------------------------- */

	/** This channel's TikTok grant, if the creator has given one. */
	const connectionOf = (accountId: number) => data.connected[accountId];

	/**
	 * A grant that has stopped working.
	 *
	 * `lastSyncDetail` is whatever the last refresh got back. Only the endings
	 * the creator can do something about are called out — a token that cannot be
	 * renewed, a scope that was never granted, the account being swapped — and
	 * everything else is left silent, because a transient 5xx overnight is not
	 * something to greet somebody with.
	 */
	const DEAD_GRANT = [
		'invalid_grant',
		'refresh_expired',
		'no_refresh_token',
		'account_changed',
		'scope_not_granted',
		'access_token_invalid',
		'scope_not_authorized',
		'unauthorised'
	];
	const needsReconnect = (accountId: number) => {
		const detail = connectionOf(accountId)?.lastSyncDetail;
		return detail ? DEAD_GRANT.includes(detail) : false;
	};

	const isTikTok = (platformId: number) =>
		platformName(platformId).trim().toLowerCase() === 'tiktok';

	/*
	 * The round trip through TikTok ends on this page with `?connected=`, which
	 * is the only way the callback can say anything: it is a redirect, so it has
	 * no form and no message store to put a sentence in. Read once per
	 * navigation, like the OAuth notices on the login page, or every reactive
	 * update would re-toast it.
	 */
	const CONNECT_OUTCOMES: Record<string, { ok: boolean; text: () => string }> = {
		ok: { ok: true, text: m.tt_ok },
		declined: { ok: false, text: m.tt_declined },
		expired: { ok: false, text: m.tt_expired },
		mismatch: { ok: false, text: m.tt_mismatch },
		unconfigured: { ok: false, text: m.tt_unconfigured },
		no_channel: { ok: false, text: m.tt_no_channel },
		exchange_failed: { ok: false, text: m.tt_exchange_failed },
		profile_failed: { ok: false, text: m.tt_profile_failed },
		no_stats_scope: { ok: false, text: m.tt_no_stats_scope },
		handle_mismatch: { ok: false, text: m.tt_handle_mismatch }
	};

	$effect(() => {
		const outcome = CONNECT_OUTCOMES[page.url.searchParams.get('connected') ?? ''];
		if (!outcome) return;
		untrack(() => (outcome.ok ? toast.success(outcome.text()) : toast.error(outcome.text())));
	});

	const disconnected: SubmitFunction =
		() =>
		async ({ result, update }) => {
			if (result.type === 'failure') toast.error(result.data?.message ?? m.common_refused());
			else if (result.type === 'success') toast.success(m.tt_disconnected());
			await update();
		};

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
			type: 'boxSelect',
			required: true,
			items: data.platforms.map((p) => ({
				value: p.id,
				name: p.name,
				glyph: p.name,
				color: p.color
			}))
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

			{#if !connectionOf(account.id)}
				<!--
					Proving the handle is theirs, by writing a code we gave them into
					the bio. Hidden once TikTok has been connected: that grant proves
					the same thing more strongly and already refreshes the figures, so
					offering both would be asking twice for one answer.
				-->
				<OwnershipPanel
					account={{
						id: account.id,
						platform: platformName(account.platformId),
						followers: account.followers,
						ownershipStatus: account.ownershipStatus,
						ownershipCode: account.ownershipCode,
						ownershipVerifiedAt: account.ownershipVerifiedAt
					}}
				/>
			{/if}

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

			{#if data.tiktokEnabled && isTikTok(account.platformId)}
				{@const connection = connectionOf(account.id)}
				<!--
					The one platform on this site whose real numbers the creator can
					switch on themselves. TikTok tells an anonymous server nothing
					about how big an account is; it tells the account's owner
					everything, so the owner grants us the read once and the hourly
					refresh takes it from there.
				-->
				<div class="space-y-2 rounded-xl border-2 border-edge-soft bg-panel p-3">
					{#if connection}
						<div class="flex flex-wrap items-center justify-between gap-2">
							<span
								class="inline-flex items-center gap-1.5 text-[11px] font-black text-brand-soft-fg"
							>
								<Link2 class="h-3.5 w-3.5" />
								<!-- The @ travels in the value, not the message: paraglide's
								     generated JSDoc reads a literal `@{` as a tag and will not
								     compile. -->
								{connection.username
									? m.tt_connected_as({ username: `@${connection.username}` })
									: m.tt_connected()}
							</span>

							<form method="POST" action="?/disconnect" use:plainEnhance={disconnected}>
								<input type="hidden" name="socialAccountId" value={account.id} />
								<button
									type="submit"
									class="inline-flex items-center gap-1 rounded-lg border-2 border-edge bg-surface px-2.5 py-1 text-[11px] font-black text-danger-fg hover:bg-danger-soft"
								>
									<Link2Off class="h-3.5 w-3.5" />
									{m.tt_disconnect()}
								</button>
							</form>
						</div>

						{#if needsReconnect(account.id)}
							<p
								class="flex items-start gap-1.5 rounded-lg border border-warn-edge bg-warn-soft p-2 text-[11px] font-bold text-warn-fg"
							>
								<CircleAlert class="mt-px h-3.5 w-3.5 shrink-0" />
								{m.tt_needs_reconnect()}
							</p>
							<form method="POST" action={resolve('/dashboard/channels/connect/tiktok')}>
								<input type="hidden" name="socialAccountId" value={account.id} />
								<button
									type="submit"
									class="inline-flex items-center gap-1 rounded-lg border-2 border-edge bg-brand px-2.5 py-1 text-[11px] font-black text-brand-ink hover:bg-brand-strong"
								>
									<Plug class="h-3.5 w-3.5" />
									{m.tt_reconnect()}
								</button>
							</form>
						{/if}
					{:else}
						<p class="text-[11px] font-medium text-ink-soft">{m.tt_connect_hint()}</p>
						<!-- A form post, not a link: the origin check that adapter-node
						     applies to posts is what keeps another site from starting
						     an authorisation the creator never asked for. -->
						<form method="POST" action={resolve('/dashboard/channels/connect/tiktok')}>
							<input type="hidden" name="socialAccountId" value={account.id} />
							<button
								type="submit"
								class="inline-flex items-center gap-1 rounded-lg border-2 border-edge bg-brand px-2.5 py-1 text-[11px] font-black text-brand-ink hover:bg-brand-strong"
							>
								<Plug class="h-3.5 w-3.5" />
								{m.tt_connect()}
							</button>
						</form>
					{/if}
				</div>
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

			<!--
				The camera, not the picker. A creator proving their figures is looking
				at an analytics screen — often on a second phone, or on a laptop beside
				them — and the shot they need does not exist yet.
			-->
			<InputComp
				form={proofForm}
				errors={proofErrors}
				name="screenshot"
				type="file"
				capture="environment"
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
