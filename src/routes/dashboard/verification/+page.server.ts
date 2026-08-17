import { fail } from '@sveltejs/kit';
import { superValidate, message } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { desc, eq, or } from 'drizzle-orm';
import type { PageServerLoad, Actions } from './$types';
import { db } from '$lib/server/db';
import * as t from '$lib/server/db/schema';
import { requireUser, getCreatorFor, getOrganizationFor, recordAudit } from '$lib/server/guards';
import { verificationSubmit } from '$lib/schemas';
import { saveUploadedFile } from '$lib/server/upload';

export const load: PageServerLoad = async ({ parent }) => {
	const { creator, organization } = await parent();

	const subject = creator
		? { type: 'creator' as const, id: creator.id, level: creator.verificationLevel }
		: organization
			? { type: 'organization' as const, id: organization.id, level: organization.verificationLevel }
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
			return message(form, { type: 'error', text: 'Check the form for errors' }, { status: 400 });
		}

		const creator = await getCreatorFor(user.id);
		const organization = creator ? undefined : await getOrganizationFor(user.id);

		if (!creator && !organization) {
			return message(
				form,
				{ type: 'error', text: 'Create a profile or organisation before requesting verification.' },
				{ status: 403 }
			);
		}

		/* One open case at a time keeps the operator queue meaningful. */
		const open = await db
			.select({ id: t.verificationRequests.id })
			.from(t.verificationRequests)
			.where(
				creator
					? eq(t.verificationRequests.creatorId, creator.id)
					: eq(t.verificationRequests.organizationId, organization!.id)
			)
			.limit(20);

		const pending = open.length
			? await db
					.select({ id: t.verificationRequests.id })
					.from(t.verificationRequests)
					.where(
						or(
							eq(t.verificationRequests.status, 'pending'),
							eq(t.verificationRequests.status, 'under_review')
						)
					)
			: [];

		if (pending.some((row) => open.some((o) => o.id === row.id))) {
			return message(
				form,
				{ type: 'error', text: 'You already have a case under review.' },
				{ status: 409 }
			);
		}

		/* An upload is written to disk; a pasted link is stored as-is. */
		const evidence = form.data.documentUrl;
		const documentUrl =
			evidence instanceof File && evidence.size > 0
				? await saveUploadedFile(evidence)
				: typeof evidence === 'string'
					? evidence
					: '';

		if (!documentUrl) {
			return message(
				form,
				{ type: 'error', text: 'Attach a document or paste a link to your evidence.' },
				{ status: 400 }
			);
		}

		await db.insert(t.verificationRequests).values({
			subjectType: creator ? 'creator' : 'organization',
			creatorId: creator?.id ?? null,
			organizationId: organization?.id ?? null,
			requestedLevel: form.data.requestedLevel,
			documentUrl,
			socialProofs: form.data.socialProofs
				.split('\n')
				.map((line) => line.trim())
				.filter(Boolean),
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

		return message(form, { type: 'success', text: 'Submitted for operator review.' });
	}
};
