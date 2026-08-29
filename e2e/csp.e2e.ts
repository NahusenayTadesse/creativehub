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

/**
 * `load`, never `networkidle`. Gallery slides carry operator-supplied image
 * URLs, so a page can be waiting on a third-party host that this machine cannot
 * reach — and `networkidle` then never fires, turning a green test suite red
 * for a reason that has nothing to do with the policy. `load` plus a short
 * settle gives inline script every chance to run and be refused.
 */
async function visit(page: import('@playwright/test').Page, path: string) {
	await page.goto(path, { waitUntil: 'load' });
	await page.waitForTimeout(300);
}

/** Collects CSP refusals for the life of the page. */
function watchForViolations(page: import('@playwright/test').Page) {
	const violations: string[] = [];
	page.on('console', (msg) => {
		const text = msg.text();
		if (msg.type() === 'error' && /Content Security Policy/i.test(text)) {
			violations.push(text.slice(0, 160));
		}
	});
	return violations;
}

test('no page is blocked by its own policy', async ({ page }) => {
	const violations = watchForViolations(page);

	for (const path of PAGES) {
		await visit(page, path);
	}

	expect(violations, violations.join('\n')).toEqual([]);
});

test('the policy still holds in dark mode', async ({ page }) => {
	/*
	 * Dark takes a different branch through mode-watcher's inline script — it
	 * writes a class where light writes none — so the hash has to cover both.
	 */
	const violations = watchForViolations(page);
	await page.emulateMedia({ colorScheme: 'dark' });

	for (const path of PAGES) {
		await visit(page, path);
	}

	expect(violations, violations.join('\n')).toEqual([]);
});

test('the page hydrates', async ({ page }) => {
	await visit(page, '/login');

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
	await page.emulateMedia({ colorScheme: 'light' });
	await page.goto('/', { waitUntil: 'domcontentloaded' });

	/*
	 * mode-watcher's inline script sets this. Asserting on `colorScheme` rather
	 * than a class because the light theme adds no class — `lightClassNames` is
	 * empty, so a class assertion would pass just as happily with the script
	 * blocked, which is the one thing this test exists to catch.
	 *
	 * `domcontentloaded` rather than `networkidle`: the point is that this is
	 * already true before the app's own JavaScript has had a chance to run.
	 */
	await expect(page.locator('html')).toHaveJSProperty('style.colorScheme', 'light');
	await expect(page.locator('html')).not.toHaveClass(/\bdark\b/);
});

test('a dark-mode reader gets dark before paint', async ({ page }) => {
	await page.emulateMedia({ colorScheme: 'dark' });
	await page.goto('/', { waitUntil: 'domcontentloaded' });

	await expect(page.locator('html')).toHaveJSProperty('style.colorScheme', 'dark');
	await expect(page.locator('html')).toHaveClass(/\bdark\b/);
});

test('the tokens actually flip the page, not just the class', async ({ page }) => {
	/*
	 * A class on <html> proves mode-watcher ran; it does not prove the stylesheet
	 * responded. This reads the ground colour the body is actually painted in.
	 */
	const groundOf = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);

	await page.emulateMedia({ colorScheme: 'light' });
	await page.goto('/', { waitUntil: 'domcontentloaded' });
	expect(await groundOf()).toBe('rgb(243, 244, 246)'); // --ground, light

	await page.emulateMedia({ colorScheme: 'dark' });
	await page.goto('/', { waitUntil: 'domcontentloaded' });
	expect(await groundOf()).toBe('rgb(11, 17, 32)'); // --ground, dark
});

test('the toggle overrides the system, and the choice survives a reload', async ({ page }) => {
	await page.emulateMedia({ colorScheme: 'dark' });
	await visit(page, '/');
	await expect(page.locator('html')).toHaveClass(/\bdark\b/);

	/* The nav toggle carries its purpose in its accessible name. */
	await page.getByRole('button', { name: /light and dark|ብርሃን/i }).click();
	await expect(page.locator('html')).not.toHaveClass(/\bdark\b/);

	/*
	 * The choice is stored in the browser rather than on the server, which is
	 * what lets it apply before the first paint on the next visit. If it did not
	 * survive a reload, the system preference would win straight back.
	 */
	await page.reload({ waitUntil: 'domcontentloaded' });
	await expect(page.locator('html')).not.toHaveClass(/\bdark\b/);
	await expect(page.locator('html')).toHaveJSProperty('style.colorScheme', 'light');
});
