<script lang="ts">
	import { writable, type Readable, type Writable } from 'svelte/store';
	import { untrack } from 'svelte';
	import * as m from '$lib/paraglide/messages';
	import { Input } from '$lib/components/ui/input/index';
	import { Textarea } from '$lib/components/ui/textarea/index';
	import { Label } from '$lib/components/ui/label/index.js';
	import FileUpload from './FileUpload.svelte';
	import DatePicker2 from './DatePicker2.svelte';
	import DatePicker from './DatePicker.svelte';
	import ComboboxComp from './ComboboxComp.svelte';
	import CheckboxComp from './CheckboxComp.svelte';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { CircleAlert, Eye, EyeOff } from '@lucide/svelte';
	import type { Item } from '$lib/global.svelte';
	import type { FullAutoFill } from 'svelte/elements';

	/**
	 * One labelled field, in whichever of the nine shapes it needs to be.
	 *
	 * Every form in the app renders its fields through this, so the label, the
	 * error list, the spacing and the `name` that the server reads are decided
	 * once. A page that hand-rolls an `<input>` gets none of them, and gets to
	 * forget one of them.
	 *
	 * It works two ways:
	 *
	 * - **Bound to a superform** — pass `form` and `errors`, and the field reads
	 *   and writes `$form[name]` and shows `$errors[name]`. This is what a page
	 *   with a schema and an action does.
	 * - **Bound to a plain value** — pass `bind:value` instead. This is for the
	 *   forms that have no superform behind them: a filter that lives in the URL,
	 *   a select that posts straight to an action, a textarea whose value is
	 *   carried by a hidden field. They still get the same label, the same
	 *   spacing and the same error slot.
	 *
	 * The two are wired through a getter/setter binding rather than two branches
	 * of markup, so there is only ever one definition of each field type.
	 */

	type FormStore = Writable<Record<string, unknown>>;
	type ErrorStore = Readable<Record<string, unknown>>;

	/* Stand-ins so `$form` and `$errors` are always real stores. Reading a
	   subscription conditionally is not something the compiler allows. */
	const NO_FORM: FormStore = writable({});
	const NO_ERRORS: ErrorStore = writable({});

	let {
		label,
		labelHidden = false,
		name,
		type = 'text',
		form = NO_FORM,
		errors = NO_ERRORS,
		value = $bindable(undefined),
		error = '',
		required = false,
		disabled = false,
		max = '',
		min = '',
		step = 'any',
		autocomplete = undefined,
		placeholder = '',
		hint = '',
		rows = 5,
		items = [],
		onChange = undefined,
		formatValue = undefined,
		align = 'start',
		oldDays = true,
		year = false,
		futureDays = false,
		image = '',
		className = ''
	}: {
		label: string;
		/**
		 * Hides the label visually while leaving it for a screen reader.
		 *
		 * For the handful of places where the surrounding design already says
		 * what the field is — a chat composer, a single search box. Never a
		 * reason to omit `label` itself.
		 */
		labelHidden?: boolean;
		name: string;
		type?: string;
		form?: FormStore;
		errors?: ErrorStore;
		value?: unknown;
		/** A message from somewhere other than a schema — a server `fail`, say. */
		error?: string;
		required?: boolean;
		disabled?: boolean;
		max?: string | number;
		min?: string | number;
		step?: string | number;
		autocomplete?: FullAutoFill | null;
		placeholder?: string;
		/** Explanatory text under the control. Not an error. */
		hint?: string;
		rows?: number;
		items?: Item[];
		/**
		 * Fires after the value settles.
		 *
		 * For the fields whose value does not live in a form at all but in the
		 * URL — a discovery filter, a sort — where changing the control is a
		 * navigation. Without it those controls could not use this component and
		 * went back to hand-rolled `<select>`s.
		 */
		onChange?: (value: unknown) => void;
		/** How a range's current value reads in its badge. */
		formatValue?: (value: number) => string;
		/**
		 * Where a single checkbox sits relative to its label: next to it, or
		 * pushed to the far end of the row. Both layouts are in use.
		 */
		align?: 'start' | 'between';
		oldDays?: boolean;
		year?: boolean;
		futureDays?: boolean;
		image?: string;
		className?: string;
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

	/*
	 * One value, wherever it lives.
	 *
	 * `bind:value={read, write}` hands both halves to the control, so each field
	 * type is written once instead of twice — a superform branch and a plain
	 * branch would be two definitions of the same input that could drift.
	 *
	 * The readers below are narrow because each control declares what it accepts,
	 * and the value on a superform is only ever `unknown` here — this component
	 * is generic over every schema in the app.
	 */
	const read = () => (bound ? $form[name] : value);
	/** Writes the value without telling anyone. */
	const set = (next: unknown) => {
		if (bound) $form[name] = next;
		else value = next;
	};

	const write = (next: unknown) => {
		set(next);
		onChange?.(next);
	};

	const asText = () => (read() ?? '') as string;
	const asScalar = () => read() as string | number | undefined;
	const asList = () => (read() ?? []) as string[];
	const asBool = () => Boolean(read());
	const asNumber = () => Number(read() ?? 0);

	/*
	 * A password field reveals itself.
	 *
	 * Built in rather than per-page: it was hand-rolled on sign-in and sign-up
	 * and absent from the third password field on the sign-up form, which is the
	 * one where seeing what you typed matters most.
	 */
	let revealed = $state(false);
	const inputType = $derived(type === 'password' && revealed ? 'text' : type);

	function flattenErrors(err: unknown): string[] {
		if (!err) return [];
		if (typeof err === 'string') return [err];
		if (Array.isArray(err)) {
			return err.flatMap((e) => (typeof e === 'string' ? e : flattenErrors(e)));
		}
		if (typeof err === 'object') {
			return Object.values(err).flatMap((v) => flattenErrors(v));
		}
		return [String(err)];
	}

	const fieldErrors = $derived([
		...(error ? [error] : []),
		...flattenErrors(bound ? $errors[name] : undefined)
	]);
	/* A checkbox's sentence beside the box is a description, not a second name. */
	const noteId = $derived(type === 'checkboxSingle' && placeholder ? `${name}-note` : undefined);
	const describedBy = $derived(
		[noteId, fieldErrors.length ? `${name}-error` : hint ? `${name}-hint` : undefined]
			.filter(Boolean)
			.join(' ') || undefined
	);
</script>

<div class="flex w-full max-w-full flex-col justify-start gap-2 px-1 py-2">
	<Label for={name} class={labelHidden ? 'sr-only' : 'pl-3 capitalize'}>{label}</Label>

	{#if type === 'textarea'}
		<Textarea
			id={name}
			class={className}
			{name}
			bind:value={asText, write}
			{required}
			{disabled}
			{rows}
			{placeholder}
			aria-invalid={fieldErrors.length ? 'true' : undefined}
			aria-describedby={describedBy}
		/>
	{:else if type === 'file'}
		<FileUpload {name} {form} {image} {placeholder} />
	{:else if type === 'select'}
		<ComboboxComp {name} bind:value={asScalar, write} {items} {disabled} {required} />
	{:else if type === 'date'}
		<DatePicker2 bind:data={asText, write} {oldDays} {year} {futureDays} />
		<input type="hidden" {name} value={asText()} />
	{:else if type === 'dateMultiple'}
		<DatePicker bind:data={asText, write} {oldDays} {year} {futureDays} />
		<input type="hidden" {name} value={asText()} />
	{:else if type === 'combo'}
		<ComboboxComp {name} bind:value={asScalar, write} {items} {required} />
	{:else if type === 'checkbox'}
		<CheckboxComp {items} bind:checkedValues={asList, write} />
		<input type="hidden" {name} value={asText()} />
	{:else if type === 'range'}
		<div class="flex items-center justify-between pl-3 text-xs">
			<span class="sr-only">{label}</span>
			<span
				class="ml-auto rounded border border-edge bg-tile-mint px-2 py-0.5 text-xs font-black text-brand-soft-fg"
			>
				{formatValue ? formatValue(asNumber()) : asNumber().toLocaleString()}
			</span>
		</div>
		<!--
			Dragging updates the badge; only letting go is a decision.

			`onChange` on a range is usually a navigation or a query, and firing it
			per pixel of travel would mean a request for every intermediate value
			the handle passed through.
		-->
		<input
			id={name}
			{name}
			type="range"
			{min}
			{max}
			{step}
			{disabled}
			value={asNumber()}
			oninput={(event) => set(Number(event.currentTarget.value))}
			onchange={(event) => write(Number(event.currentTarget.value))}
			class="w-full cursor-pointer accent-brand {className}"
			aria-describedby={describedBy}
		/>
	{:else if type === 'checkboxSingle'}
		<!--
			`label` is the control's name; `placeholder` is the sentence beside the
			box saying what ticking it does. They used to be two `<label for>`
			elements pointing at the same input, which announces the name twice and
			leaves nothing marked as the description.
		-->
		{#snippet box()}
			<Checkbox
				id={name}
				class={className}
				bind:checked={asBool, write}
				{disabled}
				aria-describedby={describedBy}
			/>
		{/snippet}
		{#snippet note()}
			{#if placeholder}
				<span id="{name}-note" class="text-xs font-medium text-ink-soft">{placeholder}</span>
			{/if}
		{/snippet}
		<div class="flex items-center gap-2 pl-3 {align === 'between' ? 'justify-between' : ''}">
			{#if align === 'between'}
				{@render note()}{@render box()}
			{:else}
				{@render box()}{@render note()}
			{/if}
			<input type="hidden" {name} value={asText()} />
		</div>
	{:else if type === 'password'}
		<div class="relative">
			<Input
				id={name}
				class="pr-10 {className}"
				type={inputType}
				{name}
				bind:value={asScalar, write}
				{placeholder}
				{required}
				{disabled}
				{autocomplete}
				aria-invalid={fieldErrors.length ? 'true' : undefined}
				aria-describedby={describedBy}
			/>
			<button
				type="button"
				onclick={() => (revealed = !revealed)}
				aria-label={revealed ? m.login_hide_password() : m.login_show_password()}
				aria-pressed={revealed}
				class="absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer text-ink-dim hover:text-ink"
			>
				{#if revealed}<EyeOff class="h-4 w-4" />{:else}<Eye class="h-4 w-4" />{/if}
			</button>
		</div>
	{:else}
		<Input
			id={name}
			class={className}
			{type}
			{name}
			{step}
			bind:value={asScalar, write}
			{max}
			{min}
			{placeholder}
			{required}
			{disabled}
			{autocomplete}
			aria-invalid={fieldErrors.length ? 'true' : undefined}
			aria-describedby={describedBy}
		/>
	{/if}

	{#if fieldErrors.length}
		<div id="{name}-error" class="pl-3" aria-live="polite">
			{#each fieldErrors as message (message)}
				<p class="flex items-center gap-2 text-danger"><CircleAlert /> {message}</p>
			{/each}
		</div>
	{:else if hint}
		<p id="{name}-hint" class="pl-3 text-xs font-medium text-ink-dim">{hint}</p>
	{/if}
</div>
