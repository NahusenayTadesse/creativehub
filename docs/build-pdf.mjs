/**
 * Renders a markdown document in this folder into a typeset PDF beside it.
 *
 *   node docs/build-pdf.mjs              # DOCUMENTATION.md — the reference
 *   node docs/build-pdf.mjs features     # FEATURES.md — the catalogue
 *
 * The markdown is the source of truth; this script only dresses it. It parses
 * with `marked` loaded from a CDN inside the page, because the repository has
 * no markdown dependency and adding one to ship a document would be a poor
 * trade. Chrome is driven through Playwright's `chrome` channel — the browser
 * already on the machine — so there is nothing to install either.
 *
 * Both documents share every rule below the cover. A second script would have
 * meant a second stylesheet, and the two would have drifted apart by the third
 * edit — so the only thing a document chooses is its own title page.
 */
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';

const here = dirname(fileURLToPath(import.meta.url));

/* Each entry is one document: where the prose lives, what to write, and the
   title page — which is composed here rather than in the markdown, because a
   cover is the one part of a document that only exists on paper. */
const DOCS = {
	documentation: {
		source: 'DOCUMENTATION.md',
		target: 'Creator-Network-Documentation.pdf',
		eyebrow: 'Documentation',
		title: 'Creator Network',
		subtitle: 'Product &amp; Technical Documentation',
		running: 'Creator Network \u00b7 Product &amp; Technical Documentation',
		pdfTitle: 'Creator Network - Product & Technical Documentation',
		pdfSubject: 'Architecture, product surfaces, security, operations and roadmap',
		pdfKeywords: 'creator marketplace, SvelteKit, Drizzle ORM, documentation',
		blurb:
			'A two-sided marketplace connecting organisations — brands, agencies, NGOs and event organisers — with content creators across Ethiopia and the wider Pan-African market. It covers the full collaboration: discovery, negotiation, agreed terms, delivery, review and settlement.',
		meta: [
			['Version', 'v0.0.1'],
			['Date', 'September 2026'],
			['Stack', 'SvelteKit 2 · Svelte 5 · Drizzle ORM · MySQL/MariaDB'],
			['Scale', '44 pages · 38 tables · 1,700 strings × 2 locales']
		]
	},
	features: {
		source: 'FEATURES.md',
		target: 'Creator-Network-Features.pdf',
		eyebrow: 'Feature Catalogue',
		title: 'Creator Network',
		subtitle: 'The Complete Feature Catalogue',
		running: 'Creator Network \u00b7 Feature Catalogue',
		pdfTitle: 'Creator Network - The Complete Feature Catalogue',
		pdfSubject: 'Every capability the platform ships, by surface and by role',
		pdfKeywords: 'creator marketplace, features, discovery, bookings, trending, SvelteKit',
		blurb:
			'Every capability the platform ships, catalogued by the surface it appears on and the role it serves — from public discovery and the two workspaces, through the deal engine, payments, verification and ranking, to the operator console and the features every screen inherits for free.',
		meta: [
			['Version', 'v0.0.1'],
			['Date', 'September 2026'],
			['Surfaces', '58 routes · 3 roles · 2 locales'],
			['Scale', '43 tables · 1,841 strings · 258 unit assertions']
		]
	}
};

const key = process.argv[2] ?? 'documentation';
const DOC = DOCS[key];
if (!DOC) {
	console.error(`Unknown document '${key}'. Try: ${Object.keys(DOCS).join(', ')}`);
	process.exit(1);
}

const target = resolve(here, DOC.target);
const markdown = readFileSync(resolve(here, DOC.source), 'utf8');

