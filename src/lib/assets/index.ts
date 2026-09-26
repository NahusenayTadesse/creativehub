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

/**
 * The URL to draw a stored picture from, when it is hosted here — and nothing
 * when it is not.
 *
 * Every image the site shows is served from its own server. A column still
 * holding somebody else's URL (an Instagram or TikTok CDN link with an expiry
 * stamp, a scraped avatar) is treated as having no picture, and the caller
 * draws its placeholder; the `mirror-images` job is what brings such a
 * picture home and repoints the row.
 */
export function hostedAssetUrl(value?: string | null): string {
	if (!value) return '';
	if (/^(https?:)?\/\//i.test(value.trim())) return '';
	return assetUrl(value);
}
