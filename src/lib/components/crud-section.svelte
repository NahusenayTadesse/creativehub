<script lang="ts">
	import * as m from '$lib/paraglide/messages';
	import type { Snippet } from 'svelte';
	import CrudDialog, { type CrudField } from '$lib/components/Table/crud-dialog.svelte';
	import CrudDelete from '$lib/components/Table/crud-delete.svelte';
	import PageHeader from '$lib/components/page-header.svelte';
	import { Inbox } from '@lucide/svelte';

	/**
	 * The shape every managed table shares: a header with an add dialog, a card
	 * grid or table of rows, and per-row edit and delete dialogs.
	 *
	 * The route supplies the three superforms that `contentCrud` returned and a
	 * `row` snippet describing how one record looks.
	 */
	let {
		eyebrow,
		title,
		description = '',
		label,
		rows,
		fields,
		addForm,
		editForm,
		deleteForm,
		nameKey = 'name',
		row,
		emptyMessage = undefined,
		layout = 'grid',
		extraActions = undefined,
		editValues = undefined,
		fileFields = []
	}: {
		eyebrow: string;
		title: string;
		description?: string;
		/** Singular noun used in the dialogs, e.g. "Country". */
		label: string;
		rows: any[];
		fields: CrudField[];
		addForm: any;
		editForm: any;
		deleteForm: any;
		nameKey?: string;
		row: Snippet<[any]>;
		emptyMessage?: string;
		layout?: 'grid' | 'list';
		extraActions?: Snippet;
		/** Maps a row to the values the edit dialog prefills with. */
		editValues?: (row: any) => Record<string, any>;
		/** Field names holding a stored filename, so the dialog can preview it. */
		fileFields?: string[];
	} = $props();

	const valuesFor = (record: any) => {
		if (editValues) return editValues(record);

		/* Default: every field on the form, with JSON arrays flattened to lines. */
		const values: Record<string, any> = { id: record.id };
		for (const field of fields) {
			const value = record[field.name];
			values[field.name] = Array.isArray(value) ? value.join('\n') : (value ?? '');
		}
		return values;
	};

	const existingFor = (record: any) =>
		Object.fromEntries(fileFields.map((name) => [name, record[name] ?? '']));
</script>

<div class="space-y-6">
	<PageHeader {eyebrow} {title} {description}>
		{#snippet actions()}
			{#if extraActions}
				{@render extraActions()}
			{/if}
			<CrudDialog
				title={m.crud_add({ label })}
				data={addForm}
				action="?/add"
				{fields}
				trigger={m.crud_add({ label })}
			/>
		{/snippet}
	</PageHeader>

	{#if rows.length === 0}
		<div class="bento-card bento-card-static space-y-3 py-16 text-center">
			<Inbox class="mx-auto h-10 w-10 text-slate-400" />
			<h3 class="text-base font-black text-slate-900">
				{emptyMessage ?? m.crud_empty_default()}
			</h3>
			<p class="mx-auto max-w-sm text-xs font-medium text-slate-600">
				{m.crud_empty_hint({ label })}
			</p>
		</div>
	{:else}
		<div
			class={layout === 'grid'
				? 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3'
				: 'space-y-3'}
		>
			{#each rows as record (record.id)}
				<div class="bento-card bento-card-static flex flex-col justify-between gap-3">
					{@render row(record)}

					<div class="flex items-center justify-end gap-2 border-t-2 border-slate-200 pt-3">
						<CrudDialog
							title={m.crud_edit({ label })}
							data={editForm}
							action="?/edit"
							{fields}
							values={valuesFor(record)}
							existing={existingFor(record)}
							variant="outline"
							trigger={m.crud_edit_short()}
						/>
						<CrudDelete data={deleteForm} id={record.id} name={record[nameKey] ?? ''} />
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
