import * as m from '$lib/paraglide/messages';

/**
 * The help centre's catalogue.
 *
 * Structure and prose are kept apart on purpose. The structure — slugs,
 * categories, who an article is for — is plain data that a route, a sitemap or
 * a test can read without a locale. The prose is behind `text()` thunks,
 * because a Paraglide message read at module scope would freeze whichever
 * locale happened to load this file first; see the note in `messages`.
 */

export type HelpAudience = 'everyone' | 'brands' | 'creators';
export type HelpCategoryKey = 'start' | 'creators' | 'brands' | 'deals' | 'money' | 'account';

export type HelpBlock = { kind: 'p' | 'note'; text: string } | { kind: 'steps'; items: string[] };

export type HelpArticle = {
	slug: string;
	category: HelpCategoryKey;
	audience: HelpAudience;
	title: string;
	summary: string;
	/** Extra words a reader might search for that the prose never says. */
	keywords: string;
	blocks: HelpBlock[];
};

type HelpEntry = Omit<HelpArticle, 'title' | 'summary' | 'keywords' | 'blocks'> & {
	text: () => Pick<HelpArticle, 'title' | 'summary' | 'keywords' | 'blocks'>;
};

/** The order articles appear in, within their category. */
const ENTRIES: HelpEntry[] = [
	{
		slug: 'what-is-influencer-ethiopia',
		category: 'start',
		audience: 'everyone',
		text: () => ({
			title: m.help_what_title(),
			summary: m.help_what_summary(),
			keywords: m.help_what_kw(),
			blocks: [
				{ kind: 'p', text: m.help_what_p1() },
				{ kind: 'p', text: m.help_what_p2() },
				{ kind: 'steps', items: [m.help_what_l1_1(), m.help_what_l1_2(), m.help_what_l1_3()] },
				{ kind: 'note', text: m.help_what_n1() }
			]
		})
	},
	{
		slug: 'create-an-account',
		category: 'start',
		audience: 'everyone',
		text: () => ({
			title: m.help_acct_title(),
			summary: m.help_acct_summary(),
			keywords: m.help_acct_kw(),
			blocks: [
				{ kind: 'p', text: m.help_acct_p1() },
				{
					kind: 'steps',
					items: [m.help_acct_l1_1(), m.help_acct_l1_2(), m.help_acct_l1_3(), m.help_acct_l1_4()]
				},
				{ kind: 'p', text: m.help_acct_p2() },
				{ kind: 'note', text: m.help_acct_n1() }
			]
		})
	},
	{
		slug: 'find-your-way-around',
		category: 'start',
		audience: 'everyone',
		text: () => ({
			title: m.help_tour_title(),
			summary: m.help_tour_summary(),
			keywords: m.help_tour_kw(),
			blocks: [
				{ kind: 'p', text: m.help_tour_p1() },
				{ kind: 'steps', items: [m.help_tour_l1_1(), m.help_tour_l1_2(), m.help_tour_l1_3()] },
				{ kind: 'p', text: m.help_tour_p2() },
				{ kind: 'note', text: m.help_tour_n1() }
			]
		})
	},
	{
		slug: 'claim-your-profile',
		category: 'creators',
		audience: 'creators',
		text: () => ({
			title: m.help_claim_title(),
			summary: m.help_claim_summary(),
			keywords: m.help_claim_kw(),
			blocks: [
				{ kind: 'p', text: m.help_claim_p1() },
				{
					kind: 'steps',
					items: [
						m.help_claim_l1_1(),
						m.help_claim_l1_2(),
						m.help_claim_l1_3(),
						m.help_claim_l1_4()
					]
				},
				{ kind: 'p', text: m.help_claim_p2() },
				{ kind: 'note', text: m.help_claim_n1() }
			]
		})
	},
	{
		slug: 'your-creator-profile',
		category: 'creators',
		audience: 'creators',
		text: () => ({
			title: m.help_cprof_title(),
			summary: m.help_cprof_summary(),
			keywords: m.help_cprof_kw(),
			blocks: [
				{ kind: 'p', text: m.help_cprof_p1() },
				{
					kind: 'steps',
					items: [
						m.help_cprof_l1_1(),
						m.help_cprof_l1_2(),
						m.help_cprof_l1_3(),
						m.help_cprof_l1_4(),
						m.help_cprof_l1_5()
					]
				},
				{ kind: 'p', text: m.help_cprof_p2() },
				{ kind: 'note', text: m.help_cprof_n1() }
			]
		})
	},
	{
		slug: 'connect-your-channels',
		category: 'creators',
		audience: 'creators',
		text: () => ({
			title: m.help_chan_title(),
			summary: m.help_chan_summary(),
			keywords: m.help_chan_kw(),
			blocks: [
				{ kind: 'p', text: m.help_chan_p1() },
				{
					kind: 'steps',
					items: [m.help_chan_l1_1(), m.help_chan_l1_2(), m.help_chan_l1_3(), m.help_chan_l1_4()]
				},
				{ kind: 'p', text: m.help_chan_p2() },
				{ kind: 'note', text: m.help_chan_n1() }
			]
		})
	},
	{
		slug: 'your-packages',
		category: 'creators',
		audience: 'creators',
		text: () => ({
			title: m.help_pack_title(),
			summary: m.help_pack_summary(),
			keywords: m.help_pack_kw(),
			blocks: [
				{ kind: 'p', text: m.help_pack_p1() },
				{
					kind: 'steps',
					items: [m.help_pack_l1_1(), m.help_pack_l1_2(), m.help_pack_l1_3(), m.help_pack_l1_4()]
				},
				{ kind: 'p', text: m.help_pack_p2() },
				{ kind: 'note', text: m.help_pack_n1() }
			]
		})
	},
	{
		slug: 'your-portfolio',
		category: 'creators',
		audience: 'creators',
		text: () => ({
			title: m.help_port_title(),
			summary: m.help_port_summary(),
			keywords: m.help_port_kw(),
			blocks: [
				{ kind: 'p', text: m.help_port_p1() },
				{ kind: 'steps', items: [m.help_port_l1_1(), m.help_port_l1_2(), m.help_port_l1_3()] },
				{ kind: 'note', text: m.help_port_n1() }
			]
		})
	},
	{
		slug: 'get-verified',
		category: 'creators',
		audience: 'creators',
		text: () => ({
			title: m.help_verif_title(),
			summary: m.help_verif_summary(),
			keywords: m.help_verif_kw(),
			blocks: [
				{ kind: 'p', text: m.help_verif_p1() },
				{
					kind: 'steps',
					items: [
						m.help_verif_l1_1(),
						m.help_verif_l1_2(),
						m.help_verif_l1_3(),
						m.help_verif_l1_4()
					]
				},
				{ kind: 'p', text: m.help_verif_p2() },
				{ kind: 'note', text: m.help_verif_n1() },
				{ kind: 'note', text: m.help_verif_n2() }
			]
		})
	},
	{
		slug: 'apply-to-campaigns',
		category: 'creators',
		audience: 'creators',
		text: () => ({
			title: m.help_apply_title(),
			summary: m.help_apply_summary(),
			keywords: m.help_apply_kw(),
			blocks: [
				{ kind: 'p', text: m.help_apply_p1() },
				{
					kind: 'steps',
					items: [
						m.help_apply_l1_1(),
						m.help_apply_l1_2(),
						m.help_apply_l1_3(),
						m.help_apply_l1_4()
					]
				},
				{ kind: 'p', text: m.help_apply_p2() },
				{ kind: 'note', text: m.help_apply_n1() }
			]
		})
	},
	{
		slug: 'your-creator-score',
		category: 'creators',
		audience: 'creators',
		text: () => ({
			title: m.help_score_title(),
			summary: m.help_score_summary(),
			keywords: m.help_score_kw(),
			blocks: [
				{ kind: 'p', text: m.help_score_p1() },
				{
					kind: 'steps',
					items: [
						m.help_score_l1_1(),
						m.help_score_l1_2(),
						m.help_score_l1_3(),
						m.help_score_l1_4()
					]
				},
				{ kind: 'p', text: m.help_score_p2() },
				{ kind: 'note', text: m.help_score_n1() }
			]
		})
	},
	{
		slug: 'getting-paid',
		category: 'creators',
		audience: 'creators',
		text: () => ({
			title: m.help_paid_title(),
			summary: m.help_paid_summary(),
			keywords: m.help_paid_kw(),
			blocks: [
				{ kind: 'p', text: m.help_paid_p1() },
				{
					kind: 'steps',
					items: [m.help_paid_l1_1(), m.help_paid_l1_2(), m.help_paid_l1_3(), m.help_paid_l1_4()]
				},
				{ kind: 'p', text: m.help_paid_p2() },
				{ kind: 'note', text: m.help_paid_n1() }
			]
		})
	},
	{
		slug: 'set-up-your-organisation',
		category: 'brands',
		audience: 'brands',
		text: () => ({
			title: m.help_org_title(),
			summary: m.help_org_summary(),
			keywords: m.help_org_kw(),
			blocks: [
				{ kind: 'p', text: m.help_org_p1() },
				{
					kind: 'steps',
					items: [m.help_org_l1_1(), m.help_org_l1_2(), m.help_org_l1_3(), m.help_org_l1_4()]
				},
				{ kind: 'p', text: m.help_org_p2() },
				{ kind: 'note', text: m.help_org_n1() }
			]
		})
	},
	{
		slug: 'post-a-campaign',
		category: 'brands',
		audience: 'brands',
		text: () => ({
			title: m.help_camp_title(),
			summary: m.help_camp_summary(),
			keywords: m.help_camp_kw(),
			blocks: [
				{ kind: 'p', text: m.help_camp_p1() },
				{
					kind: 'steps',
					items: [
						m.help_camp_l1_1(),
						m.help_camp_l1_2(),
						m.help_camp_l1_3(),
						m.help_camp_l1_4(),
						m.help_camp_l1_5()
					]
				},
				{ kind: 'p', text: m.help_camp_p2() },
				{ kind: 'note', text: m.help_camp_n1() }
			]
		})
	},
	{
		slug: 'review-applications',
		category: 'brands',
		audience: 'brands',
		text: () => ({
			title: m.help_apps_title(),
			summary: m.help_apps_summary(),
			keywords: m.help_apps_kw(),
			blocks: [
				{ kind: 'p', text: m.help_apps_p1() },
				{
					kind: 'steps',
					items: [m.help_apps_l1_1(), m.help_apps_l1_2(), m.help_apps_l1_3(), m.help_apps_l1_4()]
				},
				{ kind: 'p', text: m.help_apps_p2() },
				{ kind: 'note', text: m.help_apps_n1() }
			]
		})
	},
	{
		slug: 'find-and-shortlist-creators',
		category: 'brands',
		audience: 'brands',
		text: () => ({
			title: m.help_short_title(),
			summary: m.help_short_summary(),
			keywords: m.help_short_kw(),
			blocks: [
				{ kind: 'p', text: m.help_short_p1() },
				{
					kind: 'steps',
					items: [
						m.help_short_l1_1(),
						m.help_short_l1_2(),
						m.help_short_l1_3(),
						m.help_short_l1_4()
					]
				},
				{ kind: 'p', text: m.help_short_p2() },
				{ kind: 'note', text: m.help_short_n1() }
			]
		})
	},
	{
		slug: 'book-a-creator',
		category: 'brands',
		audience: 'brands',
		text: () => ({
			title: m.help_book_title(),
			summary: m.help_book_summary(),
			keywords: m.help_book_kw(),
			blocks: [
				{ kind: 'p', text: m.help_book_p1() },
				{
					kind: 'steps',
					items: [m.help_book_l1_1(), m.help_book_l1_2(), m.help_book_l1_3(), m.help_book_l1_4()]
				},
				{ kind: 'p', text: m.help_book_p2() },
				{ kind: 'note', text: m.help_book_n1() }
			]
		})
	},
	{
		slug: 'pay-a-deposit',
		category: 'brands',
		audience: 'brands',
		text: () => ({
			title: m.help_dep_title(),
			summary: m.help_dep_summary(),
			keywords: m.help_dep_kw(),
			blocks: [
				{ kind: 'p', text: m.help_dep_p1() },
				{
					kind: 'steps',
					items: [m.help_dep_l1_1(), m.help_dep_l1_2(), m.help_dep_l1_3(), m.help_dep_l1_4()]
				},
				{ kind: 'p', text: m.help_dep_p2() },
				{ kind: 'note', text: m.help_dep_n1() }
			]
		})
	},
	{
		slug: 'the-deal-lifecycle',
		category: 'deals',
		audience: 'everyone',
		text: () => ({
			title: m.help_life_title(),
			summary: m.help_life_summary(),
			keywords: m.help_life_kw(),
			blocks: [
				{ kind: 'p', text: m.help_life_p1() },
				{
					kind: 'steps',
					items: [
						m.help_life_l1_1(),
						m.help_life_l1_2(),
						m.help_life_l1_3(),
						m.help_life_l1_4(),
						m.help_life_l1_5(),
						m.help_life_l1_6()
					]
				},
				{ kind: 'p', text: m.help_life_p2() },
				{ kind: 'note', text: m.help_life_n1() }
			]
		})
	},
	{
		slug: 'agree-and-freeze-terms',
		category: 'deals',
		audience: 'everyone',
		text: () => ({
			title: m.help_terms_title(),
			summary: m.help_terms_summary(),
			keywords: m.help_terms_kw(),
			blocks: [
				{ kind: 'p', text: m.help_terms_p1() },
				{
					kind: 'steps',
					items: [
						m.help_terms_l1_1(),
						m.help_terms_l1_2(),
						m.help_terms_l1_3(),
						m.help_terms_l1_4()
					]
				},
				{ kind: 'p', text: m.help_terms_p2() },
				{ kind: 'note', text: m.help_terms_n1() }
			]
		})
	},
	{
		slug: 'deliver-and-review-work',
		category: 'deals',
		audience: 'everyone',
		text: () => ({
			title: m.help_deliv_title(),
			summary: m.help_deliv_summary(),
			keywords: m.help_deliv_kw(),
			blocks: [
				{ kind: 'p', text: m.help_deliv_p1() },
				{
					kind: 'steps',
					items: [
						m.help_deliv_l1_1(),
						m.help_deliv_l1_2(),
						m.help_deliv_l1_3(),
						m.help_deliv_l1_4()
					]
				},
				{ kind: 'p', text: m.help_deliv_p2() },
				{ kind: 'note', text: m.help_deliv_n1() }
			]
		})
	},
	{
		slug: 'messages-and-privacy',
		category: 'deals',
		audience: 'everyone',
		text: () => ({
			title: m.help_msg_title(),
			summary: m.help_msg_summary(),
			keywords: m.help_msg_kw(),
			blocks: [
				{ kind: 'p', text: m.help_msg_p1() },
				{ kind: 'p', text: m.help_msg_p2() },
				{ kind: 'note', text: m.help_msg_n1() }
			]
		})
	},
	{
		slug: 'reviews-and-ratings',
		category: 'deals',
		audience: 'everyone',
		text: () => ({
			title: m.help_rev_title(),
			summary: m.help_rev_summary(),
			keywords: m.help_rev_kw(),
			blocks: [
				{ kind: 'p', text: m.help_rev_p1() },
				{ kind: 'steps', items: [m.help_rev_l1_1(), m.help_rev_l1_2(), m.help_rev_l1_3()] },
				{ kind: 'note', text: m.help_rev_n1() }
			]
		})
	},
	{
		slug: 'if-something-goes-wrong',
		category: 'deals',
		audience: 'everyone',
		text: () => ({
			title: m.help_disp_title(),
			summary: m.help_disp_summary(),
			keywords: m.help_disp_kw(),
			blocks: [
				{ kind: 'p', text: m.help_disp_p1() },
				{
					kind: 'steps',
					items: [m.help_disp_l1_1(), m.help_disp_l1_2(), m.help_disp_l1_3(), m.help_disp_l1_4()]
				},
				{ kind: 'p', text: m.help_disp_p2() },
				{ kind: 'note', text: m.help_disp_n1() }
			]
		})
	},
	{
		slug: 'the-platform-fee',
		category: 'money',
		audience: 'everyone',
		text: () => ({
			title: m.help_fee_title(),
			summary: m.help_fee_summary(),
			keywords: m.help_fee_kw(),
			blocks: [
				{ kind: 'p', text: m.help_fee_p1() },
				{ kind: 'steps', items: [m.help_fee_l1_1(), m.help_fee_l1_2(), m.help_fee_l1_3()] },
				{ kind: 'note', text: m.help_fee_n1() }
			]
		})
	},
	{
		slug: 'ways-to-pay-a-creator',
		category: 'money',
		audience: 'everyone',
		text: () => ({
			title: m.help_comp_title(),
			summary: m.help_comp_summary(),
			keywords: m.help_comp_kw(),
			blocks: [
				{ kind: 'p', text: m.help_comp_p1() },
				{ kind: 'steps', items: [m.help_comp_l1_1(), m.help_comp_l1_2(), m.help_comp_l1_3()] },
				{ kind: 'p', text: m.help_comp_p2() },
				{ kind: 'note', text: m.help_comp_n1() }
			]
		})
	},
	{
		slug: 'account-settings',
		category: 'account',
		audience: 'everyone',
		text: () => ({
			title: m.help_set_title(),
			summary: m.help_set_summary(),
			keywords: m.help_set_kw(),
			blocks: [
				{ kind: 'p', text: m.help_set_p1() },
				{
					kind: 'steps',
					items: [
						m.help_set_l1_1(),
						m.help_set_l1_2(),
						m.help_set_l1_3(),
						m.help_set_l1_4(),
						m.help_set_l1_5()
					]
				},
				{ kind: 'p', text: m.help_set_p2() },
				{ kind: 'note', text: m.help_set_n1() }
			]
		})
	},
	{
		slug: 'privacy-and-your-data',
		category: 'account',
		audience: 'everyone',
		text: () => ({
			title: m.help_priv_title(),
			summary: m.help_priv_summary(),
			keywords: m.help_priv_kw(),
			blocks: [
				{ kind: 'p', text: m.help_priv_p1() },
				{ kind: 'p', text: m.help_priv_p2() },
				{ kind: 'note', text: m.help_priv_n1() }
			]
		})
	},
	{
		slug: 'contact-support',
		category: 'account',
		audience: 'everyone',
		text: () => ({
			title: m.help_sup_title(),
			summary: m.help_sup_summary(),
			keywords: m.help_sup_kw(),
			blocks: [
				{ kind: 'p', text: m.help_sup_p1() },
				{
					kind: 'steps',
					items: [m.help_sup_l1_1(), m.help_sup_l1_2(), m.help_sup_l1_3(), m.help_sup_l1_4()]
				},
				{ kind: 'note', text: m.help_sup_n1() }
			]
		})
	}
];

