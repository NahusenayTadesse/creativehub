# Bug hunt — the server-side query layer

Read-only audit of the change that moved every listing onto one query builder
(`server-side-query-builder`, commit `a9da173`). Nothing was changed.

Two passes fed this: a manual hunt driven by probing the running app, and an
independent `/code-review` over the diff. They agreed on H1, H2, M2 and M3
without seeing each other's work, which is the main reason to trust those four.
Everything below is marked **reproduced** (I triggered it on the seeded database)
or **latent** (read from the code, with the condition it needs to fire stated).

Findings are ordered by severity. Each names the file and line, what actually goes
wrong, how it is reached, and the shape of the fix.

---

## High

### H1. Every list in the app returns 500 for `?sort=__proto__`

**File:** `src/lib/server/query.ts:295`

```ts
const sortKey = requestedSort in sort ? requestedSort : defaultSort;
```

`sort` is a plain object literal, so `in` also answers `true` for everything it
inherits from `Object.prototype`. `?sort=__proto__` passes the whitelist, and
`sortColumn(sort['__proto__'])` hands `Object.prototype` to Drizzle's `desc()`:

```
TypeError: Cannot read properties of null (reading 'constructor')
    at desc (drizzle-orm/sql/expressions/select.js:6:13)
    at orderFor (src/lib/server/query.ts:342:20)
    at listCreators (src/lib/server/queries.ts:225:23)
```

**Reached from:** every paginated surface, including the two that need no session.

```
500  /discover?sort=__proto__          ← public
500  /campaigns?sort=__proto__         ← public
500  /dashboard/bookings               500  /dashboard/applications
500  /dashboard/reviews                500  /dashboard/admin/audit
500  /dashboard/admin/users            500  /dashboard/admin/verification
500  /dashboard/admin/countries        500  /dashboard/admin/creators
500  /dashboard/campaigns
```

`?sort=constructor`, `toString`, `valueOf` and `hasOwnProperty` also pass the
whitelist. They happen to return 200 today only because `sortColumn` reads
`'column' in spec` on a function and Drizzle survives it — the guard is not doing
the job either way.

Nothing leaks and nothing is written; this is an error page anyone can produce on
a public URL, on demand, at zero cost.

**Fix shape:** `Object.hasOwn(sort, requestedSort)`. The whole point of that line
is "a key this definition actually declared", and `in` does not say that.

---

### H2. `?tab=constructor` throws before any query runs

**File:** `src/lib/server/query.ts:226`

```ts
const members = filter.groups[raw[0]];
if (!members) return { values: [] };
if (!members.length) return { values: [raw[0]] };
return { values: [raw[0]], condition: inArray(filter.column, [...members]) };
```

Same root cause on a different lookup. `groups['constructor']` is `Object`, which
is truthy, so the `!members` guard lets it through; `members.length` is the
function's arity (`1`), so the "all" branch is skipped too; then `[...members]`
spreads a function:

```
TypeError: members is not iterable
    at buildFilter (src/lib/server/query.ts:231:69)
```

**Reached from:** `GET /dashboard/bookings?tab=constructor` → 500. Confirmed.

`?tab=toString` is the quieter half of the same hole: `toString` has arity 0, so
`members.length` is `0` and the code reads it as the "all" tab. The filter is
silently dropped while `state.filters.tab` is still set — confirmed, the page
returns `All (220)` / `Showing 1 – 24 of 220` for a tab that does not exist.

The `enum` and `enums` filters are unaffected — they check membership against an
**array** with `.includes`, which has no inherited keys. That contrast is the
argument for the fix.

**Fix shape:** `Object.hasOwn(filter.groups, raw[0])` before the lookup.

---

## Medium

### M1. "All markets" shows a market-filtered count

**File:** `src/routes/(public)/campaigns/+page.svelte:23`, used at `:78` and `:157`

```ts
const totalBriefs = $derived(Object.values(data.typeCounts).reduce((sum, n) => sum + n, 0));
```

