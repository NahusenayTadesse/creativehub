<script lang="ts">
	import { untrack } from 'svelte';
	import { writable, type Readable, type Writable } from 'svelte/store';
	import { CircleAlert } from '@lucide/svelte';
	import type { LucideIcon } from '@lucide/svelte';

	/**
	 * A radio group drawn as cards rather than as dots.
	 *
	 * For the choices that deserve room to explain themselves — "are you a
	 * creator or a brand?" is the whole shape of the account that follows, and a
	 * one-word radio label undersells it.
	 *
	 * A component rather than markup on the page, for the same reason as
	 * `InputComp`: this was written once on sign-up, and the next screen that
	 * wants it would have written it again slightly differently. Underneath it is
	 * a real `<input type="radio">` group, so it posts, it is keyboard-navigable,
	 * and it works with scripting off.
	 *
	 * Binds either to a superform (`form` + `errors`) or to a plain value
	 * (`bind:value`), exactly like `InputComp`.
	 */

	type FormStore = Writable<Record<string, unknown>>;
	type ErrorStore = Readable<Record<string, unknown>>;

	const NO_FORM: FormStore = writable({});
	const NO_ERRORS: ErrorStore = writable({});

	export type RadioCard = {
		value: string;
		title: string;
		description?: string;
		icon?: LucideIcon;
		/** Tailwind classes for the selected state, so each card can differ. */
		selectedClass?: string;
		iconClass?: string;
	};

	let {
		legend,
		name,
		options,
		form = NO_FORM,
		errors = NO_ERRORS,
		value = $bindable(''),
		columns = 2
	}: {
		legend: string;
		name: string;
		options: RadioCard[];
		form?: FormStore;
		errors?: ErrorStore;
		value?: string;
		columns?: 1 | 2 | 3;
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
	const current = $derived(String((bound ? $form[name] : value) ?? ''));
	const choose = (next: string) => {
		if (bound) $form[name] = next;
		else value = next;
	};

	const fieldError = $derived(bound ? String($errors[name] ?? '') : '');

	const gridClass = $derived({ 1: 'grid-cols-1', 2: 'grid-cols-2', 3: 'grid-cols-3' }[columns]);
</script>

<fieldset class="space-y-2">
	<legend class="text-xs font-black text-ink">{legend}</legend>

	<div class="grid {gridClass} gap-3">
		{#each options as option (option.value)}
			{@const selected = current === option.value}
			<label
				class="flex cursor-pointer flex-col gap-1 rounded-2xl border-2 p-3 transition-all focus-within:ring-2 focus-within:ring-brand-edge {selected
					? `border-edge shadow-[3px_3px_0px_0px_rgb(var(--bento-shadow))] ${option.selectedClass ?? 'bg-well'}`
					: 'border-edge-mid bg-surface hover:border-edge'}"
			>
				<input
					type="radio"
					{name}
					value={option.value}
					checked={selected}
					onchange={() => choose(option.value)}
					class="sr-only"
				/>
				{#if option.icon}
					{@const Icon = option.icon}
					<Icon class="h-5 w-5 {option.iconClass ?? 'text-ink-soft'}" />
				{/if}
				<span class="text-sm font-black text-ink">{option.title}</span>
				{#if option.description}
					<span class="text-[11px] font-medium text-ink-soft">{option.description}</span>
				{/if}
			</label>
		{/each}
	</div>

	{#if fieldError}
		<p class="flex items-center gap-2 text-xs font-bold text-danger" aria-live="polite">
			<CircleAlert class="h-3.5 w-3.5" />
			{fieldError}
		</p>
	{/if}
</fieldset>
