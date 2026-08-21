<script lang="ts">
	import { untrack } from 'svelte';
	import { writable, type Readable, type Writable } from 'svelte/store';
	import { CircleAlert } from '@lucide/svelte';
	import type { Item } from '$lib/global.svelte';

	/**
	 * A multi-select drawn as toggleable pills.
	 *
	 * For the lists that are short enough to show at once and worth seeing at
	 * once — the categories a creator works in, the languages they work in.
	 * `CheckboxComp` covers the other case: a long list where a grid of boxes and
	 * a select-all button read better.
	 *
	 * Underneath, one real `<input type="checkbox">` per pill, all sharing a
	 * `name`, so the group posts as a repeated field and works with scripting
	 * off. The checkbox is visually hidden rather than absent, which is what
	 * keeps the pill focusable and operable from the keyboard.
	 *
	 * Values are kept in the type the caller supplied them in: a list of category
	 * ids stays a list of numbers, because the schema behind it says `number[]`.
	 */

	type FormStore = Writable<Record<string, unknown>>;
	type ErrorStore = Readable<Record<string, unknown>>;

	const NO_FORM: FormStore = writable({});
	const NO_ERRORS: ErrorStore = writable({});

	let {
		label,
		name,
		items,
		form = NO_FORM,
		errors = NO_ERRORS,
		value = $bindable<(string | number)[]>([]),
		hint = '',
		selectedClass = 'bg-[#dcfce7]'
	}: {
		label: string;
		name: string;
		items: Item[];
		form?: FormStore;
		errors?: ErrorStore;
		value?: (string | number)[];
		hint?: string;
		/** Tailwind background for a selected pill, so groups stay tellable apart. */
		selectedClass?: string;
	} = $props();

	/*
	 * Identity, not contents: the question is whether a caller passed a store at
	 * all. `$form` would read and compare the store's *value*, which is a
	 * different question and one this component never asks.
	 *
	 * Read once by design — no call site hands this a superform on one render and
	 * a plain value on the next — so `untrack` states that rather than leaving it
	 * to be re-derived on every keystroke.
	 */
	// eslint-disable-next-line svelte/require-store-reactive-access
	const bound = untrack(() => form !== NO_FORM);

	const current = $derived((bound ? ($form[name] as (string | number)[]) : value) ?? []);
	/* Compared as strings so a numeric id and its string form agree. */
	const chosen = $derived(new Set(current.map(String)));

	const toggle = (item: Item, on: boolean) => {
		const next = on
			? [...current, item.value]
			: current.filter((entry) => String(entry) !== String(item.value));
		if (bound) $form[name] = next;
		else value = next;
	};

	const fieldError = $derived(bound ? String($errors[name] ?? '') : '');
</script>

<div class="space-y-1 pt-2">
	<span class="text-xs font-black text-slate-900">{label}</span>
	{#if hint}
		<p class="text-[11px] font-medium text-slate-500">{hint}</p>
	{/if}

	<div class="flex flex-wrap gap-2 pt-1">
		{#each items as item (item.value)}
			{@const selected = chosen.has(String(item.value))}
			<label
				class="cursor-pointer rounded-xl border-2 px-3 py-1.5 text-xs font-black transition-all focus-within:ring-2 focus-within:ring-emerald-500 {selected
					? `border-slate-900 text-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] ${selectedClass}`
					: 'border-slate-300 bg-white text-slate-600 hover:border-slate-900'}"
			>
				<input
					type="checkbox"
					{name}
					value={item.value}
					checked={selected}
					onchange={(event) => toggle(item, event.currentTarget.checked)}
					class="sr-only"
				/>
				{item.name}
			</label>
		{/each}
	</div>

	{#if fieldError}
		<p class="flex items-center gap-2 pt-1 text-xs font-bold text-red-600" aria-live="polite">
			<CircleAlert class="h-3.5 w-3.5" />
			{fieldError}
		</p>
	{/if}
</div>
