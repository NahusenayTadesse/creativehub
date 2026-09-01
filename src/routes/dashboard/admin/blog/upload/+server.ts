import * as m from '$lib/paraglide/messages';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireRole } from '$lib/server/guards';
import { saveUploadedFile } from '$lib/server/upload';
import { uploadErrorText } from '$lib/server/crud';
import { assetUrl } from '$lib/assets';

/**
 * Where an image dropped into the article body is stored.
 *
 * This exists because the body is edited in a `contenteditable`, not in a
 * form: an image has to be on disk and have a URL *before* the article is
 * saved, since the markup being written must already refer to it. The
 * alternative is a base64 data URL carried inside the row, which the sanitiser
 * would permit but which then travels in every render of the article, in the
 * feed, and in every backup of the table.
 *
 * The route is a POST under `/dashboard/admin`, and it re-checks the role
 * itself rather than relying on the layout: a layout `load` does not run for a
 * request that never renders a page.
 */
export const POST: RequestHandler = async (event) => {
	requireRole(event, 'admin');

	const form = await event.request.formData();
	const file = form.get('file');

	if (!(file instanceof File) || file.size === 0) {
		return json({ message: m.srv_invalid_request() }, { status: 400 });
	}

	try {
		const stored = await saveUploadedFile(file);
		/* The stored name, as the article body will refer to it. */
		return json({ url: assetUrl(stored) });
	} catch (err) {
		const rejected = uploadErrorText(err);
		if (rejected) return json({ message: rejected }, { status: 400 });

		console.error('Inline article upload failed:', err);
		return json({ message: m.srv_upload_failed() }, { status: 500 });
	}
};
