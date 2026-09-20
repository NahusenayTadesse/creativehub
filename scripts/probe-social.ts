/**
 * Asks one platform about one handle and prints what came back.
 *
 *   npx tsx scripts/probe-social.ts youtube mkbhd
 *   npx tsx scripts/probe-social.ts telegram durov
 *   npx tsx scripts/probe-social.ts instagram nasa
 *   npx tsx scripts/probe-social.ts tiktok mrbeast
 *   npx tsx scripts/probe-social.ts youtube mkbhd --code=CN-4F7K
 *   npx tsx scripts/probe-social.ts youtube mkbhd --bio      # print the whole bio
 *
 * There is no database here and nothing is written. This is the thing to run
 * when a fetcher stops working, or from a new host to find out whether that
 * host's address is treated differently — Instagram and TikTok refuse this
 * server and may not refuse another, and the only way to know is to ask from
 * there. `--code` runs the same bio match the Verify button runs, so a failing
 * verification can be reproduced without a browser or a session.
 *
 * Exits non-zero when the lookup fails, so it can be used as a health check.
 */
import { bioContainsCode } from '../src/lib/domain/ownership-code';
import { FETCHABLE_PLATFORMS, fetchPublicProfile } from '../src/lib/server/social';

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith('--') && !a.includes('=')));
const named = new Map(
	args
		.filter((a) => a.startsWith('--') && a.includes('='))
		.map((a) => [a.slice(2, a.indexOf('=')), a.slice(a.indexOf('=') + 1)])
);
const [platform, handle] = args.filter((a) => !a.startsWith('--'));

if (!platform || !handle) {
	console.error(`Usage: npx tsx scripts/probe-social.ts <platform> <handle> [--code=CN-XXXX] [--bio]

  platform   one of: ${FETCHABLE_PLATFORMS.join(', ')}
  handle     "name", "@name" or a full profile URL`);
	process.exit(2);
}

const started = Date.now();
const result = await fetchPublicProfile(platform, handle);
const elapsed = Date.now() - started;

console.log(`\n  platform  ${platform}`);
console.log(`  handle    ${handle}`);
console.log(`  took      ${elapsed} ms\n`);

if (!result.ok) {
	console.log(`  ✗ failed — ${result.reason}`);
	console.log(`\n  The Verify button treats this as "could not reach the platform" and`);
	console.log(`  offers the creator manual entry. Registration is never blocked by it.\n`);
	process.exit(1);
}

console.log(`  ✓ ok`);
console.log(
	`  followers ${result.followers === null ? '— (hidden by the platform; entered by hand)' : result.followers.toLocaleString('en-GB')}`
);

const bio = result.bio.replace(/\s+/g, ' ').trim();
console.log(`  bio       ${bio.length} chars`);
console.log(
	`            ${flags.has('--bio') ? result.bio : bio.slice(0, 160) + (bio.length > 160 ? '…' : '')}`
);

const code = named.get('code');
if (code) {
	const found = bioContainsCode(result.bio, code);
	console.log(`\n  code      ${code} — ${found ? '✓ found in bio' : '✗ not in bio'}`);
	if (!found) process.exit(1);
}

console.log();
