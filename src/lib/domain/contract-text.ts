/**
 * The engagement agreement, written out from a deal's frozen terms.
 *
 * Plain text with numbered clauses, because the text *is* the contract: it is
 * hashed when generated, and a signature is a statement about exactly these
 * characters. Anything that renders it — the booking page, the printable
 * copy — shows this string and adds nothing to it.
 *
 * English only, deliberately. A contract in two languages needs a clause
 * saying which one governs and a translation somebody qualified has checked;
 * until that exists, one language is the honest number.
 *
 * The wording is a working template for the legal review the owner has in
 * hand. Two rules from the brief hold in it already: the platform is the
 * party the brand contracts with and pays, and the word the brief retired for
 * funds held on a deal appears nowhere — they are "campaign funds held".
 */

/** Bumped whenever the wording changes, and stamped into every contract. */
export const CONTRACT_TEMPLATE_VERSION = '2026-09 v1';

/** How long after a deal ends the parties may not go around the platform. */
export const NON_CIRCUMVENTION_MONTHS = 12;

export type ContractInput = {
	reference: string;
	dealReference: string;
	generatedAt: Date;
	platform: { name: string; legalName: string; tin: string; address: string };
	brand: { name: string };
	creator: { fullName: string; handle: string };
	terms: {
		title: string;
		deliverables: string[];
		compensationType: 'paid' | 'barter' | 'event_pass';
		currencyCode: string;
		price: number;
		commission: number;
		commissionPercent: number;
		creatorPayout: number;
		brandServiceFee: number;
		brandServiceFeeVat: number;
		brandTotal: number;
		deadline: string | null;
		revisionsAllowed: number;
		barterDetails?: string | null;
	};
	disputeWindowDays: number;
};

const money = (amount: number, currency: string) =>
	`${currency} ${Math.round(amount).toLocaleString('en-US')}`;

const day = (date: Date) =>
	date.toLocaleDateString('en-GB', {
		day: 'numeric',
		month: 'long',
		year: 'numeric',
		timeZone: 'UTC'
	});

export function contractText(input: ContractInput): string {
	const { platform, brand, creator, terms } = input;
	const platformName = platform.legalName || platform.name;
	const paid = terms.compensationType === 'paid';
	const c = terms.currencyCode;

	const deliverables = terms.deliverables.length
		? terms.deliverables.map((line, index) => `   ${index + 1}. ${line}`).join('\n')
		: '   As described in the deal title above.';

	const payment = paid
		? [
				`4.1 The Brand pays the Platform ${money(terms.brandTotal, c)}, being the campaign fee of ${money(terms.price, c)}, the Platform's service fee of ${money(terms.brandServiceFee, c)}${terms.brandServiceFeeVat ? ` and VAT on that service fee of ${money(terms.brandServiceFeeVat, c)}` : ''}. The Brand receives one invoice from the Platform for the whole amount.`,
				`4.2 The Platform holds the campaign funds from the moment they are received until the work is completed under clause 7, or until a dispute is decided under clause 9.`,
				`4.3 On completion the Platform pays the Creator ${money(terms.creatorPayout, c)}. The Platform keeps a commission of ${money(terms.commission, c)} (${terms.commissionPercent}% of the campaign fee, or the minimum commission where that is higher) for sourcing, managing and guaranteeing the engagement, less any tax the Platform is required by law to withhold, which it certifies to the Creator.`,
				`4.4 Production does not begin until the campaign funds are held.`
			].join('\n')
		: [
				`4.1 This engagement is compensated in kind (${terms.compensationType === 'barter' ? 'barter' : 'event access'}), not in money: ${terms.barterDetails?.trim() || 'as set out in the deliverables'}.`,
				`4.2 No campaign fee passes through the Platform and no commission is charged.`
			].join('\n');

	return `ENGAGEMENT AGREEMENT
Contract ${input.reference} · Deal ${input.dealReference}
Generated ${day(input.generatedAt)} · Template ${CONTRACT_TEMPLATE_VERSION}

PARTIES
The Platform: ${platformName}${platform.tin ? `, TIN ${platform.tin}` : ''}${platform.address ? `, ${platform.address}` : ''}, operating ${platform.name}.
The Brand: ${brand.name}.
The Creator: ${creator.fullName} (${creator.handle}).

1. WHAT THIS AGREEMENT IS
1.1 The Brand engages the Platform to deliver the campaign below. The Platform sources and manages the Creator, holds and releases the campaign funds, and guarantees delivery as set out here. The Brand deals with the Platform, and pays the Platform.
1.2 The Creator agrees with the Platform and the Brand to produce and publish the work below on these terms.

2. THE WORK
Campaign: ${terms.title}
Deliverables:
${deliverables}
Deadline for the first delivery: ${terms.deadline ? day(new Date(`${terms.deadline}T00:00:00Z`)) : 'as agreed in the deal thread'}.
Rounds of revision included: ${terms.revisionsAllowed}.

3. HOW THE WORK IS APPROVED
3.1 Before production the Creator submits a concept. Production begins when the Brand approves it.
3.2 The Creator then submits the finished work for the Brand's approval. The Brand may ask for changes up to the number of revisions above, each time saying what needs to change.
3.3 Once approved, the Creator publishes the work and submits proof: the live link and a screenshot of the post as published. The Creator then records the post's performance, with a screenshot of the platform's own analytics, at 24 hours, 7 days and 30 days after publishing.
3.4 The Creator keeps the work live for at least 30 days unless the Brand agrees otherwise in writing on the Platform.

4. PAYMENT
${payment}

5. CONTENT AND ITS USE
5.1 The Creator owns the content they make. The Creator grants the Brand the right to share, repost and link to the published work, credited to the Creator, for twelve months from publishing. Any other use — paid advertising, broadcast, print — needs the Creator's written agreement on the Platform.
5.2 The Creator confirms the work is their own, that they hold the rights to everything in it, and that it will be labelled as a paid partnership where the law or the channel requires it.

6. CONFIDENTIALITY
Each party keeps the other's non-public information — the brief, the campaign's plans, the price — confidential, and uses it only for this engagement, until the Brand makes the campaign public.

7. COMPLETION
The engagement is complete when the proof of publishing is submitted and the Brand, or the Platform on the Brand's behalf, confirms it. The Platform then pays the Creator under clause 4.

8. NON-CIRCUMVENTION
For ${NON_CIRCUMVENTION_MONTHS} months after this agreement ends, the Brand and the Creator will not agree paid work with each other except through the Platform, whether directly or through anyone acting for them. Where they do, the party that arranged it pays the Platform the commission it would have earned on that work.

9. CANCELLATION AND DISPUTES
9.1 The engagement may be cancelled when both the Brand and the Creator agree on the Platform. Campaign funds are then returned to the Brand, less anything the parties agree the Creator has earned.
9.2 Either party may raise a dispute on the Platform while the engagement is open, and for ${input.disputeWindowDays} days after completion. The Platform reviews both parties' statements and evidence and decides how the campaign funds are divided: released to the Creator, returned to the Brand, or split. The parties accept the Platform's decision as the first step before any other remedy.

10. GENERAL
10.1 This agreement is governed by the laws of the Federal Democratic Republic of Ethiopia.
10.2 The parties sign electronically on the Platform. Each signature records the signer's account, their typed full name, the time and the network address, and the agreement's fingerprint below. Each party agrees that this signature binds them as a handwritten one would.
10.3 This agreement, the frozen terms of the deal and the record kept on the Platform are the whole agreement between the parties about this engagement.
`;
}
