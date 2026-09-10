/**
 * Access roles. A user holds exactly one at a time; organisation permissions are
 * layered on top through `organizationMembers`, never through this field alone.
 *
 * The list lives here rather than beside the auth config because the role of the
 * signed-in account is read on both sides of the wire — the sign-up schema, the
 * users listing's filter and the sidebar all need the same set of names, and a
 * server-only module cannot give it to the two of them that run in the browser.
 *
 * `encoder` is a data-entry account: it reaches the reference tables under
 * /dashboard/admin and nothing else. What it may open is `ENCODER_PAGES` in
 * $lib/server/guards, which is the allowlist the admin layout enforces.
 */
export const ROLES = ['creator', 'business', 'encoder', 'admin'] as const;
export type Role = (typeof ROLES)[number];

/**
 * The roles that are handed out by invitation rather than claimed.
 *
 * A creator or a brand signs itself up; nobody signs themselves up as staff. An
 * operator names the address and the role, the invite mail carries the only
 * link that can produce the account, and these two are the whole of what that
 * link may create — the invite form, the invite schema and the accept page all
 * read the list from here so none of them can offer a role the others refuse.
 */
export const STAFF_ROLES = ['encoder', 'admin'] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];