`typeCounts` is `campaignFacet(url, 'type')`, which excludes **only** the `type`
filter — `market` and `q` are still applied. Summing it therefore gives "briefs
matching the current market", and the page prints that number on the chip whose
whole meaning is _no market filter_:

```
/campaigns            → "All markets (5)"   ✅
/campaigns?market=3   → "All markets (2)"   ❌ should still be 5
/campaigns?market=6   → "All markets (1)"   ❌
```

The same number feeds the "N briefs live" tile, where it is defensible — that tile
sits above the compensation-type chips, so a market-scoped total is arguably what
a reader expects there.

The equivalent on discovery is **correct**: the country chips read
`creatorFacet(url, 'country')`, which excludes the country filter, so each chip
counts what picking it would give.

**Fix shape:** the "all markets" chip needs its own facet — `campaignFacet(url,
'market')` summed, or a second count with the market condition dropped. It cannot
be derived from the type facet.

---

### M2. A region filter survives the control that sets it

**File:** `src/routes/(public)/discover/+page.svelte:57`, `:250`

The Ethiopian-region select only renders while Ethiopia is in scope:

```svelte
{#if ethiopiaActive && visibleRegions.length}
```

but the country chips build their link with `withParams(page.url, { country: … })`,
which preserves every other parameter — including `region`. Select a non-Ethiopian
market while a region is set and the filter keeps applying from a control that is
no longer on screen:

```
/discover?region=1            → 6 creators
/discover?region=1&country=3  → 0 creators, and no region select is rendered
```

The reader sees an empty result with no visible cause and no way to clear it short
of Reset. The old client-side code did not have this: `toggleCountry` set
`regionId = 'all'` whenever Ethiopia left scope. Moving the filter into the URL
dropped that coupling.

**Fix shape:** clear `region` in the chip's link when the toggle would take
Ethiopia out of scope — the dependency between the two controls has to be
expressed in the link now that the link is the state.

---

### M3. Ranked results run out before the pager does — _latent_

**File:** `src/lib/server/query.ts:366`

```ts
const ranked = (await decorate(raw)).sort(…);        // at most `limit` rows
const pageCount = Math.max(1, Math.ceil(total / perPage));   // from the true total
const slice = ranked.slice((page - 1) * perPage, page * perPage);
```

`pageCount` is derived from the full `COUNT(*)`, but `ranked` holds at most
`limit` rows (500). With 24 per page the ranked order runs out during page 21;
pages 22 and beyond slice past the end and return `[]`, while `hasNext` — also
computed from `pageCount` — keeps offering another page. `finish` then prints
`to = from + 0 - 1`, i.e. **"Showing 577 – 576 of 1000"** above an empty grid.

**Not reproducible on this data** — it needs more than 500 published creators
matching the filters, and there are 14. It fires the first time discovery is
sorted by match on a real catalogue.

**Fix shape:** when ranking, page within what was actually ranked —
`Math.ceil(Math.min(total, ranked.length) / perPage)` — and keep reporting the
true `total` alongside `rankedWithin`, which already exists to say the order below
the cut is not the ranker's.

---

### M4. `?page=1e21` is a 500 — _reproduced_

**File:** `src/lib/server/query.ts:184`

```ts
const parsed = Number(trimmed);
return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
```

`Number.isFinite(1e21)` is true, so the value survives, and `page` is the one
numeric parameter with no upper clamp — `perPage` is bounded by `maxPerPage`, so
`?per=1e21` harmlessly becomes 100. The offset is then `(1e21 - 1) * 24`, which
`String()` renders in exponent form, and mysql2 puts `2.4e+22` into the SQL:

```
500  /discover?page=1e21
200  /discover?page=1e9                  ← still an integer when stringified
200  /discover?page=9007199254740993     ← past MAX_SAFE_INTEGER, still fine
200  /discover?per=1e21                  ← clamped to 100
```

So the trigger is precisely "large enough that JS switches to exponent
notation", which is `1e21`.

