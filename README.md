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
    money.ts         Currency conversion through the rate on `countries`
    mask.ts          Contact masking for deal conversations
  server/
    crud.ts          Generic add/edit/delete for any content table
    guards.ts        requireUser / requireRole / requireBookingAccess + audit
    queries.ts       Every read the app performs
    score-service.ts Recalculates derived creator fields after a write
    db/schema.ts     29 tables
  schemas.ts       Every Zod schema, shared by forms and actions
```

### `crud.ts` does the repetitive work

Most management screens are one call. It returns the three superforms a page
needs plus the rows, and the matching actions:

```ts
export const { load, actions } = contentCrud({
  table: t.countries,
  label: 'Country',
  addSchema: countryAdd,
  editSchema: countryEdit,
  listFields: ['paymentRails']   // one-per-line textarea → JSON array
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

## What is not connected

No payment provider is integrated. Deposits and payouts are **recorded** by an
operator and the interface says so rather than implying money has moved. The
`escrowStatus` column and its UI reflect that record, not a bank transfer.

## Scripts

| Command             | Does                                        |
| ------------------- | ------------------------------------------- |
| `npm run dev`       | Dev server                                  |
| `npm run build`     | Production build (node adapter)             |
| `npm run check`     | svelte-check                                |
| `npm run lint`      | prettier + eslint                           |
| `npm run db:push`   | Sync schema to the database                 |
| `npm run db:seed`   | Seed reference data and demonstration rows  |
| `npm run db:studio` | Drizzle Studio                              |
# creativehub
