# Creator journey — friction and bugs

A walkthrough of the whole creator path on a real dev server (`vite dev`, local
MariaDB, seeded data), from `/register?role=creator` to taking a booking. Every
finding below was reproduced in the browser unless it is marked **(code)**,
which means it was read out of the source rather than clicked through.

The account used was `selam.flowtest@example.com` — see "Test data left behind"
at the end.

---

## Status

Everything below was written from a read-only walkthrough. A second pass then
fixed most of it; each item says which.

**Fixed and verified in the browser:** B1, B2, C1, C2, C3, C4, C5, F1, F11 —
plus two things found while verifying: the review dialog stayed open over a
booking that had already moved on, and `futureDays` on both date pickers meant
the opposite of its name.

**Still open:** B3 (nothing in this codebase can make TikTok answer), F2–F10,
F12, F13 — and one new blocker found while re-running the suite, **S1**, at the
bottom.

---

## The walk

1. `/register?role=creator` → account created, signed in, landed on
   `/dashboard/profile/create`.
2. Profile created (name, handle, bio, country, city, TikTok, 5,000 ETB) →
   redirected to `/dashboard/channels`.
3. Channel added (`khaby.lame` on TikTok) — the handle was checked against
   TikTok and found.
4. Package added (8,000 ETB, two deliverables).
5. `/dashboard/profile` → "Ready to publish" → published.
6. Applied to a live brief; the pitch was accepted.
7. A brand account (`kaldi.flowtest@example.com`) was registered, an
   organisation created, and the creator booked from their public page.
8. Back as the creator: the proposal was accepted. **The booking then had
   nowhere to go** — see B1.

---

## Blockers

### B1. An accepted booking can never be delivered while the payment gateway is off — **fixed**

**Files:** `src/routes/dashboard/bookings/[id]/+page.server.ts:546`,
`src/routes/dashboard/bookings/[id]/+page.svelte:709,723`,
`src/lib/payment-gateway.ts:23`, `src/lib/server/payments.ts:254`

`booked → in_production` is written in exactly two places: the Chapa
`settle` path (`payments.ts:254`) and the `fund` action
(`+page.server.ts:546`). `PAYMENT_GATEWAY_ENABLED` is `false`, so:

- `settle` is never reached — `load` does not even look at `?payment=` while the
  gateway is off;
- the `fund` action returns `fail(503)` unconditionally
  (`+page.server.ts:512`), and its button is drawn only when
  `data.paymentsEnabled && isOperator` (`+page.svelte:709`), so it is not drawn
  for anyone.

The creator's "Submit work" button is gated on
`['in_production','revision'].includes(booking.status)` (`+page.svelte:723`),
and the `submit` action refuses anything else with 409
(`+page.server.ts:867`). So a booking that both sides accepted sits at `booked`
forever. The only buttons left to the creator are **Ask to cancel** and **Raise
a dispute**.

This directly contradicts the copy on the same page:

> Online payment is switched off for now, so the two of you settle this amount
> between yourselves and **the booking completes without waiting on it**.

It also contradicts `payment-gateway.ts`'s own note that "the deal lifecycle
runs end to end without a payment step".

Knock-on effects: no creator can ever earn a rating (reviews require a
completed booking), `completed_bookings` never moves, and the creator score
stays where onboarding left it. The 215 `completed` bookings in the dev
database were seeded directly, not driven through the UI; the two live `booked`
rows are stuck.

**Reproduced:** booking `CN-2609-FJG5QGZA` (id 222) — accepted, status
`booked`, no forward action on either side.

**What is missing:** a transition out of `booked` that does not involve money —
either the creator marking work started, or accepting terms moving straight to
`in_production` when `!PAYMENT_GATEWAY_ENABLED`.

---

### B2. A creator who finishes onboarding is still invisible in discovery, and is told the opposite — **fixed**

**Files:** `src/lib/server/queries.ts:365,377,397`,
`src/lib/server/db/creator-verification.ts`,
`src/routes/dashboard/profile/+page.server.ts:180`, `messages/en.json:1886`

Publishing is gated on bio + one live channel + one package. Discovery hides
every creator whose `verification_level` is `unverified`, and that level only
leaves `unverified` when a channel has `is_verified = true` — which a creator
cannot set for themselves.

So the newly published profile did not appear in `/discover?q=Selam` (only the
seeded `Selamawit Bekele` did). The "Include unverified creators" checkbox is
off by default, and the default `/discover` counts read "1 published creators"
against 147 rows in the table.

Meanwhile `/dashboard/profile` says, in order:

- "Everything a brand needs is in place. Publish when you are ready to be found."
- after publishing: **Visibility: Live in discovery** (`pf_live_in_discovery`).

