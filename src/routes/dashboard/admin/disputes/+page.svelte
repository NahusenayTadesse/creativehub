<script lang="ts">
	import type { SubmitFunction } from '@sveltejs/kit';
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { toast } from 'svelte-sonner';
	import PageHeader from '$lib/components/page-header.svelte';
	import InputComp from '$lib/formComponents/InputComp.svelte';
	import { withParams } from '$lib/query';
	import { formatAmountWithCode } from '$lib/domain/money';
	import { escrowLabel, statusLabel } from '$lib/domain/booking';
	import { disputeResolutionLabel, resolutionAmounts, splitIsValid } from '$lib/domain/dispute';
	import { Gavel, ExternalLink, Inbox, RefreshCw, TriangleAlert } from '@lucide/svelte';
	import * as m from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';

	let { data } = $props();

	const viewLink = (next: string) => withParams(page.url, { view: next });

	/* One draft per case, so opening a second does not overwrite the first. */
	let drafts = $state<Record<number, { resolution: string; refund: string; note: string }>>({});
	const draftFor = (id: number) =>
		(drafts[id] ??= { resolution: 'released', refund: '', note: '' });

	const handle =
		(text: string): SubmitFunction =>
		() =>
		async ({ result, update }) => {
			if (result.type === 'failure') toast.error(result.data?.message ?? m.common_refused());
			else if (result.type === 'success') {
				/* A resolution whose refund was refused is still a resolution — the
				   decision stuck, and only the money needs another go. */
				const refundError = result.data?.refundError as string | undefined;
				if (refundError) toast.warning(refundError);
				else toast.success(text);
			}
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

	const sideLabel = (side: string) =>
		side === 'creator' ? m.dsp_side_creator() : m.dsp_side_organization();

	const refundStatusLabel = (status: string) =>
		({
			pending: m.rf_status_pending(),
			queued: m.rf_status_queued(),
			success: m.rf_status_success(),
			failed: m.rf_status_failed(),
			cancelled: m.rf_status_cancelled()
		})[status] ?? status;

	const resolutionItems = () => [
		{ value: 'released', name: m.dsp_resolution_released() },
		{ value: 'refunded', name: m.dsp_resolution_refunded() },
		{ value: 'split', name: m.dsp_resolution_split() }
	];
</script>

<svelte:head><title>{m.dsp_admin_title()}</title></svelte:head>

<div class="space-y-6">
	<PageHeader
		eyebrow={m.dash_platform_operations()}
		title={m.dsp_admin_title()}
		description={m.dsp_admin_subtitle()}
	/>

	<div class="flex flex-wrap items-center gap-2">
		{#each [{ key: 'open', label: m.dsp_tab_open() }, { key: 'all', label: m.dsp_tab_all() }] as tab (tab.key)}
			<a
				href={viewLink(tab.key)}
				class="rounded-full border-2 px-3 py-1.5 text-[11px] font-black tracking-wide uppercase {(data.openOnly
					? 'open'
					: 'all') === tab.key
					? 'border-edge bg-brand text-brand-ink'
					: 'border-edge-soft bg-panel text-ink-soft hover:border-edge'}"
			>
				{tab.label}
				{#if tab.key === 'open' && data.openOnly && data.cases.length}({data.cases.length}){/if}
			</a>
		{/each}
	</div>

	{#if !data.cases.length}
		<div class="bento-card bento-card-static py-12 text-center">
			<Inbox class="mx-auto h-8 w-8 text-ink-soft" />
			<p class="mt-3 text-xs font-bold text-ink-soft">
				{data.openOnly ? m.dsp_queue_empty() : m.dsp_all_empty()}
			</p>
		</div>
	{:else}
		<div class="space-y-4">
			{#each data.cases as c (c.id)}
				{@const draft = draftFor(c.id)}
				{@const refundInput = Number(draft.refund || 0)}
				{@const amounts = resolutionAmounts(
					c.price ?? 0,
					data.feePercent,
					draft.resolution as 'released' | 'refunded' | 'split',
					refundInput
				)}
				<div class="bento-card bento-card-static space-y-4">
					<!-- Which deal, and where its money currently sits. -->
					<div class="flex flex-wrap items-start justify-between gap-3">
						<div class="min-w-0">
							<p class="flex items-center gap-2 text-sm font-black text-ink">
								<Gavel class="h-4 w-4 shrink-0" />
								{c.bookingTitle}
							</p>
							<p class="text-[11px] font-medium text-ink-soft">
								{c.bookingReference} · {c.creatorName} · {c.organizationName}
							</p>
							<p class="mt-1 text-[11px] font-medium text-ink-soft">
								{m.dsp_raised_on({
									date: formatDate(c.createdAt),
									side: sideLabel(c.raisedBySide)
								})}
								·
								{m.dsp_escrow_note({
									escrow: escrowLabel(c.escrowStatus ?? ''),
									status: statusLabel(c.bookingStatus ?? '')
								})}
							</p>
						</div>
						<p class="text-right text-sm font-black text-ink">
							{formatAmountWithCode(c.price ?? 0, c.currencyCode ?? 'ETB')}
						</p>
					</div>

					<!--
						The creator already has the money.

						Shown before the decision rather than after it, because it changes
						what the decision costs: a refund still works, but it comes out of
						the platform's balance and nothing here can recover it.
					-->
					{#if c.afterPayout}
						<p
							class="flex items-start gap-2 rounded-2xl border-2 border-danger-edge bg-danger-soft p-3 text-xs font-bold text-danger-fg"
						>
							<TriangleAlert class="mt-0.5 h-4 w-4 shrink-0" />
							{m.dsp_after_payout_warning()}
						</p>
					{/if}

					<!-- Both statements, side by side. -->
					<div class="grid gap-3 sm:grid-cols-2">
						<div class="rounded-2xl border-2 border-edge-soft bg-panel p-3">
							<p class="text-[10px] font-black tracking-widest text-ink-soft uppercase">
								{sideLabel(c.raisedBySide)}
							</p>
							<p class="mt-1 text-xs whitespace-pre-line text-ink">{c.reason}</p>
							{#if c.evidenceUrl}
								<a
									href={c.evidenceUrl}
									rel="noopener noreferrer nofollow"
									target="_blank"
									class="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-ink-soft underline"
								>
									<ExternalLink class="h-3 w-3" />{m.dsp_evidence_link()}
								</a>
							{/if}
						</div>

						<div class="rounded-2xl border-2 border-edge-soft bg-panel p-3">
							<p class="text-[10px] font-black tracking-widest text-ink-soft uppercase">
								{sideLabel(c.raisedBySide === 'creator' ? 'organization' : 'creator')}
							</p>
							{#if c.responseText}
								<p class="mt-1 text-xs whitespace-pre-line text-ink">{c.responseText}</p>
								{#if c.responseEvidenceUrl}
									<a
										href={c.responseEvidenceUrl}
										rel="noopener noreferrer nofollow"
										target="_blank"
										class="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-ink-soft underline"
									>
										<ExternalLink class="h-3 w-3" />{m.dsp_evidence_link()}
									</a>
								{/if}
							{:else}
								<p class="mt-1 text-xs font-medium text-ink-soft">{m.dsp_no_answer_yet()}</p>
							{/if}
						</div>
					</div>

					<!--
						What the decision actually did to the money.

						A resolved case is only half an answer while its refund is still
						in flight, and Chapa settles those on its own schedule — so the
						attempts are listed with the same "Ask Chapa" the payout queue
						uses, rather than leaving an operator to wonder.
					-->
					{#if data.refundsByBooking[c.bookingId]?.length}
						<div class="space-y-2 border-t-2 border-edge-soft pt-3">
							<p class="text-[10px] font-black tracking-widest text-ink-soft uppercase">
								{m.rf_heading()}
							</p>
							{#each data.refundsByBooking[c.bookingId] as refund (refund.id)}
								<div class="flex flex-wrap items-center justify-between gap-2">
									<div class="text-[11px] font-medium text-ink-soft">
										<p class="font-black text-ink">
											{formatAmountWithCode(refund.amount, refund.currencyCode)} ·
											{refundStatusLabel(refund.status)}
										</p>
										<p>
											{m.rf_reference()}: {refund.reference}
											{#if refund.providerRef}
												· {m.rf_provider_ref()}: {refund.providerRef}
											{/if}
										</p>
										{#if refund.failureReason}
											<p class="font-bold text-danger-fg">{refund.failureReason}</p>
										{/if}
									</div>

									{#if refund.status === 'queued' || refund.status === 'pending'}
										<form
											method="POST"
											action="?/refreshRefund"
											use:enhance={handle(m.rf_refreshed())}
										>
											<input type="hidden" name="id" value={refund.id} />
											<button
												type="submit"
												class="hover:bg-panel-strong inline-flex items-center gap-1 rounded-full border-2 border-edge bg-panel px-3 py-1.5 text-[11px] font-black text-ink"
											>
												<RefreshCw class="h-3.5 w-3.5" />
												{m.rf_refresh()}
											</button>
										</form>
									{/if}
								</div>
							{/each}
						</div>
					{/if}

					{#if c.status === 'open'}
						<!-- The decision. -->
						<form
							method="POST"
							action="?/resolve"
							use:enhance={handle(m.dsp_resolved_toast())}
							class="space-y-3 border-t-2 border-edge-soft pt-4"
						>
							<input type="hidden" name="id" value={c.id} />
							<p class="text-[10px] font-black tracking-widest text-ink-soft uppercase">
								{m.dsp_resolve_heading()}
							</p>

							<div class="grid gap-3 sm:grid-cols-2">
								<InputComp
									label={m.dsp_resolution_field()}
									name="resolution"
									type="select"
									items={resolutionItems()}
									bind:value={draft.resolution}
									required
								/>

								{#if draft.resolution === 'split'}
									<InputComp
										label={m.dsp_refund_amount()}
										name="refundAmount"
										type="number"
										min={1}
										max={(c.price ?? 1) - 1}
										hint={m.dsp_refund_amount_hint()}
										bind:value={draft.refund}
										required
									/>
								{/if}
							</div>

							<InputComp
								label={m.dsp_resolution_note_field()}
								name="note"
								type="textarea"
								rows={3}
								hint={m.dsp_resolution_note_hint()}
								bind:value={draft.note}
							/>

							<!-- What pressing the button will actually do to the money. -->
							<p
								class="rounded-2xl border-2 border-edge-soft bg-panel p-3 text-xs font-bold text-ink"
							>
								{m.dsp_preview({
									refund: formatAmountWithCode(amounts.refund, c.currencyCode ?? 'ETB'),
									fee: formatAmountWithCode(amounts.platformFee, c.currencyCode ?? 'ETB'),
									payout: formatAmountWithCode(amounts.payout, c.currencyCode ?? 'ETB')
								})}
							</p>

							{#if c.escrowStatus === 'unfunded' && amounts.refund > 0}
								<p class="text-[11px] font-bold text-warn-fg">{m.dsp_unfunded_note()}</p>
							{:else if amounts.refund > 0}
								<p class="text-[11px] font-medium text-ink-soft">{m.rf_fee_note()}</p>
							{/if}

							<button
								type="submit"
								disabled={draft.resolution === 'split' && !splitIsValid(c.price ?? 0, refundInput)}
								class="rounded-xl border-2 border-edge bg-brand px-4 py-2 text-xs font-black text-brand-ink shadow-[2px_2px_0px_0px_rgb(var(--bento-shadow))] hover:bg-brand-strong disabled:opacity-50"
							>
								{m.dsp_resolve_submit()}
							</button>
						</form>
					{:else}
						<div class="border-t-2 border-edge-soft pt-3">
							<p class="text-xs font-black text-ink">
								{disputeResolutionLabel(c.resolution ?? '')} · {formatDate(c.resolvedAt)}
							</p>
							{#if c.resolutionNote}
								<p class="mt-1 text-[11px] font-medium text-ink-soft">{c.resolutionNote}</p>
							{/if}
							<p class="mt-1 text-[11px] font-medium text-ink-soft">
								{m.dsp_preview({
									refund: formatAmountWithCode(c.refundAmount, c.currencyCode ?? 'ETB'),
									fee: formatAmountWithCode(
										(c.price ?? 0) - c.refundAmount - c.payoutAmount,
										c.currencyCode ?? 'ETB'
									),
									payout: formatAmountWithCode(c.payoutAmount, c.currencyCode ?? 'ETB')
								})}
							</p>
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>
