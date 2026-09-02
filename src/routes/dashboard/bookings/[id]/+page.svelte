<script lang="ts">
	import { untrack } from 'svelte';
	import type { BookingStatus } from '$lib/domain/booking';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { resolve } from '$app/paths';
	import { superForm } from 'sveltekit-superforms';
	import { enhance } from '$app/forms';
	import { toast } from 'svelte-sonner';
	import {
		ArrowLeft,
		CircleCheckBig,
		MailQuestion,
		Lock,
		ShieldAlert,
		Upload,
		ExternalLink,
		Star,
		Send,
		Handshake,
		Wallet,
		MessageSquare,
		Gavel,
		Undo2,
		XCircle
	} from '@lucide/svelte';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import BookingStatusBadge from '$lib/components/booking-status-badge.svelte';
	import CompensationBadge from '$lib/components/compensation-badge.svelte';
	import LoadingBtn from '$lib/formComponents/LoadingBtn.svelte';
	import Errors from '$lib/formComponents/Errors.svelte';
	import InputComp from '$lib/formComponents/InputComp.svelte';
	import StarRating from '$lib/formComponents/StarRating.svelte';
	import { pipelineSteps, stepIndex } from '$lib/domain/booking';
	import { disputeResolutionLabel } from '$lib/domain/dispute';
	import { formatAmountWithCode } from '$lib/domain/money';
	import * as m from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';

	let { data } = $props();

	const booking = $derived(data.booking);
	const isCreator = $derived(data.side === 'creator');
	const isBrand = $derived(data.side === 'organization');
	const isOperator = $derived(data.side === 'admin');

	const currentStep = $derived(stepIndex(booking.status as BookingStatus));

	/* Whether each button may be drawn is decided on the server, which re-runs
	   every one of these tests before anything happens. */
	const openCase = $derived(data.disputes.find((d) => d.status === 'open') ?? null);
	const closedCases = $derived(data.disputes.filter((d) => d.status !== 'open'));
	const canRaiseDispute = $derived(data.disputeProblem === null);
	const iRaisedIt = $derived(Boolean(openCase) && openCase?.raisedBySide === data.side);
	const canRespondToCase = $derived(
		Boolean(openCase) && !openCase?.respondedAt && !iRaisedIt && !isOperator
	);
	const canAskToCancel = $derived(data.cancelRequestProblem === null && !isOperator);
	const canAnswerCancel = $derived(data.cancelAgreeProblem === null && !isOperator);
	const cancelPending = $derived(Boolean(booking.cancelRequestedSide));
	const iAskedToCancel = $derived(booking.cancelRequestedSide === data.side);

	/* A refund's own vocabulary. The payout labels next door say "Sent to bank"
	   and "Paid", which read as the wrong direction entirely for money coming
	   back to the person who paid it. */
	const refundStatusLabel = (status: string) =>
		({
			pending: m.rf_status_pending(),
			queued: m.rf_status_queued(),
			success: m.rf_status_success(),
			failed: m.rf_status_failed(),
			cancelled: m.rf_status_cancelled()
		})[status] ?? status;
	const openProposal = $derived(data.proposals.find((p) => p.status === 'pending') ?? null);
	const openSubmission = $derived(data.submissions.find((s) => s.status === 'submitted') ?? null);
	const myReview = $derived(
		data.reviews.find((r) =>
			isCreator ? r.direction === 'creator_to_brand' : r.direction === 'brand_to_creator'
		)
	);

	/** The offer on the table was made by the other side, so I may accept it. */
	const canRespond = $derived(
		openProposal !== null &&
			!isOperator &&
			((isCreator && openProposal.proposedBy === 'organization') ||
				(isBrand && openProposal.proposedBy === 'creator'))
	);

	const negotiating = $derived(['proposed', 'negotiating'].includes(booking.status));

	/*
	 * The outcome of a return from Chapa, reported once.
	 *
	 * The server resolved `?payment=` during load, so by the time this runs the
	 * booking on the page already reflects it — this only says which of the five
	 * things happened. `untrack` for the same reason as the OAuth error on the
	 * login page: `data` is reactive, and re-toasting on every update would
	 * stack duplicates.
	 */
	$effect(() => {
		const state = data.payment?.state;
		if (!state) return;
		untrack(() => {
			if (state === 'funded') toast.success(m.bk_pay_succeeded());
			else if (state === 'already') toast.info(m.bk_pay_already());
			else if (state === 'failed') toast.error(m.bk_pay_failed());
			/* `pending` is a checkout still open; `unreachable` is Chapa not
			   answering us; `not_found` is a reference we never issued. None of
			   the three means the payment failed, and saying so to somebody who
			   has just paid would be the worst of the available lies — the
			   webhook is still coming, and it decides. */
			else toast.info(m.bk_pay_pending());
		});
	});

	let counterOpen = $state(false);
	let submitOpen = $state(false);
	let reviewOpen = $state(false);
	let rateOpen = $state(false);
	let revisionNote = $state('');
	let disputeOpen = $state(false);
	let respondOpen = $state(false);
	let cancelOpen = $state(false);

	/*
	 * Four forms, each seeded once.
	 *
	 * `untrack`, because a superform owns its state after it is created:
	 * re-reading `data.*Form` on every change would fight the store, and a fresh
	 * `SuperValidated` landing mid-edit would throw away a half-written pitch or
	 * review. Navigating to a *different booking* is the one case where
	 * re-seeding is correct, and the effect below does it explicitly — this is a
	 * `[id]` route, so SvelteKit reuses the component and none of this would
	 * otherwise reset.
	 */
	const proposalSuper = superForm(
		untrack(() => data.proposalForm),
		{
			id: 'proposal',
			onUpdated: ({ form }) => {
				if (form.valid) counterOpen = false;
			}
		}
	);
	const {
		form: proposalForm,
		errors: proposalErrors,
		enhance: proposalEnhance,
		delayed: proposalDelayed,
		allErrors: proposalAllErrors,
		message: proposalMessage
	} = proposalSuper;

	const submissionSuper = superForm(
		untrack(() => data.submitForm),
		{
			id: 'submission',
			onUpdated: ({ form }) => {
				if (form.valid) submitOpen = false;
			}
		}
	);
	const {
		form: submissionForm,
		errors: submissionErrors,
		enhance: submissionEnhance,
		delayed: submissionDelayed,
		allErrors: submissionAllErrors,
		message: submissionMessage
	} = submissionSuper;

	const ratingSuper = superForm(
		untrack(() => data.reviewForm),
		{
			id: 'review',
			onUpdated: ({ form }) => {
				if (form.valid) rateOpen = false;
			}
		}
	);
	const {
		form: ratingForm,
		errors: ratingErrors,
		enhance: ratingEnhance,
		delayed: ratingDelayed,
		allErrors: ratingAllErrors,
		message: ratingMessage
	} = ratingSuper;

	const chatSuper = superForm(
		untrack(() => data.messageForm),
		{
			id: 'message',
			resetForm: true
		}
	);
	const {
		form: chatForm,
		errors: chatErrors,
		enhance: chatEnhance,
		message: chatMessage
	} = chatSuper;

	const disputeSuper = superForm(
		untrack(() => data.disputeForm),
		{
			id: 'dispute',
			onUpdated: ({ form }) => {
				if (form.valid) disputeOpen = false;
			}
		}
	);
	const {
		form: disputeForm,
		errors: disputeErrors,
		enhance: disputeEnhance,
		delayed: disputeDelayed,
		message: disputeMessage
	} = disputeSuper;

	const respondSuper = superForm(
		untrack(() => data.respondForm),
		{
			id: 'dispute-respond',
			onUpdated: ({ form }) => {
				if (form.valid) respondOpen = false;
			}
		}
	);
	const {
		form: respondForm,
		errors: respondErrors,
		enhance: respondEnhance,
		delayed: respondDelayed,
		message: respondMessage
	} = respondSuper;

	const cancelSuper = superForm(
		untrack(() => data.cancelForm),
		{
			id: 'cancel',
			onUpdated: ({ form }) => {
				if (form.valid) cancelOpen = false;
			}
		}
	);
	const {
		form: cancelForm,
		errors: cancelErrors,
		enhance: cancelEnhance,
		delayed: cancelDelayed,
		message: cancelMessage
	} = cancelSuper;

	/** Everything that has to forget when the reader opens a different booking. */
	let openBookingId = $state(untrack(() => data.booking.id));
	$effect(() => {
		if (booking.id === openBookingId) return;
		openBookingId = booking.id;
		counterOpen = false;
		submitOpen = false;
		reviewOpen = false;
		rateOpen = false;
		revisionNote = '';
		disputeOpen = false;
		respondOpen = false;
		cancelOpen = false;
		proposalSuper.reset({ data: data.proposalForm.data, newState: data.proposalForm.data });
		submissionSuper.reset({ data: data.submitForm.data, newState: data.submitForm.data });
		ratingSuper.reset({ data: data.reviewForm.data, newState: data.reviewForm.data });
		chatSuper.reset({ data: data.messageForm.data, newState: data.messageForm.data });
		disputeSuper.reset({ data: data.disputeForm.data, newState: data.disputeForm.data });
		respondSuper.reset({ data: data.respondForm.data, newState: data.respondForm.data });
		cancelSuper.reset({ data: data.cancelForm.data, newState: data.cancelForm.data });
	});

	/** One toast rule for every form on the page. */
	const announce = (msg: { type: string; text: string } | undefined) => {
		if (!msg) return;
		if (msg.type === 'error') toast.error(msg.text);
		else if (msg.type === 'warning') toast.warning(msg.text);
		else toast.success(msg.text);
	};

	$effect(() => announce($proposalMessage));
	$effect(() => announce($submissionMessage));
	$effect(() => announce($ratingMessage));
	$effect(() => announce($chatMessage));
	$effect(() => announce($disputeMessage));
	$effect(() => announce($respondMessage));
	$effect(() => announce($cancelMessage));

	const dateLocale = $derived(getLocale() === 'am' ? 'am-ET' : 'en-GB');

	const formatDate = (value: string | Date | null) =>
		value
			? new Date(value).toLocaleDateString(dateLocale, {
					day: 'numeric',
					month: 'short',
					year: 'numeric'
				})
			: '—';

	const formatTime = (value: string | Date) =>
		new Date(value).toLocaleString(dateLocale, {
			day: 'numeric',
			month: 'short',
			hour: '2-digit',
			minute: '2-digit'
		});

	/** The currencies a counter-proposal may be denominated in. */
	const CURRENCY_ITEMS = ['ETB', 'KES', 'NGN', 'ZAR', 'GHS', 'RWF', 'EGP', 'AED', 'GBP', 'USD'].map(
		(code) => ({ value: code, name: code })
	);

	/** The four sub-scores, keyed so the star rows stay type-safe. */
	const SUB_RATINGS = $derived([
		{ key: 'communication', label: m.profile_rating_communication() },
		{ key: 'quality', label: m.profile_rating_quality() },
		{ key: 'timeliness', label: m.profile_rating_timeliness() },
		{ key: 'professionalism', label: m.profile_rating_compliance() }
	] as const);

	/** Plain form posts share one handler so every outcome toasts consistently. */
	const actionEnhance =
		(successText: string): SubmitFunction =>
		() => {
			return async ({ result, update }) => {
				if (result.type === 'failure') {
					toast.error(result.data?.message ?? m.bk_action_refused());
				} else if (result.type === 'success') {
					toast.success(successText);
				}
				await update();
			};
		};
