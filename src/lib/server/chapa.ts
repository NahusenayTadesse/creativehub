import { env } from '$env/dynamic/private';

/**
 * The Chapa API, and nothing else.
 *
 * This file knows how to start a checkout, how to send money to a bank account,
 * and how to ask what became of either. It does not know what a booking is,
 * does not touch the database, and does not decide what a payment or a payout
 * means — `server/payments.ts` and `server/payouts.ts` do all three. Keeping
 * the boundary there is what makes the rules about money testable without a
 * network, and what stops provider-shaped concepts leaking into the lifecycle.
 *
 * Nothing here throws. Every call returns a result that says whether it worked,
 * because "the payment provider is unreachable" is an ordinary Tuesday and has
 * to be a message on a page rather than a 500.
 */

const API = 'https://api.chapa.co/v1';

const secretKey = env.CHAPA_SECRET_KEY;

/**
 * Whether payments can be taken at all.
 *
 * Only the secret key matters here: the public key belongs to an inline
 * checkout widget this app does not use — it redirects to Chapa's hosted page
 * instead, which is authorised entirely by the secret key from the server. An
 * environment with only the public key can take no money, and the booking page
 * asks this before drawing a pay button.
 */
export const chapaEnabled = Boolean(secretKey);

/**
 * The currencies this integration will charge in.
 *
 * Chapa itself accepts ETB and USD, but a booking's currency comes from the
 * `countries` table and can be anything an operator has added. Converting one
 * to another would mean charging a figure derived from an operator-maintained
 * rate that may be months stale — so an unsupported currency is refused with a
 * sentence rather than quietly turned into a number nobody chose.
 */
export const SUPPORTED_CURRENCIES = ['ETB'] as const;
export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

export const currencyIsSupported = (code: string): code is SupportedCurrency =>
	SUPPORTED_CURRENCIES.includes(code as SupportedCurrency);

type Failure = { ok: false; error: string };

async function call<T>(
	path: string,
	init: RequestInit & { timeoutMs?: number } = {}
): Promise<{ ok: true; body: T } | Failure> {
	if (!secretKey) return { ok: false, error: 'Chapa is not configured.' };

	const { timeoutMs = 20_000, ...rest } = init;
	/* A payment provider that hangs must not hang a form submission with it. */
	const abort = AbortSignal.timeout(timeoutMs);

	try {
		const response = await fetch(`${API}${path}`, {
			...rest,
			signal: abort,
			headers: {
				Authorization: `Bearer ${secretKey}`,
				'Content-Type': 'application/json',
				...(rest.headers ?? {})
			}
		});

		const text = await response.text();
		let body: unknown;
		try {
			body = JSON.parse(text);
		} catch {
			/* Chapa answers JSON; anything else is an outage page or a proxy. */
			return { ok: false, error: `Chapa returned ${response.status} (not JSON)` };
		}

		/*
		 * Chapa's envelope is `{ status, message, data }` — except on `/banks`,
		 * which answers `{ message, data }` and no `status` at all.
		 *
		 * Requiring `status === 'success'` therefore failed every bank lookup
		 * while the request itself was a clean 200, which showed up as "we
		 * cannot reach Chapa" on a page that had just reached it. So a `status`
		 * that is present must say `success`, and an absent one falls back to
		 * the HTTP code. The payment endpoints all send `status`, so nothing on
		 * the way in is loosened by this.
		 */
		const envelope = body as { status?: string; message?: unknown };
		const failed = envelope.status ? envelope.status !== 'success' : !response.ok;
		if (failed) {
			/* `message` is a sentence on some failures and a field-errors object
			   on others — flattened rather than rendered, since none of it is
			   text a brand should be shown. */
			const detail =
				typeof envelope.message === 'string'
					? envelope.message
					: JSON.stringify(envelope.message ?? {});
			return { ok: false, error: detail.slice(0, 300) || `Chapa returned ${response.status}` };
		}

		return { ok: true, body: body as T };
	} catch (err) {
		if (err instanceof Error && err.name === 'TimeoutError') {
			return { ok: false, error: 'Chapa did not respond in time.' };
		}
		return { ok: false, error: err instanceof Error ? err.message : String(err) };
	}
}

/* ------------------------------------------------------------------ *
 * Starting a checkout
 * ------------------------------------------------------------------ */

