# Creator Network

A two-sided marketplace connecting organisations — brands, agencies, NGOs and event
organisers — with content creators across Ethiopia and the wider Pan-African market.
It covers the full collaboration lifecycle: discovery, negotiation, agreed terms,
delivery, review and settlement.

Built with SvelteKit 2, Svelte 5 (runes), Drizzle ORM on MySQL/MariaDB, better-auth,
sveltekit-superforms with Zod 4, Tailwind 4 and shadcn-svelte.

## Getting started

```bash
npm install
cp .env.example .env        # then fill in DATABASE_URL, ORIGIN, BETTER_AUTH_SECRET
npm run db:push             # create the tables
npm run db:seed             # reference data, 14 creators, 5 organisations, 6 campaigns
npm run dev
```

### Signing in

`npm run db:seed` creates an operator, five organisations and fourteen creators.
Their addresses and the shared password are in **`ACCOUNTS.md`**, which is
git-ignored and deliberately not referenced anywhere in the interface.

`npm run db:seed` is idempotent — rows are matched on their natural key, so
re-running it after correcting the seed updates in place rather than duplicating.

## How it is put together

```
src/lib/
  domain/          Pure logic, safe on client and server
    booking.ts       Lifecycle states and the legal transitions between them
    match.ts         Deterministic 5-factor campaign ↔ creator fit score
    score.ts         The 0–100 creator score, derived from evidence only
    trending.ts      The trending ranking as arithmetic — weights, decay, order
    money.ts         Currency conversion through the rate on `countries`
    mask.ts          Contact masking for deal conversations
  server/
    crud.ts          Generic add/edit/delete for any content table
    guards.ts        requireUser / requireRole / requireBookingAccess + audit
    query.ts         The one query builder: search, filter, sort, page, facet
    queries.ts       Every read the app performs, defined against that builder
    score-service.ts Recalculates derived creator fields after a write
    trending-service.ts Gathers the trending signals, publishes the board
    db/schema.ts     34 tables
  schemas.ts       Every Zod schema, shared by forms and actions
```

### One query builder, used everywhere

Every listing in the app is the same query with different columns: a search,
some filters, a sort and a page. `server/query.ts` is that query, written once.
A surface declares what it exposes, and gets back a function that reads a `URL`:

```ts
export const bookingsQuery = defineQuery({
	table: t.bookings,
	columns: bookingColumns,
	joins: bookingJoins, // applied to the page query and the count alike
	search: [t.bookings.title, t.bookings.reference, t.creators.fullName],
	filters: {
		tab: { type: 'group', column: t.bookings.status, groups: BOOKING_TABS },
		escrow: { type: 'enum', column: t.bookings.escrowStatus, values: t.escrowStatusEnum }
	},
	sort: { newest: { column: t.bookings.createdAt, direction: 'desc' } /* … */ },
	defaultSort: 'newest',
	tiebreaker: t.bookings.id
});
```

`?q=telebirr&tab=active&sort=value&dir=desc&page=2` is then the whole state of
the screen, which is what makes a result linkable and the back button correct.
Two rules hold at every call site:

- **Nothing reaches SQL that the definition did not name.** A sort key is looked
  up in a map, a filter value is checked against its column's vocabulary, `q` is
  escaped before it enters a `LIKE`, and the page size is clamped. An
  unrecognised parameter is dropped rather than passed through.
- **Ownership is not a filter.** Conditions deciding _whose_ rows these are come
  from the caller's `where`, derived from the session; filters come from the
  query string. They are separate arguments precisely so a crafted URL cannot
  widen a scope.

```ts
listBookings(url, { role, creatorId: creator?.id, organizationId: organization?.id });
```

`facet(url, key)` counts what each choice of one filter would return, with every
_other_ filter applied — the numbers on a set of tabs, or against each market in
a list of countries. Because the filter excludes itself, the counts stay true
when you are standing on one of them, and summing them gives the unfiltered
total. That is why tabs still know their tallies when their rows are three pages
away.