/** The categories, in the order the help centre lists them. */
export const HELP_CATEGORIES: HelpCategoryKey[] = [
	'start',
	'creators',
	'brands',
	'deals',
	'money',
	'account'
];

/** Every article path, for the sitemap. Reads no messages. */
export const HELP_SLUGS: string[] = ENTRIES.map((entry) => entry.slug);

/** The handful of articles the index offers before a reader searches. */
export const HELP_QUICK_LINKS: string[] = [
	'create-an-account',
	'claim-your-profile',
	'post-a-campaign',
	'the-deal-lifecycle',
	'get-verified',
	'the-platform-fee'
];

const resolveArticle = (entry: HelpEntry): HelpArticle => ({
	slug: entry.slug,
	category: entry.category,
	audience: entry.audience,
	...entry.text()
});

/** Every article, in catalogue order, in the reader's language. */
export function helpArticles(): HelpArticle[] {
	return ENTRIES.map(resolveArticle);
}

/** One article, or `null` for a slug that is not in the catalogue. */
export function helpArticle(slug: string): HelpArticle | null {
	const entry = ENTRIES.find((one) => one.slug === slug);
	return entry ? resolveArticle(entry) : null;
}

export function helpCategoryTitle(key: HelpCategoryKey): string {
	const titles: Record<HelpCategoryKey, string> = {
		start: m.help_cat_start(),
		creators: m.help_cat_creators(),
		brands: m.help_cat_brands(),
		deals: m.help_cat_deals(),
		money: m.help_cat_money(),
		account: m.help_cat_account()
	};
	return titles[key];
}

