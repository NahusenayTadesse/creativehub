import * as m from '$lib/paraglide/messages';
import { and, asc, desc, eq, isNull } from 'drizzle-orm';
import type { RequestEvent } from '@sveltejs/kit';
import { message, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { contentCrud, CrudRefusal, uploadErrorText } from '$lib/server/crud';
import { db, insertedId } from '$lib/server/db';
import * as t from '$lib/server/db/schema';
import { socialAdd, socialEdit, statProofSubmit } from '$lib/schemas';
import { recordAudit, requireCreator } from '$lib/server/guards';
import { refreshCreatorReach } from '$lib/server/score-service';
import { verifySubmittedLink } from '$lib/server/social-verify';
import { saveUploadedFile } from '$lib/server/upload';
import { profileUrlFor } from '$lib/domain/social-link';

/**
 * The handle is looked up at the platform before the row is written.
 *
 * Checked on edit as well as on add, and not only because a handle can be
 * corrected: a check that ran on create alone would be a formality anyone could
 * walk past by saving a real account and then editing it into a fabricated one.
 *
 * Only an unambiguous `not_found` refuses. A platform that did not answer, or
 * one nobody can check anonymously — Instagram, Facebook, LinkedIn — comes back
 * `unknown`, and `unknown` saves: it is a statement about this server's reach,
 * not about the creator. The verdict is stored either way, so the listing can
 * say when it was last looked at rather than implying it is fresh.
 */
async function checkLink(values: Record<string, unknown>) {
	const platformId = Number(values.platformId);
	const handle = String(values.handle ?? '');
	const verdict = await verifySubmittedLink(platformId, handle);

	if (verdict.status === 'not_found') {
		throw new CrudRefusal(
			m.sc_refused({ platform: verdict.platform ?? '', url: verdict.url ?? '' })
		);
	}

	return {
		linkStatus: verdict.status,
		linkCheckedAt: new Date(),
		/* An empty URL field is filled in from the handle, since the check has
		   just proved that is where the account lives. One the creator typed is
		   left exactly as they typed it. */
		...(values.profileUrl
			? {}
			: { profileUrl: verdict.url ?? profileUrlFor(verdict.platform ?? '', handle) })
	};
}

/**
 * What a figure typed on this form is labelled as.
 *
 * A figure the creator changes becomes theirs: `self_reported`, dated now,
 * whatever it said before — a count the platform confirmed at 40,000 and the
 * creator then edits to 90,000 is not confirmed at 90,000. A figure the form
 * posts back unchanged keeps its source, so moving a channel up the list does
 * not throw away an operator's approval. The scheduled refresh puts a platform
 * figure back the next time it runs, which is the right outcome for a channel a
 * platform can speak for.
 */
async function sourcesFor(
	creatorId: number,
	values: Record<string, unknown>,
	action: 'add' | 'edit',
	id?: number
) {
	const now = new Date();
	const followers = Number(values.followers);
	const engagementRate = Number(values.engagementRate);

	const current =
		action === 'edit' && id
			? (
					await db
						.select({
							followers: t.socialAccounts.followers,
							engagementRate: t.socialAccounts.engagementRate
						})
						.from(t.socialAccounts)
						.where(and(eq(t.socialAccounts.id, id), eq(t.socialAccounts.creatorId, creatorId)))
						.limit(1)
				).at(0)
			: undefined;

	const followersChanged = !current || current.followers !== followers;
	const engagementChanged = !current || Math.abs(current.engagementRate - engagementRate) > 1e-9;

	return {
		...(followersChanged
			? { followersSource: 'self_reported' as const, followersUpdatedAt: now }
			: {}),
		...(engagementChanged
			? {
					engagementSource: 'self_reported' as const,
					engagementUpdatedAt: engagementRate > 0 ? now : null
				}
			: {})
	};
}

/** Linked social accounts. Total reach is recomputed from them after each write. */
const crudFor = (creatorId: number) =>
	contentCrud({
		table: t.socialAccounts,
		label: () => m.ch_label(),
		addSchema: socialAdd,
		editSchema: socialEdit,
		scope: { column: t.socialAccounts.creatorId, key: 'creatorId', value: creatorId },
		beforeWrite: async (_event, values, action, id) => ({
			...(await checkLink(values)),
			...(await sourcesFor(creatorId, values, action, id))
		}),
		afterWrite: () => refreshCreatorReach(creatorId)
	});

/** Forms on one page need distinct ids, or superforms cannot tell their messages apart. */
const PROOF_FORM_ID = 'stat-proof';

export const load = async (event: RequestEvent) => {
	const { creator } = await requireCreator(event);
	const [base, platforms, proofs, proofForm] = await Promise.all([
		crudFor(creator.id).load(event),
		db.select().from(t.platforms).orderBy(asc(t.platforms.sortOrder)),
		/* Newest first, so the first row seen for a channel is its latest proof. */
		db
			.select({
				id: t.statProofs.id,
				socialAccountId: t.statProofs.socialAccountId,
				status: t.statProofs.status,
				adminNotes: t.statProofs.adminNotes,
				createdAt: t.statProofs.createdAt,
				reviewedAt: t.statProofs.reviewedAt
			})
			.from(t.statProofs)
			.where(and(eq(t.statProofs.creatorId, creator.id), isNull(t.statProofs.deletedAt)))
			.orderBy(desc(t.statProofs.createdAt)),
		superValidate(zod4(statProofSubmit), { id: PROOF_FORM_ID })
	]);

	const latestProof: Record<number, (typeof proofs)[number]> = {};
	for (const proof of proofs) latestProof[proof.socialAccountId] ??= proof;

	return { ...base, platforms, latestProof, proofForm };
};

export const actions = {
	add: async (event: RequestEvent) => {
		const { creator } = await requireCreator(event);
		return crudFor(creator.id).actions.add(event);
	},
	edit: async (event: RequestEvent) => {
		const { creator } = await requireCreator(event);
		return crudFor(creator.id).actions.edit(event);
	},
	delete: async (event: RequestEvent) => {
		const { creator } = await requireCreator(event);
		return crudFor(creator.id).actions.delete(event);
	},

	/**
	 * Evidence for a channel's figures, for an operator to check.
	 *
	 * Nothing on the channel changes here. The figures posted are what the
	 * creator says the screenshot shows; `/dashboard/admin/figure-proofs` is where
	 * someone compares the two and, on approval, writes them with source `proof`.
	 */
	proof: async (event: RequestEvent) => {
		const { user, creator } = await requireCreator(event);
		const form = await superValidate(event.request, zod4(statProofSubmit), { id: PROOF_FORM_ID });
		if (!form.valid) {
			return message(form, { type: 'error', text: m.srv_please_check_form() }, { status: 400 });
		}

		/* Scoped to this creator: the id in the form is a claim, not a permission. */
		const account = (
			await db
				.select({ id: t.socialAccounts.id })
				.from(t.socialAccounts)
				.where(
					and(
						eq(t.socialAccounts.id, form.data.socialAccountId),
						eq(t.socialAccounts.creatorId, creator.id),
						isNull(t.socialAccounts.deletedAt)
					)
				)
				.limit(1)
		).at(0);
		if (!account) {
			return message(form, { type: 'error', text: m.srv_proof_no_channel() }, { status: 404 });
		}

		/* One open proof per channel keeps the queue to one question per number. */
		const open = await db
			.select({ id: t.statProofs.id })
			.from(t.statProofs)
			.where(and(eq(t.statProofs.socialAccountId, account.id), eq(t.statProofs.status, 'pending')))
			.limit(1);
		if (open.length) {
			return message(form, { type: 'error', text: m.srv_proof_open() }, { status: 409 });
		}

		/* A screenshot, specifically. The upload allows PDFs for identity documents,
		   but an analytics screen an operator has to read at a glance is an image. */
		if (!form.data.screenshot.type.startsWith('image/')) {
			return message(form, { type: 'error', text: m.srv_proof_image_only() }, { status: 400 });
		}

		let screenshot: string;
		try {
			/* Private: an analytics screen can show audience and earnings detail the
			   creator never meant to publish. `/files/private/[name]` checks who asks. */
			screenshot = await saveUploadedFile(form.data.screenshot, { visibility: 'private' });
		} catch (err) {
			const upload = uploadErrorText(err);
			if (upload) return message(form, { type: 'error', text: upload }, { status: 400 });
			throw err;
		}

		const engagementRate =
			form.data.engagementRate !== undefined && form.data.engagementRate > 0
				? form.data.engagementRate
				: null;

		const result = await db.insert(t.statProofs).values({
			creatorId: creator.id,
			socialAccountId: account.id,
			screenshot,
			followers: form.data.followers,
			engagementRate,
			status: 'pending',
			createdBy: user.id
		});

		await recordAudit({
			actorId: user.id,
			actorLabel: creator.fullName,
			entity: 'stat_proof',
			entityId: insertedId(result),
			action: 'submitted',
			toState: 'pending',
			reason: `Channel ${account.id}: ${form.data.followers} followers${engagementRate === null ? '' : `, ${engagementRate}% engagement`}`
		});

		return message(form, { type: 'success', text: m.srv_proof_submitted() });
	}
};
