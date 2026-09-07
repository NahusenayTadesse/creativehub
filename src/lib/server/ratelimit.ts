/**
 * How often one caller may ask.
 *
 * The other half of the scraping defence, and the half that does not care what
 * the request calls itself. A person reading the directory opens a page, looks
 * at it, opens another; a scraper opens every page there is, as fast as the
 * server will answer. No header distinguishes those two, but the rate does,
 * and a limit that costs a reader nothing still turns a ten-minute harvest of
 * the whole database into a job measured in days.
 *
 * A token bucket rather than a fixed window, for one reason: a window resets
 * on a wall clock, so a caller who learns where the boundary is gets twice the
 * limit by firing on either side of it. A bucket refills continuously, so
 * bursts are absorbed up to the bucket's size and sustained abuse is held to
 * the refill rate whatever the caller's timing.
 *
 * State lives in this process and nowhere else. The app runs as a single Node
 * service behind OpenLiteSpeed, so that is the whole picture today; if it is
 * ever run as more than one process, each gets its own buckets and the
 * effective limits multiply by the process count. That is the moment to move
 * this into MySQL or Redis, not before — a shared store costs a round trip on
 * every request to solve a problem this deployment does not have.
 */

export type Limit = {
	/** Requests allowed in a window, and equally the size of the burst. */
	limit: number;
	/** How long a fully drained bucket takes to refill. */
	windowMs: number;
};

export type Decision =
	| { ok: true; remaining: number }
	/** Seconds until one more request would be allowed. Becomes `Retry-After`. */
	| { ok: false; retryAfter: number };

type Bucket = {
	tokens: number;
	updated: number;
	/** When this bucket is guaranteed full again, and so safe to forget. */
	expires: number;
};

const buckets = new Map<string, Bucket>();

/**
 * A ceiling on how many callers are tracked at once.
 *
 * Every distinct key costs an entry, and the key is derived from an address a
 * stranger controls. Without a cap, a caller cycling through addresses turns
 * the limiter itself into the denial of service it exists to prevent. On
 * overflow the map is swept and, if that is not enough, emptied: forgetting
 * who has been asking is a far smaller failure than exhausting the heap.
 */
export const MAX_TRACKED_KEYS = 20_000;

/** How often idle buckets are cleared out, when the process is otherwise busy. */
const SWEEP_INTERVAL_MS = 60_000;

function sweep(now = Date.now()) {
	for (const [key, bucket] of buckets) {
		if (bucket.expires <= now) buckets.delete(key);
	}
}

/*
 * Unreferenced on purpose: this timer must never be the reason a test runner,
 * a build or a `SIGTERM` fails to exit.
 */
const timer = setInterval(() => sweep(), SWEEP_INTERVAL_MS);
if (typeof timer === 'object' && 'unref' in timer) timer.unref();

/**
 * Spend one request's worth of allowance against `key`.
 *
 * `now` is a parameter so the tests can advance time without sleeping through
 * a ten-minute window.
 */
export function take(key: string, { limit, windowMs }: Limit, now = Date.now()): Decision {
	/** Tokens per millisecond. A bucket refills fully in exactly `windowMs`. */
	const rate = limit / windowMs;

	let bucket = buckets.get(key);
	if (!bucket) {
		if (buckets.size >= MAX_TRACKED_KEYS) {
			sweep(now);
			if (buckets.size >= MAX_TRACKED_KEYS) buckets.clear();
		}
		bucket = { tokens: limit, updated: now, expires: now + windowMs };
		buckets.set(key, bucket);
	} else {
		bucket.tokens = Math.min(limit, bucket.tokens + (now - bucket.updated) * rate);
		bucket.updated = now;
	}

	/* However drained it is now, it cannot still be draining after a full
	   window has passed with nobody asking. */
	bucket.expires = now + windowMs;

	if (bucket.tokens < 1) {
		return { ok: false, retryAfter: Math.max(1, Math.ceil((1 - bucket.tokens) / rate / 1000)) };
	}

	bucket.tokens -= 1;
	return { ok: true, remaining: Math.floor(bucket.tokens) };
}

/** Drops all state. For tests, and for nothing else. */
export function resetRateLimits() {
	buckets.clear();
}

/** How many callers are currently being tracked. For tests and diagnostics. */
export function trackedKeys() {
	return buckets.size;
}
