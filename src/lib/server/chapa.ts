import { env } from '$env/dynamic/private';

/**
 * The Chapa API, and nothing else.
 *
 * This file knows how to start a checkout and how to ask what became of one. It
 * does not know what a booking is, does not touch the database, and does not
 * decide what a payment means — `server/payments.ts` does all three. Keeping
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

		const envelope = body as { status?: string; message?: unknown };
		if (envelope.status !== 'success') {
			/* `message` is a sentence on some failures and a field-errors object
			   on others — flattened rather than rendered, since none of it is
			   text a brand should be shown. */
			const detail =
				typeof envelope.message === 'string'
					? envelope.message
					: JSON.stringify(envelope.message ?? {});
			return { ok: false, error: detail.slice(0, 300) };
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
