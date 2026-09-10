import { defaultStatements } from 'better-auth/plugins/admin/access';
import { createAccessControl } from 'better-auth/plugins/access';

/**
 * What an operator may do through better-auth's admin plugin.
 *
 * The plugin ships a whole cabinet of endpoints under `/api/auth/admin/*` —
 * create an account, delete one, set somebody's password, impersonate them —
 * and its stock `admin` role holds the key to all of them. Mounting the plugin
 * for its ban feature would therefore also mount the rest, reachable by any
 * operator with a session and a `curl`, with no page in this app ever offering
 * them and so nothing here to notice they were used.
 *
 * So the role is redefined against the plugin's own statement list, holding one
 * permission. `banUser` and `unbanUser` ask for `user: ['ban']` and are allowed;
 * every other endpoint asks for something outside the grant and is refused at
 * the door with 403, for operators included. Roles absent from `adminRoles`
 * below — creator, business, encoder — match nothing and are refused the same
 * way, which is the direction that fails safely when a role is added tomorrow.
 *
 * It lives apart from `auth.ts` so it can be read without a request behind it:
 * that file reaches for `$env` and `$app/server` and cannot be loaded by a test.
 *
 * Widening this is a deliberate act: add the statement here, and the endpoint
 * starts answering.
 */
const ac = createAccessControl(defaultStatements);

export const banOnly = ac.newRole({ user: ['ban'] });

/** The roles the plugin is configured with, keyed by the names in $lib/roles. */
export const adminPluginRoles = { admin: banOnly };
