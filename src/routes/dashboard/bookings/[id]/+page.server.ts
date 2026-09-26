import * as m from '$lib/paraglide/messages';
import { error, fail, redirect } from '@sveltejs/kit';
import { superValidate, message } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { and, desc, eq, sql } from 'drizzle-orm';
import type { PageServerLoad, Actions, RequestEvent } from './$types';
import { db, rowsAffected } from '$lib/server/db';
import * as t from '$lib/server/db/schema';
import { getBookingDetail, getSettings } from '$lib/server/queries';
import { notify } from '$lib/server/notify';
import { chapaEnabled } from '$lib/server/chapa';
import { PAYMENT_GATEWAY_ENABLED } from '$lib/payment-gateway';
import * as payments from '$lib/server/payments';
import * as disputes from '$lib/server/disputes';
import * as refunds from '$lib/server/refunds';
import { requireBookingAccess, recordAudit } from '$lib/server/guards';
import { refreshCreatorCompletedBookings, refreshCreatorRating } from '$lib/server/score-service';
import { dealVersion, markBookingRead, markNotificationsReadForLink } from '$lib/server/inbox';
import {
	awaitsDeposit,
	canApproveConcept,
	canTransition,
	type BookingStatus
} from '$lib/domain/booking';
import { projectSizeProblem } from '$lib/domain/commission';
import { checkpointIsOpen, postedAtProblem, type Checkpoint } from '$lib/domain/proof';
import { withholdingOn } from '$lib/domain/documents';
import { getCommissionSettings, priceDeal, quoteColumns } from '$lib/server/commission';
import * as contracts from '$lib/server/contracts';
import * as documents from '$lib/server/documents';
import { acceptNda, brandVisibility, maskRow } from '$lib/server/nda';
import { faydaConfig } from '$lib/server/fayda-config';
import { saveUploadedFile } from '$lib/server/upload';
import { uploadErrorText } from '$lib/server/crud';
import { clientAddress } from '$lib/server/bot-defence';
import { recalcOrganizationRatings } from '$lib/server/db/rollups';
import {
	cancelAgreeProblem,
	cancelRequestProblem,
	disputeProblem,
	disputeWindowClosesAt,
	type CancelProblem,
	type DisputeProblem
} from '$lib/domain/dispute';
import { maskContact } from '$lib/domain/mask';
import {
	proposalSchema,
	proposalRespond,
	fundEscrowSchema,
	submissionSchema,
	reviewSubmission,
	reviewSchema,
	messageSchema,
	bookingIdSchema,
	disputeRaise,
	disputeRespond,
	disputeWithdraw,
	cancelRequest,
	cancelDecision,
	contractSign,
	conceptSubmit,
	conceptReview,
	proofSubmit,
	metricsRecord
} from '$lib/schemas';

const toLines = (value: string) =>
	value
		.split('\n')
		.map((line) => line.trim())
		.filter(Boolean);

export const load: PageServerLoad = async (event) => {
	const id = Number(event.params.id);
	if (!Number.isFinite(id)) error(404, m.srv_booking_not_found());

	const { side, user, booking: row } = await requireBookingAccess(event, id);
	const [detail, version] = await Promise.all([
		getBookingDetail(id),
		/* What the live thread compares against — see `dealVersion`. */
		dealVersion(id, row.updatedAt),
		/* Opening the deal is reading it: its messages stop counting as unread,
		   and so do the notifications that pointed here. */
		markBookingRead(user.id, id),
		markNotificationsReadForLink(user.id, `/dashboard/bookings/${id}`)
	]);
	if (!detail) error(404, m.srv_booking_not_found());

	const [
		proposalForm,
		submitForm,
		reviewForm,
		messageForm,
		disputeForm,
		respondForm,
		cancelForm,
		signForm,
		conceptForm,
		proofForm,
		metricsForm
	] = await Promise.all([
		superValidate(zod4(proposalSchema), { id: 'proposal' }),
		superValidate(zod4(submissionSchema), { id: 'submission' }),
		superValidate(zod4(reviewSchema), { id: 'review' }),
		superValidate(zod4(messageSchema), { id: 'message' }),
		superValidate(zod4(disputeRaise), { id: 'dispute' }),
		superValidate(zod4(disputeRespond), { id: 'dispute-respond' }),
		superValidate(zod4(cancelRequest), { id: 'cancel' }),
		superValidate(zod4(contractSign), { id: 'sign', errors: false }),
		superValidate(zod4(conceptSubmit), { id: 'concept', errors: false }),
		superValidate(zod4(proofSubmit), { id: 'proof', errors: false }),
		superValidate(zod4(metricsRecord), { id: 'metrics', errors: false })
	]);
	signForm.data.bookingId = id;
	conceptForm.data.bookingId = id;
	proofForm.data.bookingId = id;
	metricsForm.data.bookingId = id;

	/* Seed the counter-offer form from whatever is currently on the table. */
	const latest = detail.proposals.at(-1);
	proposalForm.data.bookingId = id;
	proposalForm.data.price = latest?.price ?? detail.booking.price;
	proposalForm.data.currencyCode = (latest?.currencyCode ??
		detail.booking.currencyCode) as typeof proposalForm.data.currencyCode;
	proposalForm.data.deliverables = (latest?.deliverables ?? detail.booking.deliverables).join('\n');
	proposalForm.data.deadline = latest?.deadline
		? String(latest.deadline).slice(0, 10)
		: detail.booking.deadline
			? String(detail.booking.deadline).slice(0, 10)
			: '';
	proposalForm.data.revisionsAllowed = latest?.revisionsAllowed ?? detail.booking.revisionsAllowed;

	submitForm.data.bookingId = id;
	reviewForm.data.bookingId = id;
	messageForm.data.bookingId = id;

	/*
	 * Coming back from Chapa's hosted page.
	 *
	 * The webhook is the reliable half of the round trip, but it lands
	 * server-to-server and may be seconds behind the browser — or blocked
	 * entirely on a host that cannot receive it. Resolving the reference here
	 * too means the reader sees the outcome on the page they were returned to,
	 * and `settle` is written so that whichever arrives second changes nothing.
	 *
	 * Nobody is sent to that page while the gateway is off, so a `?payment=`
	 * in the query is a stale link or a guess. It is not looked up: `settle`
	 * would ask the provider about a reference this deployment never issued.
	 */
	const returned = PAYMENT_GATEWAY_ENABLED ? event.url.searchParams.get('payment') : null;
	const payment = returned ? await payments.settle(returned) : null;

	/* Re-read only when this request is the one that changed something, so the
	   page does not show `pending` for a deposit it just took. */
	const current = payment?.state === 'funded' ? ((await getBookingDetail(id)) ?? detail) : detail;

	const [settings, caseList, refundList, managed, commission] = await Promise.all([
		getSettings(),
		disputes.listForBooking(id),
		refunds.listForBooking(id),
		managedDeal(id, side, row.creatorId),
		getCommissionSettings()
	]);
	const windowDays = settings?.disputeWindowDays ?? 0;
	const openCase = caseList.find((c) => c.status === 'open') ?? null;

	/*
	 * The brand's name, for a creator who has not accepted the NDA on this deal
	 * (or on the brief it came from), is replaced before the row leaves the
	 * server — and so are the brand staff's names on their messages.
	 */
	const canSeeBrand = (
		await brandVisibility(user, [
			{
				organizationId: current.booking.organizationId,
				campaignId: current.booking.campaignId,
				bookingId: id
			}
		])
	)({
		organizationId: current.booking.organizationId,
		campaignId: current.booking.campaignId,
		bookingId: id
	});
	const booking = maskRow(current.booking, canSeeBrand);
	const orgMemberIds = canSeeBrand
		? new Set<string>()
		: await organizationUserIds(booking.organizationId);
	const threadMessages = current.messages.map((msg) =>
		!canSeeBrand && orgMemberIds.has(msg.senderId)
			? { ...msg, senderName: booking.organizationName }
			: msg
	);

	return {
		...current,
		booking,
		messages: threadMessages,
		canSeeBrand,
		side,
		...managed,
		minProjectSize: commission.minProjectSize,
		signForm,
		conceptForm,
		proofForm,
		metricsForm,
		version,
		proposalForm,
		submitForm,
		reviewForm,
		messageForm,
		disputeForm,
		respondForm,
		cancelForm,
		disputes: caseList,
		refunds: refundList,
		/*
		 * Whether each button may be drawn, decided here rather than in the
		 * template. The same tests run again inside every action, because a page
		 * left open while the deal moved on would otherwise post against a view
		 * that is no longer true.
		 */
		disputeProblem: disputeProblem(current.booking, {
			side,
			hasOpenDispute: Boolean(openCase),
			windowDays
		}),
		disputeWindowClosesAt: disputeWindowClosesAt(current.booking.completedAt, windowDays),
		cancelRequestProblem: cancelRequestProblem(current.booking),
		cancelAgreeProblem: cancelAgreeProblem(current.booking, side),
		payment: payment ? { state: payment.state } : null,
		/* What the pay button needs to know, decided on the server: whether the
		   provider is configured at all, and whether this booking is one it can
		   take money for. */
		canPayOnline: chapaEnabled && payments.payableProblem(current.booking) === null,
		payProblem: payments.payableProblem(current.booking),
		/* The operator's manual deposit is drawn from this rather than from
		   `canPayOnline`: it records money that moved outside the platform, so
		   it belongs to the gateway being on, not to Chapa being reachable. */
		paymentsEnabled: PAYMENT_GATEWAY_ENABLED,
		/* Decided here rather than re-derived in the template, so the button and
		   the action it posts to are asking the same question. */
		canApproveConcept: canApproveConcept(current.booking),
		awaitsDeposit: awaitsDeposit(current.booking)
	};
};

