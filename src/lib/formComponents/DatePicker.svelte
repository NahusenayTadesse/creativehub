<script lang="ts">
	import { Button, buttonVariants } from '$lib/components/ui/button/index.js';
	import { Calendar } from '$lib/components/ui/calendar';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import ScrollArea from '$lib/components/ui/scroll-area/scroll-area.svelte';
	import { cn } from '$lib/utils.js';
	import { CalendarDate, getLocalTimeZone, today, parseDate } from '@internationalized/date';
	import { CalendarIcon } from '@lucide/svelte';

	let {
		data = $bindable(''), // Expects "YYYY-MM-DD,YYYY-MM-DD"
		oldDays = false,
		year = false,
		futureDays = false
	}: {
		data: string;
		oldDays?: boolean;
		year?: boolean;
		futureDays?: boolean;
	} = $props();

	const tz = getLocalTimeZone();
	const minDate = $derived(oldDays ? undefined : today(tz));
	const maxDate = $derived(futureDays ? today(tz) : undefined);

	// Internal state is now an array
	let selectedDates = $state<CalendarDate[]>(
		data ? data.split(',').map((d) => parseDate(d.trim())) : []
	);

	// Sync internal state back to the 'data' string prop
	$effect(() => {
		data = selectedDates.map((d) => d.toString()).join(',');
	});

	const formatEthiopianDate = (date: CalendarDate): string => {
		const formatter = new Intl.DateTimeFormat('am-ET', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			calendar: 'ethiopic'
		});
		return formatter.format(date.toDate(tz));
	};

	// Derived label for the trigger button
	const displayLabel = $derived.by(() => {
		if (selectedDates.length === 0) return 'Select dates';
		if (selectedDates.length === 1) return formatEthiopianDate(selectedDates[0]);
		return `${selectedDates.length} dates selected`;
	});
</script>

<Popover.Root>
	<Popover.Trigger
		class={cn(
			buttonVariants({
				variant: 'outline',
				class: 'w-full justify-start text-left font-normal'
			}),
			selectedDates.length === 0 && 'text-muted-foreground'
		)}
	>
		<CalendarIcon class="mr-2 h-4 w-4" />
		{displayLabel}
	</Popover.Trigger>

	<Popover.Content class="flex w-auto flex-col gap-2 p-4">
		<ScrollArea class="h-80">
			<div class="flex flex-col text-sm text-muted-foreground">
				{#if selectedDates.length > 0}
					<ScrollArea class="m-2 max-h-24">
						<ul class="flex max-h-24 max-w-72 flex-row flex-wrap gap-2 rounded-lg border">
							{#each selectedDates as date}
								<li
									class="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-xs text-primary"
								>
									{formatEthiopianDate(date)}
								</li>
							{/each}
						</ul>
					</ScrollArea>
				{:else}No dates selected{/if}
			</div>
			<div class="mt-4 grid grid-cols-2 gap-2">
				<Button variant="secondary" size="sm" onclick={() => (selectedDates = [today(tz)])}>
					Today Only
				</Button>
				<Button variant="ghost" size="sm" onclick={() => (selectedDates = [])}>Clear All</Button>
			</div>
			<ScrollArea>
				<Calendar
					locale="am-ET"
					type="multiple"
					captionLayout={year ? 'dropdown-years' : 'label'}
					minValue={minDate}
					maxValue={maxDate}
					bind:value={selectedDates}
					class="h-72"
				/>
			</ScrollArea>
		</ScrollArea>
	</Popover.Content>
</Popover.Root>
