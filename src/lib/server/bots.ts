/**
 * Who is asking, as far as the request is willing to say.
 *
 * A `User-Agent` is a claim, not a fact, and every string named here can be
 * forged by anyone who reads this file. That is not the weakness it looks
 * like: the agents below are the ones that *volunteer* what they are, and
 * volunteering is highly correlated with collecting in bulk — a training
 * crawler identifies itself because its operator wants the traffic to be
 * attributable. A scraper that lies and calls itself Chrome gets no benefit
 * from this file at all; it is left to the rate limiter, which never reads the
 * header.
 *
 * So this is the cheap half of the defence. It costs one string scan and turns
 * away the bulk collectors that ask politely, while `ratelimit.ts` handles
 * everyone else by behaviour rather than by name.
 */

/**
 * What a request claims to be. The order of the checks below is the order of
 * this union, and it matters: `Applebot-Extended` is a training crawler while
 * `Applebot` is a search crawler, and `Googlebot` would match the generic
 * "contains bot" rule if search were not tested first.
 */
export type AgentKind =
	/** A declared bulk collector: LLM training, dataset building, scraping frames. */
	| 'harvester'
	/** A search engine that sends readers back. Wanted. */
	| 'search'
	/** A link unfurler — one fetch, because somebody pasted a URL somewhere. */
	| 'preview'
	/** An HTTP client, an SEO crawler, a headless browser. Automated, not named. */
	| 'tool'
	/** Nothing recognised. Most likely a person. */
	| 'browser';

/**
 * Bulk collectors, refused outright.
 *
 * Two groups, and they earn their place differently. The training and
 * dataset crawlers take the whole corpus and give nothing back — a creator
 * directory is exactly the shape of thing they want, and being in a model's
 * weights sends this site no traffic and its creators no bookings. The
 * scraping frameworks are simply what a scraper is running when it has not
 * bothered to set a header.
 *
 * SEO crawlers are deliberately absent: AhrefsBot and SemrushBot read this
 * site the way its own operators do, and throttling them is enough.
 */
const HARVESTERS = [
	/* LLM training and AI answer engines */
	'gptbot',
	'chatgpt-user',
	'oai-searchbot',
	'claudebot',
	'claude-web',
	'claude-searchbot',
	'anthropic-ai',
	'ccbot',
	'perplexitybot',
	'perplexity-user',
	'google-extended',
	'bytespider',
	'amazonbot',
	'applebot-extended',
	'meta-externalagent',
	'meta-externalfetcher',
	'facebookbot',
	'cohere-ai',
	'cohere-training-data-crawler',
	'ai2bot',
	'youbot',
	'duckassistbot',
	'iaskspider',
	'pangubot',
	'timpibot',
	'webzio-extended',
	'omgili',
	'imagesiftbot',
	'img2dataset',
	'diffbot',
	'brightbot',
	'firecrawl',
	/* Off-the-shelf scraping and mirroring */
	'scrapy',
	'httrack',
	'heritrix',
	'nutch',
	'sitesucker',
	'webcopier',
	'webzip',
	'teleport pro',
	'offline explorer'
];

/**
 * Crawlers worth the bandwidth, because they return readers.
 *
 * Tested before anything generic, so that the "contains bot" rule at the
 * bottom cannot swallow Googlebot.
 */
const SEARCH_ENGINES = [
	'googlebot',
	'google-inspectiontool',
	'storebot-google',
	'adsbot-google',
	'bingbot',
	'adidxbot',
	'bingpreview',
	'msnbot',
	'duckduckbot',
	'yandexbot',
	'baiduspider',
	'seznambot',
	'yahoo! slurp',
	'applebot',
	'naver',
	'sogou'
];

/**
 * Unfurlers. Somebody pasted a creator's profile into a chat and the chat is
 * fetching the card for it — one request, on a human's behalf, and refusing it
 * would make every shared link look broken.
 */
const PREVIEW_AGENTS = [
	'twitterbot',
	'facebookexternalhit',
	'linkedinbot',
	'whatsapp',
	'telegrambot',
	'discordbot',
	'slackbot',
	'slack-imgproxy',
	'skypeuripreview',
	'redditbot',
	'pinterest',
	'embedly',
	'vkshare',
	'bitlybot',
	'quora link preview'
];