Neither is true. Nothing anywhere in the creator dashboard explains that a
confirmed channel is what makes them findable, or that they are waiting on the
`/dashboard/admin/channel-ownership` queue.

**What is missing:** the profile page should distinguish "published" from
"findable", and name the remaining step.

---

### B3. The one self-service route off `unverified` does not work for TikTok or Instagram — **open**

**Files:** `src/lib/server/social/tiktok-public.ts:10-25`,
`src/lib/server/social/instagram.ts`, `src/lib/server/ownership.ts:221`

Pressing **Prove you own this** issued a bio code (`CN-YHNK`) with clear
instructions. Pressing **Verify** answered:

> TikTok will not answer us from here, so we cannot read your profile. Enter
> your follower count instead — it will show as self-reported.

This is documented and expected — `tiktok-public.ts` says so in its own header
comment (a signed-out profile fetch returns a WAF interstitial). But it lands
badly in the flow:

- the same page had, thirty seconds earlier, said **"Found on TikTok"** for the
  same handle (`social-check.ts` uses oEmbed, which does answer), so the
  creator is told the platform is both reachable and unreachable;
- the offered fallback — "Save count" — writes a self-reported follower number
  and **does not confirm ownership**, so it does not move
  `verification_level` and does not fix B2. It looks like a way forward and
  is not one;
- the remaining routes are TikTok OAuth (**Connect TikTok**, which needs app
  review for `user.info.stats`) and an operator decision.

Combined with B2: a TikTok or Instagram creator — which is most of the intended
supply — cannot get themselves into discovery at all, and the UI never says
that an operator is the only way.

---

## Bugs

### C1. Every dropdown's placeholder shows the database column name — **fixed**

**File:** `src/lib/formComponents/ComboboxComp.svelte:56,61`

```ts
const fieldLabel = $derived(name.replace(/([a-z0-9])([A-Z])/g, '$1 $2'));
…
selected?.name ?? m.form_select_placeholder({ field: fieldLabel })
```

The placeholder is built from the field's `name`, not from the label rendered
next to it. Observed:

- creator profile create → **"Select country Id"**
- `/dashboard/profile` → **"Select region Id"**
- organisation create → **"Select Country Id"**

`ComboboxComp` has no `label` prop, so the visible label (`Country`) is not
available to it. Second problem: the interpolated fragment is an English
column name dropped inside a translated sentence, so an Amharic reader gets
`… country Id` mid-sentence.

---

### C2. Raw Zod English reaches the user on required reference fields — **fixed**

**File:** `src/lib/schemas.ts:90`

```ts
const refId = z.coerce.number().int().positive();
```

No `error` message, and `z.coerce.number()` turns an empty select into `0`, so
a missing value renders as:

> **Too small: expected number to be >0**

Reproduced on organisation create with Country left empty. The same `refId`
is `countryId` and `primaryPlatformId` in `creatorCreateProfile`
(`schemas.ts:323,325`), so the creator's own first form does it too; `city`
(`schemas.ts:324`, `.min(2)` with no message) will say "Too small: expected
string to have >=2 characters". Every other validation message in the app is a
paraglide message — these are the exceptions, and they are untranslated.

`refId` is used by 40+ schemas, so this is one fix in one place.

---

### C3. The file pickers render a broken "NaN MB (Optimized)" card before hydration — **fixed**

**File:** `src/lib/formComponents/FileUpload.svelte:120,153,218`

```svelte
{#if $file?.length === 0 && image === ''}      <!-- dropzone -->
{:else if image && $file?.length === 0}        <!-- stored-file preview -->
{:else}                                        <!-- selected-file card -->
  {m.up_optimized_size({ size: ($file[0]?.size / 1024 / 1024).toFixed(2) })}
```

On the server `fileProxy` yields `undefined`, so `$file?.length` is `undefined`,
both guards fail, and the `{:else}` branch renders with no file:
`undefined / 1024 / 1024` → `NaN`.

Confirmed in the server HTML (authenticated fetch):

| page                      | occurrences of `NaN MB` in SSR HTML |
| ------------------------- | ----------------------------------- |
| `/dashboard/profile`      | 2 (avatar, cover)                   |
| `/dashboard/verification` | 1 (evidence document)               |

After hydration the dropzone appears and the card goes, so this is a flash
rather than a dead control — but it is the first thing on screen, it says
"NaN", and with JavaScript off the dropzone never arrives (the field's own
`<label for>` still opens the picker, by accident rather than design).

Fix is `($file?.length ?? 0) === 0` on both guards.

Likely the same root cause as the already-failing operator avatar-upload e2e.

---