`hydrate` decorates a page after it has been cut, so the second query that turns
ids into names runs over twenty-four rows rather than the table. `rank` orders by
something SQL cannot compute — the campaign fit score in `domain/match.ts` — by
ranking in the server and paging that order; it is capped, and the result says
where the cap fell rather than pretending it did not.

`contentCrud` builds on the same thing, so every managed table gets a search box
and pages without its route asking for them.

### `crud.ts` does the repetitive work

Most management screens are one call. It returns the three superforms a page
needs plus the rows, and the matching actions:

```ts
export const { load, actions } = contentCrud({
	table: t.countries,
	label: 'Country',
	addSchema: countryAdd,
	editSchema: countryEdit,
	listFields: ['paymentRails'] // one-per-line textarea → JSON array
});
```

`scope` confines the whole surface to one owner's rows, which matters because a
posted id arrives from the client and is never trustworthy on its own:

```ts
contentCrud({
  table: t.packages,
  scope: { column: t.packages.creatorId, key: 'creatorId', value: creator.id },
  afterWrite: () => refreshCreatorScore(creator.id),
  ...
});
```

With a scope set, the owning column filters every read, filters the row an edit
or delete targets, and is stamped onto inserts from the session — so a creator
cannot reach another creator's package by changing the id in the form.

### The lifecycle

```
proposed → negotiating → booked → in_production → submitted ⇄ revision
                                                      ↓
                                        approved → awaiting_settlement → completed
```

Transitions are declared in `domain/booking.ts` and enforced server-side; a client
requests an action and never asserts a state. Three rules are load-bearing:

- **Terms freeze on mutual acceptance.** Accepting the open proposal writes a
  `termsSnapshot` once. Editing a profile, package or brief afterwards cannot
  change a live deal.
- **A revision needs a reason,** and consumes one of the agreed allowance.
- **Completion needs compensation.** A paid booking cannot complete until its
  deposit is recorded.

Every state change appends to `audit_log`: actor, object, from-state, to-state,
reason. Nothing in the app updates or deletes that table.

### Trending is a policy, not a checkbox

`/dashboard/admin/trending` is where an operator decides what "trending" means.
Ten signals — profile score, reach, engagement, recent bookings, applications,
reviews, rating, shortlist saves, newcomer boost and verification — each carry a
weight, and the weights are relative: they are divided by their own sum, so
raising one does not silently steal from the other nine.

```
mode          manual (ticked by hand) · automatic (ranking only) · hybrid (pins, then ranking)
window        activity older than N days is not counted at all
half-life     how fast activity inside that window loses value; 0 counts it flat
comparison    percentile (rank against the pool) or min–max (keep the real distances)
eligibility   floors on score, reach, rating and verification; live channel, availability, activity
fairness      max per category and per country, max days on the board, rest afterwards
overrides     pin, boost or block one creator — each with a reason and an expiry
```

Three properties are deliberate:

- **Preview runs the real ranking.** The preview button posts the unsaved form
  to a dry run of the same function the publish path calls, and writes nothing.
  A preview that ran its own slightly different query would be worse than none.
- **Saving publishes.** Settings that are saved but not applied are the surest
  way to make an algorithm screen untrustworthy — so a save republishes, unless
  the board is frozen.
- **Every slot can be explained.** `trending_entries` stores the contribution of
  each signal to each rank, `trending_runs` stores the settings the run used,
  and `creators.is_trending` is rewritten from the board so the badge on a card
  and the strip on the homepage cannot disagree.

## What is not connected

No payment provider is integrated. Deposits and payouts are **recorded** by an
operator and the interface says so rather than implying money has moved. The
`escrowStatus` column and its UI reflect that record, not a bank transfer.

## Scripts

| Command             | Does                                       |
| ------------------- | ------------------------------------------ |
| `npm run dev`       | Dev server                                 |
| `npm run build`     | Production build (node adapter)            |
| `npm run check`     | svelte-check                               |
| `npm run lint`      | prettier + eslint                          |
| `npm run db:push`   | Sync schema to the database                |
| `npm run db:seed`   | Seed reference data and demonstration rows |
| `npm run db:studio` | Drizzle Studio                             |

# creativehub