/**
 * Everything a managed deal carries beyond the negotiation: the contract, the
 * concepts, the proof and its figures, and the documents issued on it.
 */
async function managedDeal(
	bookingId: number,
	side: 'admin' | 'organization' | 'creator',
	creatorId: number
) {
	const [contract, conceptRows, proofRows, metricRows, documentRows, identity] = await Promise.all([
		contracts.currentContract(bookingId),
		db
			.select()
			.from(t.concepts)
			.where(eq(t.concepts.bookingId, bookingId))
			.orderBy(desc(t.concepts.createdAt)),
		db.select().from(t.postProofs).where(eq(t.postProofs.bookingId, bookingId)).limit(1),
		db
			.select()
			.from(t.proofMetrics)
			.where(eq(t.proofMetrics.bookingId, bookingId))
			.orderBy(t.proofMetrics.capturedAt),
		documents.listDocumentsFor(bookingId, side),
		side === 'creator' ? creatorIdentityVerified(creatorId) : Promise.resolve(true)
	]);
	return {
		contract: contract
			? {
					id: contract.id,
					reference: contract.reference,
					version: contract.version,
					status: contract.status,
					body: contract.body,
					bodyHash: contract.bodyHash,
					brandSignerName: contract.brandSignerName,
					brandSignedAt: contract.brandSignedAt,
					creatorSignerName: contract.creatorSignerName,
					creatorSignedAt: contract.creatorSignedAt,
					signedAt: contract.signedAt
				}
			: null,
		concepts: conceptRows,
		proof: proofRows.at(0) ?? null,
		metrics: metricRows,
		documents: documentRows,
		/* A creator signs only once Fayda has checked them, where Fayda is set up. */
		identityRequired: side === 'creator' && faydaConfig() !== null && !identity
	};
}

/** Whether a creator has passed a Fayda check. */
async function creatorIdentityVerified(creatorId: number) {
	const rows = await db
		.select({ id: t.identityChecks.id })
		.from(t.identityChecks)
		.where(and(eq(t.identityChecks.creatorId, creatorId), eq(t.identityChecks.status, 'verified')))
		.limit(1);
	return rows.length > 0;
}

/** Every account on a brand's side, for masking their names on the thread. */
async function organizationUserIds(organizationId: number) {
	const [members, owner] = await Promise.all([
		db
			.select({ id: t.organizationMembers.userId })
			.from(t.organizationMembers)
			.where(eq(t.organizationMembers.organizationId, organizationId)),
		db
			.select({ id: t.organizations.ownerId })
			.from(t.organizations)
			.where(eq(t.organizations.id, organizationId))
	]);
	return new Set([...members, ...owner].map((row) => row.id));
}

/** Whether this creator may see the brand on this deal yet. */
async function creatorCanSeeBrand(
	user: { id: string; role?: string | null },
	booking: { organizationId: number; campaignId: number | null; id: number }
) {
	const ref = {
		organizationId: booking.organizationId,
		campaignId: booking.campaignId,
		bookingId: booking.id
	};
	return (await brandVisibility(user, [ref]))(ref);
}

/** Applies a state change only when the transition is legal, and records it. */
async function transition(
	event: RequestEvent,
	bookingId: number,
	from: BookingStatus,
	to: BookingStatus,
	extra: Record<string, unknown> = {},
	reason?: string
) {
	if (!canTransition(from, to)) {
		return { ok: false as const, text: m.srv_bad_transition({ from, to }) };
	}

	await db
		.update(t.bookings)
		.set({ status: to, updatedBy: event.locals.user?.id, ...extra })
		.where(eq(t.bookings.id, bookingId));

	await recordAudit({
		actorId: event.locals.user?.id,
		actorLabel: event.locals.user?.name,
		entity: 'booking',
		entityId: bookingId,
		action: 'status_change',
		fromState: from,
		toState: to,
		reason
	});

	return { ok: true as const };
}

/**
 * Both channels, for the one category everything on this page belongs to.
 *
 * Every notification raised from a booking action is the deal itself moving —
 * proposed, agreed, funded, submitted, revised, settled — so the category and
 * the button are fixed here and the call sites say only what happened. Whether
 * it also becomes an email is `domain/notify.ts`'s decision, not this file's.
 */
const notifyDeal = (
	userId: string | null | undefined | (string | null | undefined)[],
	title: string,
	body: string,
	link: string
) =>
	notify(userId, {
		category: 'deals',
		kind: 'booking',
		title,
		body,
		link,
		actionLabel: m.mail_open_booking(),
		footnote: m.mail_prefs_footnote()
	});

/** The account on each side of a booking, either of which may be absent. */
async function bookingParties(organizationId: number, creatorId: number) {
	const [orgRows, creatorRows] = await Promise.all([
		db
			.select({ ownerId: t.organizations.ownerId })
			.from(t.organizations)
			.where(eq(t.organizations.id, organizationId))
			.limit(1),
		db
			.select({ userId: t.creators.userId })
			.from(t.creators)
			.where(eq(t.creators.id, creatorId))
			.limit(1)
	]);

	return { organizationOwnerId: orgRows.at(0)?.ownerId, creatorUserId: creatorRows.at(0)?.userId };
}