**Fix shape:** `Number.isSafeInteger` in `readInt`, and cap `page` the way
`perPage` is already capped — the offset is bounded by the count anyway, and the
past-the-end recovery at `:401` will land the reader on the last page.

---

### M5. The users listing can render a row twice while the total counts it once — _latent_

**File:** `src/lib/server/queries.ts:950`

```ts
countColumn: t.user.id,   // an account can own more than one organisation
```

That comment is right about the count and silent about the rows. The page query
has no `DISTINCT`, so the `leftJoin` to `organizations` renders an account once
per organisation it owns while `countDistinct` counts it once. Three accounts
where one owns two organisations gives four rows over a total of three —
**"Showing 1 – 4 of 3"**, with a duplicate in the table.

**Latent:** `organizations_owner_idx` is a plain index, not unique, so nothing in
the schema prevents it — but no seeded account owns two organisations today
(`select owner_id, count(*) … having count(*) > 1` → 0 rows).

**Fix shape:** the join only exists to print one organisation name. Either
aggregate it (`group by user.id` with `min(organizations.name)`) or fetch the
names for the page separately, the way `hydrateCreatorCards` already does.

---

## Low

### L1. "Showing 0 – 0 of 0" above a "No results" panel

**File:** `src/lib/components/crud-section.svelte:102`

The toolbar renders whenever `list.total > 0 || list.state.search`, so an empty
search shows the range line and the empty state together:

```
/dashboard/admin/countries?q=zzzznope
    toolbar:     "Showing 0 – 0 of 0"
    empty state: "No results — Nothing here matches “zzzznope”."
```

**Fix shape:** show the range only when `list.total > 0`; the search box itself
still needs the wider condition so it can be cleared.

---

### L2. Invalid filter values mean two different things

**File:** `src/lib/server/query.ts:187` (`buildFilter`), `queries.ts:187`

An unrecognised value is dropped by `enum`/`enums`, but passed through by
`number` and by the `category` `custom` filter, so the same class of bad input
produces opposite results:

```
/discover?verification=nonsense → 14 creators (filter dropped)
/discover?category=nonsense     →  0 creators (filter applied, matches nothing)
/discover?region=99999          →  0 creators (filter applied, matches nothing)
```

Both readings are defensible — a nonexistent id _is_ a filter matching nothing —
but a stale bookmark to a renamed category slug now shows "no creators match your
filters" rather than the catalogue, and nothing on the page says which filter did
it. Worth deciding once and applying to every type.

---

### L3. `facet()` on a `custom` filter counts something the filter does not

**File:** `src/lib/server/query.ts:412`, definition at `queries.ts:525`

`facet` groups by the filter's `column`. For every declared filter that is what the
filter matches on — except `custom`, where `column` is only a hint. The campaigns
`market` filter is the live example: it matches on `countryId = ?` **or**
`countryId IS NULL` **or** the country's name inside `targetRegions`, while a facet
over it would count exact `countryId` matches only. Of the six seeded campaigns,
one has a null country and four target countries they are not filed under, so the
two would disagree on every row but one.

**Latent** — nothing calls `facet(url, 'market')` today. It is a trap laid for the
next person who adds counts to those chips.

**Fix shape:** either drop `column` from the `custom` variant so faceting is not
offered where it cannot be honest, or have `facet` refuse a `custom` filter
explicitly rather than quietly counting the wrong thing.

---

### L4. Accounts with a NULL role appear only under "All" — _latent_

**File:** `src/lib/server/queries.ts:959`, schema at `auth.schema.ts:15`

`role` is `text('role').default('creator')` — nullable. The code this replaced
normalised with `(user.role ?? 'creator')`; the `enum` filter now emits
`eq(role, 'creator')`, which never matches NULL, and `facet` skips NULL group
keys. Such an account is reachable only from the "All" tab, and `countFor('all')`
— a sum over the facet — under-reports it against `data.users.total`.

**Latent:** no NULL roles in this database (`select count(*) … where role is
null` → 0), because sign-up always sets one. A row created outside the app, or an
older migration, would surface it.

