/**
 * Whether money moves through the app at all.
 *
 * One constant, read by both halves: the server modules that would call the
 * provider, and the components that would draw a button for it. It is off, and
 * while it is off the deal lifecycle runs end to end without a payment step —
 * a paid booking is completed on the parties' say-so, exactly as a barter one
 * always was.
 *
 * Nothing has been deleted to make that true. `server/chapa.ts` still speaks
 * the whole API, `server/payments.ts`, `server/payouts.ts` and
 * `server/refunds.ts` still hold the rules about what a payment, a transfer and
 * a reversal are allowed to change, and the `payments`, `payouts`,
 * `payout_accounts` and `refunds` tables are untouched. Turning this back to
 * `true` — with `CHAPA_SECRET_KEY` set — restores every one of them, because
 * each guard below asks this rather than being edited out.
 *
 * What does *not* come back by itself is history: deals completed while this is
 * false were never funded, so they carry `escrow_status = 'unfunded'` and no
 * payment row. Any reconciliation written later has to expect that gap rather
 * than read it as money that went missing.
 */
export const PAYMENT_GATEWAY_ENABLED = false;
