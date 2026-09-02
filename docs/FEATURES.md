<div align="center">

# Creator Network

### The Complete Feature Catalogue

**Every capability the platform ships, by the surface it appears on and the role it serves.**

`v0.0.1` · September 2026 · 58 routes · 43 tables · 1,841 strings × 2 locales

</div>

---

## Contents

| # | Section | What it lists |
|---|---------|---------------|
| 1 | [How to read this](#1-how-to-read-this) | Scope, conventions, and what "shipped" means here |
| 2 | [The feature map](#2-the-feature-map) | Everything at a glance, in one table |
| 3 | [Discovery and the public site](#3-discovery-and-the-public-site) | What a visitor with no account can do |
| 4 | [The creator workspace](#4-the-creator-workspace) | Profile, channels, packages, portfolio, applications |
| 5 | [The brand workspace](#5-the-brand-workspace) | Organisation, briefs, shortlist, spend |
| 6 | [The deal engine](#6-the-deal-engine) | Lifecycle, terms, messaging, delivery, reviews |
| 7 | [Payments and money](#7-payments-and-money) | Chapa checkout, escrow states, fee split, currency |
| 8 | [Trust, identity and verification](#8-trust-identity-and-verification) | The ladder, claims, introductions, badges |
| 9 | [Ranking and curation](#9-ranking-and-curation) | The creator score, the match score, trending, lanes |
| 10 | [Editorial](#10-editorial) | The blog, its editor, its feed, its states |
| 11 | [The operator console](#11-the-operator-console) | Reference data, queues, levers, the audit log |
| 12 | [Accounts, access and notifications](#12-accounts-access-and-notifications) | Sign-in, roles, sessions, preferences, mail |
| 13 | [Platform capabilities](#13-platform-capabilities) | The features every screen inherits for free |
| 14 | [Security features](#14-security-features) | What is enforced, and where |
| 15 | [Operations and tooling](#15-operations-and-tooling) | Build, test, deploy, scripts, health |
| 16 | [Appendix: route map](#16-appendix-route-map) | All 58 routes |
| 17 | [Appendix: data model](#17-appendix-data-model) | All 43 tables, grouped |

---

## 1. How to read this

This document is a catalogue, not an architecture paper. It answers one
question — *what can this thing do?* — and answers it surface by surface. Where
a feature only makes sense alongside the rule that constrains it, the rule is
stated too, because a capability described without its limit is a capability
described inaccurately.

Three conventions run through it:

- **Only what is built.** Nothing here is planned, stubbed or half-wired unless
  the entry says so in as many words. Where the platform stops — payouts, for
  one — there is an explicit entry saying it stops.
- **Roles are named as the system names them.** `admin`, `creator`, `brand`.
  A person may hold a creator profile and an organisation membership at once;
  the dashboard adapts rather than forcing a choice.
- **A feature is listed once, in the place it is used from,** and
  cross-referenced from anywhere else it appears.

> **What the platform is.** A two-sided marketplace connecting organisations —
> brands, startups, agencies, NGOs, government bodies and event organisers —
> with content creators across Ethiopia and the wider Pan-African market. It
> covers the whole collaboration rather than the introduction alone: discovery,
> negotiation, agreed terms, delivery, review and settlement, with a durable
> record at every step.

---

## 2. The feature map

| Area | Features | Reaches |
|------|----------|---------|
| **Discovery** | Faceted creator search, campaign index, creator profiles, quick view, public reviews endpoint, shortlist toggle, homepage gallery and trending strip | Anyone |
| **Creator workspace** | Profile editor and publish toggle, first-run creation, profile claiming, social channels, priced packages, portfolio, brief applications, verification submission, reviews, earnings dashboard | `creator` |
| **Brand workspace** | Organisation profile and creation, campaign briefs with three compensation models, application triage, shortlist, spend dashboard, reviews written | `brand` |
| **Deals** | Nine-state lifecycle, counter-proposals, frozen terms snapshot, masked messaging, submissions, reasoned revisions, two-way reviews, per-transition audit | Both sides |
| **Money** | Chapa hosted checkout, verified settlement, escrow states, stored fee split, manual deposit recording, per-country currency conversion | Brand, operator |
| **Trust** | Four-level verification ladder with evidence review, profile claims queue, introduction queue for unclaimed profiles, representation badges | Operator |
| **Ranking** | Derived 0–100 creator score, five-factor campaign fit score, ten-signal trending policy, six kinds of trending lane, reader-location ranking | Automatic |
| **Editorial** | Rich-text article editor, sanitised HTML storage, sections, tags, galleries, scheduling, RSS, SEO metadata | `admin` |
| **Operations** | Five reference-data tables, three review queues, site settings, homepage gallery, user roles, append-only audit log | `admin` |
| **Accounts** | Email/password and Google sign-in, email confirmation, password reset, session listing and revocation, notification preferences, account-closure requests | Everyone |
| **Platform** | Two locales, dark and light themes, one query builder, one CRUD factory, one form-field kit, sortable exportable tables, validated uploads, SEO routes | Every screen |

---

## 3. Discovery and the public site

Everything in this section works with no account and is indexed by search
engines.

### 3.1 Homepage

| Feature | Detail |
|---------|--------|
| Gallery carousel | Operator-arranged slides, ordered, each with its own image, copy and link |
| Trending strip | The live board, re-ranked for the reader's own market when local ranking is enabled |
| Lane switcher | The board cut into lanes — by category, country, region, city, platform or language — switchable in place, with the reader's own market lifted to the front |
| Entry points | Into discovery, into open briefs, into sign-up as either side |
| Hero copy | Read from site settings, so an operator changes it without a deploy |

### 3.2 Creator discovery — `/discover`

The main index, and the most heavily featured screen on the public site.

**Search.** Free text across name, handle, bio and city.

**Filters.** Each carries a live count of what choosing it would return, computed
with every *other* filter applied — so the numbers stay true while you stand on
one of them.

| Filter | Kind |
|--------|------|
| Country | Multi-select, faceted |
| Region | Single, dependent on country |
| Platform | Multi-select |
| Verification level | Enum — unverified, social, identity, CN verified |
| Availability | Available, busy, away |
| Maximum starting price | Range |
| Minimum total reach | Range |
| Category | Multi-select chips |

**Sorts.** Score, reach, price, rating, newest — and **fit**, which ranks
against a chosen campaign using the five-factor match score rather than any
column in the database. Fit ranking is computed in the server over a capped
pool, and the result reports where the cap fell rather than pretending it did
not.

**Per-card features.** Verification badge, representation badge, trending badge,
availability, starting price in the creator's own currency, primary channel
reach, and a **quick view** dialog that opens the essentials — packages, top
channels, categories — without leaving the grid. A shortlist toggle saves the
creator for signed-in brands.

**URL state.** `?q=…&country=…&sort=fit&campaign=…&page=2` is the entire state
of the screen, which is what makes a result linkable and the back button
correct.

### 3.3 Creator profile — `/creators/[username]`

| Feature | Detail |
|---------|--------|
| Audience figures | Per channel: handle, followers, engagement rate, platform-verified flag |
| Reach summary | Total reach, overseas percentage, top audience countries |
| Categories and languages | The creator's declared taxonomy |
| Packages | Deliverables, price, delivery days, revision allowance |
| Portfolio | Image or video work samples, with views and likes |
| Reviews | Paginated through an endpoint of their own, so the profile page stays small |
| Score explainer | The derived 0–100 score with a public modal showing every weight |
| Verification badge | The level, and what it means |
| Representation badge | Whether the person behind the profile actually holds an account here |
| Book directly | Opens a booking dialog against a chosen package, from the profile |
| Is this you? | The claim link, for a creator whose profile was imported before they arrived |

### 3.4 Open briefs — `/campaigns` and `/campaigns/[slug]`

Published campaigns, filterable by compensation model, category and market. A
brief states its compensation model exactly once, and the fields shown follow
from it:

| Model | Shows |
|-------|-------|
| `paid` | Budget range and currency |
| `barter` | The barter details |
| `event_pass` | Event name, date, location and pass type |

A brief also carries its objective, deliverables, deadline, creators needed,
follower bracket, target platforms, target regions, language and tags. Signed-in
creators apply from the page; the application carries a pitch and a proposed
rate.

### 3.5 Editorial and legal

| Route | Feature |
|-------|---------|
| `/blog` | The public article index — sections, tags, featured posts, search |
| `/blog/[slug]` | An article, with its gallery, reading time and social metadata |
| `/blog/rss.xml` | The feed |
| `/terms`, `/privacy` | Ordinary pages, with the platform fee and support address read from site settings so the terms cannot disagree with what the app charges |

### 3.6 Machine-readable surfaces

| Route | Feature |
|-------|---------|
| `/sitemap.xml` | Published creators, published briefs and published posts |
| `/robots.txt` | A route rather than a file, so `Sitemap:` can be absolute |
| `/creators/[username]/reviews` | Paginated reviews as data |
| `/health` | Touches the database, because "Node is listening" is not the question an uptime check is asking |

---

## 4. The creator workspace

### 4.1 The dashboard

Deal pipeline by state, earnings to date, amounts awaiting settlement, the
current score, active bookings and the next actions waiting on the creator.

### 4.2 Profile — `/dashboard/profile`

| Feature | Detail |
|---------|--------|
| Public page editor | Full name, handle, bio, country, region, city, primary platform |
| Media | Avatar and cover image, uploaded and validated |
| Taxonomy | Categories and languages as toggleable chips |
| Commercials | Starting price and its currency, availability state |
| Publish toggle | A profile is not public until the creator says so |
| First-run creation | `/dashboard/profile/create` for an account with no profile yet |
| Claiming | `/dashboard/profile/claim` — take over a profile imported before you arrived |

Every write here recalculates the creator's score, so the number on the public
card never lags the profile it describes.

### 4.3 Channels — `/dashboard/channels`

Social accounts, added, edited and removed: platform, handle, profile URL,
follower count, engagement rate, and whether the account is verified on its own
platform. One channel is the primary, and drives the platform-fit factor in the
match score.

### 4.4 Packages — `/dashboard/packages`

Priced offers: title, description, deliverables, price and currency, delivery
days, and how many revisions are included. A package is what a booking is opened
against, and its terms are what get frozen into the deal.

### 4.5 Portfolio — `/dashboard/portfolio`

Work samples — image or video — with title, description, the campaign or client
it was for, and view and like counts.

### 4.6 Applications — `/dashboard/applications`

Applications to open briefs and their outcomes: `applied`, `shortlisted`,
`selected`, `rejected`, `withdrawn`. A creator can withdraw their own; the
organisation's decision carries a note that stays with the record.

### 4.7 Verification — `/dashboard/verification`

Submit evidence and request a level. The ladder and what each rung asks for is
in §8.1.

### 4.8 Reviews — `/dashboard/reviews`

Reviews received from organisations and reviews written about them, with the
four sub-scores each review carries.

---

## 5. The brand workspace

### 5.1 The dashboard

Campaign performance, a spend chart over time, committed versus settled amounts,
applications waiting to be reviewed, the shortlist, and open deals.

### 5.2 Organisation — `/dashboard/organization`

| Feature | Detail |
|---------|--------|
| Profile | Name, type, description, website, market, logo |
| Types | Company, startup, agency, NGO, government, event organiser |
| Verification | The same four-level ladder creators use |
| Creation | `/dashboard/organization/create` for a brand account with no organisation |
| Membership | An organisation carries members with roles, so more than one person can act for it |

### 5.3 Campaigns — `/dashboard/campaigns`

Create, edit, publish, close and delete briefs. A brief carries everything
listed in §3.4, plus a draft state that is invisible publicly, and a live count
of applications received. Applications are triaged from the same surface:
shortlist, select or reject, each with a decision note.

### 5.4 Shortlist — `/dashboard/shortlist`

Saved creators, carrying the same badges discovery shows — verification,
representation, trending — so a saved card does not go quietly stale about who
it represents.

---

## 6. The deal engine

The part of the product that makes it a marketplace rather than a directory.

### 6.1 The lifecycle

```
proposed ──→ negotiating ──→ booked ──→ in_production ──→ submitted ⇄ revision
                                                              │
                                                              ▼
                                             approved ──→ awaiting_settlement ──→ completed

any open state ──→ cancelled / declined
```

Transitions are declared in one place and enforced on the server. A client
requests an action; it never asserts a state.

### 6.2 What a deal carries

| Feature | Detail |
|---------|--------|
| Reference | A human-quotable identifier for support conversations |
| Terms | Title, brief, deliverables, deadline, revision allowance, compensation model |
| Price | Amount and currency, plus the platform fee and creator payout, split and stored at creation |
| Terms snapshot | Frozen on mutual acceptance, once — editing a profile, package or brief afterwards cannot reach into a live deal |
| Escrow state | `unfunded`, `pending`, `held`, `released`, `refunded` |
| Introduction state | Whether anyone has yet reached the creator behind an unclaimed profile (§8.3) |

### 6.3 Actions on a deal

| Action | Who | Does |
|--------|-----|------|
| `propose` | Either | Open a counter-proposal with new terms |
| `respond` | The other party | Accept or decline the open proposal; accepting freezes the snapshot |
| `payDeposit` | Brand | Open a Chapa checkout for the deposit |
| `fund` | Operator | Record a deposit that moved outside the platform |
| `submit` | Creator | Hand over the work, with a link, files and a note |
| `review` | Brand | Approve the submission, or request a revision with a reason |
| `settle` | Operator | Release escrow as a record and complete the deal |
| `rate` | Both | Leave a review once the deal is complete |
| `message` | Both | Post to the deal conversation |

### 6.4 Rules that are load-bearing

- **Terms freeze on mutual acceptance.** Written once, never rewritten.
- **A revision needs a reason,** and spends one of the agreed allowance.
- **Completion needs compensation.** A paid booking cannot complete until its
  deposit is recorded.
- **Every state change appends to the audit log** — actor, object, from-state,
  to-state, reason. Nothing in the application updates or deletes that table.

### 6.5 Messaging, with contact masking

Deals stay on-platform because the escrow, the delivery record and the review
only exist here. Masking is what keeps that true. Before a message is stored,
the following are rewritten:

- Email addresses
- Ethiopian mobile formats — `+251…`, `09…`, `07…`
- Generic long digit runs
- Messenger handoffs — `t.me/…`, `wa.me/…`, Telegram and WhatsApp mentions

The message records that it was masked, so neither party is left wondering
whether their text arrived intact.

### 6.6 Reviews

One active review per party per completed deal, in either direction. A review
carries an overall rating and four sub-scores — communication, professionalism,
timeliness, quality — plus a body. Creator ratings and review counts are
maintained from these, and feed the score and the match score.

---

## 7. Payments and money

### 7.1 Chapa checkout

The brand's deposit is collected through Chapa's hosted page. The integration's
security rests on one inversion: **the webhook body is never believed.** The
public webhook reads the payload for a transaction reference, throws the rest
away, and asks Chapa what happened over a connection this server opened. A
forged request can therefore make the app ask a question, never assert an
answer. A signature is checked when the secret is configured, as defence in
depth rather than the thing holding the door.

| Feature | Detail |
|---------|--------|
| Amount re-check | Amount and currency are verified against what was asked for; a mismatch fails the payment and files an audit line |
| Idempotent settlement | The browser returning and the webhook arriving both land on the same code path, in either order, safely |
| Immediate feedback | Resolving on the return page as well as the webhook makes the outcome visible at once, including where a webhook cannot be delivered at all |
| Full attempt history | Every attempt is kept, abandoned ones included — the difference between "never tried" and "tried twice and gave up" matters exactly once, in support |
| Funding starts work | A funded deposit moves a booking from `booked` to `in_production`, because submission accepts nothing earlier |
| Currency scope | ETB only; a booking priced otherwise says so and falls back to the operator path rather than being converted at a stale rate |

### 7.2 Manual deposits

Operator-only recording of money that genuinely moved outside the platform — a
bank transfer, telebirr paid directly. A `MANUAL-` reference is what tells the
two kinds of deposit apart afterwards.

### 7.3 The fee split

The platform fee and the creator payout are computed and stored on the booking
at creation, so a later change to the platform fee cannot rewrite the history of
a completed deal. The current fee is an operator setting, and the terms page
reads it from the same place.

### 7.4 Currency

Conversion goes through a per-country USD rate an operator maintains: one source
of truth, no live FX feed to fail. A price is stored in its own currency
alongside its code, so a listing shows what the creator actually asks.

### 7.5 What is not connected

**Payouts.** Money comes in through Chapa; it goes out by hand. Settlement
releases escrow as a record, not a transfer, and the interface says so rather
than implying a creator has been paid. Wiring the other direction needs Chapa
Transfers, a funded balance and bank details on creator profiles — none of which
exist yet.

---

## 8. Trust, identity and verification

### 8.1 The verification ladder

Four levels, applying to creators and organisations alike:

| Level | Means |
|-------|-------|
| `unverified` | Nothing submitted |
| `social_verified` | Channel ownership shown |
| `identity_verified` | Identity evidence accepted |
| `cn_verified` | The platform's own highest assurance |

A subject submits evidence and requests a level; an operator reviews it at
`/dashboard/admin/verification` and approves or rejects with a note. The level
shows as a badge everywhere the subject appears, weighs into the creator score,
and can be set as a floor for trending eligibility.

### 8.2 Claiming an imported profile

Most creator profiles here were compiled from public sources before the person
arrived. An imported profile carries follower counts, a score and any deals
already opened against it, so claiming one is an identity claim and goes through
a queue.

| Feature | Detail |
|---------|--------|
| Two ways in | A matcher offers candidates for the signed-in account; the public profile carries an **Is this you?** link |
| Exact matching | Normalised and exact, never fuzzy — a near-miss would show one stranger another stranger's asking price |
| A claim grants nothing | The only write that attaches an account is an operator approving it |
| One open claim per account | So the queue stays about people, and withdrawal has an unambiguous subject |
| Approval closes competitors | Every other pending claim on that profile is closed with its own note and audit line |

### 8.3 Deals against a profile nobody has claimed

A brand can open a booking against a creator who has no account here. The deal
is written — the intent is real — but it opens as an introduction, and every
surface says so: a badge on the card, the quick view, the shortlist and the
profile; a notice inside the booking dialog before an offer is written; a banner
on the deal itself. Without that, `proposed` reads as "waiting on the creator"
when nobody can answer it.

`/dashboard/admin/introductions` is the queue those land in. An operator moves a
case `pending → contacted → connected`, or declines it with a reason — which
also cancels the deal, through the same transition gate as any other lifecycle
move.

### 8.4 Representation badge

A single, plain statement on every creator surface of whether the person behind
the profile holds an account here. It is the feature that keeps the rest of the
catalogue honest about what a listing is.

---

## 9. Ranking and curation

Four ranking features, all of them arithmetic an operator can argue with rather
than a model nobody can.

### 9.1 The creator score

A 0–100 number derived from evidence only. No field on any form writes it; it is
recomputed after every write that could move it. The weights are the ones the
public explainer shows, because a score nobody can interrogate is a score nobody
should trust.

| Component | Out of | Made of |
|-----------|--------|---------|
| Profile completeness | 30 | Name, bio over 20 characters, avatar, cover, categories, languages, at least one package, at least one portfolio item |
| Verification | 25 | CN verified 25 · identity 20 · social 15 · unverified 5 |
| Engagement | 15 | Engagement rate scaled against a 10% ceiling |
| Response rate | 15 | A flat placeholder — reply times are not yet instrumented |
| Track record | 15 | Completed bookings to a cap, plus average rating |

### 9.2 The campaign fit score

Campaign-to-creator fit across five weighted factors, producing a total, a tier,
a short list of stated synergies, a predicted impression range and a recommended
angle. It drives the **fit** sort on discovery.

| Factor | Out of | Rewards |
|--------|--------|---------|
| Niche alignment | 25 | Direct category match, adjacent category, or neither |
| Audience geography | 25 | Home-market match, or overlap with the brief's target regions and the creator's top audience countries |
| Performance | 25 | Engagement rate, rating weighted by volume of completed work, verification |
| Platform fit | 15 | Primary channel in the brief's platforms, or any channel |
| Budget headroom | 10 | Asking price against the brief's ceiling; for barter and event passes, whether reach sits in the requested bracket |

Category adjacency is a declared, symmetric map — a fintech brief should still
surface a business creator.

### 9.3 Trending as a policy

Trending is not a checkbox. `/dashboard/admin/trending` is where an operator
decides what the word means, and every part of it is a stored setting.

**Ten weighted signals:** profile score, reach, engagement, recent bookings,
applications, reviews, rating, shortlist saves, newcomer boost and verification.
The weights are *relative* — divided by their own sum — so raising one does not
silently steal from the other nine.

| Lever | Choices |
|-------|---------|
| Mode | Manual (ticked by hand) · automatic (ranking only) · hybrid (pins, then ranking) |
| Slots | How many creators the board holds |
| Window | Activity older than N days is not counted at all |
| Half-life | How fast activity inside that window loses value; zero counts it flat |
| Comparison | Percentile (rank against the pool) or min–max (keep the real distances) |
| Eligibility | Floors on score, reach, rating and verification; live channel, availability, recent activity |
| Fairness | Maximum per category and per country, maximum days on the board, rest afterwards |
| Location | Restrict the board to one market; boost or hard-sort by the reader's own place, matched on country, region or city |
| Overrides | Pin, boost or block one creator — each with a reason and an expiry |
| Freeze | Hold the current board while settings are edited |

Three properties are deliberate:

- **Preview runs the real ranking.** The preview button posts the unsaved form
  to a dry run of the same function the publish path calls, and writes nothing.
- **Saving publishes,** unless the board is frozen. Settings saved but not
  applied are the surest way to make an algorithm screen untrustworthy.
- **Every slot can be explained.** Each entry stores the contribution of each
  signal to its rank, each run stores the settings it used, and the flag on the
  creator row is rewritten from the board — so the badge on a card and the strip
  on the homepage cannot disagree.

### 9.4 Trending lanes

The board, cut into slices the reader can switch between on the homepage. Six
kinds of lane, each of them a grouping the database already carries:

`category` · `country` · `region` · `city` · `platform` · `language`

A lane keeps the order the main board produced — there is deliberately no second
ranking, so "trending in fashion" cannot disagree with "trending" about which of
two fashion creators is doing better. How many lanes of each kind to keep is a
setting, lanes of one kind are ordered by their best score, and the reader's own
market is lifted to the front.

There is no job runner in this deployment, so the public page that reads the
board is what notices it has gone stale. The recompute is not awaited by the
request, and a lock keeps concurrent readers from starting several at once.

---

## 10. Editorial

An operator-only rich-text publishing surface, at `/dashboard/admin/blog`.

| Feature | Detail |
|---------|--------|
| Editor | Tipex/Tiptap rich text, with the published article's own stylesheet applied so a heading is the size it will be |
| Body | HTML, sanitised on write to an allowlist — never on read |
| Inline images | Uploaded before the post is saved, through an endpoint that re-checks the role itself |
| Featured image | With its own alt text |
| Gallery | Ordered images under the article |
| Sections | A reference table of its own, separate from the creator taxonomy so renaming one cannot rename the other |
| Tags | Free-form |
| Excerpt and reading time | Shown on cards and in the index |
| Search text | A denormalised column, so the index searches the body without scanning HTML |
| SEO metadata | Meta title, meta description, OG image, and a `noindex` switch |
| Author | Recorded by account and by display name |
| Featured and sort order | For arranging the index by hand |
| Three states | `draft` is a 404 to everyone but an operator, who sees it with a preview banner; `published` with a future date is scheduling, since the public query hides anything dated later than now; `archived` keeps a URL reachable while dropping it from the index and the feed |
| Feed | `/blog/rss.xml`, and published posts join the sitemap |

The sanitiser is a parse, not a pattern: it builds the document the browser
would build, then drops scripts, iframes, forms, `on*` handlers and
`javascript:` URLs. `data:` survives on images alone, because the editor pastes
them that way. Class names are matched against a small set, so a body cannot
reach into the site's own utilities and repaint the page.

---

## 11. The operator console

### 11.1 Reference data

Five tables, each a single CRUD declaration that gets search, paging, CSV export
and soft delete without its route asking for them.

| Table | Carries |
|-------|---------|
| Countries | Currency code, USD rate, payment rails |
| Regions | Their country, and major cities |
| Categories | The creator taxonomy, with slugs and icons |
| Platforms | The channels a creator can hold |
| Languages | With native names |

### 11.2 Queues

| Queue | Decides |
|-------|---------|
| `/dashboard/admin/verification` | Evidence review, four levels, approve or reject with a note |
| `/dashboard/admin/claims` | Who owns an imported profile; approval is the only write that attaches an account |
| `/dashboard/admin/introductions` | Reaching creators behind unclaimed profiles; a decline cancels the deal |

### 11.3 Levers

| Surface | Controls |
|---------|----------|
| `/dashboard/admin/trending` | The ranking policy in full, plus preview, freeze, overrides and cooldown clearing |
| `/dashboard/admin/gallery` | Homepage slides, ordered |
| `/dashboard/admin/settings` | Site name, hero copy, platform fee, support contacts |
| `/dashboard/admin/blog` | Articles and sections |
| `/dashboard/admin/users` | Roles |
| `/dashboard/admin/creators` | Creator records, publication and featuring |
| `/dashboard/admin/organizations` | Organisation records |

### 11.4 The audit log

`/dashboard/admin/audit` reads an append-only table. Every lifecycle transition,
every queue decision, every payment discrepancy and every role change files a
line: actor, object, from-state, to-state, reason, timestamp. Nothing in the
interface writes to it directly and nothing anywhere updates or deletes it.

### 11.5 The admin dashboard

Published creators, organisations, live campaigns, booking volume over time,
combined reach, the size of the verification queue, and a recent-activity feed
drawn from the audit log.

---

## 12. Accounts, access and notifications

### 12.1 Signing in

| Feature | Detail |
|---------|--------|
| Email and password | With deliberately vague failures, so a response cannot be read for whether an address exists |
| Google | Linked to an existing local account only when that account's address is already confirmed |
| Registration | Choosing a side — creator or brand — at sign-up, through a card picker rather than a dropdown |
| Email confirmation | Sent on sign-up; not a gate, since an unverified account signs in normally and the settings page offers the link again |
| Password reset | `/forgot-password` sends the link, `/reset-password` is where it lands; a reset revokes every session the account had and opens none |
| Rate limiting | Ten sign-ins a minute, five sign-ups per ten minutes |

### 12.2 Roles and scoping

Three roles — `admin`, `creator`, `brand` — checked in a guard rather than in
each route. Ownership is a separate argument from filtering everywhere it
matters, so a crafted URL cannot widen a scope: a creator cannot reach another
creator's package by changing an id in a form, and a posted id is re-checked
against the session's own rows before anything is written.

### 12.3 Account settings — `/dashboard/settings`

The account itself, kept deliberately apart from the public profile so that
"settings" does not become a second profile editor.

| Feature | Detail |
|---------|--------|
| Details | Name and email |
| Password | Change, with the current one |
| Notification preferences | Six switches over four categories (§12.4) |
| Sessions | See where the account is signed in, and revoke everything else |
| Resend confirmation | For an address that was never confirmed |
| Account closure | Requested, not switched — an operator unpicks it by hand, because deleting the row would cascade through an organisation to every deal it ever made. The request reaches every admin, and can be cancelled |

### 12.4 Notifications

One call site writes both channels: it reads the recipient's preferences, writes
the in-app row if they want one, and hands the words to mail if they want mail.

| Category | In-app | Email |
|----------|--------|-------|
| Deals — proposals, submissions, decisions, settlement | Optional | Optional |
| Messages | Optional | Optional |
| Account — decisions about your account | **Always** | Optional |
| Product — announcements | Never | Optional |
| Security — resets, new sign-ins | **Always** | **Always** |

Two things cannot be switched off, and neither is rendered as a toggle: security
mail, because consenting in advance to not being warned is not something a
person can meaningfully do; and account decisions in the interface, because that
is how the interface explains itself.

Mail is never awaited — the action that raised it has already succeeded and the
in-app row is the durable record. Security mail is the exception in both
directions: it consults no preference, writes no in-app row (the recipient may
be locked out of the interface that would show it), and it *is* awaited, because
there the send is the action.

A missing preferences row is not a row to repair; it means the defaults. An
account that never opened the page behaves exactly like one that opened it and
changed nothing.

---

## 13. Platform capabilities

Features every screen inherits without asking for them.

### 13.1 Two languages

English and Amharic, 1,841 message keys each, with no key missing from either.
Locale is resolved per request, and messages are compiled rather than looked up
at runtime.

### 13.2 Two themes

Dark and light, with a palette both are generated from, a toggle in the nav, and
a preference that survives a reload without a flash of the wrong one.

### 13.3 One query builder

Every listing in the app is the same query with different columns: a search,
some filters, a sort and a page. A surface declares what it exposes and gets a
function that reads a URL.

| Capability | Detail |
|------------|--------|
| Search | Across declared columns, escaped before it reaches a `LIKE` |
| Filters | Enum, group, multi-select and range, each checked against its column's vocabulary |
| Facet counts | What each choice of one filter would return, with every other filter applied |
| Sorting | Looked up in a map — an unrecognised key is dropped, not passed through |
| Paging | Clamped page size, and returning to page one when a filter changes |
| Hydration | Decorating a page after it has been cut, so the second query runs over twenty-four rows rather than the table |
| Server-side ranking | For orders SQL cannot compute, over a capped pool, honest about where the cap fell |
| Scoping | Ownership conditions come from the session, never from the query string |

### 13.4 One CRUD factory

Most management screens are a single declaration that returns the forms, the
rows and the actions. Scoping confines a whole surface to one owner's rows —
filtering every read, filtering the row an edit or delete targets, and stamping
the owner onto inserts from the session.

### 13.5 One form-field kit

A page names fields; it does not write inputs. The main field component covers
eleven shapes — text, number, url, password, textarea, select, combobox, date,
multi-date, checkbox list, single checkbox, range — and owns the label, the
`id`/`for` pairing, the invalid state, the description association, the error
list and the hint.

Three richer controls sit beside it: a card-style radio picker, a chip
multi-select, and a star rating. Each is a real input underneath, so every one
of them posts, takes focus and works with scripting off. Each binds either to a
form or to a plain value, which is what lets a URL-backed discovery filter use
the same component as a schema-backed field.

### 13.6 Tables

A shared data table with sorting, paging, column visibility, a search box, CSV
export, and dialog-based create, edit and delete.

### 13.7 Uploads and images

| Feature | Detail |
|---------|--------|
| Types | PNG, JPEG, WebP, AVIF and PDF |
| Size | Capped, and checked twice — the declared size, and the bytes actually written |
| Magic numbers | The file's first bytes are checked against the type it claims, because a browser's `accept` attribute is a hint and a direct multipart POST ignores it |
| Naming | The extension comes from the verified type, never from the client's filename |
| Client-side compression | Large images are shrunk in the browser before they are sent |
| Public and private serving | Two routes; private files check the session before a byte is read |
| Caching | Stat results are cached, and invalidated on write |
| Pruning | A script lists files no row points at, and removes them on request — necessary because deletes are soft, so the row can come back |

### 13.8 Other shared surfaces

Toast notifications carried across redirects, breadcrumb-aware page headers,
empty-result states that say what to change, a collapsible sidebar that knows
the role it is rendering for, dialogs capped to the viewport with their close
button always in reach, a carousel, charts, and a mobile layout the public pages
were specifically reworked for.

---

## 14. Security features

| Feature | Where |
|---------|-------|
| Content Security Policy | Generated at build time, because only the build knows the hashes of the inline scripts it emits |
| `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` | Set in the request hook |
| Origin checking | On form posts, in production builds |
| Role and ownership guards | One helper, used by every protected load and action, which also files the audit line |
| Schema validation | Every form and every action share one Zod schema, so the client and the server cannot disagree about what is valid |
| Prototype-pollution hardening | Sort keys, transitions and currency lookups use own-property checks — `?sort=__proto__` was a 500 on every listing, including two public ones |
| HTML sanitisation | On write, to an allowlist built by a parser |
| Contact masking | Before a message is stored |
| Upload validation | Declared size, written size, and magic number |
| Webhook distrust | The payment webhook body is read for a reference and thrown away |
| Rate limiting | On the authentication endpoints |
| Error handling | One JSON line per fault in the log — id, route, method, actor — and nothing but the id to the reader; no stack trace on an error page |
| Soft deletes | So a mistaken removal is recoverable, and files are never destroyed by a row disappearing |

---

## 15. Operations and tooling

### 15.1 Tests

258 unit assertions across 15 files, covering the domain logic and both query
layers — the places where the claims are. Each rule stated in this document that
could regress has a test that fails if it stops being true.

Four Playwright suites run against a production build and a real database,
because the CSP is generated at build time and the origin check only exists
there. CI runs check, lint and unit tests in one job, the build in another, and
the end-to-end suite against MariaDB in a third — which is also the only place
the migrations are proved to apply to an empty database before a deploy does it.

### 15.2 Deploying

`npm run deploy` is the whole procedure: build, verify, hardlink the running
build as a timestamped backup, prune to the newest two, rsync, SIGTERM, and poll
health until it answers. A dry run says what it would do and touches nothing.
Backups are hardlink copies, so a build that changes little costs little.
Rollback is the reverse and takes about ten seconds; the script prints the exact
command.

`npm run verify:build` fails if the bundle imports anything that will not exist
on the server, which matters because the failure is otherwise very quiet: one
dependency once reached the server bundle through the date pickers, so every
signed-in form page returned 500 while the public pages served fine.

### 15.3 Migrations

The schema is applied by committed migrations, not by a diff-and-rewrite. A
baseline command records migrations as applied for a database that predates
them, and a remote command applies them over a tunnel without hand-written SQL.

### 15.4 The script index

| Command | Does |
|---------|------|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run verify:build` | Fail if the build imports anything absent on the server |
| `npm run deploy` | Build, verify, back up, ship, restart, check |
| `npm run check` | Type and template checking |
| `npm run lint` / `format` | Prettier and ESLint |
| `npm run test:unit` / `test:e2e` / `test` | Vitest, Playwright, both |
| `npm run db:generate` | Write a migration for the current schema |
| `npm run db:migrate` / `db:baseline` / `db:migrate:remote` | Apply, adopt, apply remotely |
| `npm run db:seed` | Reference data and demonstration rows, idempotently |
| `npm run db:studio` | Drizzle Studio |
| `npm run mail:check` | Connect and authenticate; give it an address and it sends one too |
| `npm run import:creators` | Bulk import creators from CSV |
| `npm run fetch:avatars` | Backfill avatars for imported profiles |
| `npm run uploads:prune` | Find, and optionally remove, files no row points at |

### 15.5 Bulk import

A CSV importer for creator profiles, with an avatar backfill that follows it.
This is how most of the profiles on the platform arrived, and it is why the
claiming and introduction features in §8 exist at all.

---

## 16. Appendix: route map

**Public**

`/` · `/discover` · `/creators/[username]` · `/creators/[username]/reviews` ·
`/campaigns` · `/campaigns/[slug]` · `/blog` · `/blog/[slug]` ·
`/blog/rss.xml` · `/terms` · `/privacy` · `/sitemap.xml` · `/robots.txt` ·
`/health`

**Authentication**

`/login` · `/register` · `/logout` · `/forgot-password` · `/reset-password` ·
`/verify-email`

**Creator**

`/dashboard` · `/dashboard/profile` · `/dashboard/profile/create` ·
`/dashboard/profile/claim` · `/dashboard/channels` · `/dashboard/packages` ·
`/dashboard/portfolio` · `/dashboard/applications` · `/dashboard/verification`

**Brand**

`/dashboard/organization` · `/dashboard/organization/create` ·
`/dashboard/campaigns` · `/dashboard/shortlist`

**Shared**

`/dashboard/bookings` · `/dashboard/bookings/[id]` · `/dashboard/reviews` ·
`/dashboard/settings`

**Operator**

`/dashboard/admin/countries` · `/regions` · `/categories` · `/platforms` ·
`/languages` · `/creators` · `/organizations` · `/users` · `/verification` ·
`/claims` · `/introductions` · `/trending` · `/gallery` · `/settings` ·
`/audit` · `/blog` · `/blog/[id]` · `/blog/categories` · `/blog/upload`

**Machine**

`/api/chapa/webhook` · `/files/[name]` · `/files/private/[name]`

---

## 17. Appendix: data model

43 tables — 39 the application defines, plus four the authentication library
owns.

| Group | Tables |
|-------|--------|
| **Reference** (5) | `countries`, `regions`, `categories`, `platforms`, `languages` |
| **Identity** (4, library-owned) | `user`, `session`, `account`, `verification` |
| **Organisations** (2) | `organizations`, `organization_members` |
| **Creators** (6) | `creators`, `creator_categories`, `creator_languages`, `social_accounts`, `packages`, `portfolio_items` |
| **Briefs** (2) | `campaigns`, `applications` |
| **Deals** (5) | `bookings`, `term_proposals`, `submissions`, `messages`, `reviews` |
| **Money** (1) | `payments` |
| **Trust** (2) | `verification_requests`, `creator_claims` |
| **Engagement** (2) | `saved_creators`, `notifications` |
| **Preferences and site** (3) | `user_settings`, `site_settings`, `gallery_slides` |
| **Trending** (7) | `trending_config`, `trending_runs`, `trending_entries`, `trending_overrides`, `trending_cooldowns`, `trending_lanes`, `trending_lane_entries` |
| **Editorial** (3) | `blog_categories`, `blog_posts`, `blog_post_images` |
| **Record** (1) | `audit_log` |

<div align="center">

*Creator Network · Feature catalogue · September 2026*

</div>
