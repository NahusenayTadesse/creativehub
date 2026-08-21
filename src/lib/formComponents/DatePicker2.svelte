<script lang="ts">
	import { untrack } from 'svelte';
	import { buttonVariants } from '$lib/components/ui/button/index.js';
	import { Calendar } from '$lib/components/ui/calendar';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import { cn } from '$lib/utils.js';
	import { CalendarDate, getLocalTimeZone, today, parseDate } from '@internationalized/date';
	import { CalendarIcon } from '@lucide/svelte';

	let {
		data = $bindable(),
		oldDays = false,
		year = false,
		futureDays = false
	}: {
		data: string;
		oldDays?: boolean;
		year?: boolean;
		futureDays?: boolean;
	} = $props();

	const todayDate = $derived(oldDays ? undefined : today(getLocalTimeZone()));

	/** The bound string as a calendar date, or today when there is nothing yet. */
	const parse = (value: string) =>
		parseDate(value || todayDate?.toString() || new Date().toISOString().split('T')[0]);

	let form = $state(untrack(() => parse(data)));

	/* Picking a date writes it back out… */
	$effect(() => {
		data = form.toString();
	});

	/* …and a value arriving from outside — a form reset, a navigation to another
	   subject — moves the calendar. Guarded on the string, so the two effects
	   settle instead of chasing each other. */
	$effect(() => {
		const incoming = data;
		if (incoming && incoming !== untrack(() => form.toString())) {
			form = parse(incoming);
		}
	});

	const formatDate = (date: CalendarDate | undefined): string => {
		if (!date) return '';

		const formatter = new Intl.DateTimeFormat('en-US', {
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		});

		return formatter.format(date.toDate(getLocalTimeZone()));
	};
</script>

<Popover.Root>
	<Popover.Trigger
		class={cn(
			buttonVariants({
				variant: 'outline',
				class: 'justify-between '
			}),
			!form && 'text-muted-foreground'
		)}
	>
		<div class="flex items-center gap-2">
			<CalendarIcon />
			{formatDate(form)}
		</div>
	</Popover.Trigger>

	<Popover.Content class="flex flex-wrap gap-2 border-t p-0 px-2 py-4!">
		<Calendar
			type="single"
			captionLayout={year ? 'dropdown-years' : 'label'}
			minValue={todayDate}
			maxValue={futureDays ? today(getLocalTimeZone()) : undefined}
			bind:value={form}
		/>
		<!-- {#each [{ label: 'Today', value: 0 }, { label: 'Tomorrow', value: 1 }, { label: 'In 3 days', value: 3 }, { label: 'In a week', value: 7 }, { label: 'In 2 weeks', value: 14 }] as preset (preset.value)}
			<Button
				variant="outline"
				size="sm"
				class="flex-1"
				onclick={() => {
					form = today(getLocalTimeZone()).add({ days: preset.value });
				}}
			>
				{preset.label}
			</Button>
		{/each} -->
	</Popover.Content>
</Popover.Root>
