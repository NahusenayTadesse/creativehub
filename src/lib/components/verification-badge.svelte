<script lang="ts">
	import * as m from '$lib/paraglide/messages';
	import { ShieldCheck, CircleCheckBig } from '@lucide/svelte';

	/**
	 * Badges name the evidence that was actually checked — there is deliberately
	 * no unqualified "Verified" pill (PRD FR-091).
	 */
	let { level = 'unverified', class: className = '' }: { level?: string; class?: string } =
		$props();
</script>

{#if level === 'cn_verified'}
	<span
		class="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2 py-0.5 text-[11px] font-bold text-white shadow-2xs {className}"
		title={m.verif_cn_title()}
	>
		<ShieldCheck class="h-3 w-3" />
		<span>{m.verif_cn_label()}</span>
	</span>
{:else if level === 'identity_verified'}
	<span
		class="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 {className}"
		title={m.verif_id_title()}
	>
		<CircleCheckBig class="h-3 w-3 text-emerald-600" />
		<span>{m.verif_id_label()}</span>
	</span>
{:else if level === 'social_verified'}
	<span
		class="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-700 {className}"
		title={m.verif_social_title()}
	>
		<span>{m.verif_social_label()}</span>
	</span>
{:else}
	<span
		class="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500 {className}"
		title={m.verif_none_title()}
	>
		<span>{m.verif_none_label()}</span>
	</span>
{/if}
