/**
 * The handful of things the blog's pages agree on.
 *
 * Kept out of the components so that a card, an article header and the
 * operator's listing cannot disagree about what a section's colour is or how a
 * date reads — three copies of a switch statement is how a "Draft" badge ends
 * up green on one screen and grey on another.
 */

import { getLocale } from '$lib/paraglide/runtime';
import * as m from '$lib/paraglide/messages';

/*
 * The two vocabularies live here rather than beside the Zod schemas because a
 * `.svelte` file needs them to draw its chips and its select, and `$lib/schemas`
 * reaches `$lib/server/crud` — importing it from a component would pull server
 * code into the browser bundle, which SvelteKit refuses outright.
 */

/** The tile accents a section can be painted in; each maps to a `bg-tile-*`. */
export const BLOG_ACCENTS = ['mint', 'yellow', 'peach', 'indigo'] as const;

/**
 * `draft` is invisible to readers, `published` is live, and `archived` keeps a
 * post reachable by its URL while dropping it from the index and the feed.
 */
export const BLOG_STATUSES = ['draft', 'published', 'archived'] as const;

/** The tile class each section accent paints with. */
const ACCENT_TILES: Record<string, string> = {
	mint: 'bg-tile-mint',
	yellow: 'bg-tile-yellow',
	peach: 'bg-tile-peach',
	indigo: 'bg-tile-indigo'
};

/**
 * The background for a section chip.
 *
 * Looked up rather than interpolated: `bg-tile-${accent}` is a class Tailwind
 * never sees in the source, so it is never generated and the chip renders with
 * no background at all.
 */
export const accentTile = (accent?: string | null): string =>
	ACCENT_TILES[accent ?? ''] ?? ACCENT_TILES.mint;

/** A localised date, in the form an article byline uses. */
export function formatPostDate(value: string | Date | null | undefined): string {
	if (!value) return '';
	const date = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(date.getTime())) return '';
	return date.toLocaleDateString(getLocale() === 'am' ? 'am-ET' : 'en-GB', {
		day: 'numeric',
		month: 'short',
		year: 'numeric'
	});
}

/** `2026-09-01`, which is what a `<time datetime>` and a date input both want. */
export function isoDay(value: string | Date | null | undefined): string {
	if (!value) return '';
	const date = value instanceof Date ? value : new Date(value);
	return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}

/** How each state is labelled and painted in the operator's listing. */
export const statusLabel = (status: string): string =>
	status === 'published'
		? m.bp_status_published()
		: status === 'archived'
			? m.bp_status_archived()
			: m.bp_status_draft();

export const statusClass = (status: string): string =>
	status === 'published'
		? 'border-brand-edge bg-brand-soft text-brand-soft-fg'
		: status === 'archived'
			? 'border-edge-mid bg-well text-ink-soft'
			: 'border-edge-mid bg-tile-yellow text-ink';

/**
 * Whether a post dated in the future is waiting rather than live.
 *
 * The list query already hides these; this is what lets the operator's listing
 * say *why* a post they marked published is not on the site yet.
 */
export const isScheduled = (post: { status: string; publishedAt: Date | string | null }): boolean =>
	post.status === 'published' &&
	Boolean(post.publishedAt) &&
	new Date(post.publishedAt as string | Date).getTime() > Date.now();
