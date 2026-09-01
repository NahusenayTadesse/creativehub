import { describe, it, expect } from 'vitest';
import { htmlToText, readingMinutes, sanitizeArticleHtml, summarize } from './sanitize';

/**
 * The article body is the only value in the app that reaches `{@html}`, and
 * this is the function that decides what may be in it. Everything below is a
 * thing an editor can be made to produce or a paste can carry — none of it is
 * hypothetical, and all of it would execute if it survived.
 */
describe('sanitizeArticleHtml', () => {
	it('keeps the formatting the editor actually emits', () => {
		const html =
			'<h2>Heading</h2><p><strong>Bold</strong> and <em>italic</em> and <u>underlined</u>.</p>' +
			'<ul><li>One</li><li>Two</li></ul><blockquote>Quoted</blockquote>' +
			'<pre><code class="language-ts">const x = 1;</code></pre>';
		expect(sanitizeArticleHtml(html)).toBe(html);
	});

	it('drops a script block and keeps the prose around it', () => {
		const out = sanitizeArticleHtml('<p>Before</p><script>alert(1)</script><p>After</p>');
		expect(out).not.toContain('script');
		expect(out).toContain('Before');
		expect(out).toContain('After');
	});

	it('drops an inline event handler', () => {
		const out = sanitizeArticleHtml('<p onclick="alert(1)">Text</p>');
		expect(out).toBe('<p>Text</p>');
	});

	it('refuses a javascript: link but keeps its text', () => {
		const out = sanitizeArticleHtml('<p><a href="javascript:alert(1)">Click</a></p>');
		expect(out).not.toContain('javascript');
		expect(out).toContain('Click');
	});

	it('refuses a javascript: image source, and the empty image with it', () => {
		const out = sanitizeArticleHtml('<p>a</p><img src="javascript:alert(1)"><p>b</p>');
		expect(out).not.toContain('javascript');
		/* Not `<img>` with no src, which draws as a broken-image icon. */
		expect(out).not.toContain('<img');
		expect(out).toContain('<p>a</p>');
	});

	/* An `<svg>` carrying an `onload` is the usual way past a tag-name blocklist,
	   which is exactly why the allowlist names what is permitted instead. */
	it('drops svg, iframe, object and form outright', () => {
		for (const markup of [
			'<svg onload="alert(1)"></svg>',
			'<iframe src="https://evil.example"></iframe>',
			'<object data="x"></object>',
			'<form action="/login"><input name="password"></form>'
		]) {
			const out = sanitizeArticleHtml(markup);
			expect(out).not.toMatch(/svg|iframe|object|form|input/);
		}
	});

	it('keeps a code block class and drops a borrowed utility class', () => {
		const out = sanitizeArticleHtml(
			'<pre class="language-js fixed inset-0 z-50"><code>x</code></pre>'
		);
		expect(out).toContain('language-js');
		expect(out).not.toContain('fixed');
		expect(out).not.toContain('z-50');
	});

	it('sends an outbound link to a new tab, with the opener sealed off', () => {
		const out = sanitizeArticleHtml('<p><a href="https://example.com">Away</a></p>');
		expect(out).toContain('target="_blank"');
		expect(out).toContain('rel="noopener noreferrer nofollow"');
	});

	it('leaves a link to this site in the same tab', () => {
		const out = sanitizeArticleHtml('<p><a href="/discover">Discovery</a></p>');
		expect(out).not.toContain('target=');
	});

	it('defers every image in the body', () => {
		const out = sanitizeArticleHtml('<img src="/files/a.png" alt="A">');
		expect(out).toContain('loading="lazy"');
		expect(out).toContain('decoding="async"');
	});

	/* The editor is configured with `allowBase64`, so a pasted picture arrives
	   this way and must survive — but only as a picture. */
	it('keeps a data: image and refuses a data: link', () => {
		expect(sanitizeArticleHtml('<img src="data:image/png;base64,AAAA">')).toContain('data:image');
		expect(sanitizeArticleHtml('<a href="data:text/html,<b>x</b>">y</a>')).not.toContain('data:');
	});

	it('treats an empty body as empty', () => {
		expect(sanitizeArticleHtml('')).toBe('');
		expect(sanitizeArticleHtml(null)).toBe('');
		expect(sanitizeArticleHtml(undefined)).toBe('');
	});
});

describe('htmlToText', () => {
	it('separates block elements rather than running them together', () => {
		expect(htmlToText('<p>one</p><p>two</p>')).toBe('one two');
	});

	it('decodes entities so a search matches what the reader sees', () => {
		expect(htmlToText('<p>Addis &amp; Co</p>')).toBe('Addis & Co');
	});

	it('collapses the whitespace an editor leaves behind', () => {
		expect(htmlToText('<p>a</p>\n\n   <p>b</p>')).toBe('a b');
	});
});

describe('readingMinutes', () => {
	it('is zero only for nothing at all', () => {
		expect(readingMinutes('')).toBe(0);
	});

	it('never rounds a real article down to zero', () => {
		expect(readingMinutes('one two three')).toBe(1);
	});

	it('scales with length', () => {
		expect(readingMinutes(Array(660).fill('word').join(' '))).toBe(3);
	});
});

describe('summarize', () => {
	it('leaves a short text alone', () => {
		expect(summarize('Short enough.', 200)).toBe('Short enough.');
	});

	it('cuts at a word boundary', () => {
		const summary = summarize('alpha beta gamma delta epsilon', 20);
		expect(summary.endsWith('…')).toBe(true);
		expect(summary).not.toContain('epsil ');
		expect(summary.length).toBeLessThanOrEqual(21);
	});

	/* A single word longer than the limit has no boundary to cut at, and a
	   summary of nothing followed by an ellipsis is worse than a hard cut. */
	it('falls back to a hard cut when there is no boundary near the end', () => {
		expect(summarize('a'.repeat(50), 10)).toBe(`${'a'.repeat(10)}…`);
	});
});
