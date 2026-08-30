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
cp .env.example .env        # then fill in DATABASE_URL, ORIGIN, BETTER_AUTH_SECRET, FILES_DIR
npm run db:migrate          # apply everything in drizzle/
npm run db:seed             # reference data, 14 creators, 5 organisations, 6 campaigns
npm run dev
```

The schema is applied by **committed migrations**, not by `drizzle-kit push`.
`push` diffs the live database and rewrites it in place: there is no record of
what ran, no way back, and no way to tell two environments apart. Changing a
table means `npm run db:generate`, reviewing the SQL it writes into `drizzle/`,
and committing it alongside the schema change.

A database that predates `drizzle/` was created by `push` and already holds
every table, so `0000` would fail on "table already exists". Run
`npm run db:baseline` **once** against it; that records the migrations as
applied without running them. On an empty database, use `db:migrate`.

### Signing in

`npm run db:seed` creates an operator, five organisations and fourteen creators.
Their addresses and the shared password are in **`ACCOUNTS.md`**, which is
git-ignored and deliberately not referenced anywhere in the interface.

`npm run db:seed` is idempotent — rows are matched on their natural key, so
re-running it after correcting the seed updates in place rather than duplicating.

### Passwords, confirmations and mail

Outgoing mail is four environment variables — `SMTP_HOST`, `SMTP_PORT`,
`SMTP_USER`, `SMTP_PASSWORD` — plus two that are usually blank. `SMTP_FROM` sets
the From line when it should differ from the mailbox. `SMTP_TLS_SERVERNAME` is
for the shared-hosting case where `mail.<yourdomain>` answers with a certificate
issued for the provider's own domain: set it to a name the certificate covers
and verification stays fully on, rather than reaching for the usual advice of
switching verification off.

`npm run mail:check` connects and authenticates; give it an address and it sends
one message there as well. The two fail differently, which is the point — a
server can take your password and still refuse the From address you asked for.

With mail configured, sign-up sends a confirmation link, `/forgot-password`
sends a reset link, and `/reset-password` is where that link lands. A reset
revokes every session the account had and opens none: whoever prompted it is
signed out too, and the owner types the new password once at `/login`.

Confirming an address is not a gate — an unverified account signs in normally,
and the settings page offers the link again rather than blocking. What it buys
is account linking: better-auth attaches a Google identity to an existing local
account only when that account's address is already confirmed, and without a
confirmation step that condition could never be met by anyone.

Without SMTP configured the app runs and sends nothing, warning once per
process. In-app notifications are unaffected; password resets and confirmations,
which have no in-app equivalent, cannot complete.

### Uploads

`FILES_DIR` is where avatars, portfolio images and verification evidence are
written. It defaults to `.tempFiles` beside the working directory, which is
fine in development and wrong in production: a deploy that replaces the
application directory takes every uploaded file with it. Point it somewhere
outside the deploy.

Deletes in this app are soft, so a delete must not remove the file — the row can
come back. Files only accumulate, and reclaiming them is deliberate:

```bash
npm run uploads:prune              # list what no row points at
npm run uploads:prune -- --apply   # remove it
```

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

### Every form is built from the same field components

`$lib/formComponents/` is where a form control is defined, once. A page names
fields; it does not write inputs.

```svelte
<InputComp
	{form}
	{errors}
	name="email"
	type="email"
	label={m.login_email()}
	autocomplete="email"
	required
