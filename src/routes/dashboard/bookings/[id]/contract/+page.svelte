<script lang="ts">
	import { Printer, ShieldCheck, TriangleAlert } from '@lucide/svelte';
	import * as m from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';

	let { data } = $props();
	const contract = $derived(data.contract);

	const when = (value: string | Date | null) =>
		value
			? new Date(value).toLocaleString(getLocale() === 'am' ? 'am-ET' : 'en-GB', {
					day: 'numeric',
					month: 'long',
					year: 'numeric',
					hour: '2-digit',
					minute: '2-digit',
					timeZoneName: 'short'
				})
			: m.ct_not_signed();
</script>

<svelte:head><title>{m.ct_meta_title({ reference: contract.reference })}</title></svelte:head>

<article class="printable mx-auto max-w-3xl space-y-6 bg-surface p-6 text-ink sm:p-10">
	<div class="flex flex-wrap items-center justify-between gap-3 print:hidden">
		{#if contract.intact}
			<p class="flex items-center gap-1.5 text-xs font-bold text-brand-soft-fg">
				<ShieldCheck class="h-4 w-4" />
				{m.ct_intact()}
			</p>
		{:else}
			<p class="flex items-center gap-1.5 text-xs font-bold text-danger-fg">
				<TriangleAlert class="h-4 w-4" />
				{m.ct_tampered()}
			</p>
		{/if}
		<button
			type="button"
			onclick={() => window.print()}
			class="inline-flex items-center gap-1.5 rounded-xl border-2 border-edge bg-surface px-4 py-2 text-xs font-black text-ink"
		>
			<Printer class="h-3.5 w-3.5" />
			{m.doc_print()}
		</button>
	</div>

	<pre class="font-serif text-[13px] leading-relaxed whitespace-pre-wrap">{contract.body}</pre>

	<section class="grid gap-4 border-t border-edge pt-6 text-xs sm:grid-cols-2">
		<div>
			<p class="font-black tracking-wider uppercase">{m.ct_brand_signature()}</p>
			<p class="mt-2 font-serif text-base italic">{contract.brandSignerName ?? '—'}</p>
			<p class="text-ink-dim">{when(contract.brandSignedAt)}</p>
		</div>
		<div>
			<p class="font-black tracking-wider uppercase">{m.ct_creator_signature()}</p>
			<p class="mt-2 font-serif text-base italic">{contract.creatorSignerName ?? '—'}</p>
			<p class="text-ink-dim">{when(contract.creatorSignedAt)}</p>
		</div>
	</section>

	<p class="border-t border-edge pt-4 font-mono text-[10px] break-all text-ink-dim">
		{m.ct_fingerprint()} SHA-256 {contract.bodyHash}
	</p>
</article>

<style>
	@media print {
		:global(body) {
			background: white;
		}
		.printable {
			max-width: none;
			padding: 0;
		}
	}
</style>
