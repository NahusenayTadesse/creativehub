/**
 * What an article body is allowed to contain.
 *
 * The rich text editor produces HTML, and the article page renders it with
 * `{@html}` — the one construct in Svelte that does not escape. Everything
 * between those two points is this file's problem: the editor runs in an
 * operator's browser, so what arrives at the action is whatever was posted to
 * it, not whatever the editor last showed.
 *
 * The narrowing happens **on write**, not on read. A stored body is therefore
 * already an allowlisted document by the time any page reads it, so a second
 * surface that renders one — a feed, an email, a preview — cannot forget to
 * sanitise. The cost is that the allowlist below is retroactive only for posts
 * saved after it changes, which is the right trade: a body is written rarely
 * and read constantly.
 *
 * `sanitize-html` parses rather than pattern-matches, which is what makes it
 * worth a dependency. Every "sanitiser" built out of regular expressions has
 * eventually been defeated by a nesting or an encoding its author did not
 * think of, and none of them see the same document the browser will.
 */

import sanitizeHtml from 'sanitize-html';

/**
 * Tags the editor can emit, and nothing else.
 *
 * No `<script>`, `<style>`, `<iframe>`, `<object>` or `<form>`: the first three
 * execute or embed, and a form inside an article is a credential prompt wearing
 * the site's own chrome. `<img>` is allowed because the editor inserts uploads.
 */
const ALLOWED_TAGS = [
	'p',
	'br',
	'hr',
	'h1',
	'h2',
	'h3',
	'h4',
	'h5',
	'h6',
	'blockquote',
	'pre',
	'code',
	'strong',
	'b',
	'em',
	'i',
	'u',
	's',
	'strike',
	'del',
	'ins',
	'mark',
	'sub',
	'sup',
	'small',
	'ul',
	'ol',
	'li',
	'a',
	'img',
	'figure',
	'figcaption',
	'table',
	'thead',
	'tbody',
	'tfoot',
	'tr',
	'th',
	'td',
	'span',
	'div'
];

/**
 * Class names a body may carry.
 *
 * The editor's code blocks are highlighted by class — `language-ts`,
 * `hljs-keyword` — and its task lists mark themselves the same way. A free-form
 * `class` would let a body reach into the site's own utility classes and
 * repaint the page around it, so the allowed values are matched rather than
 * listed: `sanitize-html` accepts a RegExp in `allowedClasses`.
 */
const ALLOWED_CLASSES = [/^language-[\w-]+$/, /^hljs(-[\w-]+)?$/, /^tipex-[\w-]+$/];

