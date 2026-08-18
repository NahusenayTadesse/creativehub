import { serveStoredFile } from '$lib/server/serveFile';

/**
 * Public uploads: avatars, covers, portfolio media, organisation logos.
 *
 * Anything that needs an authorisation check is written to the private
 * directory instead and served by `/files/private/[name]`, which this route
 * cannot reach — its param matcher accepts a single path segment only.
 */
export async function GET({ params, request }: { params: { name: string }; request: Request }) {
	return serveStoredFile(params.name, request);
}
