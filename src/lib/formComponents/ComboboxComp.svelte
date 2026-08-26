<script lang="ts">
	import CheckIcon from '@lucide/svelte/icons/check';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import { tick } from 'svelte';
	import * as Command from '$lib/components/ui/command/index.js';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import { cn } from '$lib/utils.js';
	import { selectItem, type Item } from '$lib/global.svelte';
	import * as m from '$lib/paraglide/messages';

	/**
	 * The one dropdown behind both `type="select"` and `type="combo"`.
	 *
	 * A popover over a command list rather than a native-ish select, because the
	 * lists this app puts in a dropdown are long — every category, every
	 * platform, every campaign — and picking from twenty options by scrolling is
	 * the part that hurt on a phone. Typing narrows instead.
	 */
	let {
		items,
		name,
		value = $bindable(),
		required = false,
		disabled = false,
		/**
		 * Whether to offer the search box. Short lists do not earn one — a filter
		 * field over three options is more chrome than help — so by default it
		 * appears once the list is long enough to be worth narrowing.
		 */
		searchable = undefined
	}: {
		items: Item[];
		name: string;
		value?: string | number | undefined;
		required?: boolean;
		disabled?: boolean;
		searchable?: boolean;
	} = $props();

	/** Above this many options, scrolling is worse than typing. */
	const SEARCH_THRESHOLD = 8;

	let open = $state(false);
	let triggerRef = $state<HTMLButtonElement>(null!);

	const showSearch = $derived(searchable ?? items.length > SEARCH_THRESHOLD);
	const fieldLabel = $derived(name.replace(/([a-z0-9])([A-Z])/g, '$1 $2'));

	/* Compared as strings: a select posts "1" and the form may hold 1. */
	const selected = $derived(items.find((f: Item) => String(f.value) === String(value)));
	const triggerContent = $derived(
		selected?.name ?? m.form_select_placeholder({ field: fieldLabel })
	);

	/* Refocus the trigger on pick, so the keyboard stays on the form. */
	function closeAndFocusTrigger() {
		open = false;
		tick().then(() => triggerRef?.focus());
	}

	/*
	 * The primitive speaks strings; the form may hold numbers. Writing maps the
	 * chosen option back to its *own* value, so a numeric id stays a number in
	 * `$form` — the profile page filters regions with `r.countryId ===
	 * $form.countryId`, which a string would silently fail.
	 */
	function choose(item: Item) {
		value = item.value;
		closeAndFocusTrigger();
	}
</script>

<Popover.Root bind:open>
	<Popover.Trigger bind:ref={triggerRef} {disabled}>
		{#snippet child({ props })}
			<button
				{...props}
				type="button"
				id={name}
				role="combobox"
				aria-expanded={open}
				class="flex h-10 w-full items-center justify-between gap-1.5 rounded-none border border-transparent border-b-input bg-transparent px-0 py-2 text-left text-sm capitalize transition-[color,border-color] outline-none focus-visible:border-b-ring disabled:cursor-not-allowed disabled:opacity-50 aria-expanded:border-b-ring"
			>
				<span class={cn('line-clamp-1', !selected && 'text-muted-foreground')}>
					{triggerContent}
				</span>
				<ChevronDownIcon class="pointer-events-none size-3.5 shrink-0 text-muted-foreground" />
			</button>
		{/snippet}
	</Popover.Trigger>

	<input type="hidden" {name} {required} value={value ?? ''} />

	<!--
		Width follows the trigger, and height is capped by whatever room is left
		on that side of it, so the list can never run off the edge of a phone the
		way a fixed `max-h` did. The cap belongs on the popover rather than on the
		list: the search box is part of the height too, and capping only the list
		let the box push the whole thing past the fold. `p-0` because the command
		list brings its own padding.
	-->
	<Popover.Content
		align="start"
		sideOffset={4}
		preventScroll={true}
		class="flex max-h-[min(22rem,var(--bits-popover-content-available-height,22rem))] w-(--bits-popover-anchor-width) min-w-56 flex-col gap-0 overflow-hidden p-0"
	>
		<Command.Root class="min-h-0 flex-1">
			{#if showSearch}
				<Command.Input placeholder={m.form_search_placeholder({ field: fieldLabel })} />
			{/if}
			<!-- `min-h-0` so the list, not the popover, is what shrinks and scrolls. -->
			<Command.List class="max-h-none min-h-0 flex-1 overscroll-contain">
				<Command.Empty>{m.form_none_found({ field: fieldLabel })}</Command.Empty>
				<Command.Group>
					{#each items as item (item.value)}
						<Command.Item
							value={item.name}
							keywords={[item.name, String(item.value)]}
							onSelect={() => choose(item)}
							class={cn('capitalize', selectItem)}
						>
							<CheckIcon class={cn(String(item.value) !== String(value) && 'text-transparent')} />
							{item.name}
						</Command.Item>
					{/each}
				</Command.Group>
			</Command.List>
		</Command.Root>
	</Popover.Content>
</Popover.Root>