const CONFIG: sanitizeHtml.IOptions = {
	allowedTags: ALLOWED_TAGS,
	allowedAttributes: {
		/* `target` and `rel` are here because `transformTags` below adds them —
		   an attribute the transform sets is still filtered by this list
		   afterwards, so one missing here is one silently thrown away. */
		a: ['href', 'title', 'name', 'target', 'rel'],
		img: ['src', 'alt', 'title', 'width', 'height', 'loading', 'decoding'],
		td: ['colspan', 'rowspan'],
		th: ['colspan', 'rowspan', 'scope'],
		ol: ['start'],
		code: ['class'],
		pre: ['class'],
		span: ['class'],
		div: ['class'],
		li: ['class'],
		ul: ['class']
	},
	allowedClasses: {
		'*': ALLOWED_CLASSES
	},
	/*
	 * Which schemes may appear in an href or a src.
	 *
	 * `javascript:` executing from a link is the oldest hole there is, and
	 * `data:` in an href is the same hole with a document attached. `data:` is
	 * kept for `img` alone, because the editor is configured with
	 * `allowBase64: true` and a pasted image arrives that way; an image is
	 * decoded as an image whatever it claims to be, and `X-Content-Type-Options`
	 * is already set on every response.
	 */
	allowedSchemes: ['http', 'https', 'mailto'],
	allowedSchemesByTag: { img: ['http', 'https', 'data'] },
	allowProtocolRelative: false,
	/* An unrecognised tag's *text* is worth keeping; its markup is not. */
	disallowedTagsMode: 'discard',
	/*
	 * Every outbound link opens in a new tab, and carries the pair that stops
	 * the opened page from reaching back through `window.opener`. Modern
	 * browsers imply `noopener` for `target=_blank`, but the attribute costs
	 * nothing and older ones do not.
	 */
	transformTags: {
		a: (tagName, attribs) => {
			const href = attribs.href ?? '';
			const external = /^https?:\/\//i.test(href);
			return {
				tagName,
				attribs: {
					...attribs,
					...(external ? { target: '_blank', rel: 'noopener noreferrer nofollow' } : {})
				}
			};
		},
		/* Article images are always deferred: they are below the fold by
		   definition, the featured image having taken the top of the page. */
		img: (tagName, attribs) => ({
			tagName,
			attribs: { ...attribs, loading: 'lazy', decoding: 'async' }
		})
	},
	/* `<img>` and `<hr>` have no closing tag; the parser must not invent one. */
	selfClosing: ['img', 'br', 'hr'],
	/*
	 * An image whose source was just refused is not an image.
	 *
	 * Stripping a `javascript:` src leaves `<img>` with nothing to load, which
	 * every browser draws as a broken-image icon — a visible artefact of the
	 * defence, sitting in the middle of the article. A link that loses its href
	 * is left alone by contrast: it degrades to its own text, which is still
	 * worth reading.
	 */
	exclusiveFilter: (frame) => frame.tag === 'img' && !frame.attribs.src,
	enforceHtmlBoundary: false
};

/** An article body, narrowed to what the allowlist above admits. */
export function sanitizeArticleHtml(html: string | null | undefined): string {
	if (!html) return '';
	return sanitizeHtml(html, CONFIG).trim();
}

/**
 * The same body with every tag removed.
 *
 * This is what the search index and the reading time are computed from, and
 * what an excerpt falls back to. Entities are decoded so that a search for
 * "Addis & Co" matches a body that stored `&amp;`, and block-level tags become
 * spaces so that `<p>one</p><p>two</p>` does not read as "onetwo".
 */
export function htmlToText(html: string | null | undefined): string {
	if (!html) return '';

	/*
	 * Block boundaries become spaces before the tags are removed.
	 *
	 * Stripping tags alone turns `<p>one</p><p>two</p>` into `onetwo`, which is
	 * a word that appears in no article and a phrase search that can never
	 * match. Inline tags are deliberately not in this list: `<strong>bold</strong>face`
	 * is one word and must stay one.
	 */
	const spaced = html.replace(
		/<\/?(?:p|br|div|h[1-6]|li|ul|ol|tr|td|th|table|blockquote|pre|figure|figcaption|hr|section|article)\b[^>]*>/gi,
		' '
	);

	return (
		sanitizeHtml(spaced, { allowedTags: [], allowedAttributes: {} })
			.replace(/&nbsp;/g, ' ')
			.replace(/&lt;/g, '<')
			.replace(/&gt;/g, '>')
			.replace(/&quot;/g, '"')
			.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
			.replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
			/* Last, so that `&amp;lt;` decodes to `&lt;` and not to `<`. */
			.replace(/&amp;/g, '&')
			.replace(/\s+/g, ' ')
			.trim()
	);
}

/** Words per minute for an adult reading prose on a screen, rounded down. */
const READING_SPEED = 220;

/** Whole minutes, never zero for a body that has any words in it at all. */
export function readingMinutes(text: string): number {
	const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
	if (!words) return 0;
	return Math.max(1, Math.round(words / READING_SPEED));
}

/**
 * The first `limit` characters of `text`, cut at a word boundary.
 *
 * Used when an operator leaves the excerpt empty: a card still needs a blurb,
 * and half a word followed by an ellipsis is worse than a slightly short one.
 */
export function summarize(text: string, limit = 200): string {
	if (text.length <= limit) return text;
	const cut = text.slice(0, limit);
	const lastSpace = cut.lastIndexOf(' ');
	return `${(lastSpace > limit * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}
