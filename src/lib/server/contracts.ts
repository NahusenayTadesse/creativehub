import { createHash } from 'node:crypto';
import { and, desc, eq, ne } from 'drizzle-orm';
import { db } from '$lib/server/db';
import * as t from '$lib/server/db/schema';
import { getSettings } from '$lib/server/queries';
import { recordAudit } from '$lib/server/guards';
import { contractText } from '$lib/domain/contract-text';

/**
 * The contract a deal is signed under.
 *
 * Generated the moment terms freeze, from the frozen snapshot and nothing
 * else, so what both sides sign is exactly what both sides agreed. Signed by
 * each side with a typed name — see `schema.contracts` for what a signature
 * records — and once both have signed, the deal is booked.
 */

type Booking = typeof t.bookings.$inferSelect;
export type Contract = typeof t.contracts.$inferSelect;

export const sha256 = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex');

/** The live contract for a deal: the newest one that has not been voided. */
export async function currentContract(bookingId: number): Promise<Contract | null> {
	const rows = await db
		.select()
		.from(t.contracts)
		.where(and(eq(t.contracts.bookingId, bookingId), ne(t.contracts.status, 'void')))
		.orderBy(desc(t.contracts.version))
		.limit(1);
	return rows.at(0) ?? null;
}

/**
 * Writes the contract for a deal whose terms have just frozen.
 *
 * Any earlier unsigned version is voided first — terms re-agreed after a
 * contract went out mean the old text no longer describes the deal — and the
 * new one takes the next version number.
 */
export async function generateContract(
	booking: Booking,
	actor: { id?: string | null; name?: string | null }
): Promise<Contract> {
	const snapshot = booking.termsSnapshot;
	if (!snapshot) throw new Error(`Booking ${booking.id} has no frozen terms to contract on`);

	const [settings, orgRows, creatorRows, previous] = await Promise.all([
		getSettings(),
		db
			.select({ name: t.organizations.name })
			.from(t.organizations)
			.where(eq(t.organizations.id, booking.organizationId))
			.limit(1),
		db
			.select({ fullName: t.creators.fullName, username: t.creators.username })
			.from(t.creators)
			.where(eq(t.creators.id, booking.creatorId))
			.limit(1),
		db
			.select({ version: t.contracts.version })
			.from(t.contracts)
			.where(eq(t.contracts.bookingId, booking.id))
			.orderBy(desc(t.contracts.version))
			.limit(1)
	]);

	const version = (previous.at(0)?.version ?? 0) + 1;
	const reference = `${booking.reference}-C${version}`;
	const generatedAt = new Date();

	const body = contractText({
		reference,
		dealReference: booking.reference,
		generatedAt,
		platform: {
			name: settings?.siteName || 'Influencer Ethiopia',
			legalName: settings?.invoiceLegalName ?? '',
			tin: settings?.invoiceTin ?? '',
			address: settings?.invoiceAddress ?? ''
		},
		brand: { name: orgRows.at(0)?.name ?? 'the Brand' },
		creator: {
			fullName: creatorRows.at(0)?.fullName ?? 'the Creator',
			handle: `@${creatorRows.at(0)?.username ?? ''}`
		},
		terms: {
			title: snapshot.title,
			deliverables: snapshot.deliverables,
			compensationType: snapshot.compensationType,
			currencyCode: snapshot.currencyCode,
			price: snapshot.price,
			commission: snapshot.platformFee,
			commissionPercent: snapshot.commissionPercent ?? booking.commissionPercent,
			creatorPayout: snapshot.creatorPayout,
			brandServiceFee: snapshot.brandServiceFee ?? booking.brandServiceFee,
			brandServiceFeeVat: snapshot.brandServiceFeeVat ?? booking.brandServiceFeeVat,
			brandTotal: snapshot.brandTotal ?? (booking.brandTotal || booking.price),
			deadline: snapshot.deadline,
			revisionsAllowed: snapshot.revisionsAllowed,
			barterDetails: snapshot.barterDetails
		},
		disputeWindowDays: settings?.disputeWindowDays ?? 7
	});

	await db
		.update(t.contracts)
		.set({ status: 'void', voidedAt: generatedAt, updatedBy: actor.id ?? null })
		.where(
			and(eq(t.contracts.bookingId, booking.id), eq(t.contracts.status, 'awaiting_signatures'))
		);

	await db.insert(t.contracts).values({
		bookingId: booking.id,
		reference,
		version,
		body,
		bodyHash: sha256(body),
		status: 'awaiting_signatures',
		createdBy: actor.id ?? null
	});

	await recordAudit({
		actorId: actor.id,
		actorLabel: actor.name,
		entity: 'booking',
		entityId: booking.id,
		action: 'contract_generated',
		reason: `${reference} (sha256 ${sha256(body).slice(0, 12)}…)`
	});

	return (await currentContract(booking.id))!;
}