export function helpCategoryBlurb(key: HelpCategoryKey): string {
	const blurbs: Record<HelpCategoryKey, string> = {
		start: m.help_cat_start_blurb(),
		creators: m.help_cat_creators_blurb(),
		brands: m.help_cat_brands_blurb(),
		deals: m.help_cat_deals_blurb(),
		money: m.help_cat_money_blurb(),
		account: m.help_cat_account_blurb()
	};
	return blurbs[key];
}

/**
 * The audience a reader asked for, from `?for=`.
 *
 * Anything else — a stale link, a typo, a crawler's invention — reads as no
 * filter at all rather than as an empty help centre.
 */
export function helpAudience(value: string | null): HelpAudience | null {
	return value === 'brands' || value === 'creators' ? value : null;
}

/** Articles for one side, plus the ones that are for everybody. */
export function filterByAudience(articles: HelpArticle[], audience: HelpAudience | null) {
	if (!audience) return articles;
	return articles.filter(
		(article) => article.audience === audience || article.audience === 'everyone'
	);
}

const haystack = (article: HelpArticle) =>
	[
		article.title,
		article.summary,
		article.keywords,
		article.slug.replace(/-/g, ' '),
		...article.blocks.flatMap((block) => (block.kind === 'steps' ? block.items : [block.text]))
	]
		.join(' ')
		.toLowerCase();

/**
 * Plain substring search over the whole article, every word having to match.
 *
 * Deliberately not a fuzzy index: the catalogue is a few dozen articles in two
 * scripts, and Amharic has no useful stemmer here. Every word must appear
 * somewhere in the article, so "brand deposit" narrows rather than widens.
 */
export function searchHelp(articles: HelpArticle[], query: string): HelpArticle[] {
	const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
	if (!terms.length) return articles;
	return articles.filter((article) => {
		const text = haystack(article);
		return terms.every((term) => text.includes(term));
	});
}
