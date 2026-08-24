/**
 * Stand-in artwork for an image that is missing or refuses to load.
 *
 * Every image on the site points at something outside our control — an upload
 * that may have been pruned, a scraped avatar on someone else's host, an
 * unsplash URL the Content-Security-Policy blocks outright (`img-src` is
 * `'self' data: blob:`). A broken image icon is the worst possible answer to
 * any of those, and `src=""` is worse still: the browser re-requests the page
 * itself and renders that as a broken image.
 *
 * So the fallback is drawn rather than fetched. These are SVG data URIs — no
 * network, no layout shift, allowed by the `data:` in `img-src`, and identical
 * on the server and the client so hydration does not swap them.
 *
 * The colour comes from the seed, so a creator with no avatar still gets a
 * consistent one across the card, the quick view and their profile.
 */

export type PlaceholderKind =
	/** Square, initials on a tint. People. */
	| 'avatar'
	/** Wide gradient band. Cover photos and hero images. */
	| 'cover'
	/** Neutral tile with a picture glyph. Portfolio and campaign media. */
	| 'media'
	/** Rounded square, initials. Organisations. */
	| 'logo';

/**
 * A stable hue for a string.
 *
 * djb2, which is plenty for picking a colour and — unlike anything involving
 * `Math.random` — gives the same answer in the server render and the client
 * hydration that follows it.
 */
function hueOf(seed: string): number {
	let hash = 5381;
	for (let i = 0; i < seed.length; i++) hash = (hash * 33) ^ seed.charCodeAt(i);
	return Math.abs(hash) % 360;
}

/** "Kwame Accra Eats" → "KA". Falls back to a neutral glyph for empty input. */
export function initialsOf(label: string): string {
	const words = label
		.trim()
		.replace(/[^\p{L}\p{N}\s]/gu, ' ')
		.split(/\s+/)
		.filter(Boolean);
	if (!words.length) return '·';
	if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
	return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

/**
 * `svg` as a data URI.
 *
 * Percent-encoded rather than base64: it survives the `#` in a hex colour and
 * the quotes in an attribute, stays readable in devtools, and is shorter.
 */
const dataUri = (svg: string): string =>
	`data:image/svg+xml,${encodeURIComponent(svg.replace(/\s+/g, ' ').trim())}`;

/* No quoted family names: `encodeURIComponent` leaves an apostrophe alone, and
   nothing in a data URI that lands in an HTML attribute should carry a quote.
   `system-ui` already resolves to Segoe UI on Windows and San Francisco on
   Apple platforms, so the stack loses nothing by staying unquoted. */
const FONT = 'system-ui,-apple-system,sans-serif';

function initialsArt(label: string, hue: number, size: number, radius: number): string {
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
		<rect width="${size}" height="${size}" rx="${radius}" fill="hsl(${hue} 55% 90%)"/>
		<text x="50%" y="50%" dy=".02em" text-anchor="middle" dominant-baseline="central"
			font-family="${FONT}" font-size="${size * 0.4}" font-weight="700" fill="hsl(${hue} 45% 34%)"
			>${initialsOf(label)}</text>
	</svg>`;
}

function coverArt(hue: number): string {
	const second = (hue + 40) % 360;
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 240" width="640" height="240">
		<defs>
			<linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
				<stop offset="0" stop-color="hsl(${hue} 52% 82%)"/>
				<stop offset="1" stop-color="hsl(${second} 46% 68%)"/>
			</linearGradient>
		</defs>
		<rect width="640" height="240" fill="url(#g)"/>
		<circle cx="512" cy="52" r="132" fill="hsl(${second} 60% 88%)" opacity=".35"/>
		<circle cx="128" cy="212" r="96" fill="hsl(${hue} 60% 96%)" opacity=".28"/>
	</svg>`;
}

function mediaArt(hue: number): string {
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 360" width="480" height="360">
		<rect width="480" height="360" fill="hsl(${hue} 24% 92%)"/>
		<g fill="none" stroke="hsl(${hue} 22% 62%)" stroke-width="10" stroke-linejoin="round">
			<rect x="150" y="120" width="180" height="130" rx="14"/>
			<path d="M150 214l52-46 40 34 36-30 52 44"/>
		</g>
		<circle cx="204" cy="158" r="14" fill="hsl(${hue} 22% 62%)"/>
	</svg>`;
}

/**
 * Artwork for a missing image.
 *
 * `seed` decides the colour — pass something stable and specific to the subject
 * (a username, a slug) so the same creator is the same colour everywhere.
 * `label` is what gets drawn, for the kinds that draw text.
 */
export function placeholderImage(kind: PlaceholderKind, seed: string, label = ''): string {
	const hue = hueOf(seed || label || 'placeholder');
	switch (kind) {
		case 'avatar':
			return dataUri(initialsArt(label || seed, hue, 128, 24));
		case 'logo':
			return dataUri(initialsArt(label || seed, hue, 128, 32));
		case 'cover':
			return dataUri(coverArt(hue));
		default:
			return dataUri(mediaArt(hue));
	}
}
