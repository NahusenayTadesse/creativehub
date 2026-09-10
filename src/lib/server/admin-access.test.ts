import { describe, it, expect } from 'vitest';
import { adminPluginRoles, banOnly } from './admin-access';
import { ROLES } from '$lib/roles';

/**
 * The grant handed to better-auth's admin plugin is the only thing standing
 * between an operator's session and `/api/auth/admin/delete-user`, and it is
 * one line of configuration — exactly the kind of line that gets widened by
 * accident. These assertions are what would fail if it were.
 */
describe('the admin plugin grant', () => {
	it('lets an operator ban and unban', () => {
		expect(banOnly.authorize({ user: ['ban'] }).success).toBe(true);
	});

	it.each([
		['delete an account', { user: ['delete'] as const }],
		['create one', { user: ['create'] as const }],
		['set somebody else’s password', { user: ['set-password'] as const }],
		['change somebody else’s email', { user: ['set-email'] as const }],
		['sign in as somebody else', { user: ['impersonate'] as const }],
		['set a role', { user: ['set-role'] as const }],
		['list every account', { user: ['list'] as const }],
		['revoke a session', { session: ['revoke'] as const }]
	])('does not let an operator %s', (_label, permission) => {
		expect(banOnly.authorize(permission).success).toBe(false);
	});

	it('refuses a ban asked for alongside anything else', () => {
		expect(banOnly.authorize({ user: ['ban', 'delete'] }).success).toBe(false);
	});

	/* Every other role reaches the plugin with no entry in the map at all, and
	   `hasPermission` treats an unknown role as holding nothing. A role added to
	   $lib/roles tomorrow is therefore refused until somebody names it here. */
	it('names no role but the operator', () => {
		expect(Object.keys(adminPluginRoles)).toEqual(['admin']);
		for (const role of ROLES) {
			if (role === 'admin') continue;
			expect(Object.hasOwn(adminPluginRoles, role)).toBe(false);
		}
	});
});
