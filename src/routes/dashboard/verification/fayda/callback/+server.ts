import { redirect, type RequestHandler } from '@sveltejs/kit';
import { and, eq, ne } from 'drizzle-orm';
import { db } from '$lib/server/db';
import * as t from '$lib/server/db/schema';
import { requireUser, getCreatorFor, recordAudit } from '$lib/server/guards';
import { FAYDA_COOKIE, faydaConfig } from '$lib/server/fayda-config';
import { exchangeCode, fetchIdentity } from '$lib/server/fayda';
import { recalcCreatorVerification } from '$lib/server/db/creator-verification';

/**
 * Where Fayda sends a creator back after the OTP.
 *
 * Every outcome is written to `identity_checks` — a failure too, with a short
 * reason and nothing else — and the creator is returned to the verification
 * page with `?fayda=` saying which way it went. The ID number never passes
 * through here: Fayda answers with a pseudonymous subject, and that is the
 * reference kept.
 */
export const GET: RequestHandler = async (event) => {
	const user = requireUser(event);
	const back = (outcome: string) => redirect(303, `/dashboard/verification?fayda=${outcome}`);

	const creator = await getCreatorFor(user.id);
	const config = faydaConfig();
	if (!creator || !config) back('unavailable');

	const raw = event.cookies.get(FAYDA_COOKIE);
	event.cookies.delete(FAYDA_COOKIE, { path: '/dashboard/verification' });
	let attempt: { state: string; nonce: string; verifier: string } | null;
	try {
		attempt = raw ? JSON.parse(raw) : null;
	} catch {
		attempt = null;
	}

	const params = event.url.searchParams;
	const record = async (status: 'verified' | 'failed', fields: Record<string, unknown>) => {
		await db.insert(t.identityChecks).values({
			userId: user.id,
			creatorId: creator!.id,
			provider: 'fayda',
			status,
			...fields,
			createdBy: user.id
		});
		await recordAudit({
			actorId: user.id,
			actorLabel: user.name,
			entity: 'verification',
			entityId: creator!.id,
			action: status === 'verified' ? 'fayda_verified' : 'fayda_failed',
			reason: status === 'failed' ? String(fields.failureReason ?? '') : 'Fayda OTP check passed'
		});
	};

	/* The person cancelled on Fayda's side, or Fayda refused. */
	if (params.get('error')) {
		await record('failed', { failureReason: String(params.get('error')).slice(0, 250) });
		back('failed');
	}
	/* A state that does not match is a callback this browser did not start. */
	if (!attempt || !params.get('state') || params.get('state') !== attempt.state) back('expired');

	const code = params.get('code') ?? '';
	const token = await exchangeCode(config!, code, attempt!.verifier);
	if (!token.ok) {
		await record('failed', { failureReason: token.error.slice(0, 250) });
		back('failed');
	}
	const identity = await fetchIdentity(
		config!,
		(token as { ok: true; value: { accessToken: string } }).value.accessToken
	);
	if (!identity.ok) {
		await record('failed', { failureReason: identity.error.slice(0, 250) });
		back('failed');
	}
	const { subject, name } = (
		identity as { ok: true; value: { subject: string; name: string | null } }
	).value;

	/* One person, one creator account: the same Fayda identity verified on
	   another profile is refused, not shared. */
	const elsewhere = await db
		.select({ id: t.identityChecks.id })
		.from(t.identityChecks)
		.where(
			and(
				eq(t.identityChecks.reference, subject),
				eq(t.identityChecks.status, 'verified'),
				ne(t.identityChecks.userId, user.id)
			)
		)
		.limit(1);
	if (elsewhere.length) {
		await record('failed', { failureReason: 'identity_linked_to_another_account' });
		back('taken');
	}

	await record('verified', { reference: subject, verifiedName: name, verifiedAt: new Date() });
	await recalcCreatorVerification(db, creator!.id);
	back('verified');
	return new Response(null);
};
