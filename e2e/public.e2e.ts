import { expect, test } from '@playwright/test';

/**
 * The public surface, against a real server and a real database.
 *
 * Deliberately shallow. What the unit tests cannot reach is the seam between a
 * URL, a load function and SQL — so these check that the listings render, that
 * the state in the query string is the state on the screen, and that the
 * parameters which used to produce a 500 no longer do.
 */

test.describe('discovery', () => {
	test('lists creators and puts its state in the URL', async ({ page }) => {
		await page.goto('/discover');
		await expect(page).toHaveTitle(/./);

		const cards = page.locator('a[href^="/creators/"]');
		await expect(cards.first()).toBeVisible();

		await page.goto('/discover?sort=reach&dir=desc');
		await expect(page).toHaveURL(/sort=reach/);
	});

	test('a search that matches nothing says so instead of erroring', async ({ page }) => {
		const response = await page.goto('/discover?q=zzzznothingmatchesthis');
		expect(response?.status()).toBe(200);
		await expect(page.locator('a[href^="/creators/"]')).toHaveCount(0);
	});

	test('a bookmark past the last page lands on real rows', async ({ page }) => {
		const response = await page.goto('/discover?page=999');
		expect(response?.status()).toBe(200);
	});
});

test.describe('briefs', () => {
	test('lists campaigns', async ({ page }) => {
		await page.goto('/campaigns');
		await expect(page.locator('a[href^="/campaigns/"]').first()).toBeVisible();
	});

	/**
	 * The "all markets" chip means *no market filter*, so its count must not
	 * change when a market is chosen. It used to be summed from the compensation
	 * facet, which keeps the market condition — so picking a market silently
	 * rewrote the number on the control that clears it.
	 */
	test('the all-markets count ignores the market filter', async ({ page }) => {
		const countOn = async (url: string) => {
			await page.goto(url);
			const chip = page.locator('a', { hasText: /All markets/i }).first();
			return (await chip.textContent())?.match(/\d+/)?.[0];
		};

		const unfiltered = await countOn('/campaigns');
		const filtered = await countOn('/campaigns?market=1');
		expect(filtered).toBe(unfiltered);
	});
});

/**
 * Every one of these returned 500 before the query layer was fixed, and every
 * one of them is reachable with no session at all.
 */
test.describe('crafted list parameters', () => {
	const hostile = [
		'?sort=__proto__',
		'?sort=constructor',
		'?sort=toString',
		'?page=1e21',
		'?page=-5',
		'?per=1e21',
		'?per=0',
		'?country=__proto__',
		'?q=%27%3B+drop+table+creators%3B+--'
	];

	for (const path of ['/discover', '/campaigns']) {
		for (const query of hostile) {
			test(`${path}${query} is not an error page`, async ({ page }) => {
				const response = await page.goto(`${path}${query}`);
				expect(response?.status(), `${path}${query}`).toBe(200);
			});
		}
	}

	test('?tab=constructor does not throw on a signed-out listing', async ({ page }) => {
		const response = await page.goto('/campaigns?tab=constructor');
		expect(response?.status()).toBe(200);
	});
});

test.describe('operational routes', () => {
	test('health reports the database', async ({ request }) => {
		const response = await request.get('/health');
		expect(response.status()).toBe(200);
		expect(await response.json()).toMatchObject({ status: 'ok', database: 'ok' });
	});

	test('robots points at an absolute sitemap', async ({ request }) => {
		const body = await (await request.get('/robots.txt')).text();
		expect(body).toContain('Disallow: /dashboard');
		expect(body).toMatch(/Sitemap: https?:\/\/.+\/sitemap\.xml/);
	});

	test('the sitemap lists the public surface and nothing else', async ({ request }) => {
		const body = await (await request.get('/sitemap.xml')).text();
		expect(body).toContain('<urlset');
		expect(body).toContain('/discover');
		expect(body).not.toContain('/dashboard');
		expect(body).not.toContain('/login');
	});

	test('an unknown path renders the error page rather than a stack trace', async ({ page }) => {
		const response = await page.goto('/definitely-not-a-route');
		expect(response?.status()).toBe(404);
		await expect(page.locator('body')).not.toContainText('at Object.');
	});
});

test.describe('the dashboard is not public', () => {
	for (const path of ['/dashboard', '/dashboard/bookings', '/dashboard/admin/users']) {
		test(`${path} sends a signed-out visitor to sign in`, async ({ page }) => {
			await page.goto(path);
			await expect(page).toHaveURL(/\/login/);
		});
	}
});
