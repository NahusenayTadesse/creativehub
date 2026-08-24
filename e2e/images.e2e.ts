import { expect, test } from '@playwright/test';

/**
 * No page shows a broken image.
 *
 * Every image on the site points at something we do not control — an upload
 * that may have been pruned, a scraped avatar on someone else's host, a seeded
 * unsplash URL the Content-Security-Policy blocks outright. `AppImage` answers
 * all of those with drawn artwork, and this is the check that it actually does.
 *
 * It has to run in a browser: the fallback is a runtime decision, and the case
 * that broke first — an image that fails *before* hydration attaches `onerror`,
 * leaving it `complete` with no intrinsic width — is invisible to a unit test
 * and invisible in the server-rendered HTML.
 */

/** Every `<img>`, with enough state to tell broken from still-loading. */
const imagesOn = (page: import('@playwright/test').Page) =>
	page.evaluate(() =>
		[...document.images].map((img) => ({
			src: img.currentSrc || img.src,
			complete: img.complete,
			width: img.naturalWidth,
			alt: img.alt
		}))
	);

const PAGES = ['/', '/discover', '/campaigns'];

for (const path of PAGES) {
	test(`${path} renders no broken images`, async ({ page }) => {
		await page.goto(path);
		/* Lazy images below the fold never attempt a load until they are near it. */
		await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
		await page.waitForTimeout(1000);

		const images = await imagesOn(page);
		expect(images.length).toBeGreaterThan(0);

		const broken = images.filter((img) => img.complete && img.width === 0);
		expect(broken, `broken: ${broken.map((b) => b.src).join(', ')}`).toEqual([]);
	});
}

test('a creator with no avatar still gets drawn artwork', async ({ page }) => {
	await page.goto('/discover');
	const first = page.locator('a[href^="/creators/"]').first();
	await first.click();
	await expect(page).toHaveURL(/\/creators\//);

	const images = await imagesOn(page);
	expect(images.length).toBeGreaterThan(0);
	expect(images.filter((img) => img.complete && img.width === 0)).toEqual([]);

	/* Whatever else is on the profile, nothing is left pointing at an empty
	   `src` — which resolves to the page itself and draws as broken. */
	for (const image of images) expect(image.src).not.toBe('');
});
