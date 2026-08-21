import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests run against a production build, not the dev server.
 *
 * The two differ in ways these tests are meant to catch: the CSP is generated
 * at build time, adapter-node checks the Origin on every form POST, and
 * prerendering only happens in a build.
 */
export default defineConfig({
	testDir: 'e2e',
	testMatch: '**/*.e2e.{ts,js}',

	/* A test that only passes sometimes is worse than no test. */
	forbidOnly: Boolean(process.env.CI),
	retries: process.env.CI ? 1 : 0,
	reporter: process.env.CI ? [['html'], ['github']] : 'list',

	use: {
		baseURL: 'http://localhost:4173',
		trace: 'on-first-retry'
	},

	projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],

	webServer: {
		command: 'npm run build && npm run preview',
		port: 4173,
		reuseExistingServer: !process.env.CI,
		timeout: 180_000
	}
});
