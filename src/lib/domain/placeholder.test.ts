import { describe, it, expect } from 'vitest';
import { initialsOf, placeholderImage } from './placeholder';

/** Decodes a data URI back to the SVG it carries. */
const svgOf = (uri: string) => decodeURIComponent(uri.replace('data:image/svg+xml,', ''));

describe('initialsOf', () => {
	it('takes the first and last word', () => {
		expect(initialsOf('Kwame Accra Eats')).toBe('KE');
		expect(initialsOf('Wangari Maina')).toBe('WM');
	});

	it('takes two letters from a single word', () => {
		expect(initialsOf('Freedom')).toBe('FR');
		expect(initialsOf('K')).toBe('K');
	});

	it('ignores the punctuation a handle carries', () => {
		expect(initialsOf('@ifys.kitchen')).toBe('IK');
		expect(initialsOf('Elshaday Wubetu (Sheger Gebeta)')).toBe('EG');
	});

	it('has something to draw for an empty label', () => {
		expect(initialsOf('')).toBe('·');
		expect(initialsOf('   ')).toBe('·');
	});
});

describe('placeholderImage', () => {
	it('returns an inline SVG data URI, which the CSP allows', () => {
		const uri = placeholderImage('avatar', 'ctrldenise', 'Denise');
		expect(uri.startsWith('data:image/svg+xml,')).toBe(true);
		expect(svgOf(uri)).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
	});

	it('draws the initials for the kinds that carry a label', () => {
		expect(svgOf(placeholderImage('avatar', 'seed', 'Wangari Maina'))).toContain('>WM<');
		expect(svgOf(placeholderImage('logo', 'seed', 'Ethio Telecom'))).toContain('>ET<');
	});

	it('is stable for a seed, so a creator keeps one colour everywhere', () => {
		expect(placeholderImage('avatar', 'ctrldenise', 'Denise')).toBe(
			placeholderImage('avatar', 'ctrldenise', 'Denise')
		);
	});

	it('gives different seeds different colours', () => {
		const a = placeholderImage('cover', 'kmoneyinethiopia');
		const b = placeholderImage('cover', 'ctrldenise');
		expect(a).not.toBe(b);
	});

	it('draws artwork rather than text for the wide kinds', () => {
		expect(svgOf(placeholderImage('cover', 'seed'))).toContain('linearGradient');
		expect(svgOf(placeholderImage('media', 'seed'))).not.toContain('<text');
	});

	it('never emits a raw quote or angle bracket that would break an attribute', () => {
		const uri = placeholderImage('avatar', 'seed', 'Mai "Maher" <script>');
		expect(uri).not.toMatch(/["'<>]/);
	});

	it('still produces something when it is given nothing', () => {
		expect(placeholderImage('avatar', '', '').startsWith('data:image/svg+xml,')).toBe(true);
	});
});