/** Why a case could not be raised, in the reader's language. */
const disputeProblemText = (problem: DisputeProblem): string =>
	({
		not_disputable: m.dsp_problem_not_disputable(),
		window_closed: m.dsp_problem_window_closed(),
		already_open: m.dsp_problem_already_open(),
		not_a_party: m.dsp_problem_not_a_party()
	})[problem];

/** Why a cancellation could not be asked for or agreed to. */
const cancelProblemText = (problem: CancelProblem): string =>
	({
		not_cancellable: m.cx_problem_not_cancellable(),
		already_requested: m.cx_problem_already_requested(),
		own_request: m.cx_problem_own_request(),
		no_request: m.cx_problem_no_request()
	})[problem];

/**
 * Where a booking was before a dispute froze it.
 *
 * Read out of the audit log rather than kept on the booking, because the row
 * itself no longer remembers: `status` is `disputed`, and the state it came
 * from only exists in the entry the freeze wrote. A case raised from `revision`
 * must not resume at `in_production`.
 *
 * `booked` is the fallback, and it is the safe one: it is the earliest state a
 * dispute can be raised from, so a booking restored to it can always move
 * forward again through the ordinary path.
 */
async function statusBeforeDispute(bookingId: number): Promise<string> {
	const rows = await db
		.select({ fromState: t.auditLog.fromState })
		.from(t.auditLog)
		.where(
			and(
				eq(t.auditLog.entity, 'booking'),
				eq(t.auditLog.entityId, bookingId),
				eq(t.auditLog.action, 'dispute_raised')
			)
		)
		.orderBy(desc(t.auditLog.id))
		.limit(1);

	const from = rows.at(0)?.fromState;
	return from && canTransition(from as BookingStatus, 'disputed') ? from : 'booked';
}

