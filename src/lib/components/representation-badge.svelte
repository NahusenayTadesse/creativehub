<script lang="ts">
	import * as m from '$lib/paraglide/messages';
	import { Handshake, Mail } from '@lucide/svelte';

	/**
	 * Whether the person behind a profile is actually here.
	 *
	 * Imported profiles are published before anyone claims them, so a brand can
	 * reach a card, a quick view and a booking form without ever being told that
	 * the creator has no account on the other side of it. `isClaimed` has been
	 * written since the importer landed and read by nothing — this is what reads
	 * it. Like `verification-badge.svelte`, the label names the arrangement
	 * rather than making an unqualified claim about it.
	 */
	let { claimed = false, class: className = '' }: { claimed?: boolean; class?: string } = $props();
</script>

{#if claimed}
	<span
		class="inline-flex items-center gap-1 rounded-md bg-tint-sky px-2 py-0.5 text-[11px] font-semibold text-tint-sky-fg shadow-2xs {className}"
		title={m.repr_direct_title()}
	>
		<Handshake class="h-3 w-3 text-tint-sky-edge" />
		<span>{m.repr_direct_label()}</span>
	</span>
{:else}
	<span
		class="inline-flex items-center gap-1 rounded-md bg-warn-soft px-2 py-0.5 text-[11px] font-semibold text-warn-fg shadow-2xs {className}"
		title={m.repr_intro_title()}
	>
		<Mail class="h-3 w-3 text-warn-fg" />
		<span>{m.repr_intro_label()}</span>
	</span>
{/if}
