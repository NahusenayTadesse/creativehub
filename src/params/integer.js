/**
 * A route segment that is a plain positive integer.
 *
 * `/dashboard/admin/blog/[id=integer]` sits beside `/dashboard/admin/blog/upload`
 * and `/dashboard/admin/blog/categories`. SvelteKit does prefer a static
 * segment to a dynamic one, so those two would win the match either way — but
 * only by a precedence rule, and a typo'd URL would otherwise reach the editor
 * and be answered with a database lookup for `NaN` rather than a 404.
 *
 * @param {string} param
 * @returns {boolean}
 */
export function match(param) {
	return /^[1-9][0-9]{0,9}$/.test(param);
}
