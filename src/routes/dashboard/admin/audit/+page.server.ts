import { desc } from 'drizzle-orm';
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import * as t from '$lib/server/db/schema';

/** The audit log is append-only; this page reads it and nothing writes here. */
export const load: PageServerLoad = async () => ({
	entries: await db.select().from(t.auditLog).orderBy(desc(t.auditLog.createdAt)).limit(300)
});