/**
 * Named automation that is not necessarily hostile. `curl` is how this app's
 * own deploy script smoke-tests the site, and an SEO crawler is often the
 * operator's own tooling — so these are throttled hard rather than refused.
 */
const TOOLS = [
	'curl/',
	'wget',
	'libcurl',
	'python-requests',
	'python-urllib',
	'aiohttp',
	'httpx',
	'go-http-client',
	'okhttp',
	'apache-httpclient',
	'java/',
	'jsoup',
	'libwww-perl',
	'lwp::',
	'guzzle',
	'node-fetch',
	'axios',
	'got (',
	'postmanruntime',
	'insomnia',
	'restsharp',
	'mechanize',
	'colly',
	'headlesschrome',
	'phantomjs',
	'puppeteer',
	'playwright',
	'selenium',
	/* SEO and backlink crawlers: read everything, send nobody. */
	'ahrefsbot',
	'semrushbot',
	'mj12bot',
	'dotbot',
	'blexbot',
	'dataforseobot',
	'serpstatbot',
	'seokicks',
	'petalbot',
	'zoominfobot',
	'magpie-crawler',
	'barkrowler',
	'megaindex'
];

/**
 * The catch-all. Anything that calls itself a crawler is treated as one even
 * when this file has never heard of it, which is what keeps the lists above
 * from having to be exhaustive to be useful.
 */
const GENERIC_AUTOMATION =
	/bot\b|\bbot|crawler|crawling|spider|scrape|scraping|fetcher|http[-_]?client|feedfetcher|archiver/;

const includesAny = (haystack: string, needles: string[]) =>
	needles.some((needle) => haystack.includes(needle));

/**
 * Classify a `User-Agent`.
 *
 * An absent or empty header counts as `tool`, not as `browser`: every browser
 * in use sends one, so its absence is a client that did not think to fake it.
 * It is not treated as a harvester, because health checks and uptime monitors
 * are also frequently headerless and refusing those is its own outage.
 */
export function classifyAgent(userAgent: string | null | undefined): AgentKind {
	const ua = (userAgent ?? '').trim().toLowerCase();
	if (!ua) return 'tool';

	if (includesAny(ua, HARVESTERS)) return 'harvester';
	if (includesAny(ua, SEARCH_ENGINES)) return 'search';
	if (includesAny(ua, PREVIEW_AGENTS)) return 'preview';
	if (includesAny(ua, TOOLS)) return 'tool';
	if (GENERIC_AUTOMATION.test(ua)) return 'tool';

	return 'browser';
}

/**
 * The robots.txt tokens for the collectors refused above.
 *
 * Kept beside the list it mirrors so the two cannot drift: a crawler told
 * "no" in `robots.txt` and served content anyway learns that the file is
 * decorative, and one refused at the door without ever being asked politely
 * has a fair complaint. Tokens rather than user-agent substrings, because
 * `robots.txt` matches on the product token alone.
 */
export const DISALLOWED_ROBOTS = [
	'GPTBot',
	'ChatGPT-User',
	'OAI-SearchBot',
	'ClaudeBot',
	'Claude-Web',
	'Claude-SearchBot',
	'anthropic-ai',
	'CCBot',
	'PerplexityBot',
	'Perplexity-User',
	'Google-Extended',
	'Bytespider',
	'Amazonbot',
	'Applebot-Extended',
	'meta-externalagent',
	'meta-externalfetcher',
	'FacebookBot',
	'cohere-ai',
	'cohere-training-data-crawler',
	'AI2Bot',
	'YouBot',
	'DuckAssistBot',
	'iaskspider',
	'PanguBot',
	'Timpibot',
	'Webzio-Extended',
	'omgili',
	'omgilibot',
	'ImagesiftBot',
	'img2dataset',
	'Diffbot',
	'Brightbot 1.0',
	'FirecrawlAgent',
	'Scrapy',
	'HTTrack',
	'heritrix',
	'Nutch'
];
