<script lang="ts">
	import type { SubmitFunction } from '@sveltejs/kit';
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { toast } from 'svelte-sonner';
	import AppImage from '$lib/components/app-image.svelte';
	import PageHeader from '$lib/components/page-header.svelte';
	import PaginationBar from '$lib/components/pagination-bar.svelte';
	import SearchInput from '$lib/components/search-input.svelte';
	import { assetUrl } from '$lib/assets';
	import { withParams } from '$lib/query';
	import { formatAmountWithCode } from '$lib/domain/money';
	import { Banknote, Info, RefreshCw, ShieldCheck, TriangleAlert, Inbox } from '@lucide/svelte';
	import { payoutProblemLabel, payoutStatusLabel } from '$lib/domain/payout';
	import * as m from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';

	let { data } = $props();

	/* The queue is the landing view; `?view=history` is the other list. */
	const view = $derived(page.url.searchParams.get('view') === 'history' ? 'history' : 'owed');
	const viewLink = (next: string) => withParams(page.url, { view: next });

	const handle =
		(text: string): SubmitFunction =>
		() =>
		async ({ result, update }) => {
			if (result.type === 'failure') toast.error(result.data?.message ?? m.common_refused());
			else if (result.type === 'success') toast.success(text);
			await update();
		};

	const formatDate = (value: string | Date | null) =>
		value
			? new Date(value).toLocaleDateString(getLocale() === 'am' ? 'am-ET' : 'en-GB', {
					day: 'numeric',
					month: 'short',
					year: 'numeric'
				})
			: '—';

	const statusTone: Record<string, string> = {
		pending: 'border-info-edge bg-info-soft text-info-fg',
		queued: 'border-warn-edge bg-warn-soft text-warn-fg',
		success: 'border-brand-edge bg-brand-soft text-brand-soft-fg',
		failed: 'border-danger-edge bg-danger-soft text-danger-fg',
		cancelled: 'border-edge bg-panel text-ink-soft'
	};

	/**
	 * Why this row cannot be paid, or null when it can.
	 *
	 * The same tests as `payoutProblem` on the server, in the same order, minus
	 * the three the query already guarantees: every row here is a paid booking
	 * with released escrow and no live attempt against it. This decides what the
	 * button looks like; the server re-runs all of them and decides whether
	 * money leaves.
	 */
	const blockedBy = (row: (typeof data.owed)[number]) => {
		if (!row.accountId) return payoutProblemLabel('no_account');
		if (!row.accountVerified) return payoutProblemLabel('account_unverified');
		if (!data.supportedCurrencies.includes(row.currencyCode)) {
			return payoutProblemLabel('currency');
		}
		if (row.accountCurrency !== row.currencyCode) return payoutProblemLabel('currency_mismatch');
		return null;
	};
</script>

<svelte:head><title>{m.payo_admin_title()}</title></svelte:head>