export type InitializeInput = {
	amount: number;
	currency: string;
	email: string;
	firstName: string;
	lastName: string;
	/** Ours, unique per attempt. What every later question is asked about. */
	txRef: string;
	/** Where Chapa POSTs when the payment resolves. */
	callbackUrl: string;
	/** Where the payer's browser is sent afterwards. */
	returnUrl: string;
	title?: string;
	description?: string;
};

/**
 * Asks Chapa for a hosted checkout page.
 *
 * The customisation title is capped at 16 characters because Chapa rejects
 * anything longer — a booking title pasted in whole fails validation, which
 * reads from here as an unexplained refusal to take money.
 */
export async function initialize(
	input: InitializeInput
): Promise<{ ok: true; checkoutUrl: string } | Failure> {
	const result = await call<{ data?: { checkout_url?: string } }>('/transaction/initialize', {
		method: 'POST',
		body: JSON.stringify({
			amount: String(input.amount),
			currency: input.currency,
			email: input.email,
			first_name: input.firstName,
			last_name: input.lastName,
			tx_ref: input.txRef,
			callback_url: input.callbackUrl,
			return_url: input.returnUrl,
			'customization[title]': (input.title ?? 'Deposit').slice(0, 16),
			'customization[description]': (input.description ?? '').slice(0, 200)
		})
	});

	if (!result.ok) return result;

	const checkoutUrl = result.body.data?.checkout_url;
	if (!checkoutUrl) return { ok: false, error: 'Chapa returned no checkout URL.' };

	return { ok: true, checkoutUrl };
}

/* ------------------------------------------------------------------ *
 * Asking what happened
 * ------------------------------------------------------------------ */

export type Verified = {
	/** Chapa's own view: `success`, `pending`, `failed`. */
	status: string;
	amount: number;
	currency: string;
	/** How they paid — telebirr, cbebirr, card. Finer-grained than our enum. */
	method: string | null;
	/** Chapa's reference for the movement of money, for a support conversation. */
	reference: string | null;
	/** `test` or `live`. Recorded so a test payment is never mistaken for money. */
	mode: string | null;
};

/**
 * What Chapa says became of `txRef`.
 *
 * This is the only thing the app trusts about a payment. A webhook body is a
 * claim made by whoever posted it; this is an answer from Chapa to a question
 * asked with our secret key, over a connection we opened. The difference is the
 * whole security model of the integration — see the webhook route.
 */
export async function verify(txRef: string): Promise<{ ok: true; payment: Verified } | Failure> {
	const result = await call<{
		data?: {
			status?: string;
			amount?: number | string;
			currency?: string;
			method?: string | null;
			reference?: string | null;
			mode?: string | null;
		};
	}>(`/transaction/verify/${encodeURIComponent(txRef)}`);

	if (!result.ok) return result;

	const data = result.body.data;
	if (!data) return { ok: false, error: 'Chapa returned no payment details.' };

	return {
		ok: true,
		payment: {
			status: String(data.status ?? 'unknown'),
			/* Chapa has returned this as both a number and a decimal string. */
			amount: Number(data.amount ?? 0),
			currency: String(data.currency ?? ''),
			method: data.method ?? null,
			reference: data.reference ?? null,
			mode: data.mode ?? null
		}
	};
}

/* ------------------------------------------------------------------ *
 * Sending money the other way
 * ------------------------------------------------------------------ */

/** One bank Chapa can transfer to. `id` is what a transfer calls `bank_code`. */
export type Bank = {
	id: number;
	name: string;
	/** How many digits an account number at this bank has. 0 when unspecified. */
	accountLength: number;
	currency: string;
	isMobileMoney: boolean;
};

/** Chapa sends its flags as the strings `"1"` and `"0"`, and sometimes not at all. */
const flag = (value: unknown): boolean => value === 1 || value === '1' || value === true;

/**
 * Every bank Chapa will send to, with the code a transfer must quote.
 *
 * Fetched rather than hard-coded: the list gains a bank every few months, and a
 * stale copy shipped in the source is a creator who cannot be paid until the
 * next deploy. The caller caches it — see `server/payouts.ts`.
 */
