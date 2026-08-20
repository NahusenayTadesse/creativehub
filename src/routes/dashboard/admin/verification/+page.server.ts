import * as m from '$lib/paraglide/messages';
import { fail } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { eq } from 'drizzle-orm';
import type { PageServerLoad, Actions } from './$types';
import { db } from '$lib/server/db';
import * as t from '$lib/server/db/schema';
import { verificationQuery } from '$lib/server/queries';
import { requireRole, recordAudit } from '$lib/server/guards';
import { refreshCreatorScore } from '$lib/server/score-service';
import { verificationDecision } from '$lib/schemas';

export const load: PageServerLoad = async ({ url }) => {
	/*
	 * A queue opens on what is waiting. With no `status` in the URL the pending
	 * cases are the view; `?status=all` is a value the filter's vocabulary does
	 * not contain, so it drops out and every case shows — which is exactly what
	 * the "all" tab means.
	 */
	const chosen = url.searchParams.get('status');
	const scope = chosen ? [] : [eq(t.verificationRequests.status, 'pending')];

	const [requests, statusCounts, form] = await Promise.all([
		verificationQuery.run(url, { where: scope }),
		verificationQuery.facet(url, 'status'),
		superValidate(zod4(verificationDecision))
	]);

	return { requests, statusCounts, form };
};

export const actions: Actions = {
	decide: async (event) => {
		const user = requireRole(event, 'admin');
		const form = await superValidate(event.request, zod4(verificationDecision));
		if (!form.valid) return fail(400, { message: m.srv_invalid_request() });

		const rows = await db
			.select()
			.from(t.verificationRequests)
			.where(eq(t.verificationRequests.id, form.data.id))
			.limit(1);
		const request = rows.at(0);
		if (!request) return fail(404, { message: m.srv_case_not_found() });

		if (['approved', 'rejected'].includes(request.status)) {
			return fail(409, { message: m.srv_case_closed() });
		}
		/* Rejection has to say why — the subject sees this note. */
		if (
			(form.data.status === 'rejected' || form.data.status === 'more_info') &&
			!form.data.adminNotes.trim()
		) {
			return fail(400, { message: m.srv_need_reason() });
		}

		await db
			.update(t.verificationRequests)
			.set({
				status: form.data.status,
				adminNotes: form.data.adminNotes || null,
				reviewedBy: user.id,
				reviewedAt: new Date(),
				updatedBy: user.id
			})
			.where(eq(t.verificationRequests.id, request.id));

		/* Approval is the only path that grants a badge. */
		if (form.data.status === 'approved') {
			if (request.creatorId) {
				await db
					.update(t.creators)
					.set({ verificationLevel: request.requestedLevel })
					.where(eq(t.creators.id, request.creatorId));
				await refreshCreatorScore(request.creatorId);
			} else if (request.organizationId) {
				await db
					.update(t.organizations)
					.set({ verificationLevel: request.requestedLevel })
					.where(eq(t.organizations.id, request.organizationId));
			}
		}

		await recordAudit({
			actorId: user.id,
			actorLabel: user.name,
			entity: 'verification',
			entityId: request.id,
			action: 'decision',
			fromState: request.status,
			toState: form.data.status,
			reason: form.data.adminNotes || undefined
		});

		return { decided: form.data.status };
	}
};