/>
```

`InputComp` covers eleven shapes — text, number, url, password, textarea,
select, combobox, date, multi-date, checkbox list, single checkbox, range — and
owns the label, the `id`/`for` pairing, `aria-invalid`, `aria-describedby`, the
error list and the hint. Three richer controls live beside it, for the choices
that deserve more room than a native widget gives them: `RadioCards` (the
creator/brand picker on sign-up), `ChipSelect` (categories and languages as
toggleable pills) and `StarRating` (a 1–5 score over a hidden field). Each is a
real `<input>` underneath, so every one of them posts, takes focus and works
with scripting off.

Each binds two ways:

- **To a superform** — pass `form` and `errors`, and the field reads and writes
  `$form[name]` and shows `$errors[name]`.
- **To a plain value** — pass `bind:value`, and optionally `onChange`. This is
  what lets a discovery filter, whose value lives in the URL rather than in any
  form, use the same component as a schema-backed field instead of a
  hand-rolled `<select>`.

The point is that a field cannot be half-built. A page that writes its own
`<input>` gets to forget the label, or the error slot, or the `aria-describedby`
— and each of the twelve that did forgot something different.

A superform is seeded **once**, with `untrack`, because it owns its state after
that. The exception is a `[param]` route: SvelteKit reuses the component across
`/creators/a` → `/creators/b`, so those pages re-seed explicitly when the
subject changes. Without it the second profile opens with the first one's
half-written booking.

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

### A deal against a profile nobody has claimed

Imported creators are published before anyone claims them, so a brand can open a
booking against a person who has no account here. The deal is still written —
the intent is real — but it opens with `introductionStatus = 'pending'` and
every surface says what it is: an **Introduction only** badge on the card, quick
view, shortlist and profile, a notice inside the booking dialog before the offer
is written, and a banner on the deal itself. Without that, `proposed` reads as
"waiting on the creator" when no one can answer it.

`/dashboard/admin/introductions` is the queue those land in. An operator moves a
case `pending → contacted → connected`, or declines it; the transitions live in
`domain/booking.ts` beside the booking ones and are enforced server-side, a
decline has to say why, and both steps append to `audit_log`. A declined
introduction also cancels the deal, through `canTransition` like any other
lifecycle move — a deal left at `proposed` for someone who will never see it is
the thing this queue exists to prevent.

`introductionStatus = 'none'` is every ordinary booking, decided once at insert
from the creator. It is excluded from the queue at every turn, so a crafted
`?introduction=none` returns nothing rather than the whole bookings table.

### Taking over a profile that was imported for you

The introduction queue can reach a creator, but reaching them was only half of
it: `profile/create` always inserted a new row and rejected a handle that was
already held, so the one person entitled to an imported profile was the one
person who could not sign up under its handle. They either got a dead end or a
second, empty page while the original kept their audience figures.

`creator_claims` is the way across. A claim is a request and grants nothing —
the only write that attaches an account is an operator approving it, which sets
`creators.userId` and `isClaimed`. That is deliberate: an imported profile
carries follower counts, a score and any deals already opened against it, so
claiming one is an identity claim and goes through the same shape of queue as
verification, at `/dashboard/admin/claims`. Approving also closes every other
pending claim on that profile, each with its own note and audit line, because a
profile can only be handed over once.

Creators reach it two ways. `/dashboard/profile/claim` offers matches for the
signed-in account, and the public profile carries an **Is this you?** link for
the person who already knows where their page is. The matcher
(`domain/claim.ts`) is exact after normalising, never fuzzy, and SQL only casts
the net: a near-miss would show one stranger another stranger's asking price,
and someone we fail to guess can still claim from their own page.

One open claim per account, so the queue stays about people rather than one
person's shortlist and `withdraw` has an unambiguous subject. Both sides are
re-read at the moment of approval — `creators.userId` is uniquely indexed, and a
claimant who created a profile while waiting would otherwise surface as a driver
error instead of a refusal.

### The account, as opposed to the profile

`/dashboard/settings` is the account itself — details, password, what reaches
you, where you are signed in, and how to leave. The public page a creator acts
through is edited elsewhere, under Profile, and keeping the two apart is what
stops "settings" becoming a second profile editor.

Preferences live in `user_settings` rather than in better-auth's `user` table,
which is the library's to shape. A missing row is not a row to repair: it means
`DEFAULT_PREFERENCES`, so nothing is written at sign-up and an account that
never opened the page behaves exactly like one that opened it and changed
nothing.

`domain/notify.ts` holds the policy, and the interesting part of it is what
cannot be switched off. Security mail is sent whatever anyone has chosen —
consenting in advance to not being warned is not something a person can
meaningfully do — and an account decision always appears in the interface,
because that is how the interface explains itself. Neither is rendered as a
toggle, which is what keeps the page truthful about what it controls.

`server/notify.ts` is where that policy meets delivery. Both channels go through
one call: it reads the recipient's preferences, writes the in-app row if they
want one, and hands the words to `server/mail.ts` if they want mail. Call sites
say what happened and nothing about how it travels — which is what stopped the
preferences page describing rules that nothing consulted.

Mail is never awaited. The action that raised it has already succeeded and the
in-app notification is the durable record, so a mail server having a bad
afternoon costs nobody their form submission. Security mail is the exception in
both directions: it consults no preference, writes no in-app row — the recipient
may be locked out of the interface that would show it — and it _is_ awaited,
because there the send is the action.

Closing an account is a request, not a switch. `user` cascades to
`organizations`, which cascades to `bookings`, so deleting the row would take
every deal that organisation ever made with it. An operator unpicks it by hand,
and the request reaches every admin — in the dashboard always, and by email
unless they have turned that off.

### Terms and privacy

`/terms` and `/privacy` are ordinary public pages. Two things in them are read
from site settings rather than written into the prose — the platform fee and
the support address — so the terms cannot quietly disagree with what the app
charges.

The privacy page leads with the section that matters most here: most creator
profiles on this site were compiled from public sources before the person ever
arrived, and the policy says what is held, why, and that removal is available
for the asking. The pages are published in English and say so, because a
mistranslated obligation is worse than an untranslated one.

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

## Tests

```bash
npm run test:unit     # vitest, watch mode
npm test              # unit (once) + Playwright end to end
```

The unit tests cover `domain/` and the two query layers, because that is where
the claims are. `canTransition` refusing to move a completed booking, weights
being ratios rather than percentages, `withParams` returning to page one — each
of those is a sentence in this README, and each has a test that fails if it
stops being true.

Several of them target holes that were live. `?sort=__proto__` was a 500 on
every listing including two public ones, because `in` answers for everything on
`Object.prototype`; the same shape was in `canTransition` and in the currency
table, where `convert(…, 'toString', …)` produced `NaN` on a price. All three
are now `Object.hasOwn`, and all three have a test that catches the regression.

The Playwright suite runs against a production build and a real database: the
CSP is generated at build time and the Origin check only exists there, so the
dev server cannot exercise either.

CI (`.github/workflows/ci.yml`) runs check, lint and unit tests in one job, the
build in another, and the end-to-end suite against MariaDB in a third — which is
also the only place the migrations are proved to apply to an empty database
before a deploy does it.

## Deploying

`build/` is shipped on its own — there are no `node_modules` on the server — so
every dependency has to be _inside_ the bundle. Vite does not do that by
default: `ssr.noExternal` in `vite.config.ts` names the ones it would otherwise
leave as bare imports, and `npm run verify:build` fails if any survive.

That check exists because the failure is so quiet. `@internationalized/date`
reached the server bundle through the date pickers inside `InputComp`, so every
signed-in form page returned 500 while the public pages, which had no
`InputComp`, served fine — a green build, a healthy homepage, and half the app
down. Run `verify:build` before shipping; CI runs it too.

`npm run deploy` is the whole procedure: build, verify, hardlink the running
build as `build.bak.<timestamp>`, prune to the newest two, rsync, SIGTERM, and
poll `/health` until it answers. `--dry-run` says what it would do and touches
nothing; `--skip-build` ships the tree already in `build/`, and still verifies
it. `DEPLOY_KEEP` changes how many backups survive, and refuses to go below one.

The backups are hardlink copies, so a build that changes little costs little —
two backups plus the live build came to 30M against 26M for the build alone.
They are pruned by name, which is why the timestamp format is fixed: `-` sorts
before `.`, so a stray `build.bak-deploy-...` would read as newest forever while
real backups aged out around it. Anything not named `build.bak.<timestamp>` is
reported and left alone rather than guessed at.

SIGTERM rather than `systemctl restart`, which would ask for a password the
deploying user does not have: the unit is `Restart=always` with `RestartSec=3`
and `server.js` closes cleanly, so systemd brings it back in about three
seconds. Rollback is the reverse and takes about ten — the script prints the
exact command, with the timestamp of the backup it just made.

The script never touches the server's `.env`. Environment variables are managed
by hand there, and a deploy that rewrites secrets is a deploy that can take the
site down with a typo.

## Operations

| Route          | For                                                                                                         |
| -------------- | ----------------------------------------------------------------------------------------------------------- |
| `/health`      | A proxy or uptime check. Touches the database, because "Node is listening" is not the question being asked. |
| `/robots.txt`  | A route rather than a static file, so `Sitemap:` can be absolute.                                           |
| `/sitemap.xml` | Published creators and briefs only.                                                                         |

`handleError` in `hooks.server.ts` logs one JSON line per fault — id, route,
method, actor — and hands the reader the id and nothing else. `+error.svelte`
renders it in the reader's language; a stack trace on an error page tells an
attacker about the file layout and tells everyone else nothing.

Security headers are set in two places by necessity. The CSP is generated by
SvelteKit from `kit.csp` in `vite.config.ts`, because only the build knows the
hashes of the inline scripts it emits for hydration. The rest —
`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`,
`Permissions-Policy` — are set in `hooks.server.ts`, which needs no such
knowledge.

better-auth rate-limits its own endpoints: ten sign-ins a minute, five sign-ups
per ten minutes. Vague login errors stop an attacker _reading_ an answer out of
one response; they do nothing about asking a hundred thousand times. The
counters are per process, which fits a single-node deployment — behind more than
one instance, move them to `storage: 'database'`.

Uploads are checked three ways: a declared size, the bytes actually written, and
the file's magic number against the type it claims to be. The `accept`
attribute is a hint to a browser, and a direct multipart POST ignores all three
until they are enforced here.

## Taking payment

Chapa collects the brand's deposit. `server/chapa.ts` is the API client and
knows nothing about deals; `server/payments.ts` decides what a payment _means_
for a booking. Keeping the seam there is what makes the rules about money
readable without a network in the way.

The integration's security rests on one inversion: **the webhook body is never
believed**. `/api/chapa/webhook` is public and unauthenticated by necessity —
Chapa's servers call it and hold no session — so anyone can post to it. It reads
the payload for a transaction reference, throws the rest away, and asks Chapa
what happened using our secret key over a connection we opened. A forged request
can therefore make the app ask a question, never assert an answer. A signature is
checked when `CHAPA_WEBHOOK_SECRET` is set, but that is defence in depth rather
than the thing holding the door.

Verification re-checks the amount and currency against what was asked for. Chapa's
hosted page does not let a payer change either, so a mismatch means the price
moved after checkout opened, or a reference is being replayed against another
deal. Neither funds anything: the payment is marked failed, an audit line records
the discrepancy, and an operator looks at it.

The browser coming back and the webhook arriving both land on the same `settle`,
usually within a second of each other and in no guaranteed order. It is written
to be safe to run twice — a `status = 'pending'` predicate on the payment and an
`escrow_status <> 'held'` predicate on the booking mean whichever arrives second
changes nothing. Resolving it on the return page as well as the webhook is what
makes the outcome visible immediately, including on a host where the webhook
cannot be delivered at all.

Payment _starts the work_: funding moves a booking from `booked` to
`in_production`, because `submit` accepts nothing earlier. A deposit that funded
the deal but left the creator unable to hand anything over would be a dead end
that looked like success from both sides.

Only ETB, and only the brand's deposit. A booking priced in anything else says
so and falls back to the operator path rather than being converted at a rate an
operator last touched months ago. The `payments` table keeps every attempt,
including abandoned ones — the difference between "never tried" and "tried twice
and gave up" only ever matters once, in a support conversation, after the fact.

## What is not connected

**Payouts.** Money comes in through Chapa; it goes out by hand. `settle` releases
escrow as a record, not a transfer, and the interface says so rather than
implying a creator has been paid. Wiring the other direction needs Chapa
Transfers, a funded balance, and bank details on creator profiles — none of
which exist yet.

**Recording a deposit by hand** remains, for money that genuinely moved outside
the platform: a bank transfer, telebirr paid directly. It is operator-only now,
and the `MANUAL-` payment reference is what tells the two kinds of deposit apart
afterwards.

## Scripts

| Command                 | Does                                                         |
| ----------------------- | ------------------------------------------------------------ |
| `npm run dev`           | Dev server                                                   |
| `npm run build`         | Production build (node adapter)                              |
| `npm run verify:build`  | Fail if `build/` imports anything absent on the server       |
| `npm run deploy`        | Build, verify, back up, ship, restart, check (`--dry-run`)   |
| `npm run check`         | svelte-check                                                 |
| `npm run lint`          | prettier + eslint                                            |
| `npm run format`        | prettier --write                                             |
| `npm run test:unit`     | vitest                                                       |
| `npm run test:e2e`      | Playwright, against a production build                       |
| `npm test`              | Both                                                         |
| `npm run db:generate`   | Write a migration for the current schema                     |
| `npm run db:migrate`    | Apply everything in `drizzle/`                               |
| `npm run db:baseline`   | Record migrations as applied — for a database `push` created |
| `npm run db:push`       | Rewrite the schema in place. Not the deploy path; see above. |
| `npm run db:seed`       | Seed reference data and demonstration rows                   |
| `npm run mail:check`    | Connect and authenticate; `-- you@host.tld` also sends one   |
| `npm run db:studio`     | Drizzle Studio                                               |
| `npm run uploads:prune` | Find files no row points at (`-- --apply` to remove them)    |

# creativehub