export type SignProblem = 'not_awaiting' | 'already_signed' | 'name_mismatch' | 'tampered';

/**
 * Records one side's signature, and reports whether that completed the pair.
 *
 * The typed name has to be a real attempt at the signer's name — it is
 * compared loosely with the account name, not for equality, since "Selam T."
 * signing for "Selam Tesfaye" is a person signing. The body is re-hashed first:
 * a contract whose text no longer matches its fingerprint is refused, not
 * signed.
 */
export async function signContract(
	contract: Contract,
	input: {
		side: 'organization' | 'creator';
		user: { id: string; name: string };
		typedName: string;
		ip: string | null;
	}
): Promise<{ ok: true; complete: boolean } | { ok: false; problem: SignProblem }> {
	if (contract.status !== 'awaiting_signatures') return { ok: false, problem: 'not_awaiting' };
	if (sha256(contract.body) !== contract.bodyHash) return { ok: false, problem: 'tampered' };

	const brand = input.side === 'organization';
	if (brand ? contract.brandSignedAt : contract.creatorSignedAt) {
		return { ok: false, problem: 'already_signed' };
	}
	if (!namesMatch(input.typedName, input.user.name)) return { ok: false, problem: 'name_mismatch' };

	const now = new Date();
	const patch = brand
		? {
				brandSignerId: input.user.id,
				brandSignerName: input.typedName.trim(),
				brandSignedAt: now,
				brandSignerIp: input.ip
			}
		: {
				creatorSignerId: input.user.id,
				creatorSignerName: input.typedName.trim(),
				creatorSignedAt: now,
				creatorSignerIp: input.ip
			};
	const complete = Boolean(brand ? contract.creatorSignedAt : contract.brandSignedAt);

	await db
		.update(t.contracts)
		.set({
			...patch,
			...(complete ? { status: 'signed' as const, signedAt: now } : {}),
			updatedBy: input.user.id
		})
		.where(and(eq(t.contracts.id, contract.id), eq(t.contracts.status, 'awaiting_signatures')));

	await recordAudit({
		actorId: input.user.id,
		actorLabel: input.user.name,
		entity: 'booking',
		entityId: contract.bookingId,
		action: 'contract_signed',
		reason: `${contract.reference} signed by the ${brand ? 'brand' : 'creator'} as "${input.typedName.trim()}"`
	});

	return { ok: true, complete };
}

/**
 * Whether a typed signature is plausibly the account holder's name: at least
 * one word of three letters or more in common, ignoring case and accents.
 */
export function namesMatch(typed: string, accountName: string): boolean {
	const words = (value: string) =>
		new Set(
			value
				.normalize('NFKD')
				.replace(/\p{M}/gu, '')
				.toLowerCase()
				.split(/[^\p{L}\p{N}]+/u)
				.filter((word) => word.length >= 3)
		);
	const typedWords = words(typed);
	if (!typedWords.size) return false;
	const accountWords = words(accountName);
	/* An account with no usable name cannot be compared; the typed name stands. */
	if (!accountWords.size) return true;
	return [...typedWords].some((word) => accountWords.has(word));
}