export async function listBanks(): Promise<{ ok: true; banks: Bank[] } | Failure> {
	const result = await call<{
		data?: Array<{
			id?: number;
			name?: string;
			acct_length?: number | string;
			currency?: string;
			is_mobilemoney?: number | string | boolean | null;
			can_process_payouts?: number | string | boolean | null;
		}>;
	}>('/banks');

	if (!result.ok) return result;

	const banks = (result.body.data ?? [])
		.filter((row) => typeof row.id === 'number' && typeof row.name === 'string')
		/* Chapa marks the banks it will not transfer to — one of the twenty-two,
		   at the time of writing. Offering one to a creator buys a bank account
		   that can never be paid, and a failed transfer to find that out. */
		.filter((row) => flag(row.can_process_payouts))
		.map((row) => ({
			id: Number(row.id),
			name: String(row.name),
			accountLength: Number(row.acct_length ?? 0),
			currency: String(row.currency ?? 'ETB'),
			isMobileMoney: flag(row.is_mobilemoney)
		}));

	if (!banks.length) return { ok: false, error: 'Chapa returned no banks.' };

	return { ok: true, banks };
}

export type TransferInput = {
	amount: number;
	currency: string;
	accountNumber: string;
	accountName: string;
	bankCode: number;
	/** Ours, unique per attempt. What every later question is asked about. */
	reference: string;
};

/**
 * Asks Chapa to send money from the merchant balance to a bank account.
 *
 * A `success` envelope here does **not** mean the creator has been paid. It
 * means Chapa accepted the instruction and queued it; the transfer then waits
 * on an approval, and after that on the receiving bank. Only `verifyTransfer`
 * says what became of it, which is why the caller writes `queued` and not
 * `success` when this returns.
 *
 * That approval is an **OTP** to the merchant's registered device, which is
 * Chapa's default and needs nothing from us. Chapa also offers server approval,
 * where it POSTs each transfer to an endpoint of ours that must answer 200 or
 * 400 — this app does not expose one, so turning server approval on in the
 * Chapa dashboard would leave every transfer waiting on a callback that never
 * gets answered. Leave it off until that endpoint exists.
 *
 * There is no dry run for this. Chapa rejects a transfer that exceeds the
 * available balance, and repeated rejections can have the account's transfer
 * access suspended — so the caller checks what it can before getting here.
 */
export async function transfer(
	input: TransferInput
): Promise<{ ok: true; providerRef: string | null } | Failure> {
	const result = await call<{ data?: unknown }>('/transfers', {
		method: 'POST',
		body: JSON.stringify({
			account_number: input.accountNumber,
			account_name: input.accountName,
			amount: String(input.amount),
			currency: input.currency,
			bank_code: input.bankCode,
			reference: input.reference
		})
	});

	if (!result.ok) return result;

	/* `data` is Chapa's own reference as a bare string on this endpoint, not the
	   object every other endpoint returns. Absent on some responses, which is
	   not a failure: ours is the reference that matters, and we chose it. */
	const providerRef = typeof result.body.data === 'string' ? result.body.data : null;

	return { ok: true, providerRef };
}

export type VerifiedTransfer = {
	/** Chapa's own view: `success`, `pending`, `failed`. */
	status: string;
	amount: number;
	currency: string;
	/** Chapa's reference for the transfer. */
	reference: string | null;
	/** `test` or `live`. Recorded so a test transfer is never mistaken for money. */
	mode: string | null;
	/** Chapa's explanation when it failed. For the operator, not the creator. */
	failureReason: string | null;
};

/**
 * What Chapa says became of the transfer we referenced as `reference`.
 *
 * The same inversion as `verify`: this is the only thing the app believes about
 * a payout. A transfer webhook is a claim made by whoever posted it.
 */
export async function verifyTransfer(
	reference: string
): Promise<{ ok: true; transfer: VerifiedTransfer } | Failure> {
	const result = await call<{
		data?: {
			status?: string;
			amount?: number | string;
			currency?: string;
			chapa_reference?: string | null;
			reference?: string | null;
			mode?: string | null;
			failure_reason?: string | null;
		};
	}>(`/transfers/verify/${encodeURIComponent(reference)}`);

	if (!result.ok) return result;

	const data = result.body.data;
	if (!data) return { ok: false, error: 'Chapa returned no transfer details.' };

	return {
		ok: true,
		transfer: {
			status: String(data.status ?? 'unknown'),
			amount: Number(data.amount ?? 0),
			currency: String(data.currency ?? ''),
			/* `chapa_reference` is theirs; `reference` echoes ours back, so it is
			   only a fallback and never overwrites a real provider reference. */
			reference: data.chapa_reference ?? data.reference ?? null,
			mode: data.mode ?? null,
			failureReason: data.failure_reason ?? null
		}
	};
}