const css = String.raw`
@page { size: A4; margin: 20mm 16mm 20mm 16mm; }

:root {
  --brand: #059669;
  --brand-deep: #047857;
  --brand-soft: #ecfdf5;
  --brand-edge: #a7f3d0;
  --ink: #101720;
  --ink-soft: #46525f;
  --ink-dim: #6b7885;
  --edge: #e2e8ef;
  --well: #f7f9fb;
}

* { box-sizing: border-box; }

html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }

body {
  margin: 0;
  font-family: 'Source Serif 4', Georgia, serif;
  font-size: 10.2pt;
  line-height: 1.62;
  color: var(--ink);
  background: #fff;
}

/* ---------- cover ---------- */

.cover {
  page-break-after: always;
  height: 257mm;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  position: relative;
}
.cover-bar {
  height: 5px;
  border-radius: 3px;
  background: linear-gradient(90deg, var(--brand-deep), var(--brand) 55%, #34d399);
}
.cover-top { padding-top: 22mm; }
.cover-eyebrow {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 8.5pt;
  letter-spacing: .22em;
  text-transform: uppercase;
  font-weight: 650;
  color: var(--brand-deep);
}
.cover h1 {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 44pt;
  line-height: 1.02;
  letter-spacing: -0.035em;
  font-weight: 700;
  margin: 6mm 0 3mm;
  color: var(--ink);
}
.cover h2 {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 15pt;
  font-weight: 500;
  letter-spacing: -0.01em;
  margin: 0;
  color: var(--ink-soft);
}
.cover-rule {
  width: 26mm;
  height: 3px;
  background: var(--brand);
  border-radius: 2px;
  margin: 9mm 0;
}
.cover-blurb {
  max-width: 118mm;
  font-size: 11.4pt;
  line-height: 1.66;
  color: var(--ink-soft);
}
.cover-meta {
  border-top: 1px solid var(--edge);
  padding-top: 6mm;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 5mm 10mm;
  font-family: 'Inter', system-ui, sans-serif;
}
.cover-meta dt {
  font-size: 7.6pt;
  letter-spacing: .16em;
  text-transform: uppercase;
  font-weight: 650;
  color: var(--ink-dim);
  margin-bottom: 1.5mm;
}
.cover-meta dd { margin: 0; font-size: 9.6pt; font-weight: 500; color: var(--ink); }

/* ---------- flow ---------- */

.doc { counter-reset: h2; }

/* The markdown carries its own centred title block and contents table; the
   cover and the generated bookmarks replace them on paper. */
.doc > div[align='center']:first-of-type,
.doc > hr:first-of-type { display: none; }

h1, h2, h3, h4 {
  font-family: 'Inter', system-ui, sans-serif;
  letter-spacing: -0.018em;
  color: var(--ink);
  line-height: 1.22;
}

.doc h1 { display: none; }

.doc h2 {
  font-size: 19pt;
  font-weight: 700;
  margin: 0 0 6mm;
  padding: 0 0 3mm;
  border-bottom: 2.5px solid var(--brand);
  page-break-before: always;
  page-break-after: avoid;
}
.doc h2:first-of-type { page-break-before: avoid; }

.doc h3 {
  font-size: 13pt;
  font-weight: 650;
  margin: 9mm 0 3mm;
  page-break-after: avoid;
  break-inside: avoid;
  padding-top: 4mm;
  /* The short rule is painted onto the heading rather than added before it, so
     a page break can never leave the rule behind on the previous page. */
  background: linear-gradient(var(--brand-edge), var(--brand-edge)) top left / 9mm 2px no-repeat;
}

.doc h4 {
  font-size: 10.8pt;
  font-weight: 650;
  margin: 6mm 0 2mm;
  color: var(--brand-deep);
  page-break-after: avoid;
}

p { margin: 0 0 3.4mm; orphans: 2; widows: 2; }

a { color: var(--brand-deep); text-decoration: none; border-bottom: 1px solid var(--brand-edge); }

strong { font-weight: 650; color: var(--ink); }

ul, ol { margin: 0 0 3.6mm; padding-left: 6mm; }
li { margin-bottom: 1.6mm; }
li::marker { color: var(--brand); }

hr { border: 0; border-top: 1px solid var(--edge); margin: 7mm 0; }

code {
  font-family: 'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace;
  font-size: 8.6pt;
  background: var(--well);
  border: 1px solid var(--edge);
  border-radius: 3px;
  padding: 0.3mm 1.2mm;
  color: #0f3f31;
}

pre {
  font-family: 'JetBrains Mono', ui-monospace, Menlo, monospace;
  background: var(--well);
  border: 1px solid var(--edge);
  border-left: 3px solid var(--brand);
  border-radius: 4px;
  padding: 3.5mm 4mm;
  margin: 0 0 4.5mm;
  font-size: 7.9pt;
  line-height: 1.5;
  overflow: hidden;
  white-space: pre-wrap;
  page-break-inside: avoid;
}
pre code { background: none; border: 0; padding: 0; font-size: inherit; color: #16332b; }

blockquote {
  margin: 0 0 4.5mm;
  padding: 3mm 4mm;
  background: var(--brand-soft);
  border-left: 3px solid var(--brand);
  border-radius: 0 4px 4px 0;
  color: #0b3d2e;
  page-break-inside: avoid;
}
blockquote p:last-child { margin-bottom: 0; }

table {
  width: 100%;
  border-collapse: collapse;
  margin: 0 0 5mm;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 8.7pt;
  line-height: 1.45;
  page-break-inside: auto;
}
thead { display: table-header-group; }
tr { page-break-inside: avoid; }
th {
  text-align: left;
  font-weight: 650;
  font-size: 7.8pt;
  letter-spacing: .07em;
  text-transform: uppercase;
  color: var(--ink-dim);
  background: var(--well);
  border-bottom: 1.5px solid var(--brand);
  padding: 2.2mm 2.6mm;
}
td {
  padding: 2.2mm 2.6mm;
  border-bottom: 1px solid var(--edge);
  vertical-align: top;
}
tbody tr:nth-child(even) td { background: #fcfdfe; }
td code { font-size: 7.9pt; }

/* The contents table earns a lighter treatment than a data table. */
.doc > table:first-of-type th:first-child,
.doc > table:first-of-type td:first-child { width: 8mm; color: var(--brand-deep); font-weight: 650; }

img { max-width: 100%; }

div[align='center'] {
  text-align: center;
  color: var(--ink-dim);
  font-size: 9pt;
  font-style: italic;
}
div[align='center'] em { font-style: italic; }
`;

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${DOC.pdfTitle}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;650;700&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;1,8..60,400&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>${css}</style>
</head>
<body>
<section class="cover">
  <div class="cover-bar"></div>
  <div class="cover-top">
    <div class="cover-eyebrow">${DOC.eyebrow}</div>
    <h1>${DOC.title}</h1>
    <h2>${DOC.subtitle}</h2>
    <div class="cover-rule"></div>
    <p class="cover-blurb">${DOC.blurb}</p>
  </div>
  <dl class="cover-meta">
    ${DOC.meta.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('\n    ')}
  </dl>
