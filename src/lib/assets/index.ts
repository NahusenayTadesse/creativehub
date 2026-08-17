/**
 * Uploaded files are stored on disk under a generated name and served by
 * `/files/[name]`. Anything that already looks like a URL is passed through, so
 * a column can hold either an upload or an external link.
 */
export function assetUrl(value?: string | null): string {
	if (!value) return '';
	if (/^(https?:)?\/\//.test(value) || value.startsWith('data:') || value.startsWith('/')) {
		return value;
	}
	return `/files/${value}`;
}

/** True when the stored value is an upload rather than an external link. */
export const isUpload = (value?: string | null) =>
	Boolean(value) && !/^(https?:)?\/\//.test(value!) && !value!.startsWith('/');