---

### L5. A late response can eat what is being typed

**File:** `src/lib/components/search-input.svelte:36`

```ts
$effect(() => {
	const accepted = value;
	if (accepted !== undefined) draft = null;
});
```

The draft is dropped whenever _any_ new `value` arrives, including the response to
a search that is already two keystrokes stale. Type `abc`, let the 300 ms debounce
fire, keep typing `def`; when the page for `abc` lands, `value` changes, `draft`
is cleared, and the controlled input snaps back to `abc` — losing `def` and moving
the caret.

**Fix shape:** remember what was last submitted and clear the draft only when the
arriving `value` matches it.

---

### L6. The comment promises a no-JS fallback that does not exist

**File:** `src/lib/components/search-input.svelte:17`

> It also works with scripting off: the surrounding `<form method="GET">` submits
> the same parameter this would have set.

There is no surrounding form. All ten call sites drop `<SearchInput>` straight
into a `<div>`, so with scripting off the box does nothing at all.

In a codebase where the comments carry the reasoning, one that describes
behaviour the code does not have is worse than no comment. Either wrap the input
in a `<form method="GET">` — which is a genuinely small change and would make the
claim true — or delete the sentence.

---

### L7. Discovery loads the reference data twice

**File:** `src/routes/(public)/discover/+page.server.ts:16`

`src/routes/+layout.server.ts:10` already calls `getReferenceData()` for every
page. The new discover load calls it again for the category slugs behind the
adjacency map, adding five queries to the busiest public route. (The "cached per
request" comment at `queries.ts:30` describes an intention, not a mechanism —
nothing memoises it.)

**Fix shape:** take it from `await parent()`.

---

### L8. Two constants declared and never used

**File:** `src/lib/server/queries.ts:1054`

```ts
const CLOSED_BOOKINGS = ['completed', 'cancelled'] as const;
const AWAITING_PAYOUT = ['approved', 'awaiting_settlement'] as const;
```

`getOrganizationTotals` and `getCreatorTotals` inline the same literals inside
their `sql` templates instead. Two statements of the same rule that cannot be
checked against each other — either interpolate the constants or delete them.

---

## What holds up

Checked, and sound:

- **Paging is stable under ties and nulls.** Six pages of ten, sorted by `price`
  (heavily tied) and by the nullable `deadline`: 60 rows collected, 60 distinct,
  nothing repeated or skipped. The `tiebreaker` is doing its job.
- **Input reaching SQL is parameterised and escaped.** `o'brien`, `%' or '1'='1`,
  `\`, `a"b`, `'; drop table creators; --` and Amharic text all return 0–n results
  with no error and no damage; `creators` still has its 14 rows. `%` and `_` are
  escaped, so `?q=%` finds nothing rather than everything.
- **Scope holds per role.** Of 220 bookings the operator sees 220, Ethio Telecom
  45, Abel 22 — and a user who is neither creator nor organisation gets `1 = 0`
  rather than an `and()` that drops an undefined predicate.
- **Bounds are enforced.** `?per=99999` clamps to 100; `?page=999` re-reads the
  last page (`217 – 220 of 220`) instead of showing an empty one.
- **Facet counts partition correctly.** The five booking tabs cover all eleven
  states, and `All (220)` equals their sum; the counts follow the search
  (`?q=telebirr` → `All (2)`).
- **Every managed table has a searchable column,** so no `contentCrud` page shows
  a search box that silently does nothing.
- **Nothing widens a scope.** Both passes traced `bookingScope`,
  `applicationScope` and the reviews predicate: all fall through to `sql\`1 = 0\``for a user who is neither creator nor organisation, and no query-string filter
can reach the caller's`where`.
- **No stale callers** of the reshaped `listCreators` / `listCampaigns` /
  `listBookings` / `listApplications` remain, every new message key exists in both
  `en.json` and `am.json`, and `calculateMatch` still calls `m.*()` inside the
  function body now that it runs on the server.
