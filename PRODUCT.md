# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

A two-sided marketplace. Brands and creators matter equally, and neither side is treated as the primary audience.

- **Organisations hiring creators:** brands, startups, agencies, NGOs, government bodies and event organisers. They need to find creators whose reach is real, agree terms, pay safely and see the work delivered.
- **Content creators:** people working on TikTok, Telegram, YouTube and Instagram in Ethiopia and, later, the wider Pan-African market. They need to be found, get paid what was agreed, and build a record they can point to. Most creator profiles were imported from public sources before the creator signed up, so a creator's first visit is often to claim a profile that already exists.
- **Operators:** staff with the `admin` role, plus `encoder`, a narrower data-entry role. They verify creators and organisations, broker introductions to creators who haven't claimed their profile, resolve disputes, record manual deposits and pay creators by hand.

One person can hold a creator profile and an organisation membership at once, and the dashboard adapts to both.

## Product Purpose

Influencer Ethiopia covers the whole collaboration between an organisation and a creator: discovery, negotiation, agreed terms, delivery, review and settlement, with a durable record at every step. It succeeds when a deal that would otherwise happen informally in Telegram or DMs happens here instead, because here it is safer and easier to trust.

Tagline: "Connecting Ethiopia's digital influence."

## Positioning

The alternative is an informal deal over DMs, where follower counts can't be checked and terms aren't written down. Four things set Influencer Ethiopia apart, and all four are confirmed:

1. **Real, sourced reach.** Every follower and engagement figure records where it came from: a platform refresh, an uploaded proof, a bio code, an import, or the creator's own report. A figure with no evidence counts for nothing.
2. **Recorded terms and escrow.** Terms are frozen once both sides accept. The brand's deposit is held until the work is done, and every state change goes into an audit log.
3. **Managed by an operator.** Staff verify identities, handle introductions to creators who haven't claimed their profile, and settle disputes. It is a *managed* creator marketplace.
4. **Local fit.** Ethiopia comes first: Amharic, ETB, Chapa, telebirr, and Telegram as a primary creator platform.

## Operating Context

- **Deal lifecycle:** proposed → negotiating → booked → in production → submitted ⇄ revision → approved → awaiting settlement → completed. Any open deal can also end as cancelled or declined. Messages between the two sides are masked, and both sides review each other.
- **Payments:** the brand pays its deposit through Chapa's hosted checkout, in ETB only. Operators record bank-transfer and telebirr deposits by hand with a `MANUAL-` reference. Escrow can be unfunded, pending, held, released or refunded. Releasing escrow only records it: creators are still paid by hand. The platform fee is an operator setting, and the fee split is fixed on the booking when it is created.
- **Trust signals:** verification levels are unverified, social verified, identity verified and CN verified, and each shows as a badge. Channel ownership is proved with a bio code. Profiles are claimed through an exact-match queue. The creator score runs from 0 to 100. Campaign fit and trending lanes are ranked separately.
- **Platform data:** a scheduled job refreshes YouTube and Telegram figures. TikTok uses the creator's own OAuth grant. Instagram relies on proofs.
- **Brand workflows:** campaigns (briefs with three ways to pay creators), a shortlist and bookings.
- **Creator workflows:** profile, channels, priced packages, portfolio, applications to briefs, verification, reviews and payouts.
- **Public surfaces:** landing page, Discover (faceted creator search), campaigns, creator and brand profiles, blog, privacy and terms.
- **Installable PWA:** its shortcuts are Discover, Campaigns and Dashboard. HTML is never cached, because pages are personalised, and there is an offline fallback page.

## Capabilities and Constraints

- The stack is SvelteKit 2 and Svelte 5, Drizzle on MySQL/MariaDB, Tailwind 4, shadcn-svelte and better-auth (email/password and Google). It runs on adapter-node behind Cloudflare.
- The locales are English (base) and Amharic, with full key parity. The page's `lang` and `dir` come from Paraglide.
- Forms go through the shared field components in `src/lib/formComponents`.
- Operators can override the logos, landing hero and section order from site settings.
- **Terminology:** "deal" or "booking" for a collaboration; "campaign" or "brief" for a brand's call for creators; "introduction" for a booking made with a creator who hasn't claimed their profile; "claim" for a creator adopting an imported profile; "figure" for a reach or engagement number, which always has a source.
- **Open decisions:** payouts are not automated. The Instagram API integration is not built. The response-rate part of the creator score is a flat placeholder. The Pan-African expansion beyond Ethiopia is reference data only.

## Brand Commitments

- **Name:** Influencer Ethiopia.
- **Tagline:** "Connecting Ethiopia's digital influence."
- **Logo assets:** `static/brand/wordmark.webp`, `static/brand/wordmark-dark.webp`, `static/brand/mark.webp` and the app icons in `static/icons/`. The print originals are in `assets-src/brand/` and are built by `scripts/build-brand-assets.sh`. `BRAND_VERSION` in `src/lib/brand.ts` has to be bumped whenever the logo changes, or Cloudflare keeps serving the old file.
- **Voice, as the current copy shows it:** plain and factual, and it describes what the product actually does ("agree terms that are recorded, and track delivery through to completion"). It does not hype.

## Evidence on Hand

- **Creator data:** an imported public creator dataset (`african_creator_influencers_132*.csv`) and sourced figures in the database.
- **Product docs:** the feature catalogue and documentation in `docs/FEATURES.md` and `docs/DOCUMENTATION.md`.
- **Real content:** blog posts, partner logos (`static/brand/partners.webp`) and a gallery managed by operators.
- **Not on hand:** no testimonials, case studies, press, published user counts or deal volumes have been supplied. Future work must not invent them.

## Product Principles

1. **Every number shows its source.** Reach and engagement are only as credible as their evidence, so provenance is shown, never hidden.
2. **Neither side is the customer of the other.** Brands and creators get equal care, clarity and protection.
3. **The record is the product.** Agreed terms, deposits, state changes and reviews are kept and can be looked at. That is what an informal deal lacks.
4. **Operators are part of the product.** Where automation stops (introductions, disputes, payouts), staff step in, and the product says so plainly.
5. **Built for Ethiopia, not merely translated into it.** Local payment rails, platforms and language shape the product from the start.

## Accessibility & Inclusion

- **Mobile first, low bandwidth:** most visitors are on phones with limited data, so pages must stay light and work on constrained connections.
- **Amharic is first-class:** every surface must work fully in Amharic, including Ge'ez script and longer strings. It is not a translated afterthought.
- No formal WCAG target has been set yet.
