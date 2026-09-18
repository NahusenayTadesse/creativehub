/**
 * Adds an operator account — never changes one.
 *
 *   npx tsx scripts/create-admin.ts admin@influencerethiopia.com "Platform Operator"
 *
 * The password comes from `ADMIN_PASSWORD` when it is set, so it never has to
 * appear in a terminal's history or a transcript. Without it, a random one is
 * generated and printed once: sign in with it and change it straight away.
 *
 * An address that already has an account is refused rather than updated. This
 * exists to add a login beside the ones people already use, and quietly
 * resetting someone's role or password would be the opposite of that.
 *
 * Against production, run it locally through the SSH tunnel described in the
 * `run-scripts-against-server-db` notes; the server has no node_modules.
 * The account is created the way `db/seed.ts` creates its operators: a
 * verified email, the `admin` role, and a better-auth credential account keyed
 * by the user's id, so it signs in like any other.
 */
import 'dotenv/config';
import mysql from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';
import { eq } from 'drizzle-orm';
import { randomBytes, randomUUID } from 'node:crypto';
import { hashPassword } from 'better-auth/crypto';
import * as t from '../src/lib/server/db/schema';

const [email, name = 'Platform Operator'] = process.argv.slice(2);
if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
	console.error('usage: npx tsx scripts/create-admin.ts <email> [name]');
	process.exit(2);
}
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');

const pool = mysql.createPool(process.env.DATABASE_URL);
const db = drizzle(pool, { schema: t, mode: 'default' });

try {
	const address = email.trim().toLowerCase();
	const existing = await db
		.select({ id: t.user.id, role: t.user.role })
		.from(t.user)
		.where(eq(t.user.email, address))
		.limit(1);
	if (existing.length) {
		console.error(
			`✗ ${address} already has an account (role: ${existing[0].role}). Nothing changed.`
		);
		process.exitCode = 1;
	} else {
		const generated = !process.env.ADMIN_PASSWORD;
		/* 18 random bytes as base64url: 24 characters, no ambiguous punctuation. */
		const password = process.env.ADMIN_PASSWORD || randomBytes(18).toString('base64url');
		if (password.length < 8) throw new Error('ADMIN_PASSWORD must be at least 8 characters');

		const userId = randomUUID();
		await db.transaction(async (tx) => {
			await tx
				.insert(t.user)
				.values({ id: userId, name, email: address, emailVerified: true, role: 'admin' });
			await tx.insert(t.account).values({
				id: randomUUID(),
				accountId: userId,
				providerId: 'credential',
				userId,
				password: await hashPassword(password),
				updatedAt: new Date()
			});
		});

		console.log(`✓ Created admin ${address}`);
		if (generated) console.log(`  Password (shown once — change it after signing in): ${password}`);
	}
} finally {
	await pool.end();
}