export const actions: Actions = {
	/* ---------------- negotiation ---------------- */

	propose: async (event) => {
		const id = Number(event.params.id);
		const { booking, side } = await requireBookingAccess(event, id);
		const form = await superValidate(event.request, zod4(proposalSchema), { id: 'proposal' });

		if (side === 'admin') {
			return message(
				form,
				{ type: 'error', text: m.srv_operators_no_negotiate() },
				{ status: 403 }
			);
		}
		if (!form.valid) {
			return message(form, { type: 'error', text: m.srv_check_form() }, { status: 400 });
		}
		if (!['proposed', 'negotiating'].includes(booking.status)) {
			return message(form, { type: 'error', text: m.srv_terms_already_agreed() }, { status: 409 });
		}
		/* A creator negotiates knowing who with: the NDA comes first. */
		if (side === 'creator' && !(await creatorCanSeeBrand(event.locals.user!, booking))) {
			return message(form, { type: 'error', text: m.nda_required() }, { status: 403 });
		}
		const commission = await getCommissionSettings();
		if (projectSizeProblem(form.data.price, booking.compensationType, commission)) {
			return message(
				form,
				{
					type: 'error',
					text: m.srv_below_min_project({ min: commission.minProjectSize.toLocaleString('en-US') })
				},
				{ status: 400 }
			);
		}

		/* Any earlier open offer is superseded by this counter. */
		await db
			.update(t.termProposals)
			.set({ status: 'countered' })
			.where(and(eq(t.termProposals.bookingId, id), eq(t.termProposals.status, 'pending')));

		await db.insert(t.termProposals).values({
			bookingId: id,
			proposedBy: side === 'creator' ? 'creator' : 'organization',
			price: form.data.price,
			currencyCode: form.data.currencyCode,
			deliverables: toLines(form.data.deliverables),
			deadline: form.data.deadline || null,
			revisionsAllowed: form.data.revisionsAllowed,
			note: form.data.note || null,
			status: 'pending',
			createdBy: event.locals.user?.id
		});

		if (booking.status === 'proposed') {
			await db.update(t.bookings).set({ status: 'negotiating' }).where(eq(t.bookings.id, id));
		}

		await recordAudit({
			actorId: event.locals.user?.id,
			actorLabel: event.locals.user?.name,
			entity: 'booking',
			entityId: id,
			action: 'counter_offer',
			reason: `${side} proposed ${form.data.price} ${form.data.currencyCode}`
		});

		return message(form, { type: 'success', text: m.srv_counter_sent() });
	},

	/**
	 * Accepting the open proposal is the moment terms freeze. The snapshot is
	 * written once and nothing downstream may rewrite it (PRD FR-061).
	 */
	respond: async (event) => {
		const id = Number(event.params.id);
		const { booking, side } = await requireBookingAccess(event, id);
		const form = await superValidate(event.request, zod4(proposalRespond));

		if (!form.valid) return fail(400, { message: m.srv_invalid_request() });
		if (side === 'admin') return fail(403, { message: m.srv_operators_no_accept() });

		const rows = await db
			.select()
			.from(t.termProposals)
			.where(and(eq(t.termProposals.id, form.data.proposalId), eq(t.termProposals.bookingId, id)))
			.limit(1);
		const proposal = rows.at(0);

		if (!proposal || proposal.status !== 'pending') {
			return fail(409, { message: m.srv_proposal_closed() });
		}
		/* The side that made the offer cannot accept its own. */
		const proposedBySelf =
			(side === 'creator' && proposal.proposedBy === 'creator') ||
			(side === 'organization' && proposal.proposedBy === 'organization');
		if (proposedBySelf) {
			return fail(403, { message: m.srv_no_self_accept() });
		}
		if (side === 'creator' && !(await creatorCanSeeBrand(event.locals.user!, booking))) {
			return fail(403, { message: m.nda_required() });
		}

		if (form.data.decision === 'decline') {
			await db
				.update(t.termProposals)
				.set({ status: 'declined' })
				.where(eq(t.termProposals.id, proposal.id));

			const result = await transition(event, id, booking.status as BookingStatus, 'cancelled', {
				cancelReason: 'Proposal declined'
			});
			if (!result.ok) return fail(409, { message: result.text });
			return { declined: true };
		}

		/* Priced by the rate card in force now, and frozen with the terms. */
		const quote = await priceDeal(proposal.price, booking.creatorId);
		const fees = quoteColumns(quote);

		const creatorRows = await db
			.select({ userId: t.creators.userId, fullName: t.creators.fullName })
			.from(t.creators)
			.where(eq(t.creators.id, booking.creatorId))
			.limit(1);
		const orgRows = await db
			.select({ ownerId: t.organizations.ownerId, name: t.organizations.name })
			.from(t.organizations)
			.where(eq(t.organizations.id, booking.organizationId))
			.limit(1);

		const snapshot = {
			title: booking.title,
			deliverables: proposal.deliverables,
			price: proposal.price,
			currencyCode: proposal.currencyCode,
			platformFee: fees.platformFee,
			creatorPayout: fees.creatorPayout,
			commissionPercent: fees.commissionPercent,
			brandServiceFee: fees.brandServiceFee,
			brandServiceFeeVat: fees.brandServiceFeeVat,
			brandTotal: fees.brandTotal,
			compensationType: booking.compensationType,
			revisionsAllowed: proposal.revisionsAllowed,
			deadline: proposal.deadline ? String(proposal.deadline) : null,
			agreedAt: new Date().toISOString(),
			agreedByOrgUserId: orgRows.at(0)?.ownerId ?? null,
			agreedByCreatorUserId: creatorRows.at(0)?.userId ?? null
		};

		await db
			.update(t.termProposals)
			.set({ status: 'accepted' })
			.where(eq(t.termProposals.id, proposal.id));

		const result = await transition(
			event,
			id,
			booking.status as BookingStatus,
			'contracting',
			{
				price: proposal.price,
				currencyCode: proposal.currencyCode,
				deliverables: proposal.deliverables,
				deadline: proposal.deadline,
				revisionsAllowed: proposal.revisionsAllowed,
				...fees,
				termsSnapshot: snapshot,
				termsFrozenAt: new Date()
			},
			'Both sides confirmed the same terms'
		);
		if (!result.ok) return fail(409, { message: result.text });

		/* The contract is written from the snapshot just frozen, and goes to
		   both sides for signature. */
		const frozen = (await db.select().from(t.bookings).where(eq(t.bookings.id, id)).limit(1))[0];
		await contracts.generateContract(frozen, {
			id: event.locals.user?.id,
			name: event.locals.user?.name
		});

		await notifyDeal(
			[orgRows.at(0)?.ownerId, creatorRows.at(0)?.userId],
			m.notif_contract_ready_title(),
			m.notif_contract_ready_body({ title: booking.title }),
			`/dashboard/bookings/${id}`
		);

		return { accepted: true };
	},

	/* ---------------- compensation ---------------- */

	/**
	 * Sends the brand to Chapa to pay the deposit.
	 *
	 * Ends in a redirect to the provider rather than a message, so it sits
	 * outside the `try`: `redirect()` throws, and catching it would turn a
	 * successful hand-off into a 500 — the same shape as the Google button on
	 * the login page.
	 *
	 * Nothing here decides that money arrived. That is `settle`, and it only
	 * ever concludes anything from an answer Chapa gave to a question we asked.
	 */
	payDeposit: async (event) => {
		const id = Number(event.params.id);
		const { booking, side, user } = await requireBookingAccess(event, id);

		if (side === 'creator') return fail(403, { message: m.srv_only_brand_funds() });
		if (!chapaEnabled) return fail(503, { message: m.srv_payments_unavailable() });

		/* The same test the button is drawn from, re-run here: a page held open
		   while the deal moved on would otherwise post against a stale view. */
		const problem = payments.payableProblem(booking);
		if (problem === 'not_paid') return fail(400, { message: m.srv_only_paid_funded() });
		if (problem === 'settled') return fail(409, { message: m.srv_already_funded() });
		if (problem === 'currency') {
			return fail(400, { message: m.srv_currency_unsupported({ code: booking.currencyCode }) });
		}

		const started = await payments.start(booking, {
			id: user.id,
			email: user.email,
			name: user.name
		});

		if (!started.ok) {
			/* The provider's own words are logged, not shown: they are English,
			   often about our request rather than their payment, and none of it
			   is something a brand can act on. */
			console.error(`Chapa checkout failed for booking ${id}:`, started.error);
			return fail(502, { message: m.srv_payment_start_failed() });
		}

		redirect(303, started.checkoutUrl);
	},

	fund: async (event) => {
		const id = Number(event.params.id);
		const { booking, side } = await requireBookingAccess(event, id);
		const form = await superValidate(event.request, zod4(fundEscrowSchema));

		/*
		 * Operators only, now that brands pay through Chapa.
		 *
		 * This marks a deposit held without any money moving, which is exactly
		 * what is needed for a bank transfer or a telebirr payment made outside
		 * the platform — and exactly what a brand must not be able to do for
		 * itself. The audit entry and the `MANUAL-` reference are what keep the
		 * two kinds of deposit apart afterwards.
		 */
		if (side !== 'admin') return fail(403, { message: m.srv_manual_deposit_operator() });
		/* The button is not drawn while the gateway is off, so reaching this is a
		   page held open across the switch. Refused rather than honoured: a deal
		   that needs no deposit to complete should not collect one either. */
		if (!PAYMENT_GATEWAY_ENABLED) return fail(503, { message: m.srv_payments_unavailable() });
		if (!form.valid) return fail(400, { message: m.srv_invalid_request() });
		/* There is no deposit to record against barter or an event pass, and
		   `settle` only requires one for a paid booking. */
		if (booking.compensationType !== 'paid') {
			return fail(400, { message: m.srv_only_paid_funded() });
		}
		if (booking.escrowStatus !== 'unfunded') {
			return fail(409, { message: m.srv_already_funded() });
		}

		/*
		 * No payment provider is connected yet, so this records an operator-marked
		 * deposit rather than moving money. The reference makes that explicit.
		 *
		 * `escrow_status` is re-tested in the WHERE clause rather than trusted from
		 * the read above: two concurrent posts both passed that check and both
		 * wrote a deposit record. Zero rows here means the other one won.
		 */
		const funded = await db
			.update(t.bookings)
			.set({
				escrowStatus: 'held',
				paymentMethod: form.data.paymentMethod,
				paymentRef: `MANUAL-${Date.now().toString(36).toUpperCase()}`,
				updatedBy: event.locals.user?.id
			})
			.where(and(eq(t.bookings.id, id), eq(t.bookings.escrowStatus, 'unfunded')));

		if (rowsAffected(funded) === 0) {
			return fail(409, { message: m.srv_already_funded() });
		}

		/* Holding the funds does not start the work by itself: approving the
		   concept does, and that approval was waiting on exactly this. */
		await recordAudit({
			actorId: event.locals.user?.id,
			actorLabel: event.locals.user?.name,
			entity: 'booking',
			entityId: id,
			action: 'compensation_held',
			toState: 'held',
			reason: `Recorded via ${form.data.paymentMethod}`
		});

		return { funded: true };
	},

	/** Marks compensation fulfilled and completes the booking. */
	settle: async (event) => {
		const id = Number(event.params.id);
		const { booking, side } = await requireBookingAccess(event, id);
		const form = await superValidate(event.request, zod4(bookingIdSchema));

		if (side === 'creator') return fail(403, { message: m.srv_only_brand_settles() });
		if (!form.valid) return fail(400, { message: m.srv_invalid_request() });

		/*
		 * PRD FR-083: completion requires the compensation obligation to be met.
		 *
		 * Only while there is a way to meet it. With the gateway off there is no
		 * deposit to take and no button that would have taken one, so holding a
		 * paid deal at `delivered` would strand it on a step that cannot be
		 * performed — the compensation is settled between the parties instead,
		 * exactly as a barter deal's always was.
		 */
		if (
			PAYMENT_GATEWAY_ENABLED &&
			booking.compensationType === 'paid' &&
			booking.escrowStatus !== 'held'
		) {
			return fail(409, { message: m.srv_record_deposit_first() });
		}

		/*
		 * `released` is only true of a deposit that was actually held.
		 *
		 * Writing it onto a booking nobody funded would be a lie the payout
		 * queue believes: `payoutProblem` reads `released` as permission to send
		 * money, and every paid deal completed while the gateway was off would
		 * turn up in that queue the day it is switched back on. Left as it was,
		 * such a booking reads `unfunded` — which is what happened.
		 */
		const escrowPatch =
			booking.compensationType !== 'paid' || booking.escrowStatus === 'held'
				? { escrowStatus: 'released' as const }
				: {};

		/* Tax withheld from the creator's payout is fixed now, at the rate in
		   force, and certified on the documents issued below. */
		const settingsNow = await getSettings();
		const withholdingTax =
			booking.compensationType === 'paid'
				? withholdingOn(booking.creatorPayout, settingsNow?.withholdingPercent ?? 0)
				: 0;

		const result = await transition(
			event,
			id,
			booking.status as BookingStatus,
			'completed',
			{ ...escrowPatch, completedAt: new Date(), withholdingTax },
			'Compensation marked fulfilled'
		);
		if (!result.ok) return fail(409, { message: result.text });

		const completed = (await db.select().from(t.bookings).where(eq(t.bookings.id, id)).limit(1))[0];
		await documents.issueCreatorDocuments(completed);
		/* A deal completed without its invoice — one agreed before invoicing
		   existed — gets it now, so the brand's records are whole. */
		await documents.issueBrandInvoice(completed);

		await refreshCreatorCompletedBookings(booking.creatorId);

		const creatorRows = await db
			.select({ userId: t.creators.userId })
			.from(t.creators)
			.where(eq(t.creators.id, booking.creatorId))
			.limit(1);

		await notifyDeal(
			creatorRows.at(0)?.userId,
			m.notif_booking_completed_title(),
			m.notif_booking_completed_body({ title: booking.title }),
			`/dashboard/bookings/${id}`
		);

		return { settled: true };
	},

	/* ---------------- cancelling by agreement ---------------- */

	/**
	 * Asks the other side to call the deal off.
	 *
	 * Not a cancellation. Most stuck deals are not disagreements — somebody's
	 * plans changed — and this is the path that does not make an operator
	 * arbitrate something nobody is arguing about. It takes two presses from two
	 * people, which is what stops one party walking away from a funded deal and
	 * the other finding out afterwards.
	 */
	requestCancel: async (event) => {
		const id = Number(event.params.id);
		const { booking, side, user } = await requireBookingAccess(event, id);
		const form = await superValidate(event.request, zod4(cancelRequest), { id: 'cancel' });

		if (side === 'admin') return fail(403, { message: m.dsp_problem_not_a_party() });
		if (!form.valid) return fail(400, { message: m.srv_check_form() });

		const problem = cancelRequestProblem(booking);
		if (problem) return fail(409, { message: cancelProblemText(problem) });

		await db
			.update(t.bookings)
			.set({
				cancelRequestedBy: user.id,
				cancelRequestedSide: side,
				cancelRequestedAt: new Date(),
				cancelRequestReason: form.data.reason,
				updatedBy: user.id
			})
			.where(and(eq(t.bookings.id, id), sql`${t.bookings.cancelRequestedAt} is null`));

		await recordAudit({
			actorId: user.id,
			actorLabel: user.name,
			entity: 'booking',
			entityId: id,
			action: 'cancel_requested',
			reason: form.data.reason.slice(0, 300)
		});

		const parties = await bookingParties(booking.organizationId, booking.creatorId);
		await notifyDeal(
			side === 'creator' ? parties.organizationOwnerId : parties.creatorUserId,
			m.notif_cancel_requested_title(),
			m.notif_cancel_requested_body({ title: booking.title }),
			`/dashboard/bookings/${id}`
		);

		return message(form, { type: 'success', text: m.cx_requested_toast() });
	},

	/**
	 * The other side's answer: agree, and the deal ends; refuse, and it carries
	 * on with the request cleared so it can be asked again later.
	 */
	answerCancel: async (event) => {
		const id = Number(event.params.id);
		const { booking, side, user } = await requireBookingAccess(event, id);
		const form = await superValidate(event.request, zod4(cancelDecision));
		if (!form.valid) return fail(400, { message: m.srv_invalid_request() });

		const problem = cancelAgreeProblem(booking, side);
		if (problem) return fail(409, { message: cancelProblemText(problem) });

		const cleared = {
			cancelRequestedBy: null,
			cancelRequestedSide: null,
			cancelRequestedAt: null,
			cancelRequestReason: null,
			updatedBy: user.id
		};

		if (form.data.agree === 'false') {
			await db.update(t.bookings).set(cleared).where(eq(t.bookings.id, id));
			await recordAudit({
				actorId: user.id,
				actorLabel: user.name,
				entity: 'booking',
				entityId: id,
				action: 'cancel_refused'
			});
			return { cancelRefused: true };
		}

		const result = await transition(
			event,
			id,
			booking.status as BookingStatus,
			'cancelled',
			{ ...cleared, cancelReason: booking.cancelRequestReason ?? 'Cancelled by agreement' },
			'Cancelled by agreement'
		);
		if (!result.ok) return fail(409, { message: result.text });

		/*
		 * A funded deal that is called off owes the brand its deposit back.
		 *
		 * Asked for after the booking is already cancelled, and a failure does
		 * not undo that: the deal really is off either way, and a refund that
		 * Chapa refused is a row an operator can retry rather than a
		 * cancellation that half happened.
		 */
		let refundQueued = false;
		if (booking.escrowStatus === 'held') {
			const sent = await refunds.send(booking, {
				reason: 'Cancelled by agreement',
				actor: { id: user.id, name: user.name }
			});
			refundQueued = sent.ok;
			if (!sent.ok && sent.code !== 'nothing_to_refund') {
				console.error(`Refund failed for cancelled booking ${id}:`, sent.error);
			}
		}

		const parties = await bookingParties(booking.organizationId, booking.creatorId);
		await notifyDeal(
			side === 'creator' ? parties.organizationOwnerId : parties.creatorUserId,
			m.notif_cancel_agreed_title(),
			m.notif_cancel_agreed_body({ title: booking.title }),
			`/dashboard/bookings/${id}`
		);

		return { cancelled: true, refundQueued };
	},

	/* ---------------- disputes ---------------- */

	raiseDispute: async (event) => {
		const id = Number(event.params.id);
		const { booking, side, user } = await requireBookingAccess(event, id);
		const form = await superValidate(event.request, zod4(disputeRaise), { id: 'dispute' });

		if (side === 'admin') return fail(403, { message: m.dsp_problem_not_a_party() });
		if (!form.valid) {
			return message(form, { type: 'error', text: m.srv_dispute_need_reason() }, { status: 400 });
		}

		const settings = await getSettings();
		const problem = disputeProblem(booking, {
			side,
			hasOpenDispute: Boolean(await disputes.openFor(id)),
			windowDays: settings?.disputeWindowDays ?? 0
		});
		if (problem) {
			return message(form, { type: 'error', text: disputeProblemText(problem) }, { status: 409 });
		}

		await disputes.raise(booking, {
			side,
			reason: form.data.reason,
			evidenceUrl: form.data.evidenceUrl,
			actor: { id: user.id, name: user.name }
		});

		return message(form, { type: 'success', text: m.dsp_raised_toast() });
	},

	respondDispute: async (event) => {
		const id = Number(event.params.id);
		const { side, user } = await requireBookingAccess(event, id);
		const form = await superValidate(event.request, zod4(disputeRespond), {
			id: 'dispute-respond'
		});
		if (!form.valid) {
			return message(form, { type: 'error', text: m.srv_dispute_need_reason() }, { status: 400 });
		}

		const openCase = await disputes.openFor(id);
		if (!openCase || openCase.id !== form.data.id) {
			return message(form, { type: 'error', text: m.srv_dispute_closed() }, { status: 409 });
		}
		/* Only the side that did not raise it answers — an operator reads both
		   statements and is not a third voice in them. */
		if (side === 'admin' || openCase.raisedBySide === side) {
			return message(form, { type: 'error', text: m.srv_dispute_not_yours() }, { status: 403 });
		}
		if (openCase.respondedAt) {
			return message(
				form,
				{ type: 'error', text: m.srv_dispute_already_answered() },
				{ status: 409 }
			);
		}

		await disputes.respond(openCase, {
			text: form.data.text,
			evidenceUrl: form.data.evidenceUrl,
			actor: { id: user.id, name: user.name }
		});

		return message(form, { type: 'success', text: m.dsp_responded_toast() });
	},

	/**
	 * The side that raised a case backing down.
	 *
	 * The booking returns to where it was, which is read from the audit entry
	 * the freeze wrote rather than guessed: a case raised from `revision` must
	 * not resume at `in_production`, and the row itself no longer remembers.
	 */
	withdrawDispute: async (event) => {
		const id = Number(event.params.id);
		const { side, user } = await requireBookingAccess(event, id);
		const form = await superValidate(event.request, zod4(disputeWithdraw));
		if (!form.valid) return fail(400, { message: m.srv_invalid_request() });

		const openCase = await disputes.openFor(id);
		if (!openCase || openCase.id !== form.data.id) {
			return fail(409, { message: m.srv_dispute_closed() });
		}
		if (side === 'admin' || openCase.raisedBySide !== side) {
			return fail(403, { message: m.srv_dispute_not_yours() });
		}

		await disputes.withdraw(openCase, await statusBeforeDispute(id), {
			id: user.id,
			name: user.name
		});

		return { withdrawn: true };
	},

	/* ---------------- delivery ---------------- */

	/* ---------------- the NDA ---------------- */

	/**
	 * A creator's one-click NDA on this deal: the brand's name is shown from
	 * here on, and negotiating becomes possible.
	 */
	acceptNda: async (event) => {
		const id = Number(event.params.id);
		const { booking, side, user } = await requireBookingAccess(event, id);
		if (side !== 'creator') return fail(403, { message: m.nda_creators_only() });
		await acceptNda({
			user,
			organizationId: booking.organizationId,
			subject: { type: 'booking', id },
			ip: clientAddress(event)
		});
		return { ndaAccepted: true };
	},

	/* ---------------- the contract ---------------- */

	signContract: async (event) => {
		const id = Number(event.params.id);
		const { booking, side, user } = await requireBookingAccess(event, id);
		const form = await superValidate(event.request, zod4(contractSign), { id: 'sign' });

		if (side === 'admin')
			return message(form, { type: 'error', text: m.ct_parties_only() }, { status: 403 });
		if (!form.valid)
			return message(form, { type: 'error', text: m.srv_check_form() }, { status: 400 });
		if (booking.status !== 'contracting') {
			return message(form, { type: 'error', text: m.ct_not_awaiting() }, { status: 409 });
		}
		if (
			side === 'creator' &&
			faydaConfig() &&
			!(await creatorIdentityVerified(booking.creatorId))
		) {
			return message(form, { type: 'error', text: m.ct_identity_first() }, { status: 403 });
		}

		const contract = await contracts.currentContract(id);
		if (!contract)
			return message(form, { type: 'error', text: m.ct_not_awaiting() }, { status: 409 });

		const signed = await contracts.signContract(contract, {
			side,
			user: { id: user.id, name: user.name },
			typedName: form.data.typedName,
			ip: clientAddress(event)
		});
		if (!signed.ok) {
			const text = {
				not_awaiting: m.ct_not_awaiting(),
				already_signed: m.ct_already_signed(),
				name_mismatch: m.ct_name_mismatch(),
				tampered: m.ct_tampered()
			}[signed.problem];
			return message(form, { type: 'error', text }, { status: 409 });
		}

		const parties = await bookingParties(booking.organizationId, booking.creatorId);
		if (!signed.complete) {
			await notifyDeal(
				side === 'creator' ? parties.organizationOwnerId : parties.creatorUserId,
				m.notif_contract_signed_one_title(),
				m.notif_contract_signed_one_body({ title: booking.title }),
				`/dashboard/bookings/${id}`
			);
			return message(form, { type: 'success', text: m.ct_signed_toast() });
		}

		/* Both have signed: the deal is booked, and the brand is invoiced. */
		const result = await transition(
			event,
			id,
			'contracting',
			'booked',
			{},
			`Contract ${contract.reference} signed by both sides`
		);
		if (!result.ok) return message(form, { type: 'error', text: result.text }, { status: 409 });

		const fresh = (await db.select().from(t.bookings).where(eq(t.bookings.id, id)).limit(1))[0];
		await documents.issueBrandInvoice(fresh);

		await notifyDeal(
			[parties.organizationOwnerId, parties.creatorUserId],
			m.notif_contract_signed_title(),
			m.notif_contract_signed_body({ title: booking.title }),
			`/dashboard/bookings/${id}`
		);
		return message(form, { type: 'success', text: m.ct_signed_complete_toast() });
	},

	/* ---------------- the concept ---------------- */

	/**
	 * The creator's plan for the content, sent to the brand before production.
	 * A second concept after changes were asked for goes the same way.
	 */
	submitConcept: async (event) => {
		const id = Number(event.params.id);
		const { booking, side, user } = await requireBookingAccess(event, id);
		const form = await superValidate(event.request, zod4(conceptSubmit), { id: 'concept' });

		if (side !== 'creator') {
			return message(form, { type: 'error', text: m.cc_creator_only() }, { status: 403 });
		}
		if (!form.valid)
			return message(form, { type: 'error', text: m.srv_check_form() }, { status: 400 });
		if (booking.status !== 'booked') {
			return message(form, { type: 'error', text: m.cc_not_open() }, { status: 409 });
		}

		let attachment: string | null;
		try {
			const value = form.data.attachment;
			attachment =
				value instanceof File && value.size > 0
					? await saveUploadedFile(value, { visibility: 'private' })
					: typeof value === 'string' && value
						? value
						: null;
		} catch (err) {
			const text = uploadErrorText(err);
			if (!text) throw err;
			return message(form, { type: 'error', text }, { status: 400 });
		}

		await db.insert(t.concepts).values({
			bookingId: id,
			body: form.data.body,
			attachment,
			status: 'submitted',
			createdBy: user.id
		});
		const result = await transition(event, id, 'booked', 'concept', {}, 'Concept submitted');
		if (!result.ok) return message(form, { type: 'error', text: result.text }, { status: 409 });

		const { organizationOwnerId } = await bookingParties(booking.organizationId, booking.creatorId);
		await notifyDeal(
			organizationOwnerId,
			m.notif_concept_submitted_title(),
			m.notif_concept_submitted_body({ title: booking.title }),
			`/dashboard/bookings/${id}`
		);
		return message(form, { type: 'success', text: m.cc_submitted_toast() });
	},

	/**
	 * The brand's answer to a concept. Approving starts production — once the
	 * campaign funds are held, where a deposit is expected. Asking for changes
	 * sends it back to the creator with the reason.
	 */
	reviewConcept: async (event) => {
		const id = Number(event.params.id);
		const { booking, side, user } = await requireBookingAccess(event, id);
		const form = await superValidate(event.request, zod4(conceptReview));

		if (side === 'creator') return fail(403, { message: m.cc_brand_only() });
		if (!form.valid) return fail(400, { message: m.srv_invalid_request() });

		const concept = (
			await db
				.select()
				.from(t.concepts)
				.where(and(eq(t.concepts.id, form.data.conceptId), eq(t.concepts.bookingId, id)))
				.limit(1)
		).at(0);
		if (!concept || concept.status !== 'submitted' || booking.status !== 'concept') {
			return fail(409, { message: m.cc_already_reviewed() });
		}

		const { creatorUserId } = await bookingParties(booking.organizationId, booking.creatorId);

		if (form.data.decision === 'approve') {
			if (!canApproveConcept(booking)) return fail(409, { message: m.cc_funds_first() });
			await db
				.update(t.concepts)
				.set({
					status: 'approved',
					reviewNote: form.data.reviewNote || null,
					reviewedBy: user.id,
					reviewedAt: new Date()
				})
				.where(eq(t.concepts.id, concept.id));
			const result = await transition(
				event,
				id,
				'concept',
				'in_production',
				{},
				'Concept approved'
			);
			if (!result.ok) return fail(409, { message: result.text });
			await notifyDeal(
				creatorUserId,
				m.notif_concept_approved_title(),
				m.notif_concept_approved_body({ title: booking.title }),
				`/dashboard/bookings/${id}`
			);
			return { conceptApproved: true };
		}

		if (!form.data.reviewNote?.trim()) return fail(400, { message: m.srv_revision_needs_reason() });
		await db
			.update(t.concepts)
			.set({
				status: 'changes_requested',
				reviewNote: form.data.reviewNote,
				reviewedBy: user.id,
				reviewedAt: new Date()
			})
			.where(eq(t.concepts.id, concept.id));
		const result = await transition(event, id, 'concept', 'booked', {}, form.data.reviewNote);
		if (!result.ok) return fail(409, { message: result.text });
		await notifyDeal(
			creatorUserId,
			m.notif_concept_changes_title(),
			form.data.reviewNote,
			`/dashboard/bookings/${id}`
		);
		return { conceptChanges: true };
	},

	submit: async (event) => {
		const id = Number(event.params.id);
		const { booking, side } = await requireBookingAccess(event, id);
		const form = await superValidate(event.request, zod4(submissionSchema), { id: 'submission' });

		if (side !== 'creator') {
			return message(form, { type: 'error', text: m.srv_only_creator_submits() }, { status: 403 });
		}
		if (!form.valid) {
			return message(form, { type: 'error', text: m.srv_paste_link() }, { status: 400 });
		}
		if (!['in_production', 'revision'].includes(booking.status)) {
			return message(
				form,
				{ type: 'error', text: m.srv_not_open_for_submission() },
				{ status: 409 }
			);
		}

		await db.insert(t.submissions).values({
			bookingId: id,
			contentUrl: form.data.contentUrl,
			notes: form.data.notes || null,
			status: 'submitted',
			createdBy: event.locals.user?.id
		});

		const result = await transition(
			event,
			id,
			booking.status as BookingStatus,
			'submitted',
			{},
			'Work submitted for review'
		);
		if (!result.ok) {
			return message(form, { type: 'error', text: result.text }, { status: 409 });
		}

		const orgRows = await db
			.select({ ownerId: t.organizations.ownerId })
			.from(t.organizations)
			.where(eq(t.organizations.id, booking.organizationId))
			.limit(1);

		await notifyDeal(
			orgRows.at(0)?.ownerId,
			m.notif_work_submitted_title(),
			booking.title,
			`/dashboard/bookings/${id}`
		);

		return message(form, { type: 'success', text: m.srv_submitted_for_review() });
	},

	review: async (event) => {
		const id = Number(event.params.id);
		const { booking, side } = await requireBookingAccess(event, id);
		const form = await superValidate(event.request, zod4(reviewSubmission));

		if (side === 'creator') return fail(403, { message: m.srv_only_brand_reviews() });
		if (!form.valid) return fail(400, { message: m.srv_invalid_request() });

		const rows = await db
			.select()
			.from(t.submissions)
			.where(and(eq(t.submissions.id, form.data.submissionId), eq(t.submissions.bookingId, id)))
			.limit(1);
		const submission = rows.at(0);
		if (!submission || submission.status !== 'submitted') {
			return fail(409, { message: m.srv_already_reviewed() });
		}

		if (form.data.decision === 'approve') {
			await db
				.update(t.submissions)
				.set({
					status: 'approved',
					reviewNote: form.data.reviewNote || null,
					reviewedBy: event.locals.user?.id,
					reviewedAt: new Date()
				})
				.where(eq(t.submissions.id, submission.id));

			const result = await transition(
				event,
				id,
				booking.status as BookingStatus,
				'approved',
				{},
				'Deliverables approved'
			);
			if (!result.ok) return fail(409, { message: result.text });

			/* Approved content waits to go live. The creator's proof of the live
			   post is what moves the deal on to settlement. */
			const creatorAccount = await bookingParties(booking.organizationId, booking.creatorId);
			await notifyDeal(
				creatorAccount.creatorUserId,
				m.notif_work_approved_title(),
				m.notif_work_approved_body({ title: booking.title }),
				`/dashboard/bookings/${id}`
			);

			return { approved: true };
		}

		/* Revision: the reason is required and the allowance is consumed. */
		if (booking.revisionsUsed >= booking.revisionsAllowed) {
			return fail(409, {
				message: m.srv_revisions_used_up({ allowed: booking.revisionsAllowed })
			});
		}
		if (!form.data.reviewNote?.trim()) {
			return fail(400, { message: m.srv_revision_needs_reason() });
		}

		await db
			.update(t.submissions)
			.set({
				status: 'revision_requested',
				reviewNote: form.data.reviewNote,
				reviewedBy: event.locals.user?.id,
				reviewedAt: new Date()
			})
			.where(eq(t.submissions.id, submission.id));

		const result = await transition(
			event,
			id,
			booking.status as BookingStatus,
			'revision',
			/* Incremented in SQL, not from the value read earlier in this request:
			   two concurrent revision requests each computed the same successor and
			   one increment was lost, letting the allowance be exceeded. */
			{ revisionsUsed: sql`${t.bookings.revisionsUsed} + 1` },
			form.data.reviewNote
		);
		if (!result.ok) return fail(409, { message: result.text });

		const creatorRows = await db
			.select({ userId: t.creators.userId })
			.from(t.creators)
			.where(eq(t.creators.id, booking.creatorId))
			.limit(1);

		await notifyDeal(
			creatorRows.at(0)?.userId,
			m.notif_revision_requested_title(),
			form.data.reviewNote,
			`/dashboard/bookings/${id}`
		);

		return { revisionRequested: true };
	},

	/* ---------------- proof it went live ---------------- */

	/**
	 * The creator's proof that the approved work is live: the link, a
	 * screenshot of the post, and when it went up. That is what moves the deal
	 * on to settlement; the figures at 24 hours, 7 days and 30 days follow.
	 */
	submitProof: async (event) => {
		const id = Number(event.params.id);
		const { booking, side, user } = await requireBookingAccess(event, id);
		const form = await superValidate(event.request, zod4(proofSubmit), { id: 'proof' });

		if (side !== 'creator')
			return message(form, { type: 'error', text: m.pr_creator_only() }, { status: 403 });
		if (!form.valid)
			return message(form, { type: 'error', text: m.srv_check_form() }, { status: 400 });
		if (booking.status !== 'approved') {
			return message(form, { type: 'error', text: m.pr_not_open() }, { status: 409 });
		}

		const postedAt = new Date(form.data.postedAt);
		if (Number.isNaN(postedAt.getTime())) {
			return message(form, { type: 'error', text: m.val_posted_at() }, { status: 400 });
		}
		const timing = postedAtProblem(postedAt, booking.createdAt);
		if (timing) {
			return message(
				form,
				{
					type: 'error',
					text: timing === 'future' ? m.pr_posted_future() : m.pr_posted_before_deal()
				},
				{ status: 400 }
			);
		}

		let screenshot: string;
		try {
			screenshot = await saveUploadedFile(form.data.screenshot, { visibility: 'private' });
		} catch (err) {
			const text = uploadErrorText(err);
			if (!text) throw err;
			return message(form, { type: 'error', text }, { status: 400 });
		}

		await db.insert(t.postProofs).values({
			bookingId: id,
			liveUrl: form.data.liveUrl,
			screenshot,
			postedAt,
			notes: form.data.notes || null,
			createdBy: user.id
		});
		const result = await transition(
			event,
			id,
			'approved',
			'awaiting_settlement',
			{},
			'Live post proof submitted'
		);
		if (!result.ok) return message(form, { type: 'error', text: result.text }, { status: 409 });

		const { organizationOwnerId } = await bookingParties(booking.organizationId, booking.creatorId);
		await notifyDeal(
			organizationOwnerId,
			m.notif_proof_submitted_title(),
			m.notif_proof_submitted_body({ title: booking.title }),
			`/dashboard/bookings/${id}`
		);
		return message(form, { type: 'success', text: m.pr_submitted_toast() });
	},

	/** A checkpoint's figures, with the analytics screenshot behind them. */
	recordMetrics: async (event) => {
		const id = Number(event.params.id);
		const { side, user } = await requireBookingAccess(event, id);
		const form = await superValidate(event.request, zod4(metricsRecord), { id: 'metrics' });

		if (side === 'organization') {
			return message(form, { type: 'error', text: m.pr_creator_only() }, { status: 403 });
		}
		if (!form.valid)
			return message(form, { type: 'error', text: m.srv_check_form() }, { status: 400 });

		const proof = (
			await db.select().from(t.postProofs).where(eq(t.postProofs.bookingId, id)).limit(1)
		).at(0);
		if (!proof) return message(form, { type: 'error', text: m.pr_no_proof() }, { status: 409 });
		const checkpoint = form.data.checkpoint as Checkpoint;
		if (!checkpointIsOpen(proof.postedAt, checkpoint)) {
			return message(form, { type: 'error', text: m.pr_checkpoint_not_open() }, { status: 409 });
		}

		let screenshot: string;
		try {
			screenshot = await saveUploadedFile(form.data.screenshot, { visibility: 'private' });
		} catch (err) {
			const text = uploadErrorText(err);
			if (!text) throw err;
			return message(form, { type: 'error', text }, { status: 400 });
		}

		try {
			await db.insert(t.proofMetrics).values({
				proofId: proof.id,
				bookingId: id,
				checkpoint,
				views: form.data.views ?? null,
				likes: form.data.likes ?? null,
				comments: form.data.comments ?? null,
				shares: form.data.shares ?? null,
				saves: form.data.saves ?? null,
				reach: form.data.reach ?? null,
				screenshot,
				createdBy: user.id
			});
		} catch {
			/* The unique index: this checkpoint was recorded a moment ago. */
			return message(form, { type: 'error', text: m.pr_checkpoint_recorded() }, { status: 409 });
		}

		await recordAudit({
			actorId: user.id,
			actorLabel: user.name,
			entity: 'booking',
			entityId: id,
			action: 'metrics_recorded',
			reason: `${checkpoint}: ${form.data.views ?? '–'} views`
		});
		return message(form, { type: 'success', text: m.pr_metrics_toast() });
	},

	/* ---------------- reviews & messages ---------------- */

	rate: async (event) => {
		const id = Number(event.params.id);
		const { booking, side } = await requireBookingAccess(event, id);
		const form = await superValidate(event.request, zod4(reviewSchema), { id: 'review' });

		if (!form.valid) {
			return message(form, { type: 'error', text: m.srv_check_form() }, { status: 400 });
		}
		/* PRD AC-11: reviews exist only for completed bookings. */
		if (booking.status !== 'completed') {
			return message(
				form,
				{ type: 'error', text: m.srv_reviews_after_complete() },
				{ status: 409 }
			);
		}
		if (side === 'admin') {
			return message(form, { type: 'error', text: m.srv_operators_no_review() }, { status: 403 });
		}

		const direction = side === 'creator' ? 'creator_to_brand' : 'brand_to_creator';

		const existing = await db
			.select({ id: t.reviews.id })
			.from(t.reviews)
			.where(and(eq(t.reviews.bookingId, id), eq(t.reviews.direction, direction)))
			.limit(1);

		if (existing.length) {
			return message(
				form,
				{ type: 'error', text: m.srv_already_reviewed_booking() },
				{ status: 409 }
			);
		}

		await db.insert(t.reviews).values({
			bookingId: id,
			creatorId: booking.creatorId,
			organizationId: booking.organizationId,
			authorId: event.locals.user?.id,
			direction,
			rating: form.data.rating,
			communication: form.data.communication,
			professionalism: form.data.professionalism,
			timeliness: form.data.timeliness,
			quality: form.data.quality,
			body: form.data.body,
			createdBy: event.locals.user?.id
		});

		if (direction === 'brand_to_creator') {
			await refreshCreatorRating(booking.creatorId);
		} else {
			await recalcOrganizationRatings(db, booking.organizationId);
		}

		return message(form, { type: 'success', text: m.srv_review_published() });
	},

	message: async (event) => {
		const id = Number(event.params.id);
		const { booking, side } = await requireBookingAccess(event, id);
		const form = await superValidate(event.request, zod4(messageSchema), { id: 'message' });

		if (!form.valid) {
			return message(form, { type: 'error', text: m.srv_write_something() }, { status: 400 });
		}

		/* Contact details are stripped before the message is stored, not after. */
		const { text, masked } = maskContact(form.data.body);

		await db.insert(t.messages).values({
			bookingId: id,
			senderId: event.locals.user!.id,
			body: text,
			isMasked: masked,
			createdBy: event.locals.user?.id
		});

		/*
		 * The other end of the thread.
		 *
		 * An operator writing on a booking is talking to both sides at once, so
		 * both are told; a creator or a brand is talking to their counterpart.
		 * Either way the sender is never in the list — a notification about your
		 * own message is noise, and by email it is worse than noise.
		 *
		 * What goes out is the masked text, the same as what was stored. The
		 * point of stripping a phone number before it reaches the thread would be
		 * lost if the notification carried the unmasked original into an inbox.
		 */
		const parties = await bookingParties(booking.organizationId, booking.creatorId);
		const recipients =
			side === 'admin'
				? [parties.organizationOwnerId, parties.creatorUserId]
				: [side === 'creator' ? parties.organizationOwnerId : parties.creatorUserId];

		await notify(
			recipients.filter((uid) => uid !== event.locals.user?.id),
			{
				category: 'messages',
				kind: 'message',
				title: m.notif_new_message_title({ sender: event.locals.user?.name ?? '' }),
				body: text,
				link: `/dashboard/bookings/${id}`,
				actionLabel: m.mail_open_booking(),
				footnote: m.mail_prefs_footnote(),
				actorId: event.locals.user?.id
			}
		);

		return message(
			form,
			masked
				? { type: 'warning', text: m.srv_sent_masked() }
				: { type: 'success', text: m.srv_sent() }
		);
	}
};
