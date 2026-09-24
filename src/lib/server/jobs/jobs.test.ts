import { describe, expect, it } from 'vitest';
import { JOB_NAMES, isJobName } from './index';
import { outOfTime } from './types';

describe('the job registry', () => {
	it('recognises every job it lists, and nothing else', () => {
		for (const name of JOB_NAMES) expect(isJobName(name)).toBe(true);
		expect(isJobName('verify-socials ')).toBe(false);
		expect(isJobName('../../etc/passwd')).toBe(false);
		expect(isJobName('')).toBe(false);
	});
});

describe('the time budget', () => {
	it('is spent once the budget has passed', () => {
		expect(outOfTime(Date.now(), 50_000)).toBe(false);
		expect(outOfTime(Date.now() - 60_000, 50_000)).toBe(true);
	});

	/* A job called without a budget runs to the end of its queue — which is
	   what the command-line wrappers want, and what cron must never get. */
	it('never expires without a budget', () => {
		expect(outOfTime(0, undefined)).toBe(false);
		expect(outOfTime(0, 0)).toBe(false);
	});
});
