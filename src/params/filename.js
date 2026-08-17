/** @type {import('@sveltejs/kit').ParamMatcher} */
export function match(value) {
	return /^[^/]+$/.test(value); // any non-slash string, including dots
}
