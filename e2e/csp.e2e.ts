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

test('the policy still holds for a reader whose system is dark', async ({ page }) => {
	/*
	 * The site is light whatever the system says, but the media query still
	 * differs, and a stylesheet or image that only a dark-preferring browser
	 * asks for would be governed by the same policy. Cheap to keep, and it is
	 * the case that used to take its own branch.
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

/*
 * The site is light for everybody.
 *
 * `<ModeWatcher />` is gone, so nothing stamps `.dark` on <html> and nothing
 * sets an inline `style.colorScheme` — the declaration lives in `:root` in
 * layout.css instead, which is why these read the *computed* value. The tests
 * that used to assert a dark reader got dark now assert the opposite, on
 * purpose: they are the ones that would notice the theme coming back by
 * accident.
 */
const LIGHT_GROUND = 'rgb(242, 245, 249)'; // --ground, #f2f5f9

const themeOf = (page: import('@playwright/test').Page) => ({
	scheme: () => page.evaluate(() => getComputedStyle(document.documentElement).colorScheme),
	ground: () => page.evaluate(() => getComputedStyle(document.body).backgroundColor)
});

test('a reader whose system is light gets light', async ({ page }) => {
	const theme = themeOf(page);
	await page.emulateMedia({ colorScheme: 'light' });
	await page.goto('/', { waitUntil: 'domcontentloaded' });

	expect(await theme.scheme()).toBe('light');
	expect(await theme.ground()).toBe(LIGHT_GROUND);
	await expect(page.locator('html')).not.toHaveClass(/\bdark\b/);
});

test('a reader whose system is dark gets light too', async ({ page }) => {
	const theme = themeOf(page);
	await page.emulateMedia({ colorScheme: 'dark' });
	await page.goto('/', { waitUntil: 'domcontentloaded' });

	/*
	 * `domcontentloaded`, so this is true before the app's own JavaScript has
	 * had a chance to run — a light page that only becomes light after hydration
	 * is a dark flash, which is the thing worth catching.
	 */
	expect(await theme.scheme()).toBe('light');
	expect(await theme.ground()).toBe(LIGHT_GROUND);
	await expect(page.locator('html')).not.toHaveClass(/\bdark\b/);
});

test('a reader who once chose dark gets light anyway', async ({ page }) => {
	/*
	 * The case that props could not have fixed. mode-watcher persisted the
	 * choice under this key, and `defaultMode` would have lost to it — so a
	 * reader who picked dark a month ago has this sitting in their browser
	 * right now. Nothing reads it any more, and this says so.
	 */
	await page.emulateMedia({ colorScheme: 'dark' });
	await page.goto('/', { waitUntil: 'domcontentloaded' });
	await page.evaluate(() => localStorage.setItem('mode-watcher-mode', 'dark'));

	await page.reload({ waitUntil: 'domcontentloaded' });
	const theme = themeOf(page);
	expect(await theme.scheme()).toBe('light');
	expect(await theme.ground()).toBe(LIGHT_GROUND);
	await expect(page.locator('html')).not.toHaveClass(/\bdark\b/);
});

test('there is no theme control left to press', async ({ page }) => {
	await visit(page, '/');
	await expect(page.getByRole('button', { name: /light and dark|ብርሃን/i })).toHaveCount(0);
});
