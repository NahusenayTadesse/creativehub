import { expect, test } from '@playwright/test';

/**
 * The Content-Security-Policy, against a real build.
 *
 * A CSP only fails at runtime, in a browser, on a production build — the header
 * is generated from `kit.csp` at build time and the nonce is minted per
 * response, so nothing earlier in the pipeline can catch a script the policy
 * refuses to run. That refusal is silent apart from a console line, which is
 * exactly the kind of breakage that survives for months.
 */

const PAGES = ['/', '/discover', '/login', '/terms', '/privacy'];

test('no page is blocked by its own policy', async ({ page }) => {
	const violations: string[] = [];
	page.on('console', (msg) => {
		const text = msg.text();
		if (msg.type() === 'error' && /Content Security Policy/i.test(text)) {
			violations.push(text.slice(0, 160));
		}
	});

	for (const path of PAGES) {
		await page.goto(path, { waitUntil: 'networkidle' });
	}

	expect(violations, violations.join('\n')).toEqual([]);
});

test('the page hydrates', async ({ page }) => {
	await page.goto('/login', { waitUntil: 'networkidle' });

	/*
	 * The reveal toggle on a password field only exists once Svelte has taken
	 * over, so the type flipping is proof that hydration ran — a cheaper and
	 * more honest check than looking for a framework global.
	 */
	const field = page.locator('input[name="password"]');
	await expect(field).toHaveAttribute('type', 'password');
	await page.locator('form button[type="button"]').first().click();
	await expect(field).toHaveAttribute('type', 'text');
});

test('the theme is applied before paint, not after', async ({ page }) => {
	await page.goto('/', { waitUntil: 'domcontentloaded' });

	/*
	 * mode-watcher's inline script sets this. Asserting on `colorScheme` rather
	 * than a class because the light theme adds no class — `lightClassNames` is
	 * empty, so a class assertion would pass just as happily with the script
	 * blocked, which is the one thing this test exists to catch.
	 */
	await expect(page.locator('html')).toHaveJSProperty('style.colorScheme', 'light');
});
