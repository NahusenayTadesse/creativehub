<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { superForm, type SuperValidated } from 'sveltekit-superforms';
	import { toast } from 'svelte-sonner';
	import {
		BarChart3,
		EyeOff,
		FileSignature,
		FileText,
		Fingerprint,
		Lightbulb,
		Radio,
		Receipt
	} from '@lucide/svelte';
	import InputComp from '$lib/formComponents/InputComp.svelte';
	import Errors from '$lib/formComponents/Errors.svelte';
	import LoadingBtn from '$lib/formComponents/LoadingBtn.svelte';
	import { assetUrl } from '$lib/assets';
	import { formatAmountWithCode } from '$lib/domain/money';
	import { CHECKPOINTS, checkpointIsOpen, checkpointOpensAt } from '$lib/domain/proof';
	import * as m from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';

	/**
	 * The managed half of a deal: what happens between agreed terms and a
	 * completed booking, beyond the negotiation the page already draws.
	 *
	 *   the NDA        a creator sees who the brand is before responding
	 *   what it costs  the fee breakdown each side is entitled to see
	 *   the contract   generated from the frozen terms, signed by both
	 *   the concept    approved by the brand before production begins
	 *   the proof      the live post, and its figures at 24h, 7d and 30d
	 *   documents      the invoice and certificates the platform issued
	 *
	 * Every button here is drawn from state the server decided, and every
	 * action re-checks it; this component only arranges what is allowed.
	 */

	type Side = 'admin' | 'organization' | 'creator';

	/* The page's data, narrowed to what this reads. */
	let {
		data
	}: {
		data: {
			side: Side;
			canSeeBrand: boolean;
			canApproveConcept: boolean;
			awaitsDeposit: boolean;
			identityRequired: boolean;
			booking: {
				id: number;
				status: string;
				compensationType: string;
				currencyCode: string;
				price: number;
				platformFee: number;
				creatorPayout: number;
				commissionPercent: number;
				brandServiceFee: number;
				brandServiceFeeVat: number;
				brandTotal: number;
				withholdingTax: number;
				organizationName: string;
				creatorName: string;
				termsFrozenAt: string | Date | null;
			};
			contract: {
				id: number;
				reference: string;
				version: number;
				status: string;
				body: string;
				bodyHash: string;
				brandSignerName: string | null;
				brandSignedAt: string | Date | null;
				creatorSignerName: string | null;
				creatorSignedAt: string | Date | null;
				signedAt: string | Date | null;
			} | null;
			concepts: {
				id: number;
				body: string;
				attachment: string | null;
				status: string;
				reviewNote: string | null;
				createdAt: string | Date;
			}[];
			proof: {
				liveUrl: string;
				screenshot: string;
				postedAt: string | Date;
				notes: string | null;
			} | null;
			metrics: {
				checkpoint: string;
				views: number | null;
				likes: number | null;
				comments: number | null;
				shares: number | null;
				saves: number | null;
				reach: number | null;
				screenshot: string;
				capturedAt: string | Date;
			}[];
			documents: {
				number: string;
				kind: string;
				total: number;
				currencyCode: string;
				issuedAt: string | Date;
			}[];
			/* eslint-disable @typescript-eslint/no-explicit-any -- each form's shape
			   is its schema's, checked where the schema is defined. */
			signForm: SuperValidated<any>;
			conceptForm: SuperValidated<any>;
			proofForm: SuperValidated<any>;
			metricsForm: SuperValidated<any>;
			/* eslint-enable @typescript-eslint/no-explicit-any */
		};
	} = $props();

	const booking = $derived(data.booking);
	const isCreator = $derived(data.side === 'creator');
	const isBrand = $derived(data.side === 'organization');
	const isOperator = $derived(data.side === 'admin');
	const money = (amount: number) => formatAmountWithCode(amount, booking.currencyCode);

	const dateLocale = $derived(getLocale() === 'am' ? 'am-ET' : 'en-GB');
	const formatDateTime = (value: string | Date | null) =>
		value
			? new Date(value).toLocaleString(dateLocale, {
					day: 'numeric',
					month: 'short',
					year: 'numeric',
					hour: '2-digit',
					minute: '2-digit'
				})
			: '—';

	const announce = (msg: { type: string; text: string } | undefined) => {
		if (!msg) return;
		if (msg.type === 'error') toast.error(msg.text);
		else toast.success(msg.text);
	};

	const actionEnhance =
		(successText: string): SubmitFunction =>
		() =>
		async ({ result, update }) => {
			if (result.type === 'failure') toast.error(result.data?.message ?? m.bk_action_refused());
			else if (result.type === 'success') toast.success(successText);
			await update();
		};

	/* ---------------- the forms ---------------- */

	const sign = superForm(
		untrack(() => data.signForm),
		{ id: 'sign', resetForm: false, invalidateAll: true }
	);
	const {
		form: signForm,
		errors: signErrors,
		enhance: signEnhance,
		delayed: signDelayed,
		allErrors: signAll,
		message: signMessage
	} = sign;

	const concept = superForm(
		untrack(() => data.conceptForm),
		{ id: 'concept', resetForm: true, invalidateAll: true }
	);
	const {
		form: conceptForm,
		errors: conceptErrors,
		enhance: conceptEnhance,
		delayed: conceptDelayed,
		allErrors: conceptAll,
		message: conceptMessage
	} = concept;

	const proof = superForm(
		untrack(() => data.proofForm),
		{ id: 'proof', resetForm: true, invalidateAll: true }
	);
	const {
		form: proofForm,
		errors: proofErrors,
		enhance: proofEnhance,
		delayed: proofDelayed,
		allErrors: proofAll,
		message: proofMessage
	} = proof;

	const metrics = superForm(
		untrack(() => data.metricsForm),
		{ id: 'metrics', resetForm: true, invalidateAll: true }
	);
	const {
		form: metricsForm,
		errors: metricsErrors,
		enhance: metricsEnhance,
		delayed: metricsDelayed,
		allErrors: metricsAll,
		message: metricsMessage
	} = metrics;

	$effect(() => announce($signMessage));
	$effect(() => announce($conceptMessage));
	$effect(() => announce($proofMessage));
	$effect(() => announce($metricsMessage));

	/* ---------------- what each stage shows ---------------- */

	const contract = $derived(data.contract);
	const iSigned = $derived(
		Boolean(
			contract && (isCreator ? contract.creatorSignedAt : isBrand ? contract.brandSignedAt : false)
		)
	);
	const canSign = $derived(
		booking.status === 'contracting' &&
			contract?.status === 'awaiting_signatures' &&
			(isCreator || isBrand) &&
			!iSigned
	);

	const latestConcept = $derived(data.concepts[0] ?? null);
	const canSubmitConcept = $derived(isCreator && booking.status === 'booked');
	const conceptUnderReview = $derived(
		booking.status === 'concept' && latestConcept?.status === 'submitted' ? latestConcept : null
	);
	let conceptNote = $state('');

	const canSubmitProof = $derived(isCreator && booking.status === 'approved' && !data.proof);
	const recorded = $derived(new Set(data.metrics.map((row) => row.checkpoint)));
	const openCheckpoints = $derived(
		data.proof
			? CHECKPOINTS.filter(
					(cp) => !recorded.has(cp) && checkpointIsOpen(new Date(data.proof!.postedAt), cp)
				)
			: []
	);
	const checkpointItems = $derived(
		openCheckpoints.map((cp) => ({ value: cp, name: checkpointLabel(cp) }))
	);
	$effect(() => {
		/* The picker starts on the earliest open checkpoint. */
		const first = openCheckpoints[0];
		if (first && !openCheckpoints.includes($metricsForm.checkpoint))
			$metricsForm.checkpoint = first;
	});

	function checkpointLabel(cp: string) {
		return cp === '24h' ? m.pr_cp_24h() : cp === '7d' ? m.pr_cp_7d() : m.pr_cp_30d();
	}

	const documentLabel = (kind: string) =>
		kind === 'brand_invoice'
			? m.doc_brand_invoice()
			: kind === 'creator_statement'
				? m.doc_creator_statement()
				: m.doc_withholding_certificate();

	const paid = $derived(booking.compensationType === 'paid' && booking.price > 0);

	/* What the deal is waiting on, and whose move it is — said once, above the stages. */
	const nextStep = $derived.by(() => {
		switch (booking.status) {
			case 'contracting':
				return iSigned ? m.md_next_other_signature() : m.md_next_sign();
			case 'booked':
				return isCreator ? m.md_next_concept_creator() : m.md_next_concept_brand();
			case 'concept':
				if (isCreator) return m.md_next_concept_waiting();
				return data.awaitsDeposit ? m.md_next_funds_first() : m.md_next_concept_review();
			case 'approved':
				return isCreator ? m.md_next_publish() : m.md_next_publish_brand();
			case 'awaiting_settlement':
				return isCreator ? m.md_next_settle_creator() : m.md_next_settle_brand();
			default:
				return '';
		}
	});

	const cardTitle = 'flex items-center gap-1.5 text-sm font-black text-ink';
	const primaryButton =
		'inline-flex items-center gap-1.5 rounded-xl border-2 border-edge bg-brand px-4 py-2 text-xs font-black text-brand-ink shadow-[2px_2px_0px_0px_rgb(var(--bento-shadow))] hover:bg-brand-strong disabled:opacity-60';
	const secondaryButton =
		'inline-flex items-center gap-1.5 rounded-xl border-2 border-edge bg-surface px-4 py-2 text-xs font-black text-ink shadow-[2px_2px_0px_0px_rgb(var(--bento-shadow))] hover:bg-panel';
