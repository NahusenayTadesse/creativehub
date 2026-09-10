/**
 * How long a ban lasts.
 *
 * A closed list rather than a box to type a number of days into: the value is
 * handed to better-auth as `banExpiresIn`, which counts seconds, and an
 * operator typing 30 into a box is an operator who meant days. These names are
 * what travels in the form, what the seconds below are keyed by and what the
 * labels in the browser are keyed by, so the three cannot drift apart on a
 * spelling.
 *
 * They live here rather than beside the ban schema for the same reason the
 * role names live in $lib/roles: the dialog that offers the choice runs in the
 * browser, and $lib/schemas reaches server-only code that must not follow it
 * there.
 */
export const BAN_DURATIONS = ['permanent', '24h', '7d', '30d'] as const;
export type BanDuration = (typeof BAN_DURATIONS)[number];

/** `null` is a ban with no end; the rest are what better-auth is handed as
    `banExpiresIn`, which it counts in seconds. */
export const BAN_DURATION_SECONDS: Record<BanDuration, number | null> = {
	permanent: null,
	'24h': 86_400,
	'7d': 604_800,
	'30d': 2_592_000
};
