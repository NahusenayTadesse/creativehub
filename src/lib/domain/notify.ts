/**
 * Who gets told what, and through which channel.
 *
 * The policy lives here rather than at each call site so that "does this person
 * want this?" has one answer, and so the rules can be read in one place — which
 * matters most for the ones a preference cannot override.
 */

export type NotifyChannel = 'email' | 'app';

export type NotifyCategory =
	/** Proposals, countered terms, submissions, settlement — the deal itself. */
	| 'deals'
	/** A message on a booking thread. */
	| 'messages'
	/** Verification, claims, and the state of the account. */
	| 'account'
	/** Anything sent because we want to, not because something happened. */
	| 'product'
	/** Password resets, sign-ins from somewhere new, a closure request. */
	| 'security';

export type Preferences = {
	dealsEmail: boolean;
	dealsApp: boolean;
	messagesEmail: boolean;
	messagesApp: boolean;
	accountEmail: boolean;
	productEmail: boolean;
};

/**
 * What an account gets before anyone touches a switch.
 *
 * Everything that reports something which happened to them is on; the one
 * category that exists for our benefit rather than theirs is off. A missing
 * `user_settings` row resolves to exactly this, so no row has to be written at
 * sign-up for an account to behave correctly.
 */
export const DEFAULT_PREFERENCES: Preferences = {
	dealsEmail: true,
	dealsApp: true,
	messagesEmail: true,
	messagesApp: true,
	accountEmail: true,
	productEmail: false
};

type Rule = keyof Preferences | 'always' | 'never';

/**
 * `always` and `never` are not preferences that happen to be fixed — they are
 * the cases where offering a switch would be dishonest. Security mail is sent
 * whatever anyone has chosen, because consenting in advance to not being warned
 * is not something a person can meaningfully do; and the in-app record of an
 * account decision is how the interface explains itself, so it is not optional
 * either. Neither is rendered as a toggle, which is what keeps the settings
 * page truthful about what it controls.
 */
const RULES: Record<NotifyCategory, Record<NotifyChannel, Rule>> = {
	deals: { email: 'dealsEmail', app: 'dealsApp' },
	messages: { email: 'messagesEmail', app: 'messagesApp' },
	account: { email: 'accountEmail', app: 'always' },
	product: { email: 'productEmail', app: 'never' },
	security: { email: 'always', app: 'always' }
};

/**
 * Whether to send `category` over `channel` to somebody holding `prefs`.
 *
 * `Object.hasOwn` for the same reason as every other lookup table here: a plain
 * object literal answers to `constructor` and `toString`, and an unknown
 * category must be silence rather than a crash or an accidental send.
 */
export function shouldNotify(
	prefs: Preferences | null | undefined,
	category: NotifyCategory,
	channel: NotifyChannel
): boolean {
	if (!Object.hasOwn(RULES, category)) return false;
	const rule = RULES[category][channel];
	if (rule === 'always') return true;
	if (rule === 'never') return false;

	const resolved = prefs ?? DEFAULT_PREFERENCES;
	return Object.hasOwn(resolved, rule) ? resolved[rule] === true : false;
}

/** The categories a person can actually change, in the order the page shows them. */
export const EDITABLE: {
	category: Exclude<NotifyCategory, 'security'>;
	channels: NotifyChannel[];
}[] = [
	{ category: 'deals', channels: ['email', 'app'] },
	{ category: 'messages', channels: ['email', 'app'] },
	{ category: 'account', channels: ['email'] },
	{ category: 'product', channels: ['email'] }
];
