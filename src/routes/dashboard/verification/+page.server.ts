import * as m from '$lib/paraglide/messages';
import { superValidate, message } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { and, desc, eq, inArray } from 'drizzle-orm';
import type { PageServerLoad, Actions } from './$types';
import { db } from '$lib/server/db';
import * as t from '$lib/server/db/schema';
import { requireUser, getCreatorFor, getOrganizationFor, recordAudit } from '$lib/server/guards';
import { verificationSubmit, linesOf } from '$lib/schemas';
import { saveUploadedFile } from '$lib/server/upload';
import { uploadErrorText } from '$lib/server/crud';

export const load: PageServerLoad = async ({ parent }) => {
	const { creator, organization } = await parent();

	const subject = creator
		? { type: 'creator' as const, id: creator.id, level: creator.verificationLevel }
		: organization
			? {
					type: 'organization' as const,
					id: organization.id,
					level: organization.verificationLevel
				}
			: null;

	const requests = subject
		? await db
				.select()
				.from(t.verificationRequests)
				.where(
					subject.type === 'creator'
						? eq(t.verificationRequests.creatorId, subject.id)
						: eq(t.verificationRequests.organizationId, subject.id)
				)
				.orderBy(desc(t.verificationRequests.createdAt))
		: [];

	return { subject, requests, form: await superValidate(zod4(verificationSubmit)) };
};

export const actions: Actions = {
	default: async (event) => {
		const user = requireUser(event);
		const form = await superValidate(event.request, zod4(verificationSubmit));
		if (!form.valid) {
			return message(form, { type: 'error', text: m.srv_check_form() }, { status: 400 });
		}

		const creator = await getCreatorFor(user.id);
		const organization = creator ? undefined : await getOrganizationFor(user.id);

		if (!creator && !organization) {
			return message(form, { type: 'error', text: m.srv_create_profile_first() }, { status: 403 });
		}

		/*
		 * One open case at a time keeps the operator queue meaningful.
		 *
		 * Both halves of this used to be wrong: the subject's requests were capped
		 * at 20, so anyone past that could slip a second case through, and the
		 * pending lookup had no subject predicate at all — it read every open
		 * request on the platform and intersected them in JavaScript. One
		 * predicate answers the question.
		 */
		const open = await db
			.select({ id: t.verificationRequests.id })
			.from(t.verificationRequests)
			.where(
				and(
					creator
						? eq(t.verificationRequests.creatorId, creator.id)
						: eq(t.verificationRequests.organizationId, organization!.id),
					inArray(t.verificationRequests.status, ['pending', 'under_review'])
				)
			)
			.limit(1);

		if (open.length) {
			return message(form, { type: 'error', text: m.srv_case_under_review() }, { status: 409 });
		}

		/* An upload is written to disk; a pasted link is stored as-is. */
		const evidence = form.data.documentUrl;
		let documentUrl: string;
		try {
			documentUrl =
				evidence instanceof File && evidence.size > 0
					? /* Identity evidence is not public: this lands in the private
					     directory, behind /files/private/[name]'s ownership check. */
						await saveUploadedFile(evidence, { visibility: 'private' })
					: typeof evidence === 'string'
						? evidence
						: '';
		} catch (err) {
			/* A refused upload is the submitter's to correct, not a 500. */
			const upload = uploadErrorText(err);
			if (upload) return message(form, { type: 'error', text: upload }, { status: 400 });
			throw err;
		}

		if (!documentUrl) {
			return message(form, { type: 'error', text: m.srv_attach_evidence() }, { status: 400 });
		}

		await db.insert(t.verificationRequests).values({
			subjectType: creator ? 'creator' : 'organization',
			creatorId: creator?.id ?? null,
			organizationId: organization?.id ?? null,
			requestedLevel: form.data.requestedLevel,
			documentUrl,
			socialProofs: linesOf(form.data.socialProofs),
			status: 'pending',
			createdBy: user.id
		});

		await recordAudit({
			actorId: user.id,
			actorLabel: creator?.fullName ?? organization?.name,
			entity: 'verification',
			action: 'submitted',
			toState: 'pending',
			reason: `Requested ${form.data.requestedLevel}`
		});

		return message(form, { type: 'success', text: m.srv_verification_submitted() });
	}
};
