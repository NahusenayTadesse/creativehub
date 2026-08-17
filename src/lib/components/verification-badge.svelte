<script lang="ts">
	import { ShieldCheck, CircleCheckBig } from '@lucide/svelte';

	/**
	 * Badges name the evidence that was actually checked — there is deliberately
	 * no unqualified "Verified" pill (PRD FR-091).
	 */
	let { level = 'unverified', class: className = '' }: { level?: string; class?: string } = $props();
</script>

{#if level === 'cn_verified'}
	<span
		class="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2 py-0.5 text-[11px] font-bold text-white shadow-2xs {className}"
		title="Identity documents and channel ownership both checked by an operator"
	>
		<ShieldCheck class="h-3 w-3" />
		<span>CN Verified</span>
	</span>
{:else if level === 'identity_verified'}
	<span
		class="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 {className}"
		title="Government identity document checked by an operator"
	>
		<CircleCheckBig class="h-3 w-3 text-emerald-600" />
		<span>ID Verified</span>
	</span>
{:else if level === 'social_verified'}
	<span
		class="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-700 {className}"
		title="Channel ownership confirmed"
	>
		<span>Social Verified</span>
	</span>
{:else}
	<span
		class="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500 {className}"
		title="No evidence submitted yet"
	>
		<span>Unverified</span>
	</span>
{/if}
