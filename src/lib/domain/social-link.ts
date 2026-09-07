/**
 * Turning what somebody typed into a profile address.
 *
 * Everything here is pure and runs on both sides of the wire: the channels form
 * builds the same URL the server will check, so the reader is shown the address
 * that was actually looked up rather than one reconstructed afterwards.
 *
 * The platform names are `platforms.name` as seeded — "TikTok", "Instagram",
 * "YouTube", "Facebook", "Telegram", "X", "LinkedIn" — matched case-insensitively
 * so a renamed row does not silently stop producing links.
 */

/** What a check concluded about an address. Stored on `social_accounts`. */
export const LINK_STATUSES = ['unchecked', 'found', 'not_found', 'unknown'] as const;
export type LinkStatus = (typeof LINK_STATUSES)[number];

/**
 * The bare handle, whatever form it arrived in.
 *
 * People paste the whole address as often as they type the name, and a stored
 * "https://www.tiktok.com/@nuru" is a handle nothing can look up. A URL is
 * reduced to its last meaningful segment; a bare name loses its `@`, its
 * surrounding spaces and any trailing slash.
 */
export function normaliseHandle(raw: string): string {
	let value = (raw ?? '').trim();
	if (!value) return '';

	if (/^https?:\/\//i.test(value)) {
		try {
			const url = new URL(value);
			/* `/@nuru`, `/in/nuru`, `/c/nuru` — the last non-empty segment is the
			   name in every shape these sites use. */
			const segments = url.pathname.split('/').filter(Boolean);
			value = segments.at(-1) ?? '';
		} catch {
			/*
			 * It announced itself as a URL and is not one — "https://" and nothing
			 * else, a typo, a half-pasted line. Empty is the honest answer: falling
			 * through to the text branch would hand back "https:" and let a lookup
			 * be attempted on it.
			 */
			return '';
		}
	}

	return value.replace(/^@/, '').replace(/\/+$/, '').trim();
}

/** Where a handle lives, for the platforms whose URL shape is unambiguous. */
export function profileUrlFor(platform: string, handle: string): string | null {
	const bare = normaliseHandle(handle);
	if (!bare) return null;

	switch (platform.trim().toLowerCase()) {
		case 'instagram':
			return `https://www.instagram.com/${bare}/`;
		case 'tiktok':
			return `https://www.tiktok.com/@${bare}`;
		case 'youtube':
			return `https://www.youtube.com/@${bare}`;
		case 'facebook':
			return `https://www.facebook.com/${bare}`;
		case 'telegram':
			return `https://t.me/${bare}`;
		case 'x':
		case 'twitter':
			return `https://x.com/${bare}`;
		case 'linkedin':
			return `https://www.linkedin.com/in/${bare}`;
		default:
			return null;
	}
}
