import * as m from '$lib/paraglide/messages';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { requireBookingAccess } from '$lib/server/guards';
import { currentContract, sha256 } from '$lib/server/contracts';

/**
 * The contract on its own, for printing or saving as a PDF from the browser.
 * Only the deal's two sides and the platform's staff can open it.
 */
export const load: PageServerLoad = async (event) => {
	const id = Number(event.params.id);
	if (!Number.isFinite(id)) error(404, m.srv_booking_not_found());
	const { booking } = await requireBookingAccess(event, id);

	const contract = await currentContract(id);
	if (!contract) error(404, m.ct_none());

	return {
		reference: booking.reference,
		contract: {
			reference: contract.reference,
			status: contract.status,
			body: contract.body,
			bodyHash: contract.bodyHash,
			/* Re-hashed on every view: what is printed is checked against its
			   fingerprint, not merely shown beside it. */
			intact: sha256(contract.body) === contract.bodyHash,
			brandSignerName: contract.brandSignerName,
			brandSignedAt: contract.brandSignedAt,
			creatorSignerName: contract.creatorSignerName,
			creatorSignedAt: contract.creatorSignedAt,
			signedAt: contract.signedAt
		}
	};
};
