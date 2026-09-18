import * as m from '$lib/paraglide/messages';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireBlogAuthor } from '$lib/server/blog-authorship';
import { saveUploadedFile } from '$lib/server/upload';
import { uploadErrorText } from '$lib/server/crud';
import { assetUrl } from '$lib/assets';

/**
 * Where an image dropped into an author's article body is stored.
 *
 * The operator has its own copy of this under /dashboard/admin/blog, and the
 * two are deliberately separate endpoints rather than one with a wider guard:
 * the only thing they share is `saveUploadedFile`, and a single route admitting
 * both audiences is one edit away from admitting everybody.
 *
 * It checks the account itself rather than relying on the dashboard layout: a
 * layout `load` does not run for a POST that never renders a page.
 */
export const POST: RequestHandler = async (event) => {
	await requireBlogAuthor(event);

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
