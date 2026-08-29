<script lang="ts">
	import * as m from '$lib/paraglide/messages';
	import { Ticket, Gift } from '@lucide/svelte';

	let { type = 'paid', class: className = '' }: { type?: string; class?: string } = $props();
</script>

{#if type === 'event_pass'}
	<span
		class="inline-flex items-center gap-1 rounded-full border border-tint-violet-edge bg-tint-violet px-2.5 py-0.5 text-xs font-semibold text-tint-violet-fg {className}"
	>
		<Ticket class="h-3 w-3 text-tint-violet-edge" />
		<span>{m.comp_badge_event()}</span>
	</span>
{:else if type === 'barter'}
	<span
		class="inline-flex items-center gap-1 rounded-full border border-warn-edge bg-warn-soft px-2.5 py-0.5 text-xs font-semibold text-warn-fg {className}"
	>
		<Gift class="h-3 w-3 text-warn" />
		<span>{m.comp_badge_barter()}</span>
	</span>
{:else}
	<span
		class="inline-flex items-center rounded-full border border-brand-edge bg-brand-soft px-2.5 py-0.5 text-xs font-semibold text-brand-soft-fg {className}"
	>
		{m.comp_badge_paid()}
	</span>
{/if}
