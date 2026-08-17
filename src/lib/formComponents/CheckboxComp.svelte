<script lang="ts">
	import Button from '$lib/components/ui/button/button.svelte';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Label } from '$lib/components/ui/label';
	import { Badge, BadgeCheck } from '@lucide/svelte';

	import { type Item } from '$lib/global.svelte';

	let { items = [], checkedValues = $bindable([]) }: { items: Item[]; checkedValues?: string[] } =
		$props();

	/**
	 * Handle checkbox change
	 */
	const handleChange = (itemValue: string, isChecked: boolean) => {
		if (isChecked) {
			checkedValues = [...checkedValues, itemValue];
		} else {
			checkedValues = checkedValues.filter((v) => v !== itemValue);
		}
	};

	let Icon = $derived(checkedValues.length === items.length ? BadgeCheck : Badge);

	function toggleSelectAll() {
		if (checkedValues.length === items.length) {
			checkedValues = [];
		} else {
			checkedValues = items.map((item) => String(item.value));
		}
	}
</script>

<Button onclick={toggleSelectAll} size="icon" class="w-full lg:w-1/5">
	<Icon />
	{checkedValues.length === items.length ? 'Unselect' : 'Select'} All
</Button>
<div
	class="grid {items.length > 20
		? 'grid-cols-1 lg:grid-cols-5'
		: items.length > 10
			? 'grid-cols-1 lg:grid-cols-2'
			: 'grid-cols-1'} gap-3"
>
	{#each items as item (item.value)}
		<div class="flex items-center gap-2">
			<Label for={String(item.value)} class="cursor-pointer font-normal">
				<Checkbox
					id={String(item.value)}
					checked={checkedValues.includes(String(item.value))}
					onCheckedChange={(c) => handleChange(String(item.value), c)}
				/>

				{item.name}
			</Label>
		</div>
	{/each}
</div>