</script>

<svelte:head><title>{m.bk_meta_title({ ref: booking.reference })}</title></svelte:head>

<div class="space-y-6">
	<a
		href={resolve('/dashboard/bookings')}
		class="inline-flex items-center gap-1.5 rounded-lg border border-edge-soft bg-surface px-3 py-1.5 text-xs font-semibold text-ink-soft hover:text-ink"
	>
		<ArrowLeft class="h-3.5 w-3.5" />
		{m.bk_all_bookings()}
	</a>

	<!--
		A deal opened against a profile nobody had claimed. Saying so is the
		point: without it the brand reads `proposed` as "waiting on the creator",
		when in fact no account exists to answer it yet.
	-->
	{#if booking.introductionStatus !== 'none'}
		{@const settled = booking.introductionStatus === 'connected'}
		{@const closed = settled || booking.introductionStatus === 'declined'}
		<div
			class="flex items-start gap-3 rounded-2xl border-2 p-4 {settled
				? 'border-brand-edge bg-brand-soft'
				: booking.introductionStatus === 'declined'
					? 'border-edge-mid bg-well'
					: 'border-warn-edge bg-warn-soft'}"
		>
			<MailQuestion
				class="mt-0.5 h-5 w-5 shrink-0 {settled
					? 'text-brand-soft-fg'
					: closed
						? 'text-ink-soft'
						: 'text-warn-fg'}"
			/>
			<div class="space-y-1">
				<h2 class="text-xs font-black text-ink">
					{#if settled}
						{m.bk_intro_connected_title()}
					{:else if booking.introductionStatus === 'declined'}
						{m.bk_intro_declined_title()}
					{:else}
						{m.bk_intro_title()}
					{/if}
				</h2>
				<p class="text-[11px] font-medium text-ink-soft">
					{#if booking.introductionStatus === 'pending'}
						{m.bk_intro_pending_body({ creator: booking.creatorName })}
					{:else if booking.introductionStatus === 'contacted'}
						{m.bk_intro_contacted_body({ creator: booking.creatorName })}
					{:else if settled}
						{m.bk_intro_connected_body({ creator: booking.creatorName })}
					{:else}
						{m.bk_intro_declined_body({ creator: booking.creatorName })}
					{/if}
				</p>
			</div>
		</div>
	{/if}

	<!--
		A cancellation one side has asked for and the other has not answered.

		Shown before the deal itself, because until it is answered it is the most
		important thing about this booking to whichever side is being asked.
	-->
	{#if cancelPending && booking.status !== 'cancelled'}
		<div class="flex items-start gap-3 rounded-2xl border-2 border-warn-edge bg-warn-soft p-4">
			<XCircle class="mt-0.5 h-5 w-5 shrink-0 text-warn-fg" />
			<div class="min-w-0 flex-1 space-y-2">
				<p class="text-sm font-black text-warn-fg">{m.cx_pending_title()}</p>
				<p class="text-xs font-medium text-warn-fg">
					{iAskedToCancel ? m.cx_pending_you() : m.cx_pending_them()}
				</p>
				{#if booking.cancelRequestReason}
					<p class="rounded-xl border border-warn-edge bg-surface p-2 text-xs text-ink">
						{booking.cancelRequestReason}
					</p>
				{/if}

				{#if canAnswerCancel}
					<div class="flex flex-wrap gap-2 pt-1">
						<form
							method="POST"
							action="?/answerCancel"
							use:enhance={actionEnhance(m.cx_agreed_toast())}
						>
							<input type="hidden" name="agree" value="true" />
							<button
								type="submit"
								class="rounded-xl border-2 border-edge bg-danger px-3 py-1.5 text-xs font-black text-white hover:opacity-90"
							>
								{m.cx_agree()}
							</button>
						</form>
						<form
							method="POST"
							action="?/answerCancel"
							use:enhance={actionEnhance(m.cx_refused_toast())}
						>
							<input type="hidden" name="agree" value="false" />
							<button
								type="submit"
								class="rounded-xl border-2 border-edge bg-surface px-3 py-1.5 text-xs font-black text-ink hover:bg-panel"
							>
								{m.cx_refuse()}
							</button>
						</form>
					</div>
				{:else if iAskedToCancel}
					<form
						method="POST"
						action="?/answerCancel"
						use:enhance={actionEnhance(m.cx_refused_toast())}
					>
						<input type="hidden" name="agree" value="false" />
						<button
							type="submit"
							class="rounded-xl border-2 border-edge bg-surface px-3 py-1.5 text-xs font-black text-ink hover:bg-panel"
						>
							{m.cx_withdraw()}
						</button>
					</form>
				{/if}
			</div>
		</div>
	{/if}

	<!-- The open case: both statements, and whatever this reader can still do. -->
	{#if openCase}
		<div class="flex items-start gap-3 rounded-2xl border-2 border-danger-edge bg-danger-soft p-4">
			<Gavel class="mt-0.5 h-5 w-5 shrink-0 text-danger-fg" />
			<div class="min-w-0 flex-1 space-y-3">
				<div>
					<p class="text-sm font-black text-danger-fg">{m.dsp_open_title()}</p>
					<p class="text-xs font-medium text-danger-fg">{m.dsp_open_body()}</p>
				</div>

				<div class="space-y-2">
					<p class="text-[10px] font-black tracking-widest text-ink-soft uppercase">
						{iRaisedIt ? m.dsp_case_from_you() : m.dsp_case_from_them()}
					</p>
					<p class="rounded-xl border border-danger-edge bg-surface p-2 text-xs text-ink">
						{openCase.reason}
					</p>
					{#if openCase.evidenceUrl}
						<a
							href={openCase.evidenceUrl}
							rel="noopener noreferrer nofollow"
							target="_blank"
							class="inline-flex items-center gap-1 text-[11px] font-bold text-ink-soft underline"
						>
							<ExternalLink class="h-3 w-3" />{m.dsp_evidence_link()}
						</a>
					{/if}
				</div>

				<div class="space-y-2">
					<p class="text-[10px] font-black tracking-widest text-ink-soft uppercase">
						{iRaisedIt ? m.dsp_their_answer() : m.dsp_your_answer()}
					</p>
					{#if openCase.responseText}
						<p class="rounded-xl border border-danger-edge bg-surface p-2 text-xs text-ink">
							{openCase.responseText}
						</p>
					{:else}
						<p class="text-xs font-medium text-ink-soft">
							{canRespondToCase ? m.dsp_no_answer_yet() : m.dsp_awaiting_answer()}
						</p>
					{/if}
				</div>

				{#if openCase.responseText || iRaisedIt}
					<p class="text-[11px] font-bold text-ink-soft">{m.dsp_awaiting_operator()}</p>
				{/if}

				<div class="flex flex-wrap gap-2">
					{#if canRespondToCase}
						<button
							type="button"
							onclick={() => (respondOpen = true)}
							class="rounded-xl border-2 border-edge bg-surface px-3 py-1.5 text-xs font-black text-ink hover:bg-panel"
						>
							{m.dsp_respond()}
						</button>
					{/if}
					{#if iRaisedIt}
						<form
							method="POST"
							action="?/withdrawDispute"
							use:enhance={actionEnhance(m.dsp_withdrawn_toast())}
						>
							<input type="hidden" name="id" value={openCase.id} />
							<button
								type="submit"
								class="inline-flex items-center gap-1 rounded-xl border-2 border-edge bg-surface px-3 py-1.5 text-xs font-black text-ink hover:bg-panel"
							>
								<Undo2 class="h-3.5 w-3.5" />
								{m.dsp_withdraw()}
							</button>
						</form>
					{/if}
				</div>
			</div>
		</div>
	{/if}

	<!-- Cases already decided. Kept visible: the outcome is why the money moved. -->
	{#each closedCases as closed (closed.id)}
		{#if closed.status === 'resolved'}
			<div class="flex items-start gap-3 rounded-2xl border-2 border-edge bg-panel p-4">
				<Gavel class="mt-0.5 h-5 w-5 shrink-0 text-ink-soft" />
				<div class="min-w-0 flex-1">
					<p class="text-sm font-black text-ink">{m.dsp_resolved_title()}</p>
					<p class="text-xs font-medium text-ink-soft">
						{m.dsp_resolved_body({
							resolution: disputeResolutionLabel(closed.resolution ?? ''),
							note: closed.resolutionNote ?? ''
						})}
					</p>
				</div>
			</div>
		{/if}
	{/each}

	<!-- ===== Header ===== -->
	<div class="bento-card bento-card-static space-y-4">
		<div class="flex flex-col justify-between gap-4 md:flex-row md:items-start">
			<div class="min-w-0">
				<div class="mb-1 flex flex-wrap items-center gap-2">
					<span class="font-mono text-[10px] font-black tracking-widest text-ink-faint">
						{booking.reference}
					</span>
					<BookingStatusBadge status={booking.status} />
					<CompensationBadge type={booking.compensationType} />
				</div>
				<h1 class="text-xl font-black text-ink sm:text-2xl">{booking.title}</h1>
				<p class="mt-1 text-xs font-bold text-ink-dim">
					<a href={resolve(`/creators/${booking.creatorUsername}`)} class="hover:underline">
						{booking.creatorName}
					</a>
					· {booking.organizationName} · {m.bk_due({ date: formatDate(booking.deadline) })}
				</p>
			</div>

			<div class="flex shrink-0 flex-wrap items-center gap-2">
				{#if negotiating && !isOperator}
					<button
						type="button"
						onclick={() => (counterOpen = true)}
						class="rounded-xl border-2 border-edge bg-surface px-4 py-2 text-xs font-black text-ink shadow-[2px_2px_0px_0px_rgb(var(--bento-shadow))] hover:bg-panel"
					>
						{m.bk_counter_offer()}
					</button>
				{/if}

				{#if booking.status === 'booked' && isBrand && data.canPayOnline}
					<!-- Ends in a redirect to Chapa, so this posts for real rather than
					     through `enhance`: an enhanced submit would have to follow the
					     303 itself, and a cross-origin one at that. -->
					<form method="POST" action="?/payDeposit">
						<input type="hidden" name="bookingId" value={booking.id} />
						<button
							type="submit"
							class="flex items-center gap-1.5 rounded-xl border-2 border-edge bg-brand px-4 py-2 text-xs font-black text-brand-ink shadow-[2px_2px_0px_0px_rgb(var(--bento-shadow))] hover:bg-brand-strong"
						>
							<Wallet class="h-3.5 w-3.5" />
							{m.bk_pay_deposit()}
						</button>
					</form>
				{/if}

				<!-- The manual path is what remains for money that moved outside the
				     platform — a bank transfer, telebirr paid directly. Operators only;
				     the server refuses it from anyone else. -->
				{#if booking.status === 'booked' && isOperator && booking.escrowStatus !== 'held'}
					<form method="POST" action="?/fund" use:enhance={actionEnhance(m.bk_deposit_recorded())}>
						<input type="hidden" name="bookingId" value={booking.id} />
						<input type="hidden" name="paymentMethod" value="bank_transfer" />
						<button
							type="submit"
							class="flex items-center gap-1.5 rounded-xl border-2 border-edge bg-surface px-4 py-2 text-xs font-black text-ink shadow-[2px_2px_0px_0px_rgb(var(--bento-shadow))] hover:bg-panel"
						>
							<Wallet class="h-3.5 w-3.5" />
							{m.bk_record_deposit_manual()}
						</button>
					</form>
				{/if}

				{#if ['in_production', 'revision'].includes(booking.status) && isCreator}
					<button
						type="button"
						onclick={() => (submitOpen = true)}
						class="flex items-center gap-1.5 rounded-xl border-2 border-edge bg-brand px-4 py-2 text-xs font-black text-brand-ink shadow-[2px_2px_0px_0px_rgb(var(--bento-shadow))] hover:bg-brand-strong"
					>
						<Upload class="h-3.5 w-3.5" />
						{m.bk_submit_work()}
					</button>
				{/if}

				{#if booking.status === 'submitted' && (isBrand || isOperator)}
					<button
						type="button"
						onclick={() => (reviewOpen = true)}
						class="flex items-center gap-1.5 rounded-xl border-2 border-edge bg-brand px-4 py-2 text-xs font-black text-brand-ink shadow-[2px_2px_0px_0px_rgb(var(--bento-shadow))] hover:bg-brand-strong"
					>
						<CircleCheckBig class="h-3.5 w-3.5" />
						{m.bk_review_submission()}
					</button>
				{/if}

				{#if booking.status === 'awaiting_settlement' && (isBrand || isOperator)}
					<form
						method="POST"
						action="?/settle"
						use:enhance={actionEnhance(m.bk_booking_completed())}
					>
						<input type="hidden" name="bookingId" value={booking.id} />
						<button
							type="submit"
							class="flex items-center gap-1.5 rounded-xl border-2 border-edge bg-brand px-4 py-2 text-xs font-black text-brand-ink shadow-[2px_2px_0px_0px_rgb(var(--bento-shadow))] hover:bg-brand-strong"
						>
							<CircleCheckBig class="h-3.5 w-3.5" />
							{m.bk_mark_fulfilled()}
						</button>
					</form>
				{/if}

				{#if booking.status === 'completed' && !myReview && !isOperator}
					<button
						type="button"
						onclick={() => (rateOpen = true)}
						class="flex items-center gap-1.5 rounded-xl border-2 border-edge bg-warn px-4 py-2 text-xs font-black text-warn-ink shadow-[2px_2px_0px_0px_rgb(var(--bento-shadow))] hover:bg-warn"
					>
						<Star class="h-3.5 w-3.5 fill-current" />
						{m.bk_write_review()}
					</button>
				{/if}

				<!--
					The two ways out of a live deal, and they are deliberately not the
					same button. Cancelling is for a deal that is simply not going
					ahead and needs the other side to agree; a dispute is for one that
					is going wrong and needs somebody to decide. Both are quiet
					secondary actions — neither is a thing to reach for first.
				-->
				{#if canAskToCancel}
					<button
						type="button"
						onclick={() => (cancelOpen = true)}
						class="flex items-center gap-1.5 rounded-xl border-2 border-edge-soft bg-surface px-3 py-2 text-xs font-bold text-ink-soft hover:border-edge hover:text-ink"
					>
						<XCircle class="h-3.5 w-3.5" />
						{m.cx_request()}
					</button>
				{/if}

				{#if canRaiseDispute}
					<button
						type="button"
						onclick={() => (disputeOpen = true)}
						class="flex items-center gap-1.5 rounded-xl border-2 border-edge-soft bg-surface px-3 py-2 text-xs font-bold text-ink-soft hover:border-danger-edge hover:text-danger-fg"
					>
						<Gavel class="h-3.5 w-3.5" />
						{m.dsp_raise()}
					</button>
				{/if}
			</div>
		</div>

		{#if booking.status === 'completed' && canRaiseDispute && data.disputeWindowClosesAt}
			<p class="text-[11px] font-medium text-ink-soft">
				{m.dsp_window_note({ date: formatDate(data.disputeWindowClosesAt) })}
			</p>
		{/if}

		<!-- Stepper -->
		{#if currentStep >= 0}
			<div class="overflow-x-auto border-t-2 border-edge-soft py-6">
				<div class="relative mx-auto flex max-w-2xl min-w-[560px] items-center justify-between">
					{#each pipelineSteps() as step, index (step.status)}
						{@const done = index <= currentStep}
						<div class="relative z-10 flex flex-col items-center">
							<div
								class="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold transition-colors {done
									? 'bg-brand text-brand-ink ring-4 ring-brand-soft'
									: 'border border-edge-soft bg-well text-ink-faint'}"
							>
								{#if done}
									<CircleCheckBig class="h-5 w-5" />
								{:else}
									{index + 1}
								{/if}
							</div>
							<span
								class="mt-2 text-[11px] {index === currentStep
									? 'font-bold text-ink'
									: done
										? 'text-ink-soft'
										: 'text-ink-faint'}"
							>
								{step.label}
							</span>
						</div>
					{/each}
				</div>
			</div>
		{/if}
	</div>

	<div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
		<div class="space-y-6 lg:col-span-2">
			<!-- ===== Negotiation ===== -->
			<div class="bento-card bento-card-static space-y-4">
				<div class="flex items-center justify-between border-b-2 border-edge pb-3">
					<h2 class="flex items-center gap-1.5 text-sm font-black text-ink">
						<Handshake class="h-4 w-4 text-brand-fg" />
						{m.bk_negotiation()}
					</h2>
					{#if booking.termsFrozenAt}
						<span
							class="inline-flex items-center gap-1 rounded-lg border-2 border-brand-edge bg-brand-soft px-2 py-0.5 text-[10px] font-black tracking-wider text-brand-soft-fg uppercase"
						>
							<Lock class="h-3 w-3" />
							{m.bk_terms_frozen({ date: formatDate(booking.termsFrozenAt) })}
						</span>
					{/if}
				</div>

				<ol class="space-y-3">
					{#each data.proposals as prop, index (prop.id)}
						<li class="relative pl-6">
							<span
								class="absolute top-2 left-0 h-2.5 w-2.5 rounded-full border-2 border-edge {prop.status ===
								'accepted'
									? 'bg-brand'
									: prop.status === 'declined'
										? 'bg-danger'
										: prop.status === 'countered'
											? 'bg-well'
											: 'bg-warn'}"
							></span>
							{#if index < data.proposals.length - 1}
								<span class="absolute top-5 left-[4px] h-full w-0.5 bg-well"></span>
							{/if}

							<div
								class="rounded-2xl border-2 p-3 {prop.status === 'accepted'
									? 'border-brand-edge bg-brand-soft'
									: prop.status === 'pending'
										? 'border-edge bg-surface'
										: 'border-edge-soft bg-panel'}"
							>
								<div class="mb-1 flex flex-wrap items-center justify-between gap-2">
									<span class="text-xs font-black text-ink">
										{prop.proposedBy === 'creator' ? booking.creatorName : booking.organizationName}
										{m.bk_proposed()}
									</span>
									<span class="text-[10px] font-bold text-ink-faint">
										{formatTime(prop.createdAt)}
									</span>
								</div>

								<div class="flex flex-wrap items-center gap-3 text-xs">
									<span class="font-black text-ink">
										{prop.price.toLocaleString()}
										<span class="text-brand-fg">{prop.currencyCode}</span>
									</span>
									<span class="font-medium text-ink-soft">
										{m.bk_revisions_due({
											revisions: prop.revisionsAllowed,
											date: formatDate(prop.deadline)
										})}
									</span>
									<span
										class="rounded-md border border-edge-mid bg-surface px-1.5 py-0.5 text-[9px] font-black tracking-wider uppercase"
									>
										{prop.status}
									</span>
								</div>

								{#if prop.deliverables?.length}
									<ul class="mt-2 space-y-0.5">
										{#each prop.deliverables as item (item)}
											<li class="text-[11px] font-medium text-ink-soft">· {item}</li>
										{/each}
									</ul>
								{/if}

								{#if prop.note}
									<p
										class="mt-2 rounded-lg bg-surface/70 p-2 text-[11px] font-medium text-ink-soft italic"
									>
										"{prop.note}"
									</p>
								{/if}

								{#if prop.status === 'pending' && canRespond}
									<div class="mt-3 flex gap-2 border-t border-edge-soft pt-3">
										<form
											method="POST"
											action="?/respond"
											use:enhance={actionEnhance(m.bk_terms_agreed_toast())}
										>
											<input type="hidden" name="proposalId" value={prop.id} />
											<input type="hidden" name="decision" value="accept" />
											<button
												type="submit"
												class="rounded-lg border-2 border-edge bg-brand px-3 py-1.5 text-[11px] font-black text-brand-ink hover:bg-brand-strong"
											>
												{m.bk_accept_terms()}
											</button>
										</form>
										<form
											method="POST"
											action="?/respond"
											use:enhance={actionEnhance(m.bk_proposal_declined_toast())}
										>
											<input type="hidden" name="proposalId" value={prop.id} />
											<input type="hidden" name="decision" value="decline" />
											<button
												type="submit"
												class="rounded-lg border-2 border-edge bg-surface px-3 py-1.5 text-[11px] font-black text-ink hover:bg-panel"
											>
												{m.bk_decline()}
											</button>
										</form>
									</div>
								{:else if prop.status === 'pending' && !isOperator}
									<p class="mt-2 text-[11px] font-bold text-ink-dim">
										{m.bk_waiting_other_side()}
									</p>
								{/if}
							</div>
						</li>
					{:else}
						<p class="py-4 text-center text-xs font-medium text-ink-dim">
							{m.bk_no_proposals()}
						</p>
					{/each}
				</ol>
			</div>

			<!-- ===== Frozen terms ===== -->
			{#if booking.termsSnapshot}
				<div class="bento-card-mint space-y-3">
					<div class="flex items-center gap-1.5">
						<Lock class="h-4 w-4 text-brand-soft-fg" />
						<h2 class="text-sm font-black text-ink">{m.bk_agreed_terms()}</h2>
					</div>
					<p class="text-[11px] font-medium text-brand-soft-fg">
						{m.bk_agreed_terms_note()}
					</p>

					<div class="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
						<div>
							<span class="block text-[9px] font-black tracking-wider text-ink-soft uppercase">
								{m.bk_fee()}
							</span>
							<span class="font-black text-ink">
								{booking.termsSnapshot.price.toLocaleString()}
								{booking.termsSnapshot.currencyCode}
							</span>
						</div>
						<div>
							<span class="block text-[9px] font-black tracking-wider text-ink-soft uppercase">
								{m.bk_creator_payout()}
							</span>
							<span class="font-black text-ink">
								{booking.termsSnapshot.creatorPayout.toLocaleString()}
							</span>
						</div>
						<div>
							<span class="block text-[9px] font-black tracking-wider text-ink-soft uppercase">
								{m.bk_revisions()}
							</span>
							<span class="font-black text-ink">
								{m.bk_revisions_used({
									used: booking.revisionsUsed,
									allowed: booking.termsSnapshot.revisionsAllowed
								})}
							</span>
						</div>
						<div>
							<span class="block text-[9px] font-black tracking-wider text-ink-soft uppercase">
								{m.bk_deadline()}
							</span>
							<span class="font-black text-ink">
								{formatDate(booking.termsSnapshot.deadline)}
							</span>
						</div>
					</div>

					{#if booking.termsSnapshot.deliverables?.length}
						<div class="border-t border-brand-edge pt-3">
							<span class="mb-1 block text-[9px] font-black tracking-wider text-ink-soft uppercase">
								{m.bk_agreed_deliverables()}
							</span>
							<ul class="space-y-1">
								{#each booking.termsSnapshot.deliverables as item (item)}
									<li class="flex items-start gap-1.5 text-xs font-medium text-ink">
										<CircleCheckBig class="mt-0.5 h-3 w-3 shrink-0 text-brand-soft-fg" />
										<span>{item}</span>
									</li>
								{/each}
							</ul>
						</div>
					{/if}
				</div>
			{/if}

			<!-- ===== Submissions ===== -->
			{#if data.submissions.length}
				<div class="bento-card bento-card-static space-y-3">
					<h2 class="border-b-2 border-edge pb-3 text-sm font-black text-ink">
						{m.bk_delivery_history()}
					</h2>

					{#each data.submissions as sub (sub.id)}
						<div class="rounded-2xl border-2 border-edge-soft bg-panel p-3">
							<div class="mb-2 flex flex-wrap items-center justify-between gap-2">
								<a
									href={sub.contentUrl}
									target="_blank"
									rel="noreferrer"
									class="inline-flex items-center gap-1 text-xs font-black text-brand-soft-fg hover:underline"
								>
									<ExternalLink class="h-3.5 w-3.5" />
									{m.bk_view_submitted()}
								</a>
								<div class="flex items-center gap-2">
									<span
										class="rounded-md border-2 px-2 py-0.5 text-[10px] font-black tracking-wider uppercase {sub.status ===
										'approved'
											? 'border-brand-edge bg-brand-soft text-brand-soft-fg'
											: sub.status === 'revision_requested'
												? 'border-tint-orange-edge bg-tint-orange text-tint-orange-fg'
												: 'border-warn-edge bg-warn-soft text-warn-fg'}"
									>
										{sub.status.replace('_', ' ')}
									</span>
									<span class="text-[10px] font-bold text-ink-faint">
										{formatTime(sub.createdAt)}
									</span>
								</div>
							</div>

							{#if sub.notes}
								<p class="text-[11px] font-medium text-ink-soft italic">"{sub.notes}"</p>
							{/if}

							{#if sub.reviewNote}
								<div class="mt-2 rounded-lg border border-tint-orange-edge bg-tint-orange p-2">
									<span
										class="block text-[9px] font-black tracking-wider text-tint-orange-fg uppercase"
									>
										{m.bk_feedback()}
									</span>
									<p class="text-[11px] font-medium text-tint-orange-fg">{sub.reviewNote}</p>
								</div>
							{/if}
						</div>
					{/each}
				</div>
			{/if}

			<!-- ===== Reviews ===== -->
			{#if data.reviews.length}
				<div class="bento-card bento-card-static space-y-3">
					<h2 class="border-b-2 border-edge pb-3 text-sm font-black text-ink">
						{m.bk_reviews()}
					</h2>
					{#each data.reviews as review (review.id)}
						<div class="rounded-2xl border-2 border-warn-edge bg-warn-soft p-3">
							<div class="mb-1 flex items-center justify-between">
								<span class="text-xs font-black text-ink">
									{review.direction === 'brand_to_creator'
										? `${booking.organizationName} → ${booking.creatorName}`
										: `${booking.creatorName} → ${booking.organizationName}`}
								</span>
								<div class="flex items-center gap-0.5">
									{#each Array(review.rating) as _, i (i)}
										<Star class="h-3.5 w-3.5 fill-warn text-warn" />
									{/each}
									<span class="ml-1 text-xs font-black text-ink">{review.rating}.0</span>
								</div>
							</div>
							<p class="text-[11px] font-medium text-ink-soft italic">"{review.body}"</p>
							<div class="mt-2 flex flex-wrap gap-2 text-[10px] font-bold text-ink-soft">
								<span class="rounded bg-surface px-2 py-0.5">💬 {review.communication}/5</span>
								<span class="rounded bg-surface px-2 py-0.5">✨ {review.quality}/5</span>
								<span class="rounded bg-surface px-2 py-0.5">⏱️ {review.timeliness}/5</span>
								<span class="rounded bg-surface px-2 py-0.5">💼 {review.professionalism}/5</span>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>

		<!-- ===== Sidebar ===== -->
		<div class="space-y-6">
			<div class="bento-card bento-card-static space-y-3">
				<h2 class="border-b-2 border-edge pb-3 text-sm font-black text-ink">
					{m.bk_compensation()}
				</h2>

				<div class="flex items-center justify-between text-xs">
					<span class="font-medium text-ink-soft">{m.bk_status()}</span>
					<BookingStatusBadge status={booking.escrowStatus} kind="escrow" />
				</div>
				<div class="flex items-center justify-between text-xs">
					<span class="font-medium text-ink-soft">{m.bk_agreed_value()}</span>
					<span class="font-black text-ink">
						{booking.price.toLocaleString()}
						{booking.currencyCode}
					</span>
				</div>
				<div class="flex items-center justify-between border-t border-edge-soft pt-2 text-xs">
					<span class="font-medium text-ink-dim">{m.bk_creator_payout()}</span>
					<span class="font-bold text-ink">{booking.creatorPayout.toLocaleString()}</span>
				</div>
				<div class="flex items-center justify-between text-[11px]">
					<span class="text-ink-faint">{m.bk_marketplace_fee()}</span>
					<span class="text-ink-faint">{booking.platformFee.toLocaleString()}</span>
				</div>

				{#if booking.paymentRef}
					<p class="pt-1 font-mono text-[10px] text-ink-dim">
						{m.bk_payment_ref({
							ref: booking.paymentRef,
							method: booking.paymentMethod?.toUpperCase() ?? ''
						})}
					</p>
				{/if}

				<!--
					Money on its way back, when there is any.

					Shown to both sides rather than to operators alone: a brand whose
					deal was cancelled or refunded wants to know the refund exists and
					has not settled yet, and the alternative to saying so here is a
					support message asking where the money is.
				-->
				{#if data.refunds.length}
					<div class="mt-3 space-y-1 border-t-2 border-edge-soft pt-3">
						<p class="text-[10px] font-black tracking-widest text-ink-soft uppercase">
							{m.rf_heading()}
						</p>
						{#each data.refunds as refund (refund.id)}
							<p class="text-[11px] font-medium text-ink-soft">
								{formatAmountWithCode(refund.amount, refund.currencyCode)} ·
								{refundStatusLabel(refund.status)}
							</p>
						{/each}
					</div>
				{/if}

				<p
					class="mt-2 rounded-xl border border-warn-edge bg-warn-soft p-2 text-[10px] leading-relaxed font-medium text-warn-fg"
				>
					{m.bk_compensation_note()}
				</p>
			</div>

			<!-- Messages -->
			<div class="bento-card bento-card-static flex flex-col gap-3">
				<h2
					class="flex items-center gap-1.5 border-b-2 border-edge pb-3 text-sm font-black text-ink"
				>
					<MessageSquare class="h-4 w-4 text-brand-fg" />
					{m.bk_conversation()}
				</h2>

				<div
					class="flex items-start gap-2 rounded-xl border border-warn-edge bg-warn-soft p-2 text-[10px] leading-tight text-warn-fg"
				>
					<ShieldAlert class="mt-0.5 h-3.5 w-3.5 shrink-0 text-warn" />
					<p>
						{m.bk_masking_note()}
					</p>
				</div>

				<div class="thin-scroll max-h-80 space-y-3 overflow-y-auto pr-1">
					{#each data.messages as msg (msg.id)}
						{@const mine = msg.senderId === data.user?.id}
						<div class="flex flex-col {mine ? 'items-end' : 'items-start'}">
							<span class="mb-1 text-[10px] font-semibold text-ink-faint">{msg.senderName}</span>
							<div
								class="max-w-[85%] rounded-2xl p-2.5 text-xs leading-relaxed shadow-xs {mine
									? 'rounded-br-none bg-brand text-brand-ink'
									: 'rounded-bl-none bg-well text-ink'}"
							>
								<p>{msg.body}</p>
								{#if msg.isMasked}
									<div
										class="mt-1.5 flex items-center gap-1 border-t border-current/20 pt-1.5 text-[10px] font-semibold opacity-90"
									>
										<ShieldAlert class="h-3 w-3" />
										<span>{m.bk_contact_hidden()}</span>
									</div>
								{/if}
							</div>
							<span class="mt-1 text-[9px] text-ink-faint">{formatTime(msg.createdAt)}</span>
						</div>
					{:else}
						<p class="py-6 text-center text-xs font-medium text-ink-dim">
							{m.bk_no_messages()}
						</p>
					{/each}
				</div>

				<form
					method="POST"
					action="?/message"
					use:chatEnhance
					class="flex items-center gap-2 border-t border-edge-soft pt-3"
				>
					<input type="hidden" name="bookingId" value={booking.id} />
					<div class="flex-1">
						<InputComp
							form={chatForm}
							errors={chatErrors}
							name="body"
							label={m.bk_send_message()}
							labelHidden
							placeholder={m.bk_message_placeholder()}
						/>
					</div>
					<button
						type="submit"
						class="rounded-xl border-2 border-edge bg-brand p-2 text-brand-ink hover:bg-brand-strong"
						aria-label={m.bk_send_message()}
					>
						<Send class="h-4 w-4" />
					</button>
				</form>
			</div>
		</div>
	</div>
</div>

<!-- ===================== Dialogs ===================== -->

<Dialog.Root bind:open={counterOpen}>
	<Dialog.Content class="w-lg! max-w-[95vw]!">
		<Dialog.Header>
			<Dialog.Title class="text-base font-black">{m.bk_counter_dialog_title()}</Dialog.Title>
			<Dialog.Description class="text-xs font-medium text-ink-soft">
				{m.bk_counter_dialog_body()}
			</Dialog.Description>
		</Dialog.Header>

		<form method="POST" action="?/propose" use:proposalEnhance class="space-y-3 text-xs">
			<Errors allErrors={$proposalAllErrors} />
			<input type="hidden" name="bookingId" value={booking.id} />

			<div class="grid grid-cols-3 gap-2">
				<div class="col-span-2">
					<InputComp
						form={proposalForm}
						errors={proposalErrors}
						name="price"
						type="number"
						min="0"
						label={m.bk_fee()}
					/>
				</div>
				<InputComp
					form={proposalForm}
					errors={proposalErrors}
					name="currencyCode"
					type="select"
					label={m.campaign_currency()}
					items={CURRENCY_ITEMS}
				/>
			</div>

			<InputComp
				form={proposalForm}
				errors={proposalErrors}
				name="deliverables"
				type="textarea"
				rows={4}
				label={m.profile_deliverables_label()}
				hint={m.profile_one_per_line()}
			/>

			<div class="grid grid-cols-2 gap-2">
				<InputComp
					form={proposalForm}
					errors={proposalErrors}
					name="deadline"
					type="date"
					label={m.bk_deadline()}
					futureDays
				/>
				<InputComp
					form={proposalForm}
					errors={proposalErrors}
					name="revisionsAllowed"
					type="number"
					min="0"
					max="10"
					label={m.bk_revisions()}
				/>
			</div>

			<InputComp
				form={proposalForm}
				errors={proposalErrors}
				name="note"
				type="textarea"
				rows={3}
				label={m.bk_note()}
				placeholder={m.bk_note_placeholder()}
			/>

			<button
				type="submit"
				disabled={$proposalDelayed}
				class="w-full rounded-2xl border-2 border-edge bg-brand py-3 font-black text-brand-ink shadow-[3px_3px_0px_0px_rgb(var(--bento-shadow))] hover:bg-brand-strong disabled:opacity-60"
			>
				{#if $proposalDelayed}
					<LoadingBtn name={m.campaign_sending()} />
				{:else}
					{m.bk_send_counter()}
				{/if}
			</button>
		</form>
	</Dialog.Content>
</Dialog.Root>

<Dialog.Root bind:open={submitOpen}>
	<Dialog.Content class="w-lg! max-w-[95vw]!">
		<Dialog.Header>
			<Dialog.Title class="text-base font-black">{m.bk_submit_dialog_title()}</Dialog.Title>
		</Dialog.Header>

		<form method="POST" action="?/submit" use:submissionEnhance class="space-y-3 text-xs">
			<Errors allErrors={$submissionAllErrors} />
			<input type="hidden" name="bookingId" value={booking.id} />

			<InputComp
				form={submissionForm}
				errors={submissionErrors}
				name="contentUrl"
				type="url"
				label={m.bk_content_url()}
				placeholder={m.bk_content_url_placeholder()}
				required
			/>

			<InputComp
				form={submissionForm}
				errors={submissionErrors}
				name="notes"
				type="textarea"
				rows={4}
				label={m.bk_notes_for_brand()}
				placeholder={m.bk_notes_placeholder()}
			/>

			<button
				type="submit"
				disabled={$submissionDelayed}
				class="w-full rounded-2xl border-2 border-edge bg-brand py-3 font-black text-brand-ink shadow-[3px_3px_0px_0px_rgb(var(--bento-shadow))] hover:bg-brand-strong disabled:opacity-60"
			>
				{#if $submissionDelayed}
					<LoadingBtn name={m.bk_submitting()} />
				{:else}
					{m.bk_submit_for_review()}
				{/if}
			</button>
		</form>
	</Dialog.Content>
</Dialog.Root>

<Dialog.Root bind:open={reviewOpen}>
	<Dialog.Content class="w-lg! max-w-[95vw]!">
		<Dialog.Header>
			<Dialog.Title class="text-base font-black">{m.bk_review_dialog_title()}</Dialog.Title>
			<Dialog.Description class="text-xs font-medium text-ink-soft">
				{m.bk_review_dialog_body({
					used: booking.revisionsUsed,
					allowed: booking.revisionsAllowed
				})}
			</Dialog.Description>
		</Dialog.Header>

		{#if openSubmission}
			<div class="space-y-3 text-xs">
				<a
					href={openSubmission.contentUrl}
					target="_blank"
					rel="noreferrer"
					class="inline-flex items-center gap-1 font-black text-brand-soft-fg hover:underline"
				>
					<ExternalLink class="h-3.5 w-3.5" />
					{m.bk_open_submitted()}
				</a>

				<form
					method="POST"
					action="?/review"
					use:enhance={actionEnhance(m.bk_submission_approved_toast())}
				>
					<input type="hidden" name="submissionId" value={openSubmission.id} />
					<input type="hidden" name="decision" value="approve" />
					<button
						type="submit"
						class="w-full rounded-2xl border-2 border-edge bg-brand py-3 font-black text-brand-ink shadow-[3px_3px_0px_0px_rgb(var(--bento-shadow))] hover:bg-brand-strong"
					>
						{m.bk_approve()}
					</button>
				</form>

				<div class="border-t-2 border-edge-soft pt-3">
					<form
						method="POST"
						action="?/review"
						use:enhance={actionEnhance(m.bk_revision_requested_toast())}
						class="space-y-2"
					>
						<input type="hidden" name="submissionId" value={openSubmission.id} />
						<input type="hidden" name="decision" value="revision" />

						<InputComp
							name="reviewNote"
							type="textarea"
							rows={3}
							label={m.bk_request_revision_label()}
							placeholder={m.bk_revision_placeholder()}
							bind:value={revisionNote}
							required
						/>

						<button
							type="submit"
							class="w-full rounded-2xl border-2 border-edge bg-surface py-2.5 font-black text-ink hover:bg-panel"
						>
							{m.bk_request_revision()}
						</button>
					</form>
				</div>
			</div>
		{/if}
	</Dialog.Content>
</Dialog.Root>

<Dialog.Root bind:open={rateOpen}>
	<Dialog.Content class="w-lg! max-w-[95vw]!">
		<Dialog.Header>
			<Dialog.Title class="text-base font-black">
				{m.bk_rate_dialog_title({
					name: isCreator ? booking.organizationName : booking.creatorName
				})}
			</Dialog.Title>
		</Dialog.Header>

		<form method="POST" action="?/rate" use:ratingEnhance class="space-y-4 text-xs">
			<Errors allErrors={$ratingAllErrors} />
			<input type="hidden" name="bookingId" value={booking.id} />

			<div class="space-y-2 rounded-2xl border border-warn-edge bg-warn-soft p-4 text-center">
				<span class="block text-xs font-black tracking-wider text-ink-soft uppercase">
					{m.bk_overall_rating()}
				</span>
				<StarRating
					form={ratingForm}
					errors={ratingErrors}
					name="rating"
					onPick={(star) => {
						/* The overall score seeds the four below it, so the common case
						   — "it was all fine" — is one click rather than five. */
						for (const row of SUB_RATINGS) $ratingForm[row.key] = star;
					}}
				/>
			</div>

			<div class="space-y-2.5 rounded-2xl border border-edge-soft bg-panel p-4">
				<span class="mb-1 block text-[11px] font-black tracking-wider text-ink-dim uppercase">
					{m.bk_detailed_breakdown()}
				</span>

				{#each SUB_RATINGS as row (row.key)}
					<div class="flex items-center justify-between">
						<span class="font-bold text-ink-soft">{row.label}</span>
						<StarRating
							form={ratingForm}
							errors={ratingErrors}
							name={row.key}
							label={row.label}
							size="sm"
						/>
					</div>
				{/each}
			</div>

			<InputComp
				form={ratingForm}
				errors={ratingErrors}
				name="body"
				type="textarea"
				rows={4}
				label={m.bk_written_review()}
				placeholder={m.bk_written_review_placeholder()}
				required
			/>

			<button
				type="submit"
				disabled={$ratingDelayed}
				class="w-full rounded-2xl border-2 border-edge bg-brand py-3 font-black text-brand-ink shadow-[3px_3px_0px_0px_rgb(var(--bento-shadow))] hover:bg-brand-strong disabled:opacity-60"
			>
				{#if $ratingDelayed}
					<LoadingBtn name={m.bk_publishing()} />
				{:else}
					{m.bk_publish_review()}
				{/if}
			</button>
		</form>
	</Dialog.Content>
</Dialog.Root>

<!--
	Raising a case.

	The hint is the important part of this dialog. Both sides can reach it and
	most of them will be reaching for it in frustration, so it says plainly what
	pressing it does: the deal stops, and somebody neutral reads both accounts
	before any money moves.
-->
<Dialog.Root bind:open={disputeOpen}>
	<Dialog.Content class="w-lg! max-w-[95vw]!">
		<Dialog.Header>
			<Dialog.Title class="text-base font-black">{m.dsp_raise()}</Dialog.Title>
			<Dialog.Description class="text-xs text-ink-soft">{m.dsp_raise_hint()}</Dialog.Description>
		</Dialog.Header>

		<form method="POST" action="?/raiseDispute" use:disputeEnhance class="space-y-3 text-xs">
			<InputComp
				form={disputeForm}
				errors={disputeErrors}
				name="reason"
				type="textarea"
				rows={5}
				label={m.dsp_reason()}
				hint={m.dsp_reason_hint()}
				required
			/>

			<InputComp
				form={disputeForm}
				errors={disputeErrors}
				name="evidenceUrl"
				type="url"
				label={m.dsp_evidence()}
				hint={m.dsp_evidence_hint()}
			/>

			<button
				type="submit"
				disabled={$disputeDelayed}
				class="w-full rounded-2xl border-2 border-edge bg-danger py-3 font-black text-white shadow-[3px_3px_0px_0px_rgb(var(--bento-shadow))] hover:opacity-90 disabled:opacity-60"
			>
				{#if $disputeDelayed}
					<LoadingBtn name={m.dsp_submit()} />
				{:else}
					{m.dsp_submit()}
				{/if}
			</button>
		</form>
	</Dialog.Content>
</Dialog.Root>

<!-- The other side's one written answer. -->
<Dialog.Root bind:open={respondOpen}>
	<Dialog.Content class="w-lg! max-w-[95vw]!">
		<Dialog.Header>
			<Dialog.Title class="text-base font-black">{m.dsp_respond()}</Dialog.Title>
		</Dialog.Header>

		<form method="POST" action="?/respondDispute" use:respondEnhance class="space-y-3 text-xs">
			<input type="hidden" name="id" value={openCase?.id ?? 0} />

			<InputComp
				form={respondForm}
				errors={respondErrors}
				name="text"
				type="textarea"
				rows={5}
				label={m.dsp_response()}
				hint={m.dsp_response_hint()}
				required
			/>

			<InputComp
				form={respondForm}
				errors={respondErrors}
				name="evidenceUrl"
				type="url"
				label={m.dsp_evidence()}
				hint={m.dsp_evidence_hint()}
			/>

			<button
				type="submit"
				disabled={$respondDelayed}
				class="w-full rounded-2xl border-2 border-edge bg-brand py-3 font-black text-brand-ink shadow-[3px_3px_0px_0px_rgb(var(--bento-shadow))] hover:bg-brand-strong disabled:opacity-60"
			>
				{#if $respondDelayed}
					<LoadingBtn name={m.dsp_respond_submit()} />
				{:else}
					{m.dsp_respond_submit()}
				{/if}
			</button>
		</form>
	</Dialog.Content>
</Dialog.Root>

<!-- Asking the other side to call it off. -->
<Dialog.Root bind:open={cancelOpen}>
	<Dialog.Content class="w-lg! max-w-[95vw]!">
		<Dialog.Header>
			<Dialog.Title class="text-base font-black">{m.cx_request()}</Dialog.Title>
			<Dialog.Description class="text-xs text-ink-soft">{m.cx_request_hint()}</Dialog.Description>
		</Dialog.Header>

		<form method="POST" action="?/requestCancel" use:cancelEnhance class="space-y-3 text-xs">
			<InputComp
				form={cancelForm}
				errors={cancelErrors}
				name="reason"
				type="textarea"
				rows={4}
				label={m.cx_reason()}
				hint={m.cx_reason_hint()}
				required
			/>

			<button
				type="submit"
				disabled={$cancelDelayed}
				class="w-full rounded-2xl border-2 border-edge bg-surface py-3 font-black text-ink shadow-[3px_3px_0px_0px_rgb(var(--bento-shadow))] hover:bg-panel disabled:opacity-60"
			>
				{#if $cancelDelayed}
					<LoadingBtn name={m.cx_submit()} />
				{:else}
					{m.cx_submit()}
				{/if}
			</button>
		</form>
	</Dialog.Content>
</Dialog.Root>
