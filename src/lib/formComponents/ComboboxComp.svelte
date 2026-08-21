<script lang="ts">
	import CheckIcon from '@lucide/svelte/icons/check';
	import ChevronsUpDownIcon from '@lucide/svelte/icons/chevrons-up-down';
	import { tick } from 'svelte';
	import * as Command from '$lib/components/ui/command/index.js';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { cn } from '$lib/utils.js';
	import { selectItem } from '$lib/global.svelte';
	import * as m from '$lib/paraglide/messages';

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

	/* Compared as strings: a select posts "1" and the form may hold 1. */
	const triggerContent = $derived(
		items.find((f: Item) => String(f.value) === String(value))?.name ??
			m.form_select_placeholder({ field: name.replace(/([a-z])([A-Z])/g, '$1 $2') })
	);
	// We want to refocus the trigger button when the user selects
	// an item from the list so users can continue navigating the
	// rest of the form with the keyboard.
	function closeAndFocusTrigger() {
		open = false;
		tick().then(() => {
			triggerRef.focus();
		});
	}
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
				placeholder={m.form_search_placeholder({
					field: name
						.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
						.replace(/\b\w/g, (char: string) => char.toUpperCase())
				})}
			/>
			<Command.List>
				<Command.Empty>
					{m.form_none_found({ field: name.replace(/([a-z])([A-Z])/g, '$1 $2') })}
				</Command.Empty>
				<Command.Group>
					{#each items as item (item.value)}
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
