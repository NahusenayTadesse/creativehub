import * as m from '$lib/paraglide/messages';

/**
 * Where a follower count or an engagement rate came from.
 *
 * A figure on a channel is only as good as whoever put it there, and a brand
 * comparing two creators deserves to know which of the two numbers anyone has
 * actually checked. Five answers, from weakest to strongest:
 *
 * - `self_reported` — the creator typed it on the channels form.
 * - `imported` — an operator's research, brought in by `import:creators`. Found
 *   somewhere public, never confirmed with the platform or the creator.
 * - `proof` — an operator compared it against a screenshot of the creator's own
 *   analytics and approved it.
 * - `bio_code` — the creator wrote a code we gave them into their profile bio,
 *   and the figure was then read off that same profile. Nobody at this end
 *   typed it, and the account answered to a code only its owner could have
 *   placed. See `$lib/server/ownership.ts`.
 * - `platform` — the platform's API returned it to the scheduled refresh.
 *
 * Pure and client-safe: the channels page and the public profile both label a
 * figure with it, and the score weighs one with it.
 */
export const STAT_SOURCES = ['self_reported', 'imported', 'proof', 'bio_code', 'platform'] as const;
export type StatSource = (typeof STAT_SOURCES)[number];

/** Has anyone other than the creator stood behind this figure? */
export const isConfirmedSource = (source: string | null | undefined): boolean =>
	source === 'platform' || source === 'proof' || source === 'bio_code';

/**
 * What a figure from this source is worth to the score, as a multiplier.
 *
 * Unconfirmed figures still count — most of the marketplace has nothing else
 * yet, and zeroing them would rank a creator who has never been asked for proof
 * below one who invented nothing but also filled nothing in. They count at half,
 * so confirming a number is always worth doing.
 */
export const sourceConfidence = (source: string | null | undefined): number =>
	isConfirmedSource(source) ? 1 : 0.5;

/** A short phrase for the reader: "Confirmed by YouTube", "Self-reported". */
export function statSourceLabel(source: string | null | undefined, platform: string): string {
	switch (source) {
		case 'platform':
			return m.src_platform({ platform });
		case 'proof':
			return m.src_proof({ platform });
		case 'bio_code':
			return m.src_bio_code({ platform });
		case 'imported':
			return m.src_imported();
		default:
			return m.src_self_reported();
	}
}
