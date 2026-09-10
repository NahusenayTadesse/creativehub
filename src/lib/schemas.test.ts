import { describe, it, expect } from 'vitest';
import {
	creatorAdd,
	creatorSelfEdit,
	gallerySlideEdit,
	inviteAccept,
	staffInvite
} from './schemas';

/**
 * The picture columns, which hold three unrelated kinds of value.
 *
 * A column like `creators.avatar` is written by a file picker, by an import
 * that stores a downloaded copy, and historically by someone pasting a link —
 * so it has to accept a `File`, the bare name an upload was stored under, and a
 * URL, while still rejecting the things that would render as a broken image.
 *
 * The bare-name case is the one that regressed: these fields used to validate
 * as URLs, which rejected the very name `saveUploadedFile` had just returned.
 */

const base = {
	username: 'kmoneyinethiopia',
	fullName: 'K Money',
	countryId: 1,
	primaryPlatformId: 1
};

const avatarOf = (value: unknown) => creatorAdd.safeParse({ ...base, avatar: value });

describe('creator picture columns', () => {
	it('accepts a picked file', () => {
		const file = new File([new Uint8Array([0xff, 0xd8, 0xff])], 'me.jpg', { type: 'image/jpeg' });
		const result = avatarOf(file);
		expect(result.success).toBe(true);
		expect(result.data?.avatar).toBeInstanceOf(File);
	});

	it('accepts the bare name an upload is stored under', () => {
		expect(avatarOf('kmoneyinethiopia-avatar.jpg').success).toBe(true);
		expect(avatarOf('550e8400-e29b-41d4-a716-446655440000.webp').success).toBe(true);
	});

	it('accepts a private upload, which is stored with its directory prefix', () => {
		expect(avatarOf('private/passport.pdf').success).toBe(true);
	});

	it('accepts a link and a site-relative path', () => {
		expect(avatarOf('https://unavatar.io/tiktok/kmoney').success).toBe(true);
		expect(avatarOf('/files/kmoneyinethiopia-avatar.jpg').success).toBe(true);
	});

	it('accepts an empty value — most creators have no picture', () => {
		expect(avatarOf('').success).toBe(true);
		expect(creatorAdd.safeParse(base).success).toBe(true);
	});

	it('rejects a scheme that is not a link, which would render as nothing', () => {
		expect(avatarOf('javascript:alert(1)').success).toBe(false);
		expect(avatarOf('ftp://example.test/a.jpg').success).toBe(false);
	});

	it('rejects a value too long for the column', () => {
		expect(avatarOf(`https://example.test/${'a'.repeat(500)}.jpg`).success).toBe(false);
	});

	it('holds for the cover, for a creator editing their own profile, and for a slide', () => {
		const file = new File([new Uint8Array([0xff, 0xd8, 0xff])], 'c.jpg', { type: 'image/jpeg' });
		expect(creatorAdd.safeParse({ ...base, cover: 'k-cover.jpg' }).success).toBe(true);
		expect(
			creatorSelfEdit.safeParse({ id: 1, fullName: 'K Money', avatar: file, cover: 'k-cover.jpg' })
				.success
		).toBe(true);
		expect(gallerySlideEdit.safeParse({ id: 1, title: 'Hero', image: 'hero.webp' }).success).toBe(
			true
		);
	});
});

/**
 * Staff invitations.
 *
 * The role field is the interesting one. It is the only place in the app where
 * an `admin` account can be brought into existence, so what it refuses matters
 * as much as what it accepts: an invitation that could mint a creator or a
 * brand would be a second sign-up form, one that skips the profile step and
 * arrives pre-trusted.
 */
describe('staff invitations', () => {
	it('accepts the two roles nobody may claim for themselves', () => {
		expect(staffInvite.safeParse({ email: 'ops@example.test', role: 'admin' }).success).toBe(true);
		expect(staffInvite.safeParse({ email: 'ops@example.test', role: 'encoder' }).success).toBe(
			true
		);
	});

	it('refuses the two that sign themselves up', () => {
		expect(staffInvite.safeParse({ email: 'ops@example.test', role: 'creator' }).success).toBe(
			false
		);
		expect(staffInvite.safeParse({ email: 'ops@example.test', role: 'business' }).success).toBe(
			false
		);
	});

	it('refuses an address that is not one', () => {
		expect(staffInvite.safeParse({ email: 'ops', role: 'admin' }).success).toBe(false);
	});

	it("carries no address or role on the accepting side — both are the invitation's", () => {
		const accepted = inviteAccept.safeParse({
			name: 'Sara T',
			password: 'a-long-enough-one',
			confirm: 'a-long-enough-one',
			email: 'someone-else@example.test',
			role: 'admin'
		});
		expect(accepted.success).toBe(true);
		expect(accepted.success && accepted.data).toEqual({
			name: 'Sara T',
			password: 'a-long-enough-one',
			confirm: 'a-long-enough-one'
		});
	});

	it('refuses a password that was typed twice and differently', () => {
		expect(
			inviteAccept.safeParse({ name: 'Sara T', password: 'first-password', confirm: 'second-one' })
				.success
		).toBe(false);
	});

	it('refuses a password shorter than the account will demand at sign-in', () => {
		expect(
			inviteAccept.safeParse({ name: 'Sara T', password: 'short', confirm: 'short' }).success
		).toBe(false);
	});
});