/* ------------------------------------------------------------------ *
 * Giving money back
 * ------------------------------------------------------------------ */

export type RefundInput = {
	/** The deposit being reversed. Chapa refunds a transaction, not a booking. */
	txRef: string;
	/** Omit for the whole thing; Chapa reads an absent amount as "all of it". */
	amount?: number;
	reason?: string;
	/** Ours, unique per attempt. Echoed back, but not what verification takes. */
	reference?: string;
};

/**
 * Asks Chapa to return money to whoever paid `txRef`.
 *
 * Like a transfer, an accepted refund is not a completed one — the status runs
 * `initiated` → `processing` → `refunded` or `reversed`, and only
 * `verifyRefund` says which. Unlike a transfer, the handle for asking is
 * Chapa's `ref_id` rather than the reference we chose, so a caller that loses
 * the returned id has no way to ask about the refund again. That is why the
 * `refunds` table treats `providerRef` as load-bearing rather than as a note.
 *
 * Chapa's own charge on the original payment is not returned; the refund plus
 * that charge come out of the merchant's available balance.
 */
export async function refund(
	input: RefundInput
): Promise<{ ok: true; refId: string | null } | Failure> {
	const body: Record<string, string> = {};
	/* Sent only when partial: an `amount` equal to the whole payment is the
	   same instruction as omitting it, and omitting it cannot round wrong. */
	if (typeof input.amount === 'number') body.amount = String(input.amount);
	if (input.reason) body.reason = input.reason.slice(0, 300);
	if (input.reference) body.reference = input.reference;

	const result = await call<{ data?: unknown }>(`/refund/${encodeURIComponent(input.txRef)}`, {
		method: 'POST',
		body: JSON.stringify(body)
	});

	if (!result.ok) return result;

	/* Chapa returns the tracking id either bare or wrapped, depending on the
	   endpoint version. Both shapes are read rather than one being assumed,
	   because losing this id is losing the ability to verify the refund. */
	const data = result.body.data as { ref_id?: string; refund_id?: string } | string | undefined;
	const refId = typeof data === 'string' ? data : (data?.ref_id ?? data?.refund_id ?? null);

	return { ok: true, refId };
}

export type VerifiedRefund = {
	/** Chapa's own view: `initiated`, `processing`, `refunded`, `reversed`. */
	status: string;
	amount: number;
	currency: string;
	mode: string | null;
	failureReason: string | null;
};

/** What Chapa says became of the refund it gave us `refId` for. */
export async function verifyRefund(
	refId: string
): Promise<{ ok: true; refund: VerifiedRefund } | Failure> {
	const result = await call<{
		data?: {
			status?: string;
			amount?: number | string;
			currency?: string;
			mode?: string | null;
			failure_reason?: string | null;
			reason?: string | null;
		};
	}>(`/refund/${encodeURIComponent(refId)}/verify`);

	if (!result.ok) return result;

	const data = result.body.data;
	if (!data) return { ok: false, error: 'Chapa returned no refund details.' };

	return {
		ok: true,
		refund: {
			status: String(data.status ?? 'unknown'),
			amount: Number(data.amount ?? 0),
			currency: String(data.currency ?? ''),
			mode: data.mode ?? null,
			failureReason: data.failure_reason ?? null
		}
	};
}

/**
 * Chapa's refund vocabulary, in ours.
 *
 * `initiated` and `processing` are both still in flight and must stay `queued`
 * — treating either as settled would close a case while the money was still
 * moving. `reversed` is Chapa's word for a refund that did not happen.
 */
export function refundOutcome(status: string): 'pending' | 'success' | 'failed' {
	if (status === 'refunded' || status === 'success') return 'success';
	if (status === 'initiated' || status === 'processing' || status === 'pending') return 'pending';
	return 'failed';
}