<div class="space-y-6">
	<PageHeader
		eyebrow={m.dash_platform_operations()}
		title={m.payo_admin_title()}
		description={m.payo_admin_subtitle()}
	/>

	{#if !data.chapaEnabled}
		<p
			class="flex items-start gap-2 rounded-2xl border-2 border-danger-edge bg-danger-soft p-3 text-xs font-bold text-danger-fg"
		>
			<TriangleAlert class="mt-0.5 h-4 w-4 shrink-0" />
			{m.srv_payouts_unavailable()}
		</p>
	{/if}

	<!--
		Said once, at the top, rather than on every queued row.

		Sending is not the end of the operator's job: Chapa holds the transfer
		for an approval code on the merchant's registered device, and nothing in
		this app can see that happen. Without this line, a transfer that sat at
		"Sent to bank" for an hour would read as a bug rather than as something
		waiting on a person.
	-->
	<p
		class="flex items-start gap-2 rounded-2xl border-2 border-info-edge bg-info-soft p-3 text-xs font-medium text-info-fg"
	>
		<Info class="mt-0.5 h-4 w-4 shrink-0" />
		{m.payo_otp_hint()}
	</p>

	<div class="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
		<div class="flex flex-wrap items-center gap-2">
			{#each [{ key: 'owed', label: m.payo_tab_owed() }, { key: 'history', label: m.payo_tab_history() }] as tab (tab.key)}
				<a
					href={viewLink(tab.key)}
					class="rounded-full border-2 px-3 py-1.5 text-[11px] font-black tracking-wide uppercase {view ===
					tab.key
						? 'border-edge bg-brand text-brand-ink'
						: 'border-edge-soft bg-panel text-ink-soft hover:border-edge'}"
				>
					{tab.label}
					{#if tab.key === 'owed' && data.owedTotal}({data.owedTotal}){/if}
				</a>
			{/each}
		</div>
		{#if view === 'history'}
			<SearchInput value={data.history.state.search} class="sm:w-64" />
		{/if}
	</div>

	{#if view === 'owed'}
		<!-- ---------------------------------------------- owed -->
		{#if !data.owed.length}
			<div class="bento-card bento-card-static py-12 text-center">
				<Inbox class="mx-auto h-8 w-8 text-ink-soft" />
				<p class="mt-3 text-xs font-bold text-ink-soft">{m.payo_owed_empty()}</p>
			</div>
		{:else}
			{#if data.owedTotal > data.owed.length}
				<p class="text-[11px] font-bold text-ink-soft">
					{m.payo_owed_truncated({ shown: data.owed.length, total: data.owedTotal })}
				</p>
			{/if}
			<div class="space-y-3">
				{#each data.owed as row (row.id)}
					{@const blocked = blockedBy(row)}
					<div class="bento-card bento-card-static space-y-3">
						<div class="flex flex-wrap items-start justify-between gap-3">
							<div class="flex items-center gap-3">
								<AppImage
									src={assetUrl(row.creatorAvatar)}
									alt={row.creatorName ?? ''}
									class="h-10 w-10 rounded-full border-2 border-edge object-cover"
								/>
								<div>
									<p class="text-sm font-black text-ink">{row.creatorName}</p>
									<p class="text-[11px] font-medium text-ink-soft">
										{row.title} · {row.reference}
									</p>
								</div>
							</div>

							<div class="text-right">
								<span class="block text-[10px] font-black tracking-widest text-ink-soft uppercase">
									{m.payo_net()}
								</span>
								<p class="text-sm font-black text-ink">
									{formatAmountWithCode(row.creatorPayout, row.currencyCode)}
								</p>
								<p class="text-[10px] font-medium text-ink-soft">
									{m.payo_gross()}
									{formatAmountWithCode(row.price, row.currencyCode)} · {m.payo_fee()}
									{formatAmountWithCode(row.platformFee, row.currencyCode)}
								</p>
							</div>
						</div>

						<div
							class="flex flex-wrap items-center justify-between gap-3 border-t-2 border-edge-soft pt-3"
						>
							<div class="text-[11px] font-medium text-ink-soft">
								{#if row.accountId}
									{row.bankName} · {row.accountName} · {row.accountNumber}
								{:else}
									{m.payo_no_account_yet()}
								{/if}
								<span class="ml-1 opacity-70">
									· {m.payo_completed_on({ date: formatDate(row.completedAt) })}
								</span>
							</div>

							<div class="flex flex-wrap items-center gap-2">
								<!--
									Marking an account checked is its own form.
									A person confirms the name and number belong to the creator
									before any money can be sent to them; the send button below
									stays disabled until they have.
								-->
								{#if row.accountId}
									<form
										method="POST"
										action="?/verifyAccount"
										use:enhance={handle(m.payo_account_verified_toast())}
									>
										<input type="hidden" name="id" value={row.accountId} />
										<input
											type="hidden"
											name="isVerified"
											value={row.accountVerified ? 'false' : 'true'}
										/>
										<button
											type="submit"
											class="hover:bg-panel-strong inline-flex items-center gap-1 rounded-full border-2 border-edge bg-panel px-3 py-1.5 text-[11px] font-black text-ink"
										>
											<ShieldCheck class="h-3.5 w-3.5" />
											{row.accountVerified ? m.payo_unverify_account() : m.payo_verify_account()}
										</button>
									</form>
								{/if}

								{#if blocked}
									<span
										class="rounded-full border-2 border-warn-edge bg-warn-soft px-3 py-1.5 text-[11px] font-black text-warn-fg"
									>
										{blocked}
									</span>
								{:else}
									<form method="POST" action="?/send" use:enhance={handle(m.payo_sent_toast())}>
										<input type="hidden" name="bookingId" value={row.id} />
										<button
											type="submit"
											disabled={!data.chapaEnabled}
											class="inline-flex items-center gap-1 rounded-full border-2 border-edge bg-brand px-4 py-1.5 text-[11px] font-black text-brand-ink shadow-[3px_3px_0px_0px_rgb(var(--bento-shadow))] hover:bg-brand-strong disabled:opacity-60"
										>
											<Banknote class="h-3.5 w-3.5" />
											{m.payo_send()}
										</button>
									</form>
								{/if}
							</div>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	{:else}
		<!-- ---------------------------------------------- history -->
		{#if !data.history.rows.length}
			<div class="bento-card bento-card-static py-12 text-center">
				<Inbox class="mx-auto h-8 w-8 text-ink-soft" />
				<p class="mt-3 text-xs font-bold text-ink-soft">{m.payo_history_empty()}</p>
			</div>
		{:else}
			<div class="space-y-3">
				{#each data.history.rows as payout (payout.id)}
					<div class="bento-card bento-card-static space-y-2">
						<div class="flex flex-wrap items-start justify-between gap-3">
							<div>
								<p class="text-sm font-black text-ink">
									{payout.creatorName} · {formatAmountWithCode(payout.amount, payout.currencyCode)}
								</p>
								<p class="text-[11px] font-medium text-ink-soft">
									{payout.bookingTitle} · {payout.bookingReference}
								</p>
							</div>
							<div class="flex items-center gap-2">
								{#if payout.mode === 'test'}
									<span
										class="rounded-full border-2 border-edge-soft bg-panel px-2 py-0.5 text-[10px] font-black tracking-wide text-ink-soft uppercase"
									>
										{m.payo_test_mode()}
									</span>
								{/if}
								<span
									class="rounded-full border-2 px-2 py-0.5 text-[10px] font-black tracking-wide uppercase {statusTone[
										payout.status
									] ?? 'border-edge bg-panel text-ink-soft'}"
								>
									{payoutStatusLabel(payout.status)}
								</span>
							</div>
						</div>

						<div class="flex flex-wrap items-center justify-between gap-3">
							<div class="space-y-0.5 text-[11px] font-medium text-ink-soft">
								<p>{payout.bankName} · {payout.accountName} · {payout.accountNumber}</p>
								<p>
									{m.payo_reference()}: {payout.reference}
									{#if payout.providerRef}
										· {m.payo_provider_ref()}: {payout.providerRef}
									{/if}
								</p>
								<p>{m.payo_sent_on({ date: formatDate(payout.verifiedAt ?? payout.createdAt) })}</p>
								{#if payout.failureReason}
									<p class="font-bold text-danger-fg">{payout.failureReason}</p>
								{/if}
							</div>

							<!--
								Only an unresolved transfer can be asked about. A settled one
								has an answer already, and re-asking would spend a provider
								call to learn nothing.
							-->
							{#if payout.status === 'queued' || payout.status === 'pending'}
								<form method="POST" action="?/refresh" use:enhance={handle(m.payo_refreshed())}>
									<input type="hidden" name="id" value={payout.id} />
									<button
										type="submit"
										class="hover:bg-panel-strong inline-flex items-center gap-1 rounded-full border-2 border-edge bg-panel px-3 py-1.5 text-[11px] font-black text-ink"
									>
										<RefreshCw class="h-3.5 w-3.5" />
										{m.payo_refresh()}
									</button>
								</form>
							{/if}
						</div>
					</div>
				{/each}
			</div>

			<PaginationBar result={data.history} />
		{/if}
	{/if}
</div>