</section>
<main class="doc" id="doc"></main>
<script src="https://cdnjs.cloudflare.com/ajax/libs/marked/12.0.2/marked.min.js"></script>
<script id="md" type="application/json"></script>
<script>
  const raw = JSON.parse(document.getElementById('md').textContent);
  marked.setOptions({ gfm: true, breaks: false });
  document.getElementById('doc').innerHTML = marked.parse(raw);
  document.documentElement.dataset.ready = '1';
</script>
</body>
</html>`;

const dir = mkdtempSync(join(tmpdir(), 'cn-docs-'));
const page = join(dir, 'documentation.html');
/* The markdown is injected as JSON so nothing in it can close the script tag
   or be read as markup. */
writeFileSync(
	page,
	html.replace(
		'<script id="md" type="application/json"></script>',
		`<script id="md" type="application/json">${JSON.stringify(markdown).replace(/</g, '\\u003c')}</script>`
	)
);

const browser = await chromium.launch({ channel: 'chrome' });
const tab = await browser.newPage();
await tab.goto(pathToFileURL(page).href, { waitUntil: 'networkidle' });
await tab.waitForFunction(() => document.documentElement.dataset.ready === '1');
await tab.evaluate(() => document.fonts.ready);

const label = DOC.running;
const chrome = (line) =>
	`<div style="width:100%;padding:0 16mm;font:8px Inter,system-ui,sans-serif;color:#93a1af;display:flex;justify-content:space-between;">${line}</div>`;

const base = {
	format: 'A4',
	printBackground: true,
	margin: { top: '20mm', bottom: '18mm', left: '16mm', right: '16mm' },
	outline: true,
	tagged: true
};

/*
 * Two passes and a join, because Chrome's header and footer templates apply to
 * every page it prints and a title page wearing a running head is not a title
 * page. The cover is printed bare, the body is printed with the furniture, and
 * `pdfunite` puts them back together — which also starts the page numbering on
 * the first page of prose rather than on the cover.
 */
const coverPdf = join(dir, 'cover.pdf');
const bodyPdf = join(dir, 'body.pdf');

await tab.pdf({ ...base, path: coverPdf, pageRanges: '1' });
await tab.pdf({
	...base,
	path: bodyPdf,
	pageRanges: '2-',
	displayHeaderFooter: true,
	headerTemplate: chrome(`<span>${label}</span><span>v0.0.1</span>`),
	footerTemplate: chrome('<span>September 2026</span><span class="pageNumber"></span>')
});

await browser.close();

/*
 * Ghostscript rather than `pdfunite` for the join: poppler's merger drops the
 * document outline, and a thirty-six page reference without a bookmark tree is
 * a thirty-six page reference nobody navigates. The pdfmark block restores the
 * document properties, which any merge would otherwise leave empty.
 */
const marks = join(dir, 'docinfo.ps');
writeFileSync(
	marks,
	[
		`[ /Title (${DOC.pdfTitle})`,
		'  /Author (Creator Network)',
		`  /Subject (${DOC.pdfSubject})`,
		`  /Keywords (${DOC.pdfKeywords})`,
		'  /DOCINFO pdfmark',
		''
	].join('\n')
);

execFileSync('gs', [
	'-q',
	'-dBATCH',
	'-dNOPAUSE',
	'-dPrinted=false',
	'-sDEVICE=pdfwrite',
	'-dPDFSETTINGS=/prepress',
	'-dCompatibilityLevel=1.7',
	`-sOutputFile=${target}`,
	coverPdf,
	bodyPdf,
	marks
]);

console.log(`Wrote ${target}`);