### C4. An unpublished creator can apply to a brief, and the brand's link to them 404s — **fixed**

**Files:** `src/routes/(public)/campaigns/[slug]/+page.server.ts:52-62`,
`src/routes/(public)/creators/[username]/+page.server.ts:19-24`,
`src/routes/dashboard/applications/+page.svelte:145`

The `apply` action only checks that a creator profile exists. Its refusal
message is even named `srv_need_published_profile` — but `isPublished` is never
read.

`/creators/[username]` refuses an unpublished profile with 404 for anyone but
its owner and operators, and the brand's application row links straight there
(`applications/+page.svelte:145`).

**Reproduced:** set `is_published = 0`, applied to
`/campaigns/green-futures-clean-cooking` → "Your pitch has been sent",
application row written. `curl /creators/<unpublished-handle>` → **404**.

So the brand gets a pitch it cannot evaluate. Either enforce the published
requirement the message already claims, or make the card degrade instead of
linking into a 404.

---

### C5. The creator onboarding view offers a door that 403s — **fixed**

**Files:** `src/routes/dashboard/+page.svelte:52`,
`src/routes/dashboard/organization/create/+page.server.ts:22`

A creator-role account with no profile gets `view: 'onboarding'`, which draws
two cards side by side: "create a creator profile" and "create an
organisation". The second links to `/dashboard/organization/create`, which is
`requireRole(event, 'business', 'admin')` — **403** for a creator.

Confirmed: `fetch('/dashboard/organization/create')` from a signed-in creator
returns 403.

Either hide the card for creator-role accounts or make it a role switch.

---

## Friction

### F1. The onboarding thread is dropped after step 1 — **fixed**

`/dashboard/profile/create` says **"Step 1 of 3"** and promises "You will add
channels and packages next". After submitting, `/dashboard/channels` has no
step indicator, no "next" button and no mention of packages; `/dashboard/packages`
likewise has no route on to publishing. The creator is on their own from step 2,
and the three-step promise is only kept by the sidebar.

### F2. Nothing tells the creator a confirmation email was sent

`sendOnSignUp: true` fires at registration, but the sign-up redirects straight
to `/dashboard/profile/create` with no mention of it. The only place the state
surfaces is `/dashboard/settings` → "Not verified · Send a confirmation link".
Since an unverified address is what blocks Google account-linking
(`auth.ts`, `socialProviders` note), it is worth a line at sign-up.

### F3. "Continue with Google" exists on `/login` but not on `/register`

Google is configured and the button is drawn on the sign-in page. Someone who
arrived at "Join as a creator" has only the email/password form, and has to
work out that signing _in_ with Google is how you sign _up_ with Google.

### F4. `/register` links to neither Terms nor Privacy

Both pages exist (`/terms`, `/privacy`) and the footer links them; the account
creation form does not, and there is no acceptance step.

### F5. Password rules appear only after a failed submit

Submitting `pass` produced a clear "At least 8 characters" — but nothing says so
beforehand.

### F6. A channel saves with 0 followers, and publishing accepts it

The add-channel form defaults Followers to `0` and accepts it. The check
against the platform ("Found on TikTok") does **not** fill the number in — it
has to be typed by hand. The publish gate counts channels, not reach, so the
profile went live reading **"0 total reach"**, and the public page shows
`Followers 0 / Engagement 0.0%`. A minimum, or filling the figure from the
check where the platform gives one, would stop that.

### F7. The add-channel form does not preselect a platform, and says so late

The platform radio group starts with nothing selected. Pressing "Check this
account" with a handle typed answers **"Choose a platform first."** — correct,
but the radio group reads as decorative next to the labelled fields, so the
first attempt is wasted.

### F8. "Sort order" is on the creator's own forms

Both the add-channel and add-package dialogs expose a numeric **Sort order**
field to the creator. It is an internal ordering knob; on a creator-facing form
it is one more number to worry about.

### F9. Categories are not in the publish gate, though discovery filters on them

`pf_categories_note` says "Brands filter discovery by these". The profile
published with none selected, and the public page showed no categories at all.
A creator can therefore be live and filtered out of every category panel.

### F10. A brief's stated audience requirement is not checked or even flagged

`Yirgacheffe Origin Story` states **Audience size 40,000+**. The 0-follower
profile applied and got "Your pitch has been sent." Nothing on the form warns
that the requirement is not met — which wastes the creator's pitch and the
brand's queue.

### F11. The booking dialog defaults the deadline to today and ignores the package's turnaround — **fixed**

Booking the 3-day package pre-filled `deadline = 2026-09-20` — the day the
proposal was written. It was accepted without complaint, so the agreed terms
read "due 20 Sept 2026" on a proposal timestamped after that date. Default to
`today + deliveryDays`, and refuse a deadline in the past.

