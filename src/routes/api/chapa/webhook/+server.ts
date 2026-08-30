import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '$env/dynamic/private';
import { settle } from '$lib/server/payments';
import type { RequestHandler } from './$types';

/**
 * Where Chapa says a payment resolved.
 *
 * The important thing about this route is what it does *not* do: it never
 * believes the body. The payload is read for one field — the transaction
 * reference — and everything else is thrown away. What happens next is decided
 * by `settle`, which asks Chapa directly, with our secret key, over a
 * connection we opened.
 *
 * That inversion is the whole security model. This endpoint is public and
 * unauthenticated by necessity — Chapa's servers call it, and they hold no
 * session — so anyone at all can post to it. Trusting a body would mean
 * anybody who guessed a reference could mark a booking paid. As written, the
 * worst a forged request can do is make us ask Chapa about a reference, and
 * Chapa's answer is the same answer it would have given anyway.
 *
 * A signature is checked when one can be — see below — but it is defence in
 * depth rather than the thing holding the door.
 */

/**
 * Chapa signs the raw body with the webhook secret from its dashboard, sending
 * the digest in both `Chapa-Signature` and `x-chapa-signature`. That secret is
 * separate from the API key and may not be configured at all, so a missing
 * `CHAPA_WEBHOOK_SECRET` is not an error: it means the signature is not checked
 * and the verification round trip is doing the work alone. Once the secret is
 * set, a request that fails the check is refused outright.
 */
function signatureOk(raw: string, request: Request): boolean {
	const secret = env.CHAPA_WEBHOOK_SECRET;
	if (!secret) return true;

	const sent = request.headers.get('chapa-signature') ?? request.headers.get('x-chapa-signature');
	if (!sent) return false;

	const expected = createHmac('sha256', secret).update(raw).digest('hex');
	const a = Buffer.from(expected, 'utf8');
	const b = Buffer.from(sent.trim(), 'utf8');
	/* Lengths must match before comparing, and the comparison is constant-time
	   so the endpoint does not leak the digest one byte at a time. */
	return a.length === b.length && timingSafeEqual(a, b);
}

export const POST: RequestHandler = async ({ request }) => {
	const raw = await request.text();

	if (!signatureOk(raw, request)) {
		console.warn('[chapa] webhook rejected: bad signature');
		return new Response('forbidden', { status: 403 });
	}

	let txRef: string | undefined;
	try {
		const body = JSON.parse(raw) as { tx_ref?: string; trx_ref?: string; reference?: string };
		/* Chapa has used `tx_ref` and `trx_ref` in different payload versions;
		   `reference` is its own id, taken last so ours wins when both appear. */
		txRef = body.tx_ref ?? body.trx_ref ?? body.reference;
	} catch {
		return new Response('bad request', { status: 400 });
	}

	if (!txRef) return new Response('missing reference', { status: 400 });

	const outcome = await settle(txRef);

	/*
	 * The status code is a delivery receipt, not an opinion, so it says only
	 * whether Chapa should send this again.
	 *
	 * 200 for everything settled — including a payment that genuinely failed,
	 * and including a reference we never issued. The second of those is the one
	 * that is easy to get wrong: a stale callback from a reset database, or
	 * somebody posting a reference at random, is not a transient fault, and
	 * answering 500 would have Chapa retry it on a schedule for hours.
	 *
	 * 500 is reserved for the one case a retry can actually fix: we could not
	 * reach Chapa to ask what happened, so nothing has been decided yet.
	 */
	if (outcome.state === 'unreachable') {
		console.error(`[chapa] webhook could not reach Chapa about ${txRef}: ${outcome.reason}`);
		return new Response('retry', { status: 500 });
	}

	if (outcome.state === 'not_found') {
		console.warn(`[chapa] webhook for unknown reference ${txRef}`);
		return new Response('ok', { status: 200 });
	}

	console.log(`[chapa] webhook ${txRef} -> ${outcome.state}`);
	return new Response('ok', { status: 200 });
};
