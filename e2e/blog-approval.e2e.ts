import { expect, test, type Browser, type Page } from '@playwright/test';

/**
 * A creator writes for the blog and an operator decides.
 *
 * The rule the whole feature rests on — nothing a creator or a brand writes
 * reaches a reader until somebody has read *that* text — spans four routes,
 * three roles and a status column, and no unit test can see all of it at once.
 * What goes wrong in practice is a listing that forgets its status condition,
 * and the only honest check for that is to submit something and then go and
 * look at the public pages as a signed-out reader. So there are three browser
 * contexts here rather than one: sharing a session would let a page pass
 * because the person looking at it happened to be allowed to.
 *
 * It ends by deleting the article, so the suite can be run twice against the
 * same database.
 */

/** Seeded accounts all share this; see ACCOUNTS.md. */
const PASSWORD = 'creator2026';

const CREATOR = 'joel_tech_ethiopia@gmail.com';
const CREATOR_PROFILE = '/creators/joel_tech_ethiopia';
const OPERATOR = 'admin@influencerethiopia.com';

/** Unique per run, so a second run is not reading the first one's article. */
const TITLE = `E2E review ${Date.now()}`;

async function signedInAs(browser: Browser, email: string): Promise<Page> {
	const page = await browser.newContext().then((context) => context.newPage());
	await page.goto('/login');
	await page.fill('input[name="email"]', email);
	await page.fill('input[name="password"]', PASSWORD);
	await page.click('button[type="submit"]');
	await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
	return page;
}

/** The card for this article in whichever listing is open. */
const card = (page: Page) => page.locator('div.bento-card').filter({ hasText: TITLE });

test('a creator submits, an operator publishes, and only then is it public', async ({
	browser
}) => {
	const creator = await signedInAs(browser, CREATOR);
	const reader = await browser.newContext().then((context) => context.newPage());

	/* ---- The creator writes it ---- */
	await creator.goto('/dashboard/blog');
	await creator.getByRole('button', { name: 'New blog' }).click();
	await creator.getByRole('dialog').locator('input[name="title"]').fill(TITLE);
	await creator.getByRole('dialog').getByRole('button', { name: 'Add' }).click();

	/* Creating redirects into the editor for the new post. */
	await expect(creator).toHaveURL(/\/dashboard\/blog\/\d+/, { timeout: 15_000 });

	/* The body is a contenteditable mirrored into a hidden input, so typing into
	   it is the only thing that ever writes the field the form posts. */
	await creator.locator('.ProseMirror').click();
	await creator.keyboard.type('An article written by a creator, for the approval queue.');

	await creator.getByRole('button', { name: 'Send for review' }).click();
	await expect(creator.getByText(/waiting for an editor/i)).toBeVisible({ timeout: 15_000 });

	/* ---- It is nobody else's yet ---- */
	await reader.goto('/blog');
	await expect(reader.getByText(TITLE)).toHaveCount(0);
	await reader.goto(CREATOR_PROFILE);
	await expect(reader.getByText(TITLE)).toHaveCount(0);

	/* ---- The operator decides ---- */
	const operator = await signedInAs(browser, OPERATOR);
	await operator.goto('/dashboard/admin/blog/approvals');
	await expect(card(operator)).toHaveCount(1, { timeout: 15_000 });
	await card(operator).getByRole('button', { name: 'Publish' }).click();
	await expect(card(operator)).toHaveCount(0, { timeout: 15_000 });

	/* ---- Now a reader may have it ---- */
	await reader.goto('/blog');
	await expect(reader.getByText(TITLE).first()).toBeVisible({ timeout: 15_000 });
	await reader.goto(CREATOR_PROFILE);
	await expect(reader.getByText(TITLE).first()).toBeVisible({ timeout: 15_000 });

	/* ---- And editing it again takes it straight back off ---- */
	await creator.reload();
	await creator.locator('input[name="title"]').fill(`${TITLE} (revised)`);
	await creator.getByRole('button', { name: 'Save and send for review' }).click();
	await expect(creator.getByText(/waiting for an editor/i)).toBeVisible({ timeout: 15_000 });

	await reader.goto('/blog');
	await expect(reader.getByText(TITLE)).toHaveCount(0);

	/* ---- Put the database back ---- */
	await creator.goto('/dashboard/blog');
	/* The row's only `button` is the delete trigger; the view and edit controls
	   beside it are links. */
	await card(creator).locator('button').click();
	await creator.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
	await expect(creator.getByText(TITLE)).toHaveCount(0, { timeout: 15_000 });
});
