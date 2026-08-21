import { drizzle } from 'drizzle-orm/mysql2';
import type { MySqlRawQueryResult } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as schema from './schema';
import { env } from '$env/dynamic/private';

if (!env.DATABASE_URL) throw new Error('DATABASE_URL is not set');

const client = mysql.createPool(env.DATABASE_URL);

export const db = drizzle(client, { schema, mode: 'default' });

/**
 * The auto-increment id a MySQL insert produced.
 *
 * Drizzle's mysql2 driver returns the raw `[ResultSetHeader, FieldPacket[]]`
 * tuple, so the id is on element zero — not on the result itself. Every call
 * site used to reach for it through an `any` and a `??` covering both readings;
 * this is the one place that has to know the shape.
 */
export const insertedId = (result: MySqlRawQueryResult): number => Number(result[0].insertId);

/**
 * How many rows an UPDATE or DELETE actually touched.
 *
 * Same story as `insertedId`: the count lives on the `ResultSetHeader`, and
 * "did my conditional write win the race?" is asked in several places.
 */
export const rowsAffected = (result: MySqlRawQueryResult): number =>
	Number(result[0].affectedRows ?? 0);
