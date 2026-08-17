<script lang="ts">
	import { Ticket, Gift } from '@lucide/svelte';

	let { type = 'paid', class: className = '' }: { type?: string; class?: string } = $props();
</script>

{#if type === 'event_pass'}
	<span
		class="inline-flex items-center gap-1 rounded-full border border-purple-200/80 bg-purple-100 px-2.5 py-0.5 text-xs font-semibold text-purple-800 {className}"
	>
		<Ticket class="h-3 w-3 text-purple-600" />
		<span>Event Pass</span>
	</span>
{:else if type === 'barter'}
	<span
		class="inline-flex items-center gap-1 rounded-full border border-amber-200/80 bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800 {className}"
	>
		<Gift class="h-3 w-3 text-amber-600" />
		<span>Product / Barter</span>
	</span>
{:else}
	<span
		class="inline-flex items-center rounded-full border border-emerald-200/80 bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 {className}"
	>
		Paid Campaign
	</span>
{/if}
