<script lang="ts">
	import { untrack } from 'svelte';
	import { writable, type Readable, type Writable } from 'svelte/store';
	import { Star } from '@lucide/svelte';
	import * as m from '$lib/paraglide/messages';

	/**
	 * A 1–5 star control that posts as a plain field.
	 *
	 * There is no native input for this, so it is a row of buttons over a hidden
	 * field — which is fine, and is exactly the sort of thing that gets written
	 * slightly differently every time it is written. This page alone had it
	 * twice: once large for the overall score, once small for each of the four
	 * sub-scores, with different labels and different hidden-field handling.
	 *
	 * Binds to a superform (`form`) or to a plain value (`bind:value`), like the
	 * other field components. `onPick` fires after the value settles, which is
	 * what lets the overall stars seed the four below them.
	 */

	type FormStore = Writable<Record<string, unknown>>;
	type ErrorStore = Readable<Record<string, unknown>>;

	const NO_FORM: FormStore = writable({});
	const NO_ERRORS: ErrorStore = writable({});

	let {
		name,
		label = '',
		form = NO_FORM,
		errors = NO_ERRORS,
		value = $bindable(0),
		size = 'lg',
		onPick = undefined
	}: {
		name: string;
		/** Named in the accessible label of each star, so "4 out of 5 for what?". */
		label?: string;
		form?: FormStore;
		errors?: ErrorStore;
		value?: number;
		size?: 'sm' | 'lg';
		onPick?: (value: number) => void;
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
	const current = $derived(Number((bound ? $form[name] : value) ?? 0));

	const pick = (star: number) => {
		if (bound) $form[name] = star;
		else value = star;
		onPick?.(star);
	};

	const starClass = $derived(size === 'lg' ? 'h-8 w-8' : 'h-4 w-4');
	const padClass = $derived(size === 'lg' ? 'p-1.5 hover:scale-110' : 'p-0.5');

	const fieldError = $derived(bound ? String($errors[name] ?? '') : '');

	const starLabel = (star: number) =>
		label
			? m.bk_sub_rating_label({ label, value: star })
			: star === 1
				? m.bk_star_label_one()
				: m.bk_star_label({ count: star });
</script>

<div
	class="flex items-center {size === 'lg' ? 'justify-center gap-2' : 'gap-1'}"
	role="radiogroup"
	aria-label={label || m.bk_overall_rating()}
>
	{#each [1, 2, 3, 4, 5] as star (star)}
		<button
			type="button"
			role="radio"
			aria-checked={current === star}
			onclick={() => pick(star)}
			class="cursor-pointer transition-transform {padClass}"
			aria-label={starLabel(star)}
		>
			<Star
				class="{starClass} {star <= current ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}"
			/>
		</button>
	{/each}
</div>

<input type="hidden" {name} value={current} />

{#if fieldError}
	<p class="text-xs font-bold text-red-600" aria-live="polite">{fieldError}</p>
{/if}