### F12. Portfolio items are URL-only

`/dashboard/portfolio` → Add asks for an **Image or video URL**; there is no
uploader, though the avatar and verification fields have one. A creator with a
file on their phone has nowhere to put it. The dialog's labels are also
auto-titlecased column names ("Image Or Video URL", "Sort Order").

### F13. The country list is in no particular order

16 countries, ordered Ethiopia, Côte d'Ivoire, Senegal, Morocco, Tanzania,
Uganda… — neither alphabetical nor obviously by weight. With the search box
appearing only above 8 items it is usable, but scanning it is guesswork.

---

## Things that worked well

- Sign-up → profile → channels → packages → publish never lost data, and every
  redirect went where it said it would.
- The handle check against TikTok answered in about a second and filled the
  profile URL in.
- Claim candidates are offered **before** the create form, not after — the right
  way round.
- The "handle taken" refusal points at `/dashboard/profile/claim` when the
  holder is an unclaimed imported profile.
- Toasts, notification bell, `/dashboard/notifications` and the applications
  tabs all behaved.
- Contact masking and the "terms frozen" record on the booking page are clear
  and well worded.

---

## Found while verifying the fixes

### S1. The service worker makes navigations hang — **open, and it is in production**

**Files:** `src/service-worker.ts`, `src/lib/components/pwa.svelte:83`
**Introduced in:** `edcba08` "An installable app: a bottom bar, push, and a
dashboard that fits a phone"

Re-running the e2e suite turned up failures that looked like flakes — always
`page.goto: net::ERR_ABORTED` or a bare navigation timeout, at a different step
each run. They are not flakes and they are not the dev server: the same
navigations answer in under a second to `curl`.

**A/B, five rounds each, same build, same preview server, one script:**

| service worker                    | rounds with a failed navigation |
| --------------------------------- | ------------------------------- |
| allowed                           | **3 / 5**                       |
| blocked at `**/service-worker.js` | **0 / 5**                       |

**Bisect.** At `1e95098` (the commit before the PWA landed),
`e2e/blog-approval.e2e.ts` passes 3/3 in ~4.5 s each. At `HEAD` it fails 3/3,
each run burning 20–30 s in a hung navigation. Nothing between those two
commits touches blog approval.

**What the worker is doing.** Instrumenting a signed-in session and printing
the registration after every navigation:

```
after sign-in:              active=activating  controlled=true
goto /dashboard/admin/creators   928ms  installing=installing active=activated
goto /dashboard/admin/blog/approvals 138ms  active=activating controlled=true
goto /creators/joel_tech_ethiopia   1108ms  active=activating controlled=true
goto /dashboard                      100ms  active=activating controlled=false
goto /blog                            72ms  waiting=installed active=activating
```

One to three new worker instances are created per navigation and the
registration never settles: it is `activating` on almost every sample and
`controlled` flips on and off. Two 429s from `bot-defence` appear in the same
runs — the install re-fetches its four precache files with `cache: 'reload'`
every time round, so the churn is loud enough to trip the site's own rate
limiter.

The script itself is stable (`md5sum` identical across fetches) and is served
with no `Cache-Control`, so a byte-comparison update should be a no-op. It is
not behaving like one.

The navigate branch of the `fetch` handler is what puts every page load through
the worker, and it exists only to `return await fetch(request)` and fall back to
`/offline.html`. Two things worth trying, in order: enable
`registration.navigationPreload` and answer from `event.preloadResponse`, which
is the standard remedy for navigations that have to wait on a worker booting;
and work out why `skipWaiting` + `clients.claim` are cycling instead of settling
once.

Not attempted here. Getting it wrong changes what every visitor caches, and the
deploy notes already warn that Cloudflare holds static files for a week.

**To reproduce:** `npm run build && npm run preview`, then drive a signed-in
session through five dashboard navigations in a fresh context — roughly three
runs in five will hang on one of them. Blocking `/service-worker.js` in the
context makes it stop.

---

## Test data left behind

In the local dev database (`creator`), created by this walkthrough:

- users `selam.flowtest@example.com`, `kaldi.flowtest@example.com` and
  `onboard.flowtest@example.com`
- creator `selam.flowtest` (id 149), published, with one channel — marked
  confirmed by hand to check the B2 fix — and one package
- organisation `Kaldi Roasters`
- booking 222 (`CN-2609-FJG5QGZA`), now driven all the way to `completed`
  through the UI, plus one more booking left at `proposed` from the deadline
  test
- applications id 10 and 11

`.env.local` (which blanked SMTP so no real mail went out) was removed, and the
dev and preview servers were stopped.