</script>

<!-- ===== The NDA, for a creator who has not yet seen who the brand is ===== -->
{#if isCreator && !data.canSeeBrand}
	<div class="bento-card bento-card-static space-y-3 border-warn-edge">
		<h2 class={cardTitle}>
			<EyeOff class="h-4 w-4 text-warn-fg" />
			{m.nda_title()}
		</h2>
		<p class="text-xs leading-relaxed font-medium text-ink-soft">{m.nda_body()}</p>
		<ul class="list-disc space-y-1 ps-5 text-[11px] font-medium text-ink-soft">
			<li>{m.nda_point_private()}</li>
			<li>{m.nda_point_no_share()}</li>
			<li>{m.nda_point_platform()}</li>
		</ul>
		<form method="POST" action="?/acceptNda" use:enhance={actionEnhance(m.nda_accepted_toast())}>
			<button type="submit" class={primaryButton}>{m.nda_accept()}</button>
		</form>
	</div>
{/if}

{#if nextStep}
	<p
		class="rounded-2xl border-2 border-info-edge bg-info-soft px-4 py-3 text-xs font-bold text-info-fg"
		role="status"
	>
		{nextStep}
	</p>
{/if}

<!-- ===== What it costs, for the side it concerns ===== -->
{#if paid && booking.termsFrozenAt}
	<div class="bento-card bento-card-static space-y-3">
		<h2 class={cardTitle}>
			<Receipt class="h-4 w-4 text-brand-fg" />
			{m.md_money_title()}
		</h2>
		<dl class="space-y-1.5 text-xs">
			<div class="flex justify-between gap-3">
				<dt class="text-ink-soft">{m.md_campaign_fee()}</dt>
				<dd class="font-black text-ink tabular-nums">{money(booking.price)}</dd>
			</div>
			{#if isBrand || isOperator}
				<div class="flex justify-between gap-3">
					<dt class="text-ink-soft">{m.md_service_fee()}</dt>
					<dd class="font-bold text-ink tabular-nums">{money(booking.brandServiceFee)}</dd>
				</div>
				{#if booking.brandServiceFeeVat}
					<div class="flex justify-between gap-3">
						<dt class="text-ink-soft">{m.md_service_fee_vat()}</dt>
						<dd class="font-bold text-ink tabular-nums">{money(booking.brandServiceFeeVat)}</dd>
					</div>
				{/if}
				<div class="flex justify-between gap-3 border-t-2 border-edge-soft pt-1.5">
					<dt class="font-black text-ink">{m.md_brand_total()}</dt>
					<dd class="font-black text-ink tabular-nums">
						{money(booking.brandTotal || booking.price)}
					</dd>
				</div>
			{/if}
			{#if isCreator || isOperator}
				<div class="flex justify-between gap-3">
					<dt class="text-ink-soft">
						{m.md_commission({ percent: String(booking.commissionPercent) })}
					</dt>
					<dd class="font-bold text-ink tabular-nums">− {money(booking.platformFee)}</dd>
				</div>
				{#if booking.withholdingTax}
					<div class="flex justify-between gap-3">
						<dt class="text-ink-soft">{m.md_withholding()}</dt>
						<dd class="font-bold text-ink tabular-nums">− {money(booking.withholdingTax)}</dd>
					</div>
				{/if}
				<div class="flex justify-between gap-3 border-t-2 border-edge-soft pt-1.5">
					<dt class="font-black text-ink">{m.md_creator_receives()}</dt>
					<dd class="font-black text-ink tabular-nums">
						{money(booking.creatorPayout - booking.withholdingTax)}
					</dd>
				</div>
			{/if}
		</dl>
		<p class="text-[10px] font-medium text-ink-dim">{m.md_money_note()}</p>
	</div>
{/if}

<!-- ===== The contract ===== -->
{#if contract}
	<div class="bento-card bento-card-static space-y-4" id="contract">
		<div class="flex flex-wrap items-center justify-between gap-2 border-b-2 border-edge pb-3">
			<h2 class={cardTitle}>
				<FileSignature class="h-4 w-4 text-brand-fg" />
				{m.ct_title()}
			</h2>
			<a
				href={resolve(`/dashboard/bookings/${booking.id}/contract`)}
				target="_blank"
				rel="noopener"
				class="text-[11px] font-black text-brand-soft-fg underline underline-offset-2"
			>
				{m.ct_open_printable()}
			</a>
		</div>

		<div class="grid gap-2 text-[11px] sm:grid-cols-2">
			<div class="rounded-xl border-2 border-edge-soft bg-well p-3">
				<p class="font-black tracking-wider text-ink-dim uppercase">{m.ct_brand_signature()}</p>
				{#if contract.brandSignedAt}
					<p class="mt-1 font-bold text-ink">{contract.brandSignerName}</p>
					<p class="text-ink-dim">{formatDateTime(contract.brandSignedAt)}</p>
				{:else}
					<p class="mt-1 font-bold text-ink-soft">{m.ct_not_signed()}</p>
				{/if}
			</div>
			<div class="rounded-xl border-2 border-edge-soft bg-well p-3">
				<p class="font-black tracking-wider text-ink-dim uppercase">{m.ct_creator_signature()}</p>
				{#if contract.creatorSignedAt}
					<p class="mt-1 font-bold text-ink">{contract.creatorSignerName}</p>
					<p class="text-ink-dim">{formatDateTime(contract.creatorSignedAt)}</p>
				{:else}
					<p class="mt-1 font-bold text-ink-soft">{m.ct_not_signed()}</p>
				{/if}
			</div>
		</div>

		<details class="rounded-xl border-2 border-edge-soft" open={canSign}>
			<summary class="cursor-pointer px-3 py-2 text-xs font-black text-ink">
				{m.ct_read({ reference: contract.reference })}
			</summary>
			<pre
				class="max-h-96 overflow-y-auto border-t-2 border-edge-soft px-3 py-3 font-sans text-[11px] leading-relaxed whitespace-pre-wrap text-ink-soft">{contract.body}</pre>
			<p
				class="border-t-2 border-edge-soft px-3 py-2 font-mono text-[10px] break-all text-ink-faint"
			>
				SHA-256 {contract.bodyHash}
			</p>
		</details>

		{#if canSign}
			{#if data.identityRequired}
				<p class="flex items-center gap-2 text-xs font-bold text-warn-fg">
					<Fingerprint class="h-4 w-4 shrink-0" />
					<span>
						{m.ct_identity_first()}
						<a href={resolve('/dashboard/verification')} class="underline underline-offset-2">
							{m.fayda_start()}
						</a>
					</span>
				</p>
			{:else}
				<form method="POST" action="?/signContract" use:signEnhance class="space-y-3">
					<Errors allErrors={$signAll} />
					<input type="hidden" name="bookingId" value={booking.id} />
					<InputComp
						form={signForm}
						errors={signErrors}
						label={m.ct_typed_name()}
						name="typedName"
						type="text"
						autocomplete="name"
						hint={m.ct_typed_name_hint()}
					/>
					<InputComp
						form={signForm}
						errors={signErrors}
						label={m.ct_agree_label()}
						labelHidden
						name="agree"
						type="checkboxSingle"
						placeholder={m.ct_agree()}
					/>
					<button type="submit" disabled={$signDelayed} class={primaryButton}>
						{#if $signDelayed}
							<LoadingBtn name={m.common_saving()} />
						{:else}
							<FileSignature class="h-3.5 w-3.5" />
							{m.ct_sign()}
						{/if}
					</button>
				</form>
			{/if}
		{/if}
	</div>
{/if}

<!-- ===== The concept ===== -->
{#if canSubmitConcept || data.concepts.length}
	<div class="bento-card bento-card-static space-y-4">
		<h2 class="{cardTitle} border-b-2 border-edge pb-3">
			<Lightbulb class="h-4 w-4 text-brand-fg" />
			{m.cc_title()}
		</h2>

		{#each data.concepts as item (item.id)}
			<div class="space-y-2 rounded-xl border-2 border-edge-soft p-3">
				<div class="flex flex-wrap items-center justify-between gap-2 text-[11px]">
					<span class="font-black text-ink">{formatDateTime(item.createdAt)}</span>
					<span
						class="rounded-full border px-2 py-0.5 font-black {item.status === 'approved'
							? 'border-brand-edge bg-brand-soft text-brand-soft-fg'
							: item.status === 'changes_requested'
								? 'border-tint-orange-edge bg-tint-orange text-tint-orange-fg'
								: 'border-warn-edge bg-warn-soft text-warn-fg'}"
					>
						{item.status === 'approved'
							? m.cc_status_approved()
							: item.status === 'changes_requested'
								? m.cc_status_changes()
								: m.cc_status_submitted()}
					</span>
				</div>
				<p class="text-xs leading-relaxed whitespace-pre-line text-ink-soft">{item.body}</p>
				{#if item.attachment}
					<a
						href={assetUrl(item.attachment)}
						target="_blank"
						rel="noopener external"
						class="inline-flex items-center gap-1 text-[11px] font-black text-brand-soft-fg underline underline-offset-2"
					>
						<FileText class="h-3 w-3" />
						{m.cc_attachment()}
					</a>
				{/if}
				{#if item.reviewNote}
					<p class="rounded-lg bg-well px-3 py-2 text-[11px] text-ink-soft">
						<span class="font-black text-ink">{m.cc_brand_note()}</span>
						{item.reviewNote}
					</p>
				{/if}
			</div>
		{/each}

		{#if conceptUnderReview && (isBrand || isOperator)}
			<div class="space-y-3 rounded-xl border-2 border-edge p-3">
				{#if !data.canApproveConcept}
					<p class="text-[11px] font-bold text-warn-fg">{m.cc_funds_first()}</p>
				{/if}
				<InputComp
					label={m.cc_review_note()}
					name="conceptNote"
					type="textarea"
					rows={3}
					bind:value={conceptNote}
					hint={m.cc_review_note_hint()}
				/>
				<div class="flex flex-wrap gap-2">
					<form
						method="POST"
						action="?/reviewConcept"
						use:enhance={actionEnhance(m.cc_approved_toast())}
					>
						<input type="hidden" name="conceptId" value={conceptUnderReview.id} />
						<input type="hidden" name="decision" value="approve" />
						<input type="hidden" name="reviewNote" value={conceptNote} />
						<button type="submit" class={primaryButton} disabled={!data.canApproveConcept}>
							{m.cc_approve()}
						</button>
					</form>
					<form
						method="POST"
						action="?/reviewConcept"
						use:enhance={actionEnhance(m.cc_changes_toast())}
					>
						<input type="hidden" name="conceptId" value={conceptUnderReview.id} />
						<input type="hidden" name="decision" value="changes" />
						<input type="hidden" name="reviewNote" value={conceptNote} />
						<button type="submit" class={secondaryButton}>{m.cc_request_changes()}</button>
					</form>
				</div>
			</div>
		{/if}

		{#if canSubmitConcept}
			<form
				method="POST"
				action="?/submitConcept"
				use:conceptEnhance
				enctype="multipart/form-data"
				class="space-y-3"
			>
				<Errors allErrors={$conceptAll} />
				<input type="hidden" name="bookingId" value={booking.id} />
				<InputComp
					form={conceptForm}
					errors={conceptErrors}
					label={m.cc_body()}
					name="body"
					type="textarea"
					rows={5}
					placeholder={m.cc_body_placeholder()}
				/>
				<InputComp
					form={conceptForm}
					errors={conceptErrors}
					label={m.cc_attachment_label()}
					name="attachment"
					type="file"
					placeholder={m.cc_attachment_hint()}
				/>
				<button type="submit" disabled={$conceptDelayed} class={primaryButton}>
					{#if $conceptDelayed}
						<LoadingBtn name={m.common_saving()} />
					{:else}
						<Lightbulb class="h-3.5 w-3.5" />
						{m.cc_submit()}
					{/if}
				</button>
			</form>
		{/if}
	</div>
{/if}

<!-- ===== Proof it went live, and how it performed ===== -->
{#if canSubmitProof || data.proof}
	<div class="bento-card bento-card-static space-y-4">
		<h2 class="{cardTitle} border-b-2 border-edge pb-3">
			<Radio class="h-4 w-4 text-brand-fg" />
			{m.pr_title()}
		</h2>

		{#if data.proof}
			<div class="grid gap-3 sm:grid-cols-[1fr_8rem]">
				<div class="space-y-1 text-xs">
					<a
						href={data.proof.liveUrl}
						target="_blank"
						rel="noopener external"
						class="font-black break-all text-brand-soft-fg underline underline-offset-2"
					>
						{data.proof.liveUrl}
					</a>
					<p class="text-ink-dim">
						{m.pr_posted_at({ date: formatDateTime(data.proof.postedAt) })}
					</p>
					{#if data.proof.notes}
						<p class="text-ink-soft">{data.proof.notes}</p>
					{/if}
				</div>
				<a
					href={assetUrl(data.proof.screenshot)}
					target="_blank"
					rel="noopener external"
					class="block"
				>
					<img
						src={assetUrl(data.proof.screenshot)}
						alt={m.pr_screenshot_alt()}
						class="h-32 w-full rounded-xl border-2 border-edge object-cover"
						loading="lazy"
					/>
				</a>
			</div>

			<!-- The three checkpoints: figures where recorded, the date each opens where not. -->
			<div class="overflow-x-auto">
				<table class="w-full min-w-[520px] text-left text-[11px]">
					<thead>
						<tr class="border-b-2 border-edge-soft text-ink-dim">
							<th class="py-2 font-black">{m.pr_checkpoint()}</th>
							<th class="py-2 font-black">{m.pr_views()}</th>
							<th class="py-2 font-black">{m.pr_likes()}</th>
							<th class="py-2 font-black">{m.pr_comments()}</th>
							<th class="py-2 font-black">{m.pr_shares()}</th>
							<th class="py-2 font-black">{m.pr_reach()}</th>
							<th class="py-2 font-black"></th>
						</tr>
					</thead>
					<tbody>
						{#each CHECKPOINTS as cp (cp)}
							{@const row = data.metrics.find((one) => one.checkpoint === cp)}
							<tr class="border-b border-edge-soft">
								<td class="py-2 font-black text-ink">{checkpointLabel(cp)}</td>
								{#if row}
									<td class="py-2 tabular-nums">{row.views ?? '—'}</td>
									<td class="py-2 tabular-nums">{row.likes ?? '—'}</td>
									<td class="py-2 tabular-nums">{row.comments ?? '—'}</td>
									<td class="py-2 tabular-nums">{row.shares ?? '—'}</td>
									<td class="py-2 tabular-nums">{row.reach ?? '—'}</td>
									<td class="py-2">
										<a
											href={assetUrl(row.screenshot)}
											target="_blank"
											rel="noopener external"
											class="font-black text-brand-soft-fg underline underline-offset-2"
										>
											{m.pr_evidence()}
										</a>
									</td>
								{:else}
									<td colspan="6" class="py-2 text-ink-dim">
										{checkpointIsOpen(new Date(data.proof.postedAt), cp)
											? m.pr_due_now()
											: m.pr_opens_on({
													date: formatDateTime(checkpointOpensAt(new Date(data.proof.postedAt), cp))
												})}
									</td>
								{/if}
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			{#if (isCreator || isOperator) && openCheckpoints.length}
				<form
					method="POST"
					action="?/recordMetrics"
					use:metricsEnhance
					enctype="multipart/form-data"
					class="space-y-3 rounded-xl border-2 border-edge p-3"
				>
					<h3 class="flex items-center gap-1.5 text-xs font-black text-ink">
						<BarChart3 class="h-3.5 w-3.5" />
						{m.pr_record_heading()}
					</h3>
					<Errors allErrors={$metricsAll} />
					<input type="hidden" name="bookingId" value={booking.id} />
					<InputComp
						form={metricsForm}
						errors={metricsErrors}
						label={m.pr_checkpoint()}
						name="checkpoint"
						type="select"
						items={checkpointItems}
					/>
					<div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
						<InputComp
							form={metricsForm}
							errors={metricsErrors}
							label={m.pr_views()}
							name="views"
							type="number"
							min={0}
						/>
						<InputComp
							form={metricsForm}
							errors={metricsErrors}
							label={m.pr_likes()}
							name="likes"
							type="number"
							min={0}
						/>
						<InputComp
							form={metricsForm}
							errors={metricsErrors}
							label={m.pr_comments()}
							name="comments"
							type="number"
							min={0}
						/>
						<InputComp
							form={metricsForm}
							errors={metricsErrors}
							label={m.pr_shares()}
							name="shares"
							type="number"
							min={0}
						/>
						<InputComp
							form={metricsForm}
							errors={metricsErrors}
							label={m.pr_saves()}
							name="saves"
							type="number"
							min={0}
						/>
						<InputComp
							form={metricsForm}
							errors={metricsErrors}
							label={m.pr_reach()}
							name="reach"
							type="number"
							min={0}
						/>
					</div>
					<InputComp
						form={metricsForm}
						errors={metricsErrors}
						label={m.pr_analytics_screenshot()}
						name="screenshot"
						type="file"
						capture="environment"
						placeholder={m.pr_analytics_screenshot_hint()}
					/>
					<button type="submit" disabled={$metricsDelayed} class={primaryButton}>
						{#if $metricsDelayed}
							<LoadingBtn name={m.common_saving()} />
						{:else}
							{m.pr_record()}
						{/if}
					</button>
				</form>
			{/if}
		{:else if canSubmitProof}
			<form
				method="POST"
				action="?/submitProof"
				use:proofEnhance
				enctype="multipart/form-data"
				class="space-y-3"
			>
				<p class="text-xs text-ink-soft">{m.pr_intro()}</p>
				<Errors allErrors={$proofAll} />
				<input type="hidden" name="bookingId" value={booking.id} />
				<InputComp
					form={proofForm}
					errors={proofErrors}
					label={m.pr_live_url()}
					name="liveUrl"
					type="url"
					placeholder="https://"
				/>
				<InputComp
					form={proofForm}
					errors={proofErrors}
					label={m.pr_posted_at_label()}
					name="postedAt"
					type="datetime-local"
				/>
				<InputComp
					form={proofForm}
					errors={proofErrors}
					label={m.pr_screenshot()}
					name="screenshot"
					type="file"
					capture="environment"
					placeholder={m.pr_screenshot_hint()}
				/>
				<InputComp
					form={proofForm}
					errors={proofErrors}
					label={m.pr_notes()}
					name="notes"
					type="textarea"
					rows={2}
				/>
				<button type="submit" disabled={$proofDelayed} class={primaryButton}>
					{#if $proofDelayed}
						<LoadingBtn name={m.common_saving()} />
					{:else}
						<Radio class="h-3.5 w-3.5" />
						{m.pr_submit()}
					{/if}
				</button>
			</form>
		{/if}
	</div>
{/if}

<!-- ===== Documents the platform issued ===== -->
{#if data.documents.length}
	<div class="bento-card bento-card-static space-y-3">
		<h2 class={cardTitle}>
			<Receipt class="h-4 w-4 text-brand-fg" />
			{m.doc_title()}
		</h2>
		<ul class="space-y-2">
			{#each data.documents as doc (doc.number)}
				<li class="flex flex-wrap items-center justify-between gap-2 text-xs">
					<span>
						<span class="font-black text-ink">{documentLabel(doc.kind)}</span>
						<span class="font-mono text-[10px] text-ink-dim">· {doc.number}</span>
					</span>
					<a
						href={resolve(`/dashboard/documents/${doc.number}`)}
						target="_blank"
						rel="noopener"
						class="font-black text-brand-soft-fg underline underline-offset-2"
					>
						{m.doc_open({ amount: formatAmountWithCode(doc.total, doc.currencyCode) })}
					</a>
				</li>
			{/each}
		</ul>
	</div>
{/if}
