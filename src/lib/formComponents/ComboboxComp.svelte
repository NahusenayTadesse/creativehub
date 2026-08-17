<script lang="ts">
	import CheckIcon from '@lucide/svelte/icons/check';
	import ChevronsUpDownIcon from '@lucide/svelte/icons/chevrons-up-down';
	import { tick } from 'svelte';
	import * as Command from '$lib/components/ui/command/index.js';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { cn } from '$lib/utils.js';
	import { selectItem } from '$lib/global.svelte';

	let {
		items,
		name,
		value = $bindable(),
		required = false
	}: {
		items: Item[];
		name: string;
		value: string | number | undefined;
		required: boolean;
	} = $props();
	let open = $state(false);
	let triggerRef = $state<HTMLButtonElement>(null!);
	type Item = {
		value: string | number;
		name: string;
	};

	const selectedValue = $derived(items.find((f) => f.value === value)?.name);

	// const triggerContent = $derived(
	// 	items.find((f: Item) => f.value === value)?.name ??
	// 		'Select ' + name.replace(/([a-z])([A-Z])/g, '$1 $2')
	// );
	//
	const triggerContent = $derived(
		// Use String coercion to ensure "1" matches 1
		items.find((f: Item) => String(f.value) === String(value))?.name ??
			'Select ' + name.replace(/([a-z])([A-Z])/g, '$1 $2')
	);

	function getNameByValue(items: Item[], value: string | number): string | undefined {
		return items.find((item) => item.value === value)?.name.replace(/([a-z])([A-Z])/g, '$1 $2');
	}
	// We want to refocus the trigger button when the user selects
	// an item from the list so users can continue navigating the
	// rest of the form with the keyboard.
	function closeAndFocusTrigger() {
		open = false;
		tick().then(() => {
			triggerRef.focus();
		});
	}
	$inspect(value, items);
</script>

<Popover.Root bind:open>
	<Popover.Trigger bind:ref={triggerRef}>
		{#snippet child({ props })}
			<Button
				{...props}
				variant="outline"
				class="w-full justify-between capitalize"
				role="combobox"
				aria-expanded={open}
			>
				{triggerContent}
				<ChevronsUpDownIcon class="opacity-50" />
			</Button>
		{/snippet}
	</Popover.Trigger>
	<input type="hidden" bind:value {name} {required} />

	<Popover.Content class="w-full p-0">
		<Command.Root>
			<Command.Input
				placeholder="Search {name
					.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
					.replace(/\b\w/g, (char) => char.toUpperCase())}..."
			/>
			<Command.List>
				<Command.Empty>No {name.replace(/([a-z])([A-Z])/g, '$1 $2')} found.</Command.Empty>
				<Command.Group>
					{#each items as item}
						<Command.Item
							value={item.name}
							keywords={[item.name]}
							onSelect={() => {
								value = item.value;
								closeAndFocusTrigger();
							}}
							class={selectItem}
						>
							<CheckIcon class={cn(value !== item.value && 'text-transparent')} />
							{item.name}
						</Command.Item>
					{/each}
				</Command.Group>
			</Command.List>
		</Command.Root>
	</Popover.Content>
</Popover.Root>
