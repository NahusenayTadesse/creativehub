import { expect, test, type Page } from '@playwright/test';

/**
 * Uploading a profile picture, from both sides.
 *
 * Most creators on this site came from a scrape with no usable avatar, so the
 * two places a real one can be put on a profile — an operator in the dashboard,
 * a creator on their own page — are the only way those profiles ever get a
 * face. Both go through `FileUpload`, both store the file on disk, and both
 * keep the stored picture when the form is saved again without touching the
 * picker. That last part is the one that quietly breaks: an empty file input
 * posts as an empty string, and a careless action writes that over the column.
 *
 * It has to be a browser test. The picker compresses in a web worker before the
 * form is submitted, so what reaches the server is not the file that was
 * chosen, and nothing below the browser sees that step at all.
 */

/** Seeded accounts all share this; see ACCOUNTS.md. */
const PASSWORD = 'creator2026';

/** A 2×2 PNG — small enough to be quick, real enough to survive compression. */
const PNG = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP8z4AATAxIHAgLxsUEAFZ4Agsz9lFZAAAAAElFTkSuQmCC',
	'base64'
);

async function signIn(page: Page, email: string) {
	await page.goto('/login');
	await page.fill('input[name="email"]', email);
	await page.fill('input[name="password"]', PASSWORD);
	await page.click('button[type="submit"]');
	await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
}

/** The `src` of the first avatar image on the page. */
const firstAvatarSrc = (page: Page) =>
	page.evaluate(() => {
		const image = document.images[0];
		return image ? image.getAttribute('src') : null;
	});

test('a creator can put a photo on their own profile', async ({ page }) => {
	await signIn(page, 'wangari_tech_ke@gmail.com');
	await page.goto('/dashboard/profile');

	/* The picker is hidden behind its label, which is why the input is filled
	   directly rather than clicked. */
	await page.setInputFiles('input[type="file"][name="avatar"]', {
		name: 'me.png',
		mimeType: 'image/png',
		buffer: PNG
	});
	/* Compression happens off the main thread; the preview appearing is the
	   signal that the field now holds the processed file. */
	await expect(page.locator('img[alt]').first()).toBeVisible();

	await page.click('form[action="?/save"] button[type="submit"]');
	await expect(page.getByText(/updated/i).first()).toBeVisible({ timeout: 15_000 });

	await page.goto('/dashboard/profile');
	const stored = await page
		.locator('form[action="?/save"]')
		.evaluate(() => document.body.innerHTML.match(/\/files\/[\w.-]+/)?.[0] ?? null);
	expect(stored, 'the saved profile should reference a stored file').toBeTruthy();

	/* And the site can actually serve it back. */
	const response = await page.request.get(stored!);
	expect(response.status()).toBe(200);
	expect(response.headers()['content-type']).toContain('image/');
});

test('saving again without touching the picker keeps the photo', async ({ page }) => {
	await signIn(page, 'wangari_tech_ke@gmail.com');
	await page.goto('/dashboard/profile');

	const before = await page
		.locator('body')
		.evaluate(() => document.body.innerHTML.match(/\/files\/[\w.-]+/)?.[0] ?? null);
	test.skip(!before, 'no stored picture yet — the upload test above provides it');

	await page.click('form[action="?/save"] button[type="submit"]');
	await expect(page.getByText(/updated/i).first()).toBeVisible({ timeout: 15_000 });

	await page.goto('/dashboard/profile');
	const after = await page
		.locator('body')
		.evaluate(() => document.body.innerHTML.match(/\/files\/[\w.-]+/)?.[0] ?? null);
	expect(after).toBe(before);
});

test('an operator can put a photo on any creator', async ({ page }) => {
	await signIn(page, 'admin@creatornetwork.et');
	await page.goto('/dashboard/admin/creators');

	await page.getByRole('button', { name: /edit/i }).first().click();
	const dialog = page.getByRole('dialog');
	await expect(dialog).toBeVisible();

	await dialog.locator('input[type="file"][name="avatar"]').setInputFiles({
		name: 'creator.png',
		mimeType: 'image/png',
		buffer: PNG
	});
	await dialog.getByRole('button', { name: /save|add/i }).click();
	await expect(dialog).toBeHidden({ timeout: 15_000 });

	/* The listing re-renders from the row, so a stored name here means the
	   column holds the upload and `AppImage` resolved it to a servable path. */
	await expect
		.poll(async () => await firstAvatarSrc(page), { timeout: 15_000 })
		.toMatch(/^\/files\//);
});
