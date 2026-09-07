import { describe, it, expect } from 'vitest';
import { normaliseHandle, profileUrlFor } from './social-link';

describe('normaliseHandle', () => {
	it('strips the decoration people type around a handle', () => {
		expect(normaliseHandle('@KmoneyinEthiopia')).toBe('KmoneyinEthiopia');
		expect(normaliseHandle('  natgeo  ')).toBe('natgeo');
		expect(normaliseHandle('natgeo/')).toBe('natgeo');
		expect(normaliseHandle('')).toBe('');
	});

	/* The field says "handle" and people paste the address bar into it, which
	   used to be stored verbatim — and a stored URL is a handle nothing can look
	   up at the platform. */
	it('takes the handle out of a pasted profile address', () => {
		expect(normaliseHandle('https://www.tiktok.com/@napiofficial27')).toBe('napiofficial27');
		expect(normaliseHandle('https://www.instagram.com/natgeo/')).toBe('natgeo');
		expect(normaliseHandle('https://www.youtube.com/@NASA')).toBe('NASA');
		expect(normaliseHandle('https://t.me/telegram')).toBe('telegram');
		expect(normaliseHandle('https://www.linkedin.com/in/someone')).toBe('someone');
	});

	it('leaves something that only looks like a URL alone', () => {
		expect(normaliseHandle('https://')).toBe('');
		expect(normaliseHandle('not a url')).toBe('not a url');
	});
});

describe('profileUrlFor', () => {
	it('builds the address for the platforms with one unambiguous shape', () => {
		expect(profileUrlFor('Instagram', '@nuruvazi01')).toBe('https://www.instagram.com/nuruvazi01/');
		expect(profileUrlFor('TikTok', 'napiofficial27')).toBe(
			'https://www.tiktok.com/@napiofficial27'
		);
		expect(profileUrlFor('YouTube', 'NURUVAZI')).toBe('https://www.youtube.com/@NURUVAZI');
		expect(profileUrlFor('Telegram', 'somechannel')).toBe('https://t.me/somechannel');
		expect(profileUrlFor('LinkedIn', 'someone')).toBe('https://www.linkedin.com/in/someone');
	});

	/* `platforms.name` is an editable row, so a renamed "TIKTOK" must not
	   silently stop producing links. */
	it('matches the platform name whatever its case', () => {
		expect(profileUrlFor('tiktok', 'napi')).toBe('https://www.tiktok.com/@napi');
		expect(profileUrlFor('  YouTube  ', 'napi')).toBe('https://www.youtube.com/@napi');
	});

	it('treats X and Twitter as the same place', () => {
		expect(profileUrlFor('X', 'nasa')).toBe('https://x.com/nasa');
		expect(profileUrlFor('Twitter', 'nasa')).toBe('https://x.com/nasa');
	});

	it('returns null rather than guessing', () => {
		expect(profileUrlFor('Snapchat', 'maimaher777')).toBeNull();
		expect(profileUrlFor('TikTok', '  ')).toBeNull();
	});

	it('accepts a pasted address and rebuilds it canonically', () => {
		expect(profileUrlFor('TikTok', 'https://www.tiktok.com/@napi')).toBe(
			'https://www.tiktok.com/@napi'
		);
	});
});
