<script lang="ts">
	import { Input } from '$lib/components/ui/input/index';
	import { Textarea } from '$lib/components/ui/textarea/index';
	import { Label } from '$lib/components/ui/label/index.js';
	import FileUpload from './FileUpload.svelte';
	import DatePicker2 from './DatePicker2.svelte';
	import DatePicker from './DatePicker.svelte';
	import SelectComp from './SelectComp.svelte';
	import ComboboxComp from './ComboboxComp.svelte';
	import CheckboxComp from './CheckboxComp.svelte';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { CircleAlert } from '@lucide/svelte';

	let {
		label,
		form,
		name,
		errors,
		type,
		required = false,
		max = '',
		min = '',
		placeholder = '',
		rows = 5,
		items = [],
		oldDays = true,
		year = false,
		futureDays = false,
		image = '',
		className = ''
	} = $props();


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

	let fieldErrors = $derived(flattenErrors($errors[name]));
</script>

<div class="flex w-full max-w-full flex-col justify-start gap-2 p-1">
	<Label for={name} class="capitalize">{label}</Label>
	{#if type === 'textarea'}
		<Textarea class={className} {name} bind:value={$form[name]} {required} {rows} {placeholder} />
	{:else if type === 'file'}
		<FileUpload {name} {form} {image} {placeholder} />
	{:else if type === 'select'}
		<SelectComp {name} bind:value={$form[name]} {items} />
	{:else if type === 'date'}
		<DatePicker2 bind:data={$form[name]} {oldDays} {year} {futureDays} />
		<input type="hidden" {name} bind:value={$form[name]} />
	{:else if type === 'dateMultiple'}
		<DatePicker bind:data={$form[name]} {oldDays} {year} {futureDays} />
		<input type="hidden" {name} bind:value={$form[name]} />
	{:else if type === 'combo'}
		<ComboboxComp {name} bind:value={$form[name]} {items} {required} />
	{:else if type === 'checkbox'}
		<CheckboxComp {items} bind:checkedValues={$form[name]} />
		<input type="hidden" {name} bind:value={$form[name]} />
	{:else if type === 'checkboxSingle'}
		<div class="flex items-center gap-2">
			<Checkbox class={className} bind:checked={$form[name]} />
			<Label for={name} class="capitalize">{placeholder}</Label>
			<input type="hidden" {name} bind:value={$form[name]} />
		</div>
	{:else}
		<Input
			class={className}
			{type}
			{name}
			step="any"
			bind:value={$form[name]}
			{max}
			{min}
			{placeholder}
			{required}
		/>
	{/if}

	<!-- {#if $errors[name]}
		{#if $errors[name]._errors}
			{#each $errors[name]._errors as error}
				<p class="flex items-center gap-2 text-red-500"><CircleAlert /> {error}</p>
			{/each}
		{:else}
			<p class="text-red-500">{$errors[name]}</p>
		{/if}
	{/if} -->

{#if fieldErrors.length}
	{#each fieldErrors as error}
		<p class="flex items-center gap-2 text-red-500"><CircleAlert /> {error}</p>
	{/each}
{/if}
</div>
