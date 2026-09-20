<script lang="ts">
	import { untrack } from 'svelte';
	import { writable, type Writable } from 'svelte/store';
	import PlatformGlyph from '$lib/components/platform-glyph.svelte';
	import type { Item } from '$lib/global.svelte';

	/**
	 * A one-of-many choice drawn as a row of small boxes rather than a dropdown.
	 *
	 * For the short, visual lists — platforms above all, where the logo says
	 * "TikTok" faster than the word does and every option fits on screen at once.
	 * A dropdown hides the choices behind a click and gives a logo nowhere to go;
	 * this shows the whole list, which is the point when there are seven of them.
	 *
	 * Underneath it is a real `<input type="radio">` group. It posts on its own,
	 * it is keyboard-navigable with the arrow keys the platform already gives
	 * radios, and it works with scripting off — the same bargain `RadioCards`
	 * makes, in a smaller shape meant to sit inside a form beside other fields
	 * rather than to be the whole question.
	 *
	 * Binds either to a superform (`form`) or to a plain value (`bind:value`),
	 * exactly like `InputComp`, which is what renders it in practice.
	 */

	type FormStore = Writable<Record<string, unknown>>;

	const NO_FORM: FormStore = writable({});

	let {
		name,
		id = undefined,
		items = [],
		form = NO_FORM,
		value = $bindable(undefined),
		onChange = undefined,
		required = false,
		disabled = false,
		describedBy = undefined,
		class: className = ''
	}: {
		name: string;
		/** Carried by the first box, so a `<label for>` outside resolves to a real control. */
		id?: string;
		items?: Item[];
		form?: FormStore;
		value?: string | number | undefined;
		onChange?: (value: unknown) => void;
		required?: boolean;
		disabled?: boolean;
		describedBy?: string | undefined;
		class?: string;
	} = $props();

	/* Identity, not contents — the same reading `InputComp` makes, for the same
	   reason: the question is whether a caller passed a store at all. */
	// eslint-disable-next-line svelte/require-store-reactive-access
	const bound = untrack(() => form !== NO_FORM);

	const selected = $derived(bound ? $form[name] : value);

	/**
	 * Whether this box is the chosen one.
	 *
	 * Compared as strings because the two sides genuinely differ in type: a
	 * superform holds `platformId` as a number, a URL filter holds it as the
	 * text that was in the query string, and an item's value may be either.
	 * Comparing with `===` silently unselects the right box in half the call
	 * sites.
	 */
	const isChosen = (item: Item) =>
		selected !== undefined && selected !== null && String(selected) === String(item.value);

	/**
	 * Writes the item's own value, not the DOM's.
	 *
	 * A radio's `value` attribute is always a string, so reading it back would
	 * turn every numeric id into text and post `"3"` where the schema wants `3`.
	 * Taking it from the item keeps whatever type the caller built the list with.
	 */
	function choose(item: Item) {
		if (disabled) return;
		if (bound) $form[name] = item.value;
		else value = item.value;
		onChange?.(item.value);
	}
</script>

<div
	class="flex flex-wrap gap-2 {className}"
	role="radiogroup"
	aria-required={required ? 'true' : undefined}
	aria-describedby={describedBy}
>
	{#each items as item, index (item.value)}
		{@const chosen = isChosen(item)}
		<label
			class="relative flex cursor-pointer items-center gap-2 rounded-xl border-2 px-3 py-2 text-xs font-black transition-all select-none has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring
				{chosen
				? 'border-edge bg-inverse text-inverse-ink shadow-[2px_2px_0px_0px_rgb(var(--bento-shadow))]'
				: 'border-edge-mid bg-surface text-ink hover:bg-well'}
				{disabled ? 'cursor-not-allowed opacity-60' : ''}"
		>
			<!--
				The radio itself, present and focusable but not drawn: the box around
				it is the control the reader sees, and `focus-visible` on the box is
				what shows where the keyboard is. `sr-only` rather than `hidden`,
				which would take it out of the tab order and off the accessibility
				tree with it.
			-->
			<input
				type="radio"
				class="sr-only"
				id={index === 0 ? id : undefined}
				{name}
				{required}
				{disabled}
				value={String(item.value)}
				checked={chosen}
				onchange={() => choose(item)}
			/>

			{#if item.glyph}
				<!-- Drawn in the platform's own colours, except where the glyph is a
				     black mark — see `platform-glyph.svelte`. -->
				<PlatformGlyph
					name={item.glyph}
					color={item.color ?? ''}
					monoClass={chosen ? 'text-inverse-ink' : 'text-ink'}
					class="size-4"
				/>
			{/if}
			<span>{item.name}</span>
		</label>
	{/each}
</div>
