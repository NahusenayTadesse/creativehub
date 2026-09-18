import { describe, expect, it } from 'vitest';
import {
	authorMayEdit,
	authorMaySubmit,
	authorMayWithdraw,
	authorProfile,
	authorSaveUnpublishes,
	awaitingReview,
	isAuthoredExternally,
	statusAfterAuthorSave
} from './blog-post';
import type { BlogStatus } from './blog-post';

const ALL: BlogStatus[] = ['draft', 'pending', 'published', 'archived'];

describe('authorMayEdit', () => {
	it('lets an author work on anything an operator has not shelved', () => {
		expect(authorMayEdit('draft')).toBe(true);
		expect(authorMayEdit('pending')).toBe(true);
		expect(authorMayEdit('published')).toBe(true);
	});

	it('refuses an archived post, which is an operator decision', () => {
		expect(authorMayEdit('archived')).toBe(false);
	});
});

describe('statusAfterAuthorSave', () => {
	it('sends an edited live article back for a decision', () => {
		expect(statusAfterAuthorSave('published')).toBe('pending');
		expect(authorSaveUnpublishes('published')).toBe(true);
	});

	it('leaves every other state where it was', () => {
		for (const status of ['draft', 'pending', 'archived'] as BlogStatus[]) {
			expect(statusAfterAuthorSave(status)).toBe(status);
			expect(authorSaveUnpublishes(status)).toBe(false);
		}
	});

	it('never lets a save reach the public state', () => {
		for (const status of ALL) {
			expect(statusAfterAuthorSave(status)).not.toBe('published');
		}
	});
});

describe('authorMaySubmit', () => {
	it('is the one way out of a draft', () => {
		expect(authorMaySubmit('draft')).toBe(true);
	});

	it('refuses to re-submit something already handed over or decided', () => {
		for (const status of ['pending', 'published', 'archived'] as BlogStatus[]) {
			expect(authorMaySubmit(status)).toBe(false);
		}
	});
});

describe('authorMayWithdraw', () => {
	it('is allowed only while nobody has answered', () => {
		expect(authorMayWithdraw('pending')).toBe(true);
		for (const status of ['draft', 'published', 'archived'] as BlogStatus[]) {
			expect(authorMayWithdraw(status)).toBe(false);
		}
	});
});

describe('awaitingReview', () => {
	it('is what the operator queue selects on', () => {
		expect(awaitingReview('pending')).toBe(true);
		for (const status of ['draft', 'published', 'archived'] as BlogStatus[]) {
			expect(awaitingReview(status)).toBe(false);
		}
	});
});

describe('isAuthoredExternally', () => {
	it('is true for a post filed under a profile', () => {
		expect(isAuthoredExternally({ creatorId: 4 })).toBe(true);
		expect(isAuthoredExternally({ organizationId: 9 })).toBe(true);
	});

	it("is false for an operator's own article", () => {
		expect(isAuthoredExternally({ creatorId: null, organizationId: null })).toBe(false);
		expect(isAuthoredExternally({})).toBe(false);
	});
});

describe('authorProfile', () => {
	it('points a creator post at the creator profile', () => {
		expect(authorProfile({ creatorId: 4, creatorUsername: 'abebe' })).toEqual({
			kind: 'creator',
			href: '/creators/abebe'
		});
	});

	it('points a brand post at the brand page', () => {
		expect(authorProfile({ organizationId: 9, organizationSlug: 'acme' })).toEqual({
			kind: 'organization',
			href: '/brands/acme'
		});
	});

	it('has nowhere to point when the profile is gone', () => {
		/* `on delete set null` on both columns: the piece keeps its byline text
		   and loses its link, rather than linking to a 404. */
		expect(authorProfile({ creatorId: null, creatorUsername: null })).toBeNull();
		expect(authorProfile({ creatorId: 4, creatorUsername: null })).toBeNull();
		expect(authorProfile({})).toBeNull();
	});
});
