/**
 * A small table, standing in for the real schema in `query.test.ts`.
 *
 * The tests there are about `defineQuery` — which parameters it accepts and
 * which it drops — not about any particular listing. Declaring the columns here
 * keeps them from breaking every time a real table gains a column, and keeps
 * the test from importing `db/schema.ts`, whose 31 tables would be loaded to
 * read four column names.
 */
import { boolean, int, mysqlEnum, mysqlTable, timestamp, varchar } from 'drizzle-orm/mysql-core';

export const bookings = mysqlTable('bookings', {
	id: int('id').autoincrement().primaryKey(),
	reference: varchar('reference', { length: 40 }).notNull(),
	title: varchar('title', { length: 250 }).notNull(),
	status: mysqlEnum('status', [
		'booked',
		'in_production',
		'submitted',
		'completed',
		'cancelled'
	]).notNull(),
	escrowStatus: mysqlEnum('escrow_status', ['unfunded', 'held', 'released']).notNull(),
	currencyCode: varchar('currency_code', { length: 8 }).notNull(),
	creatorId: int('creator_id').notNull(),
	price: int('price').notNull(),
	isActive: boolean('is_active').notNull(),
	createdAt: timestamp('created_at').notNull()
});
