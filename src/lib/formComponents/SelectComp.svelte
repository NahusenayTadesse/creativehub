<script lang="ts">
	import * as Select from '$lib/components/ui/select/index.js';
	import { selectItem, type Item } from '$lib/global.svelte';
	import * as m from '$lib/paraglide/messages';

	let {
		value = $bindable(),
		items,
		name,
		disabled = false
	}: {
		value?: string | number | undefined;
		items: Item[];
		name: string;
		disabled?: boolean;
	} = $props();

	/* Compared as strings: a select posts "1" and the form may hold 1. */
	const triggerContent = $derived(
		items.find((f: Item) => String(f.value) === String(value))?.name ??
			m.form_select_placeholder({ field: name.replace(/([a-z])([A-Z])/g, '$1 $2') })
	);

	/*
	 * The primitive speaks strings; the form may hold numbers.
	 *
	 * Reading stringifies, and writing maps the chosen string back to the item's
	 * *own* value — so a numeric id stays a number in `$form`. That matters
	 * beyond tidiness: the profile page filters regions with
	 * `r.countryId === $form.countryId`, which a string would silently fail.
	 */
	const selected = () => (value === undefined || value === null ? undefined : String(value));
	const choose = (next: string | undefined) => {
		value = items.find((item: Item) => String(item.value) === next)?.value ?? next;
	};
</script>

<Select.Root type="single" {name} {disabled} bind:value={selected, choose}>
	<Select.Trigger id={name} class="w-full capitalize">
		{triggerContent}
	</Select.Trigger>
	<Select.Content>
		{#each items as item (item.value)}
			<Select.Item value={String(item.value)} class={selectItem}>{item.name}</Select.Item>
		{/each}
	</Select.Content>
</Select.Root>
