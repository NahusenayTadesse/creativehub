<div align="center">

# Creator Network

### Product & Technical Documentation

**A two-sided marketplace connecting organisations with content creators across Ethiopia and the wider Pan-African market.**

`v0.0.1` · September 2026 · SvelteKit 2 · Svelte 5 · Drizzle ORM · MySQL/MariaDB

</div>

---

## Contents

| # | Section | What it covers |
|---|---------|----------------|
| 1 | [Overview](#1-overview) | What the product is, who it serves, what it claims |
| 2 | [At a glance](#2-at-a-glance) | The system in numbers |
| 3 | [The product](#3-the-product) | Every surface, by the role that uses it |
| 4 | [Core mechanics](#4-core-mechanics) | The seven pieces of logic the marketplace turns on |
| 5 | [Architecture](#5-architecture) | Stack, layout, and the four abstractions that carry it |
| 6 | [Data model](#6-data-model) | 38 tables, grouped by what they are for |
| 7 | [Security model](#7-security-model) | Authentication, authorisation, input, transport, uploads |
| 8 | [Payments](#8-payments) | What is connected, what is not, and why |
| 9 | [Language and theme](#9-language-and-theme) | Two locales, two colour schemes, one component set |
| 10 | [Build, test, deploy](#10-build-test-deploy) | The path from a commit to a running server |
| 11 | [Configuration reference](#11-configuration-reference) | Every environment variable, and what breaks without it |
| 12 | [Roadmap](#12-roadmap) | What to sharpen, what to build, in what order |
| 13 | [Appendices](#13-appendices) | Route map, script index, glossary |

---

## 1. Overview

Creator Network is a marketplace with two sides that need each other and cannot
easily find each other.

On one side are **organisations** — brands, startups, agencies, NGOs, government
bodies and event organisers — who want African creators to make something for
them and have no reliable way to work out who is worth approaching, what the
going rate is, or whether the person will deliver.

On the other are **creators** — from nano voices with a few thousand engaged
followers to national names — who are discovered by word of mouth, priced by
guesswork, and paid by whichever arrangement the brand happens to prefer.

The platform covers the whole collaboration, not just the introduction:

```
discovery → negotiation → agreed terms → delivery → review → settlement
```

Every one of those steps is a record. That is the product's actual position: a
handshake made over a phone call leaves nothing behind, and so nothing about it
can be enforced, disputed, measured or repeated. A deal made here leaves a
frozen set of terms, a delivery with a submission attached, a review from both
directions, a payment with a reference, and an append-only audit line for every
state it passed through.

### What the platform asserts, and what it does not

The system is deliberately modest about what it knows. Three examples set the
tone for the whole codebase:

- **A creator's score is derived, never entered.** No field on any profile form
  writes it. It is recomputed from evidence after every write that could change
  it.
- **A campaign-to-creator fit score is arithmetic, not a model.** Five weighted
  factors an operator can argue with, because the number influences who gets
  paid.
- **A payment webhook is never believed.** The body is read for a transaction
  reference and thrown away; the outcome is decided by asking the payment
  processor over a connection this server opened.

### Who it is for

| Role | Enters through | Works in |
|------|----------------|----------|
| **Creator** | Sign-up, or claiming a profile imported for them | Profile, channels, packages, portfolio, applications, bookings, reviews |
| **Brand / organisation** | Sign-up and creating an organisation | Campaigns, discovery, shortlist, bookings, reviews |
| **Operator (admin)** | Assigned role | Reference data, verification, claims, introductions, trending, gallery, users, audit, site settings |
| **Visitor** | No account | Homepage, discovery, creator profiles, open briefs, terms, privacy |

---

## 2. At a glance

| | |
|---|---|
| **Application routes** | 44 pages, 7 endpoints |
| **Database tables** | 38 (34 domain + 4 authentication) |
| **Migrations** | 6, committed and replayable from empty |
| **Translated strings** | 1,700 keys × 2 locales (English, Amharic) — full parity |
| **Unit test files** | 13, over `domain/` and both query layers |
| **End-to-end suites** | 4, run against a production build and a real database |
| **Reference taxonomies** | Countries, regions, categories, platforms, languages |
| **Booking states** | 10, with declared transitions enforced server-side |
| **Trending signals** | 10 weighted inputs, plus eligibility floors and fairness caps |
| **Field components** | 11 input shapes plus 3 richer controls, defined once |

---

## 3. The product

### 3.1 The public surface

Everything here works without an account, and is indexed.

**Homepage** — an operator-arranged gallery carousel, the live trending board,
and entry points into discovery and open briefs. The trending strip is
re-ranked for where the reader is when local ranking is enabled, so a visitor in
Addis and a visitor in Nairobi do not necessarily see the same twelve faces.

**Discovery** (`/discover`) — the creator index. Free-text search across name,
handle, bio and city, then filters on country (multi-select), region, platform,
verification level, availability, maximum starting price, minimum reach and
category. Sorts by score, reach, price, rating, newest — or by **fit**, which
ranks against a chosen campaign using the match score rather than any column in
the database. Every filter carries a live count of what choosing it would
return.

**Creator profile** (`/creators/[username]`) — audience figures per channel,
categories and languages, packages with deliverables and delivery times,
portfolio, reviews with a paginated endpoint of their own, the derived score
with a public explainer of its weights, verification level, and a
representation badge that says plainly whether the person behind the profile
actually has an account here. A booking can be opened directly from this page.

**Open briefs** (`/campaigns`, `/campaigns/[slug]`) — published campaigns,
filterable by compensation model, category and market. A brief states its
compensation model exactly once: paid, barter, or event pass — with the barter
details or event name, date, location and pass type shown only for the model
that uses them.

**Terms and privacy** — ordinary pages, with two values read from site settings
rather than written into the prose: the platform fee and the support address, so
the terms cannot quietly disagree with what the application charges. The privacy
page leads with the fact that most creator profiles were compiled from public
sources before the person arrived, and that removal is available for the asking.

### 3.2 The creator workspace

| Surface | Does |
|---------|------|
| `/dashboard` | Deal pipeline, earnings, score, next actions |
| `/dashboard/profile` | The public page: bio, location, categories, languages, avatar, cover |
| `/dashboard/profile/create` | First-time profile creation |
| `/dashboard/profile/claim` | Take over a profile that was imported before you arrived |
| `/dashboard/channels` | Social accounts: handle, followers, engagement rate, verified flag |
| `/dashboard/packages` | Priced offers — deliverables, price, delivery days, revisions |
| `/dashboard/portfolio` | Work samples, image or video, with views and likes |
| `/dashboard/applications` | Applications to open briefs, and their outcomes |
| `/dashboard/bookings` | Live deals, negotiation, delivery, revisions |
| `/dashboard/verification` | Submit evidence, move up the verification ladder |
| `/dashboard/reviews` | Reviews received and given |
| `/dashboard/settings` | The account: details, password, notification preferences, sessions, closure |

A write anywhere in the first six of those recalculates the creator's score
through `afterWrite`, so the number on the public card never lags the profile it
describes.

### 3.3 The brand workspace

| Surface | Does |
|---------|------|
| `/dashboard` | Campaign performance, spend chart, shortlist, open deals |
| `/dashboard/organization` | The organisation: name, type, market, logo, verification |
| `/dashboard/campaigns` | Briefs — draft, publish, close; applications per brief |
| `/dashboard/shortlist` | Saved creators, with the same badges discovery shows |
| `/dashboard/bookings` | Deals from both directions, with the full lifecycle |
| `/dashboard/reviews` | Reviews of creators worked with |

### 3.4 The operator console

Reference data, queues, and the levers that decide what the public sees.

**Reference data** — countries (with currency, USD rate and payment rails),
regions and their major cities, categories, platforms, languages. Each is one
`contentCrud` call and gets search, paging, export and soft delete without its
route asking.

**Queues**

- `/dashboard/admin/verification` — evidence review, four verification levels
- `/dashboard/admin/claims` — a creator claiming an imported profile; approval
  is the only write that attaches an account, and it closes every competing
  claim with its own note and audit line
- `/dashboard/admin/introductions` — deals opened against creators who have no
  account here yet: `pending → contacted → connected`, or declined with a reason
  that also cancels the deal

**Levers**

- `/dashboard/admin/trending` — the ranking policy in full (see §4.6)
- `/dashboard/admin/gallery` — homepage slides, ordered
- `/dashboard/admin/settings` — site name, hero copy, platform fee, support contacts
- `/dashboard/admin/creators`, `/organizations`, `/users` — the records themselves
- `/dashboard/admin/audit` — the append-only log, readable and never written from the interface

---

## 4. Core mechanics

Seven pieces of logic carry the marketplace. All seven live in `src/lib/domain/`
as pure functions with no database and no network, which is why all seven have
tests.

### 4.1 The creator score — `domain/score.ts`

A 0–100 number derived from evidence, capped and floored, recomputed after any
write that could move it. The weights are the ones the public explainer modal
shows, because a score nobody can interrogate is a score nobody should trust.

| Component | Out of | Made of |
|-----------|--------|---------|
| Profile completeness | 30 | Name, bio over 20 characters, avatar, cover, categories, languages, at least one package, at least one portfolio item |
| Verification | 25 | `cn_verified` 25 · `identity_verified` 20 · `social_verified` 15 · unverified 5 |
| Engagement | 15 | Engagement rate scaled against a 10% ceiling |
| Response rate | 15 | Currently a flat placeholder — reply times are not yet instrumented |
| Track record | 15 | Completed bookings (to a cap) plus average rating |

### 4.2 The match score — `domain/match.ts`

Campaign-to-creator fit across five weighted factors, producing a total, a tier,
a short list of stated synergies, a predicted impression range and a
recommended angle.

| Factor | Out of | Rewards |
|--------|--------|---------|
| Niche alignment | 25 | Direct category match (25), adjacent category (18), neither (8) |
| Audience geography | 25 | Home-market match, or overlap with the brief's target regions and the creator's top audience countries |
| Performance | 25 | Engagement rate, then rating weighted by volume of completed work, then verification |
| Platform fit | 15 | Primary channel in the brief's platforms, or any channel |
| Budget headroom | 10 | Asking price against the brief's ceiling; for barter and event passes, whether reach sits in the requested bracket |

Adjacency is a declared, **symmetric** map of category slugs: a fintech brief
should still surface a business creator. Symmetry is tested, because only the
forward direction is read today — a one-way entry would be invisible and
indistinguishable from a typo. Eleven had crept in before the test existed.

Fit ranking happens in the server, not in SQL, because the score cannot be
expressed as an `ORDER BY`. The query layer ranks a capped pool and pages that
order, and the result reports where the cap fell rather than pretending it did
not.

### 4.3 The booking lifecycle — `domain/booking.ts`

```
proposed ──→ negotiating ──→ booked ──→ in_production ──→ submitted ⇄ revision
                                                              │
                                                              ▼
                                             approved ──→ awaiting_settlement ──→ completed

any open state ──→ cancelled / declined
```

Transitions are declared in one place and enforced on the server. A client
requests an action; it never asserts a state. Three rules are load-bearing:

1. **Terms freeze on mutual acceptance.** Accepting the open proposal writes a
   `termsSnapshot` exactly once. Editing a profile, a package or a brief
   afterwards cannot reach into a live deal.
2. **A revision needs a reason,** and spends one of the agreed allowance.
3. **Completion needs compensation.** A paid booking cannot complete until its
   deposit is recorded.

Every state change appends to `audit_log`: actor, object, from-state, to-state,
reason. Nothing in the application updates or deletes that table.

### 4.4 Deals against a profile nobody has claimed

Imported creators are published before anyone claims them, so a brand can open a
booking against a person who has no account here. The deal is still written —
the intent is real — but it opens with `introductionStatus = 'pending'` and
every surface says so: an **Introduction only** badge on the card, quick view,
shortlist and profile; a notice inside the booking dialog before the offer is
written; a banner on the deal itself.

Without that, `proposed` reads as "waiting on the creator" when nobody can
answer it. The operator queue at `/dashboard/admin/introductions` is where those
land, and a declined introduction cancels the deal through the same
`canTransition` gate as any other lifecycle move.

`introductionStatus = 'none'` is every ordinary booking, decided once at insert.
It is excluded from the queue at every turn, so a crafted `?introduction=none`
returns nothing rather than the whole bookings table.

### 4.5 Claiming an imported profile — `domain/claim.ts`

An imported profile carries follower counts, a score and any deals already
opened against it, so claiming one is an identity claim and goes through a
queue. A claim grants nothing; the only write that attaches an account is an
operator approving it.

The matcher is **exact after normalising, never fuzzy**. SQL only casts the net;
a near-miss would show one stranger another stranger's asking price. Someone the
matcher fails to guess can still claim from their own public page, which carries
an **Is this you?** link.

One open claim per account, so the queue stays about people. Both sides are
re-read at the moment of approval, because `creators.userId` is uniquely indexed
and a claimant who created a profile while waiting would otherwise surface as a
driver error instead of a refusal.

### 4.6 Trending as a policy — `domain/trending.ts`

Trending used to be a checkbox on a creator row: an operator ticked it and
nothing recorded why, when, or on what evidence. It is now five tables and a
settings page.

```
mode          manual (ticked by hand) · automatic (ranking only) · hybrid (pins, then ranking)
slots         how many creators the board holds
window        activity older than N days is not counted at all
half-life     how fast activity inside that window loses value; 0 counts it flat
comparison    percentile (rank against the pool) or min–max (keep the real distances)
eligibility   floors on score, reach, rating, verification; live channel, availability, activity
fairness      max per category and per country, max days on the board, rest afterwards
location      restrict the board to one market; boost or hard-sort by the reader's own place
overrides     pin, boost or block one creator — each with a reason and an expiry
```

Ten signals carry weights: profile score, reach, engagement, recent bookings,
applications, reviews, rating, shortlist saves, newcomer boost and verification.
The weights are **relative** — divided by their own sum — so raising one does
not silently steal from the other nine.

Three properties are deliberate:

- **Preview runs the real ranking.** The preview button posts the unsaved form
  to a dry run of the same function the publish path calls, and writes nothing.
  A preview that ran its own slightly different query would be worse than none.
- **Saving publishes.** Settings saved but not applied are the surest way to
  make an algorithm screen untrustworthy — so a save republishes, unless the
  board is frozen.
- **Every slot can be explained.** `trending_entries` stores each signal's
  contribution to each rank, `trending_runs` stores the settings a run used, and
  `creators.is_trending` is rewritten from the board, so the badge on a card and
  the strip on the homepage cannot disagree.

There is no job runner in this deployment, so the public page that reads the
board is what notices it has gone stale. The recompute is not awaited by the
request — a visitor should never pay for it — and a module-level lock keeps
concurrent requests from starting several at once.

### 4.7 Contact masking — `domain/mask.ts`

Deals stay on-platform because the escrow, the delivery record and the review
only exist here. Masking is what keeps that true: email addresses, Ethiopian
mobile formats (`+251…`, `09…`, `07…`), generic long digit runs and messenger
handoffs (`t.me/…`, `wa.me/…`, Telegram and WhatsApp mentions) are rewritten
before a message is stored, and `messages.isMasked` records that it happened.

Each pass compiles a fresh regular expression, because a shared `/g` literal
carries `lastIndex` between calls and would silently skip matches.

### 4.8 Money — `domain/money.ts`

Currency conversion goes through the `usdRate` column on `countries`: one source
of truth, editable by an operator, with no live FX feed to fail. A price is
stored in its own currency alongside its code; the fee split
(`platformFee`, `creatorPayout`) is stored on the booking at creation so a later
change to the platform fee cannot rewrite the history of a completed deal.

---

## 5. Architecture

### 5.1 Stack

| Layer | Choice | Note |
|-------|--------|------|
| Framework | SvelteKit 2 · Svelte 5 runes | `adapter-node`, standalone `server.js` |
| Database | MySQL / MariaDB via Drizzle ORM | Committed migrations, never `push` |
| Authentication | better-auth | Email + password, Google, sessions, rate limits |
| Forms | sveltekit-superforms + Zod 4 | One schema shared by the form and the action |
| Styling | Tailwind 4 + shadcn-svelte | Token-based palette, light and dark |
| i18n | Paraglide (inlang) | `en` and `am`, compiled, per-request locale |
| Mail | nodemailer | Optional; the app runs and warns once without it |
| Payments | Chapa hosted checkout | Deposit in, by server-side verification only |
| Charts | LayerChart | Spend and performance |
| Testing | Vitest + Playwright | Unit on domain and queries; e2e on a production build |

### 5.2 Layout

```
src/
  lib/
    domain/            Pure logic, safe on client and server, fully tested
      booking.ts         Lifecycle states and the legal transitions between them
      match.ts           Deterministic 5-factor campaign ↔ creator fit score
      score.ts           The 0–100 creator score, derived from evidence only
      trending.ts        The trending ranking as arithmetic — weights, decay, order
      money.ts           Currency conversion through the rate on `countries`
      mask.ts            Contact masking for deal conversations
      claim.ts           Matching an account to a profile imported for it
      notify.ts          What may be switched off, and what may not
      creator-import.ts  Parsing the scraped CSV into the schema
      placeholder.ts     Deterministic artwork for an image that will not load
    server/
      query.ts           The one query builder: search, filter, sort, page, facet
      queries.ts         Every read the app performs, defined against that builder
      crud.ts            Generic add/edit/delete for any content table
      guards.ts          requireUser / requireRole / requireBookingAccess + audit
      score-service.ts   Recalculates derived creator fields after a write
      trending-service.ts Gathers the trending signals, publishes the board
      payments.ts        What a payment means for a booking
      chapa.ts           The payment API client, and nothing about deals
      notify.ts          Policy meets delivery: in-app row and mail, one call
      mail.ts            SMTP, never awaited except for security mail
      upload.ts          Size, written bytes, and magic number
      db/schema.ts       38 tables
    formComponents/    Every form control, defined once
    components/        Cards, badges, tables, navigation, charts
    schemas.ts         Every Zod schema, shared by forms and actions
  routes/
    (public)/          Indexed, no account required
    dashboard/         Signed in; admin/ is role-gated in its layout
    api/, files/, health, robots.txt, sitemap.xml
```

### 5.3 The one query builder

Every listing in the application is the same query with different columns: a
search, some filters, a sort and a page. `server/query.ts` is that query,
written once. A surface declares what it exposes and gets back a function that
reads a `URL`:

```ts
export const bookingsQuery = defineQuery({
	table: t.bookings,
	columns: bookingColumns,
	joins: bookingJoins,          // applied to the page query and the count alike
	search: [t.bookings.title, t.bookings.reference, t.creators.fullName],
	filters: {
		tab:    { type: 'group', column: t.bookings.status, groups: BOOKING_TABS },
		escrow: { type: 'enum',  column: t.bookings.escrowStatus, values: t.escrowStatusEnum }
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
- **Ownership is not a filter.** Conditions deciding *whose* rows these are come
  from the caller's `where`, derived from the session; filters come from the
  query string. They are separate arguments precisely so a crafted URL cannot
  widen a scope.

```ts
listBookings(url, { role, creatorId: creator?.id, organizationId: organization?.id });
```

Three extras earn their place:

| Helper | Does |
|--------|------|
| `facet(url, key)` | Counts what each choice of one filter would return, with every *other* filter applied. Because the filter excludes itself, counts stay true while standing on one of them, and summing them gives the unfiltered total. |
| `hydrate` | Decorates a page **after** it has been cut, so the second query that turns ids into names runs over twenty-four rows rather than the table. |
| `rank` | Orders by something SQL cannot compute — the campaign fit score. Capped, and the result says where the cap fell. |

### 5.4 `crud.ts` does the repetitive work

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
	afterWrite: () => refreshCreatorScore(creator.id)
});
```

With a scope set, the owning column filters every read, filters the row an edit
or delete targets, and is stamped onto inserts from the session — so a creator
cannot reach another creator's package by changing the id in the form.

### 5.5 Every form is built from the same field components

`$lib/formComponents/` is where a form control is defined, once. A page names
fields; it does not write inputs.

```svelte
<InputComp {form} {errors} name="email" type="email"
           label={m.login_email()} autocomplete="email" required />
```

`InputComp` covers eleven shapes — text, number, url, password, textarea,
select, combobox, date, multi-date, checkbox list, single checkbox, range — and
owns the label, the `id`/`for` pairing, `aria-invalid`, `aria-describedby`, the
error list and the hint. Three richer controls sit beside it for the choices
that deserve more room than a native widget gives them: `RadioCards` (the
creator/brand picker on sign-up), `ChipSelect` (categories and languages as
toggleable pills) and `StarRating` (a 1–5 score over a hidden field). Each is a
real `<input>` underneath, so every one of them posts, takes focus and works
with scripting off.

Each binds two ways:

- **To a superform** — pass `form` and `errors`; the field reads and writes
  `$form[name]` and shows `$errors[name]`.
- **To a plain value** — pass `bind:value` and optionally `onChange`. This is
  what lets a discovery filter, whose value lives in the URL rather than in any
  form, use the same component as a schema-backed field.

The point is that a field cannot be half-built. A page that writes its own
`<input>` gets to forget the label, or the error slot, or the
`aria-describedby` — and each of the twelve that did forgot something different.

A superform is seeded **once**, with `untrack`, because it owns its state after
that. The exception is a `[param]` route: SvelteKit reuses the component across
`/creators/a` → `/creators/b`, so those pages re-seed explicitly when the
subject changes. Without it the second profile opens with the first one's
half-written booking.

---

## 6. Data model

38 tables. Soft deletion (`publishable()`) and authorship (`audit()`) are mixins
applied nearly everywhere, so a delete is reversible and every row knows who
last touched it.

### Reference

| Table | Holds |
|-------|-------|
| `countries` | Name, code, flag, currency, symbol, **`usdRate`** (the one FX source), payment rails |
| `regions` | Sub-national regions and their major cities |
| `categories` | Content niches, slugged — the slug is what adjacency is declared against |
| `platforms` | Instagram, TikTok, YouTube, X, and whatever else an operator adds |
| `languages` | Languages a creator works in |

### Identity

| Table | Holds |
|-------|-------|
| `user`, `session`, `account`, `verification` | better-auth's own tables — the library's to shape |
| `user_settings` | Preferences. A missing row *means* `DEFAULT_PREFERENCES`, so nothing is written at sign-up |
| `organizations` | Brand, agency, NGO, government, startup or event organiser; type, market, logo, verification level |
| `organization_members` | Owner / admin / member seats |

### Supply

| Table | Holds |
|-------|-------|
| `creators` | The profile. Reach, starting price, derived score, verification, availability, overseas share, top audience countries, `isPublished`, `isClaimed` |
| `creator_categories`, `creator_languages` | Join tables |
| `social_accounts` | One per channel: handle, followers, engagement rate, platform-verified flag |
| `packages` | Priced offers: deliverables, price, delivery days, revision allowance |
| `portfolio_items` | Work samples, image or video, with views and likes |

`creators.totalReach`, `score`, `reviewsCount`, `averageRating` and
`completedBookings` are denormalised on purpose, so discovery can filter and
sort without a join per row. All five are written by services, never by a form.

`creators.userId` is **uniquely indexed** — one profile per account. Imported
profiles carry a null `userId`, and MySQL permits repeated nulls in a unique
index, so unclaimed supply is unaffected.

### Demand

| Table | Holds |
|-------|-------|
| `campaigns` | The brief: objective, exactly one compensation model, category, platforms, follower bracket, budget range, market, target regions, deliverables, deadline, language, tags, status |
| `applications` | A creator's pitch and proposed price. Uniquely indexed on `(campaignId, creatorId)` — one active application each |

### Transactions

| Table | Holds |
|-------|-------|
| `bookings` | The deal: reference, parties, price, **stored** platform fee and creator payout, status, escrow status, introduction status, revision counters, `termsSnapshot` and when it froze |
| `term_proposals` | One negotiation round each; the chain of them is the timeline |
| `payments` | Every attempt, including abandoned ones — the difference between "never tried" and "tried twice and gave up" only ever matters once, in a support conversation |
| `submissions` | Delivery: submitted, approved, or revision requested |
| `messages` | Scoped to a deal — there is no global inbox — with `isMasked` set when the masker rewrote something |
| `reviews` | Both directions, brand→creator and creator→brand |

### Trust and operations

| Table | Holds |
|-------|-------|
| `verification_requests` | Evidence for a creator or an organisation, and its outcome |
| `creator_claims` | A request to take over an imported profile. Grants nothing on its own |
| `saved_creators` | Shortlists |
| `notifications` | In-app rows written by `server/notify.ts` |
| `audit_log` | Append-only: actor, object, from-state, to-state, reason. Never updated, never deleted |
| `site_settings` | Site name, tagline, hero copy, platform fee percent, support email and phone |
| `gallery_slides` | Homepage carousel, in the order an operator arranged them |

### Trending

| Table | Holds |
|-------|-------|
| `trending_config` | One row of knobs: mode, slots, window, half-life, normalisation, ten weights, eligibility floors, diversity caps, rotation, location policy, auto-refresh, freeze |
| `trending_overrides` | Pins, boosts and blocks, each with a reason and an optional expiry |
| `trending_entries` | The live board, one row per slot, with each signal's contribution |
| `trending_cooldowns` | Who is resting, so the same faces cannot camp on the homepage |
| `trending_runs` | Append-only history of every recompute and the settings it used |

---

## 7. Security model

### Authentication

better-auth handles email/password and Google, and rate-limits its own
endpoints: ten sign-ins a minute, five sign-ups per ten minutes. Vague login
errors stop an attacker *reading* an answer out of one response; they do nothing
about asking a hundred thousand times, which is what the limiter is for. The
counters are per process, which fits a single-node deployment — behind more than
one instance, move them to `storage: 'database'`.

Confirming an address is **not a gate**. An unverified account signs in
normally, and the settings page offers the link again rather than blocking. What
confirmation buys is account linking: better-auth attaches a Google identity to
an existing local account only when that account's address is already confirmed,
and without a confirmation step that condition could never be met by anyone.

A password reset revokes every session the account had and opens none: whoever
prompted it is signed out too, and the owner types the new password once at
`/login`.

### Authorisation

Three guards, and one rule that outranks them:

| Guard | Refuses |
|-------|---------|
| `requireUser` | Anyone not signed in |
| `requireRole` | Anyone whose role is not in the list |
| `requireBookingAccess` | Anyone who is not a party to this deal |

The rule is §5.3's: **ownership is never a filter**. Scope comes from the
session, filters come from the URL, and they are separate arguments so no
crafted query string can widen what a listing returns.

### Input

Every form is a Zod schema shared by the client-side superform and the server
action, so validation cannot drift between them. The query layer accepts nothing
it did not declare. Three prototype-pollution holes were live and are now closed
with `Object.hasOwn` and covered by tests: `?sort=__proto__` was a 500 on every
listing including two public ones, the same shape sat in `canTransition`, and
`convert(…, 'toString', …)` produced `NaN` on a price.

### Transport and headers

The CSP is generated by SvelteKit from `kit.csp` in `vite.config.ts`, because
only the build knows the hashes of the inline scripts it emits for hydration.
`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy` and
`Permissions-Policy` are set in `hooks.server.ts`, which needs no such
knowledge. `adapter-node` checks the `Origin` header on every form POST, which
is why a wrong `ORIGIN` looks like "every submission is forbidden".

### Uploads

Checked three ways: the declared size, the bytes actually written, and the
file's magic number against the type it claims to be. The `accept` attribute is
a hint to a browser, and a direct multipart POST ignores all three until they
are enforced on the server. Verification evidence is written to a `private/`
subdirectory and served only after an authorisation check.

Deletes are soft, so a delete must not remove the file — the row can come back.
Files therefore only accumulate, and reclaiming them is deliberate:
`npm run uploads:prune` lists what no row points at; `-- --apply` removes it.

### Errors

`handleError` logs one JSON line per fault — id, route, method, actor — and
hands the reader the id and nothing else. `+error.svelte` renders it in the
reader's language. A stack trace on an error page tells an attacker about the
file layout and tells everyone else nothing.

---

## 8. Payments

Chapa collects the brand's deposit. `server/chapa.ts` is the API client and
knows nothing about deals; `server/payments.ts` decides what a payment *means*
for a booking. Keeping the seam there is what makes the rules about money
readable without a network in the way.

**The webhook body is never believed.** `/api/chapa/webhook` is public and
unauthenticated by necessity — Chapa's servers call it and hold no session — so
anyone can post to it. It reads the payload for a transaction reference, throws
the rest away, and asks Chapa what happened using our secret key over a
connection we opened. A forged request can therefore make the application ask a
question, never assert an answer. A signature is checked when
`CHAPA_WEBHOOK_SECRET` is set, but that is defence in depth rather than the
thing holding the door.

Verification re-checks the amount and currency against what was asked for.
Chapa's hosted page does not let a payer change either, so a mismatch means the
price moved after checkout opened, or a reference is being replayed against
another deal. Neither funds anything: the payment is marked failed, an audit
line records the discrepancy, and an operator looks at it.

The browser coming back and the webhook arriving both land on the same `settle`,
usually within a second of each other and in no guaranteed order. It is written
to be safe to run twice — a `status = 'pending'` predicate on the payment and an
`escrow_status <> 'held'` predicate on the booking mean whichever arrives second
changes nothing. Resolving it on the return page as well as the webhook is what
makes the outcome visible immediately, including on a host where the webhook
cannot be delivered at all.

**Payment starts the work.** Funding moves a booking from `booked` to
`in_production`, because `submit` accepts nothing earlier. A deposit that funded
the deal but left the creator unable to hand anything over would be a dead end
that looked like success from both sides.

Only ETB, and only the brand's deposit. A booking priced in anything else says
so and falls back to the operator path rather than being converted at a rate an
operator last touched months ago.

### What is not connected

**Payouts.** Money comes in through Chapa; it goes out by hand. `settle`
releases escrow as a *record*, not a transfer, and the interface says so rather
than implying a creator has been paid. Wiring the other direction needs Chapa
Transfers, a funded balance, and bank details on creator profiles — none of
which exist yet.

**Recording a deposit by hand** remains, for money that genuinely moved outside
the platform: a bank transfer, telebirr paid directly. It is operator-only, and
the `MANUAL-` payment reference is what tells the two kinds of deposit apart
afterwards.

---

## 9. Language and theme

### Two locales

English and Amharic, 1,700 message keys each, at full parity. Paraglide compiles
messages into `src/lib/paraglide/`, and the locale is resolved **per request**.
That has one consequence that governs the whole codebase:

> A message function is never called at module scope. `m.foo()` at the top level
> of a module is evaluated once, in whatever locale happened to be current, and
> then served to everyone. Anything that needs a label exports a function that
> returns it — which is why `scoreWeights` in `domain/score.ts` is
> `() => [...]` rather than an array.

Public legal pages are published in English and say so, because a mistranslated
obligation is worse than an untranslated one.

### Two colour schemes

The palette is a set of semantic tokens — `brand`, `ink`, `edge`, `well`,
`warn`, `info`, `tint-*` and their `-soft`, `-fg` and `-edge` variants — defined
once and swapped for dark mode. Components name a role, never a colour, so the
scheme can change without touching a component. `mode-watcher` holds the
reader's choice, with a system default.

---

## 10. Build, test, deploy

### Tests

```bash
npm run test:unit     # vitest, watch mode
npm test              # unit (once) + Playwright end to end
```

Unit tests cover `domain/` and the two query layers, because that is where the
claims are. `canTransition` refusing to move a completed booking, weights being
ratios rather than percentages, `withParams` returning to page one, adjacency
being symmetric — each of those is a sentence in this document, and each has a
test that fails if it stops being true.

The Playwright suite runs against a **production build and a real database**:
the CSP is generated at build time and the `Origin` check only exists there, so
the dev server cannot exercise either.

CI runs check, lint and unit tests in one job, the build in another, and the
end-to-end suite against MariaDB in a third — which is also the only place the
migrations are proved to apply to an empty database before a deploy does it.

### Migrations, never `push`

The schema is applied by committed migrations. `push` diffs the live database
and rewrites it in place: there is no record of what ran, no way back, and no
way to tell two environments apart. Changing a table means `npm run db:generate`,
reviewing the SQL it writes into `drizzle/`, and committing it alongside the
schema change.

A database that predates `drizzle/` was created by `push` and already holds
every table, so `0000` would fail on "table already exists". `npm run db:baseline`
is run **once** against such a database; it records the migrations as applied
without running them.

### The bundle has to be self-contained

`build/` is shipped on its own — there are no `node_modules` on the server — so
every dependency has to be *inside* the bundle. Vite does not do that by
default: `ssr.noExternal` in `vite.config.ts` names the ones it would otherwise
leave as bare imports, and `npm run verify:build` fails if any survive.

That check exists because the failure is so quiet. `@internationalized/date`
reached the server bundle through the date pickers inside `InputComp`, so every
signed-in form page returned 500 while the public pages, which had no
`InputComp`, served fine — a green build, a healthy homepage, and half the
application down.

### Deploying

`npm run deploy` is the whole procedure: build, verify, hardlink the running
build as `build.bak.<timestamp>`, prune to the newest two, rsync, SIGTERM, and
poll `/health` until it answers. `--dry-run` says what it would do and touches
nothing; `--skip-build` ships the tree already in `build/`, and still verifies
it. `DEPLOY_KEEP` changes how many backups survive, and refuses to go below one.

Backups are hardlink copies, so a build that changes little costs little — two
backups plus the live build came to 30M against 26M for the build alone. They
are pruned by name, which is why the timestamp format is fixed: `-` sorts before
`.`, so a stray `build.bak-deploy-…` would read as newest forever while real
backups aged out around it. Anything not named `build.bak.<timestamp>` is
reported and left alone rather than guessed at.

SIGTERM rather than `systemctl restart`, which would ask for a password the
deploying user does not have: the unit is `Restart=always` with `RestartSec=3`
and `server.js` closes cleanly, so systemd brings it back in about three
seconds. Rollback is the reverse and takes about ten — the script prints the
exact command, with the timestamp of the backup it just made.

The script never touches the server's `.env`. Environment variables are managed
by hand there, and a deploy that rewrites secrets is a deploy that can take the
site down with a typo.

### Operational routes

| Route | For |
|-------|-----|
| `/health` | A proxy or uptime check. Touches the database, because "Node is listening" is not the question being asked |
| `/robots.txt` | A route rather than a static file, so `Sitemap:` can be absolute |
| `/sitemap.xml` | Published creators and briefs only |

---

## 11. Configuration reference

| Variable | Required | Without it |
|----------|----------|------------|
| `DATABASE_URL` | Yes | Nothing starts |
| `ORIGIN` | Yes | Every form POST is forbidden and cookies do not verify |
| `BETTER_AUTH_SECRET` | Yes | Sessions cannot be signed. 32+ high-entropy characters in production |
| `FILES_DIR` | Effectively | Defaults to `.tempFiles` beside the working directory — a deploy that replaces the application directory takes every upload with it. Point it outside the deploy |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` | No | The app runs and sends nothing, warning once per process. In-app notifications are unaffected; password resets and address confirmations cannot complete |
| `SMTP_FROM` | No | Defaults to `SMTP_USER`. The address must be one the mailbox may send as, or the server refuses the message even though it accepted the password |
| `SMTP_TLS_SERVERNAME` | No | For shared hosting where `mail.<yourdomain>` answers with a certificate for the provider's domain. Set it to a name the certificate covers and verification stays fully on — rather than reaching for `rejectUnauthorized: false`, which accepts any certificate from anyone on the path |
| `CHAPA_SECRET_KEY` | No | The pay button is not drawn and operators record deposits by hand |
| `CHAPA_PUBLIC_KEY` | No | Unused — it belongs to the inline widget, which this app does not use |
| `CHAPA_WEBHOOK_SECRET` | No | Signatures are not checked. Survivable, because the webhook body is never believed |

`npm run mail:check` connects and authenticates; give it an address and it sends
one message there as well. The two fail differently, which is the point — a
server can take your password and still refuse the From address you asked for.

---

## 12. Roadmap

Two lists. The first closes gaps between what the system already believes and
what it actually does — each one is a place where a table, a flag or a service
exists and nothing reads it, or reads it with a placeholder. The second is new
ground.

Effort is rough: **S** is a day or two, **M** is a week, **L** is longer than
that or needs something outside the codebase.

### 12.1 Sharpen what exists

#### A1 · An in-app notification inbox — **S**, highest value per hour

`server/notify.ts` writes rows into `notifications` on every meaningful event,
and `user_settings` lets a person choose which of them they want. **Nothing
reads that table.** The only surface referencing notifications is the
preferences form that decides what gets written into it.

The settings page is currently describing rules whose in-app half is invisible.
A bell in the dashboard header with an unread count, a panel, a mark-read
action, and a `/dashboard/notifications` page for the full history would make
the preference page honest and would carry every existing event — a new
proposal, a revision request, a claim outcome, a verification decision, a
payment settling — without a single new emitter.

> Touches: `queries.ts` (a `notificationsQuery` against the existing builder),
> a header component, one route.

#### A2 · Instrument response rate — **M**

`domain/score.ts` awards a flat 13 out of 15 for response rate, with the comment
"a placeholder until reply times are instrumented". Every creator therefore
scores identically on a factor the public explainer names, which quietly makes
the score 85 points wide instead of 100 and rewards nobody for actually
replying.

`messages` already carries `createdAt` and `readAt` per deal. A median
first-response time over a rolling window, computed in `score-service.ts` and
stored as a denormalised column beside `score`, turns the fifteen points back
on. It is also the single most useful number a brand could see on a card.

#### A3 · Freshness and provenance on every audience figure — **M**

`social_accounts.followers` and `engagementRate` are typed in by a creator or
imported from a scrape, and once written they look exactly as authoritative as a
figure pulled from a platform API an hour ago. There is an `isVerified` flag per
channel, but no record of *when* a number was last established or *where it came
from*.

Two columns — `measuredAt` and a `source` enum (`self_declared`, `imported`,
`platform_api`) — let every figure be labelled where it is shown, let discovery
sort or filter on freshness, and let the score stop treating a two-year-old
scrape as evidence. This is the foundation A4 and B1 both stand on.

#### A4 · Connect at least one platform API — **L**

With A3's columns in place, an OAuth connection per channel that refreshes
followers and engagement on a schedule turns the largest claim on the site from
an assertion into a measurement. Start with the platform the roster is heaviest
on; the schema does not need to change again.

#### A5 · A real scheduler — **M**

Trending has `autoRefresh` and `refreshIntervalMinutes`, and the comment in
`trending-service.ts` is candid: *"There is no job runner in this deployment, so
the public page that reads the board is what notices it has gone stale."* That
works, but it means the board only refreshes when someone visits, and it puts a
recompute on the same process serving the request.

The same missing runner is why `uploads:prune` is manual, why nothing expires
`trending_overrides` on their own expiry date, why cooldowns lapse lazily, and
why there are no digest emails. One in-process scheduler with a leader lock in
the database — or a systemd timer calling an authenticated endpoint — makes all
five automatic.

#### A6 · Full-text search — **M**

`query.ts` builds `LIKE '%term%'` across the declared columns. It cannot rank by
relevance, it cannot match a stem, and it degrades badly in Amharic. A MySQL
`FULLTEXT` index on the searchable columns of `creators` and `campaigns`, used
when the term is long enough and falling back to `LIKE` when it is not, is a
contained change behind a builder that is already the only thing constructing
these queries.

#### A7 · Organisation seats — **S**

`organization_members` exists with `owner`/`admin`/`member` roles and is written
only at organisation creation. There is no invite, no seat list, no way to
remove someone. A brand is currently one login shared by a team, which is both a
security problem and the reason a second person cannot pick up a negotiation.

#### A8 · Move rate limiting into the database — **S**

better-auth's counters are per process. That fits one node and silently
multiplies the effective limit by the instance count on two. `storage: 'database'`
before the first horizontal scale, not after.

#### A9 · Precompute campaign fit — **M**

`rank` pulls a capped pool into the server, scores it and pages that order. It
is honest about where the cap fell, but the cap exists because the work is done
per request. Materialising fit scores per `(campaign, creator)` when a brief is
published or a profile changes — the same `afterWrite` hook the score already
uses — turns ranking back into an `ORDER BY` and removes the cap.

#### A10 · Retire the last denormalisation drift risks — **S**

`creators.reviewsCount`, `averageRating` and `completedBookings` are written by
services. Add a maintenance script that recomputes all three from source tables
and reports differences, run in CI against the seed. Denormalised columns are
correct until the day one write path forgets, and that day is invisible without
a check.

### 12.2 New capabilities

#### B1 · Audience tiers as a first-class taxonomy — **S**

Reach is currently a raw number with a `minReach` filter. Buyers do not think in
raw numbers; they think in tiers, and each tier is a different kind of buy:

| Tier | Range | What it is bought for |
|------|-------|----------------------|
| Nano | under 10K | Highest engagement, closest to their audience |
| Micro | 10K–100K | Real communities, still affordable |
| Macro | 100K–1M | Serious reach with a clear niche |
| Mega | 1M+ | Household names, national attention |

Derive the tier from `totalReach`, expose it as a `group` filter (the builder
already supports the type — `BOOKING_TABS` uses it), facet it so each tier
carries its count, badge it on the card, and let a brief request one. It costs a
derived column and a handful of message keys, and it changes discovery from a
number line into four intelligible products.

#### B2 · A campaign results report — **L**, and the largest gap in the product

The lifecycle currently ends at *delivered and paid*. `submissions` records that
content was handed over and approved; nothing records **how it performed**. A
brand's most important question — what did this buy me — is answered outside the
platform, which is exactly where a marketplace loses the account.

The shape:

- A `submission_metrics` table: impressions, reach, engagement, clicks, saves,
  per submission, per platform, with `measuredAt` and the same `source` enum as
  A3 so a self-reported number and an API-read number are never confused.
- A campaign results view: spend, creators, deliverables, total reach,
  engagement rate, cost per thousand impressions, and per-creator breakdown.
- A compiled, shareable report at the end of a campaign — the artefact a brand
  actually takes to whoever signed off the budget.

This also completes the `spend-chart.svelte` and LayerChart work already in the
tree, and it feeds A2 and the score with real performance evidence rather than a
declared engagement rate.

#### B3 · Brand monitoring, as a subscription — **L**

Discovery answers *who should I work with*. It does not answer *what is being
said about me, and who is already saying it*. A monitoring product — a brand
registers phrases and hashtags, the system watches the platforms that permit it,
and the brand gets a feed, a volume-over-time chart and, most valuably, a list
of the creators already mentioning them — is a second revenue line that runs on
its own subscription rather than on marketplace take rate.

Be honest in the interface about the differing reach of each platform: some
allow phrase and hashtag search, some allow hashtag only. A monitoring product
that silently under-reports one platform is worse than one that says which
window it is looking through.

Schema: `monitoring_briefs` (owner, phrases, hashtags, platforms, cadence,
subscription state), `monitoring_mentions` (author handle, platform, url,
captured metrics, matched term, `capturedAt`), and a link from a mention to a
`creators` row when the handle is one already on the roster — which is what
turns listening into a shortlist.

#### B4 · A managed service tier — **M**

Not every brand wants to run a campaign themselves, and self-serve pricing does
not fit a campaign with fifteen creators across three markets. Two additions
cover it:

- **Brand access requests.** A short public form — company, market, budget
  band, what they are trying to do — that lands in an operator queue rather than
  creating an account. Personalised onboarding is a better first impression than
  an empty dashboard, and the queue is a qualified lead list.
- **A quote object.** An operator composes a quote against a campaign — line
  items, creators, fees, validity — the brand accepts it, and accepting creates
  the bookings. `term_proposals` is nearly this shape already, one level down.

Mark on each organisation which mode it is in, because the interface should not
offer a self-serve checkout to an account that is invoiced.

#### B5 · Invoicing — **M**

Chapa collects a deposit per booking. A brand running six campaigns a quarter
wants one invoice, net terms, a purchase-order number and a VAT line — not six
card receipts. An `invoices` table over existing bookings (and, for B3, over
subscriptions), with a rendered PDF, a paid/overdue state and a reminder
schedule, is what makes the platform usable by an organisation with a finance
department.

Pair it with **payouts** (§8, *What is not connected*): bank or mobile-money
details on creator profiles, Chapa Transfers, and a batched release run. Until
that exists, `settle` releases escrow as a record and the interface has to keep
saying so.

#### B6 · Self-serve removal, without an account — **S**

The privacy page already promises that removal is available for the asking, and
most profiles were compiled from public sources before the person arrived. Right
now the asking happens by email.

A **Remove this profile** link on every public creator page, leading to a short
form that verifies control of one listed channel — or simply lands in the
operator queue with a note — is the smallest possible version, and it is both an
ethical obligation and a defensible answer to a data-protection request. It
belongs beside the existing **Is this you?** claim link, since a person arriving
at their own imported page wants one of exactly two things.

#### B7 · A roster application front door — **M**

`/register` creates an account and then asks the person to build a profile.
There is no way for a creator to *apply* — to say who they are and be reviewed
before appearing. The verification queue is close, but it operates on a profile
that is already published.

An application form, an operator review, and approval that creates the profile
in a published state gives the roster a quality floor and gives the platform
something to say about what being listed means. It reuses
`verification_requests`' exact shape and the claims queue's exact interaction.

#### B8 · A creator earnings ledger — **S**

`payments` holds every attempt and `bookings` holds the fee split, but a creator
has no single page answering *what have I earned, what is owed, and when did it
arrive*. One view over existing rows — settled, pending, in escrow, per deal,
with a downloadable statement — needs no new tables and is the page a creator
will open most often after the deal list.

#### B9 · Saved searches and alerts — **S**

Discovery state lives entirely in the URL, which means a saved search is a saved
string. Persist those strings per user, and let one be subscribed to: *tell me
when a creator matching this appears*. The same mechanism, pointed at
`campaigns` instead, gives creators a brief alert — which is what turns an
occasional visitor into a weekly one.

The notification plumbing for both already exists and is waiting on A1.

#### B10 · Invite a shortlist to a brief — **S**

A brand can save creators and can publish a brief, but cannot send the brief to
the people it saved. One action over `saved_creators` and `campaigns` that
creates an invited application per creator — with an opening message, subject to
the contact masker — closes the loop between the two halves of the brand
workspace and is a handful of rows of code over machinery that already exists.

#### B11 · Market landing pages — **M**

`countries`, `regions` and `regions.majorCities` are already populated, and
`sitemap.xml` already publishes creators and briefs. Generated pages for a
market — *creators in Addis Ababa*, *food creators in Nairobi* — with the local
currency, the local payment rails from `countries.paymentRails`, and copy in the
local language, are cheap to build over the existing query builder and are the
single best source of unpaid demand-side traffic a marketplace has.

#### B12 · Usage rights in the frozen terms — **M**

`termsSnapshot` freezes deliverables, price and revisions. It does not record
what the brand may *do* with the content afterwards: how long, on which
channels, whether it may be run as a paid advertisement, whether exclusivity
applies in the category and for how long.

That is the clause most often disputed in this business, and it is the clause
that most often justifies a higher price. Adding a usage-rights block to the
proposal form, freezing it into the snapshot with everything else, and rendering
it on the deal is a contained change with a direct effect on transaction value.

### 12.3 Suggested sequencing

| Phase | Items | Why this order |
|-------|-------|----------------|
| **1 — Make the existing product honest** | A1, A8, B6, B8, A10 | All small. Each closes a gap between what a page says and what the system does. A1 alone unlocks B9 and B10 |
| **2 — Make the numbers real** | A3, A2, A5, B1 | Provenance first, then the score factor that depends on it, then the runner that keeps everything fresh, then the taxonomy that makes reach legible |
| **3 — Close the loop on outcomes** | B2, B12, B10, B9 | Results reporting is the largest gap in the product; usage rights raise the value of every deal it applies to |
| **4 — Serve the accounts that pay most** | B4, B5, B7, A7 | Managed service, invoicing, a vetted front door and real team seats are what an organisation with a procurement process needs |
| **5 — Grow demand and add a second line** | B11, B3, A4, A6, A9 | Landing pages first because they are cheap; monitoring is a product in its own right and should not be started until the marketplace's own loop is closed |

---

## 13. Appendices

### 13.1 Route map

**Public**

```
/                        Gallery, trending board, entry points
/discover                Creator index — search, 8 filters, 6 sorts, facet counts
/creators/[username]     Profile, channels, packages, portfolio, reviews, booking
/creators/[username]/reviews   Paginated reviews endpoint
/campaigns               Open briefs
/campaigns/[slug]        One brief, and applying to it
/terms  /privacy         Legal, with fee and support address read from settings
/login  /register  /logout
/forgot-password  /reset-password  /verify-email
```

**Dashboard — creator**

```
/dashboard               Pipeline, earnings, score, next actions
/dashboard/profile       …/create   …/claim
/dashboard/channels      /packages   /portfolio
/dashboard/applications  /bookings   /bookings/[id]
/dashboard/verification  /reviews    /settings
```

**Dashboard — brand**

```
/dashboard/organization  …/create
/dashboard/campaigns     /shortlist   /bookings   /reviews
```

**Dashboard — operator**

```
/dashboard/admin/countries  /regions  /categories  /platforms  /languages
/dashboard/admin/creators   /organizations  /users
/dashboard/admin/verification  /claims  /introductions
/dashboard/admin/trending   /gallery  /settings  /audit
```

**Endpoints**

```
/health                        Touches the database
/robots.txt  /sitemap.xml      Routes, so URLs can be absolute
/api/chapa/webhook             Public, unauthenticated, and never believed
/files/[name]                  Public uploads
/files/private/[name]          Verification evidence, after an authorisation check
```

### 13.2 Script index

| Command | Does |
|---------|------|
| `npm run dev` | Dev server |
| `npm run build` | Production build (node adapter) |
| `npm run verify:build` | Fail if `build/` imports anything absent on the server |
| `npm run deploy` | Build, verify, back up, ship, restart, check (`--dry-run` available) |
| `npm run check` | svelte-check |
| `npm run lint` / `format` | prettier + eslint |
| `npm run test:unit` | vitest |
| `npm run test:e2e` | Playwright, against a production build |
| `npm test` | Both |
| `npm run db:generate` | Write a migration for the current schema |
| `npm run db:migrate` | Apply everything in `drizzle/` |
| `npm run db:migrate:remote` | The same, against the server |
| `npm run db:baseline` | Record migrations as applied — for a database `push` created |
| `npm run db:push` | Rewrite the schema in place. **Not the deploy path** |
| `npm run db:seed` | Reference data, 14 creators, 5 organisations, 6 campaigns — idempotent |
| `npm run db:studio` | Drizzle Studio |
| `npm run mail:check` | Connect and authenticate; `-- you@host.tld` also sends one |
| `npm run import:creators` | Import the scraped creator CSV into the schema |
| `npm run fetch:avatars` | Backfill creator avatars |
| `npm run uploads:prune` | Find files no row points at (`-- --apply` to remove them) |
| `npm run auth:schema` | Regenerate better-auth's tables |

### 13.3 Glossary

| Term | Means here |
|------|-----------|
| **Booking** | One deal between an organisation and a creator, with its own reference and lifecycle |
| **Brief / campaign** | An organisation's published call, with exactly one compensation model |
| **Claim** | A request by an account to take over a profile imported before they arrived. Grants nothing until approved |
| **Escrow** | A recorded state on a booking — `unfunded`, `pending`, `held`, `released`, `refunded`. Money in is real; money out is still a record, not a transfer |
| **Facet** | The count of what one filter choice would return, with every *other* filter applied |
| **Fit / match score** | Deterministic campaign↔creator score across five weighted factors |
| **Introduction** | A deal opened against a creator who has no account here. Badged everywhere, and queued for an operator |
| **Masking** | Rewriting contact details out of deal messages |
| **Score** | The creator's derived 0–100 number. Never entered, always recomputed |
| **Terms snapshot** | The deal's terms, frozen once on mutual acceptance and never rewritten |
| **Trending board** | The published set of slots, with each signal's contribution stored per slot |

---

<div align="center">

*Creator Network · Product & Technical Documentation · September 2026*

</div>
