import { superValidate, message } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { and, asc, eq, isNull, type SQL } from 'drizzle-orm';
import { z } from 'zod/v4';
import type { RequestEvent } from '@sveltejs/kit';
import type { MySqlTable } from 'drizzle-orm/mysql-core';
import { db } from '$lib/server/db';
import { saveUploadedFile } from '$lib/server/upload';

/** Every content table is keyed by an autoincrement id. */
export const idSchema = z.object({ id: z.coerce.number() });

/** Reused by every content form: an integer that decides display order. */
export const sortOrderField = z.coerce.number().int().min(0).default(0);

/** A content table, plus index access to its columns for the generic helpers. */
type AnyTable = MySqlTable & Record<string, any>;
type AnySchema = z.ZodType<any, any>;
/** Validated form data always carries the row's own columns, and an id on edit. */
type FormData = Record<string, any> & { id: number };

/**
 * Restricts every read and write to rows this actor owns.
 *
 * Without it, a creator could edit another creator's package simply by posting
 * a different id — the id arrives from the client and is never trustworthy on
 * its own. With it, the owning column is both a filter on update/delete and a
 * value stamped onto insert, so the client cannot choose an owner.
 */
type CrudScope = {
	/** The owning column, e.g. `packages.creatorId`. */
	column: any;
	/** Its property name on the row, e.g. `'creatorId'`, for stamping inserts. */
	key: string;
	/** The value it must equal, e.g. the signed-in user's creator id. */
	value: number | string;
};

interface CrudOptions {
	/** The Drizzle table being managed. */
	table: AnyTable;
	/** Singular, human-readable name used in toast messages, e.g. "Package". */
	label: string;
	addSchema: AnySchema;
	editSchema: AnySchema;
	/** Fields holding an uploaded File; saved to disk and stored as a filename. */
	fileFields?: string[];
	/** Fields entered as one-per-line text and stored as a JSON string array. */
	listFields?: string[];
	/** Confines the whole CRUD surface to one owner's rows. */
	scope?: CrudScope;
	/** Hides soft-deleted rows from the listing. */
	excludeDeleted?: boolean;
	/** Extra columns written on every insert and update. */
	defaults?: Record<string, unknown>;
	/** Runs after a successful write, e.g. to recalculate a derived score. */
	afterWrite?: (event: RequestEvent) => Promise<void> | void;
}

/**
 * Builds the `load` and `actions` for a content table's dashboard page.
 *
 * Every content page needs the same three forms and the same add/edit/delete
 * round trip, so the only thing a route has to supply is its schemas and the
 * handful of fields that need special treatment (files, JSON lists, ownership).
 */
export function contentCrud({
	table,
	label,
	addSchema,
	editSchema,
	fileFields = [],
	listFields = [],
	scope,
	excludeDeleted = false,
	defaults = {},
	afterWrite
}: CrudOptions) {
	/** Newest content sorts by the admin-chosen order; the rest falls back to id. */
	const orderColumn = table.sortOrder ?? table.id;

	/** Conditions applied to every read, and to the row an edit or delete targets. */
	const guards = (): SQL[] => {
		const conditions: SQL[] = [];
		if (scope) conditions.push(eq(scope.column, scope.value));
		if (excludeDeleted && table.deletedAt) conditions.push(isNull(table.deletedAt));
		return conditions;
	};

	/** Turns validated form data into a row, minus anything that must not change. */
	const toRow = async (data: Record<string, any>) => {
		const { id, ...values } = data;

		for (const field of fileFields) {
			const file = values[field];
			// No new upload means "keep whatever is already stored".
			if (file instanceof File && file.size > 0) {
				values[field] = await saveUploadedFile(file);
			} else {
				delete values[field];
			}
		}

		for (const field of listFields) {
			const raw = values[field];
			values[field] =
				typeof raw === 'string'
					? raw
							.split('\n')
							.map((line) => line.trim())
							.filter(Boolean)
					: (raw ?? []);
		}

		return values;
	};

	const load = async () => {
		const conditions = guards();

		const [addForm, editForm, deleteForm, rows] = await Promise.all([
			superValidate(zod4(addSchema)),
			superValidate(zod4(editSchema)),
			superValidate(zod4(idSchema)),
			conditions.length
				? db
						.select()
						.from(table)
						.where(and(...conditions))
						.orderBy(asc(orderColumn))
				: db.select().from(table).orderBy(asc(orderColumn))
		]);

		/*
		 * The table is generic, so Drizzle cannot narrow the row shape here. Each
		 * route knows its own columns, so an indexable record is the honest type.
		 */
		return { addForm, editForm, deleteForm, rows: rows as Record<string, any>[] };
	};

	const actions = {
		add: async (event: RequestEvent) => {
			const { request, locals } = event;
			const form = await superValidate(request, zod4(addSchema));
			if (!form.valid) {
				return message(
					form,
					{ type: 'error', text: 'Please check the form for errors' },
					{ status: 400 }
				);
			}

			try {
				const values = await toRow(form.data as FormData);
				await db.insert(table).values({
					...values,
					...defaults,
					// The owner is stamped from the session, never taken from the form.
					...(scope ? { [scope.key]: scope.value } : {}),
					createdBy: locals.user?.id
				});
				await afterWrite?.(event);
				return message(form, { type: 'success', text: `${label} added` });
			} catch (err) {
				console.error(`Failed to add ${label}:`, err);
				return message(form, { type: 'error', text: `Could not add ${label}` }, { status: 500 });
			}
		},

		edit: async (event: RequestEvent) => {
			const { request, locals } = event;
			const form = await superValidate(request, zod4(editSchema));
			if (!form.valid) {
				return message(
					form,
					{ type: 'error', text: 'Please check the form for errors' },
					{ status: 400 }
				);
			}

			try {
				const data = form.data as FormData;
				const values = await toRow(data);
				const result: any = await db
					.update(table)
					.set({ ...values, ...defaults, updatedBy: locals.user?.id })
					.where(and(eq(table.id, data.id), ...guards()));

				/* Zero rows means the id exists but is not this actor's to change. */
				if (scope && (result?.rowsAffected ?? result?.[0]?.affectedRows ?? 1) === 0) {
					return message(
						form,
						{ type: 'error', text: `That ${label.toLowerCase()} is not yours to edit` },
						{ status: 403 }
					);
				}

				await afterWrite?.(event);
				return message(form, { type: 'success', text: `${label} updated` });
			} catch (err) {
				console.error(`Failed to update ${label}:`, err);
				return message(form, { type: 'error', text: `Could not update ${label}` }, { status: 500 });
			}
		},

		delete: async (event: RequestEvent) => {
			const form = await superValidate(event.request, zod4(idSchema));
			if (!form.valid) {
				return message(form, { type: 'error', text: 'Invalid request' }, { status: 400 });
			}

			try {
				await db.delete(table).where(and(eq(table.id, (form.data as FormData).id), ...guards()));
				await afterWrite?.(event);
				return message(form, { type: 'success', text: `${label} deleted` });
			} catch (err) {
				console.error(`Failed to delete ${label}:`, err);
				return message(form, { type: 'error', text: `Could not delete ${label}` }, { status: 500 });
			}
		}
	};

	return { load, actions };
}
