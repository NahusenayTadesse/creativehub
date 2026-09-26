<script lang="ts">
	import { Printer } from '@lucide/svelte';
	import * as m from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';
	import { formatAmountWithCode } from '$lib/domain/money';
	import type { DocumentLine } from '$lib/domain/documents';

	let { data } = $props();
	const doc = $derived(data.doc);
	const money = (amount: number) => formatAmountWithCode(amount, data.currencyCode);

	const title = $derived(
		doc.kind === 'brand_invoice'
			? m.doc_brand_invoice()
			: doc.kind === 'creator_statement'
				? m.doc_creator_statement()
				: m.doc_withholding_certificate()
	);

	const lineLabel = (label: DocumentLine['label']) =>
		({
			campaign_fee: m.doc_line_campaign_fee(),
			service_fee: m.doc_line_service_fee(),
			vat_on_service_fee: m.doc_line_vat(),
			commission: m.doc_line_commission(),
			withholding: m.doc_line_withholding(),
			net_payout: m.doc_line_net(),
			gross_payment: m.doc_line_gross()
		})[label];

	const totalLabel = $derived(
		doc.kind === 'brand_invoice'
			? m.doc_total_due()
			: doc.kind === 'creator_statement'
				? m.doc_total_net()
				: m.doc_total_withheld()
	);

	const issued = $derived(
		new Date(data.issuedAt).toLocaleDateString(getLocale() === 'am' ? 'am-ET' : 'en-GB', {
			day: 'numeric',
			month: 'long',
			year: 'numeric'
		})
	);
</script>

<svelte:head><title>{title} {data.number}</title></svelte:head>

<article class="printable mx-auto max-w-3xl space-y-8 bg-surface p-6 text-ink sm:p-10">
	<div class="flex justify-end print:hidden">
		<button
			type="button"
			onclick={() => window.print()}
			class="inline-flex items-center gap-1.5 rounded-xl border-2 border-edge bg-surface px-4 py-2 text-xs font-black text-ink"
		>
			<Printer class="h-3.5 w-3.5" />
			{m.doc_print()}
		</button>
	</div>

	<header class="flex flex-wrap items-start justify-between gap-6">
		<div class="space-y-1 text-xs">
			<p class="text-lg font-black">{doc.issuer.legalName || doc.issuer.siteName}</p>
			{#if doc.issuer.legalName}<p>{doc.issuer.siteName}</p>{/if}
			{#if doc.issuer.address}<p class="whitespace-pre-line">{doc.issuer.address}</p>{/if}
			{#if doc.issuer.tin}<p>{m.doc_tin({ tin: doc.issuer.tin })}</p>{/if}
			{#if doc.issuer.vatNumber}<p>{m.doc_vat_number({ number: doc.issuer.vatNumber })}</p>{/if}
		</div>
		<div class="space-y-1 text-end text-xs">
			<p class="text-xl font-black tracking-tight uppercase">{title}</p>
			<p class="font-mono">{data.number}</p>
			<p>{m.doc_issued({ date: issued })}</p>
		</div>
	</header>

	<section class="grid gap-6 text-xs sm:grid-cols-2">
		<div>
			<p class="font-black tracking-wider text-ink-dim uppercase">{m.doc_to()}</p>
			<p class="mt-1 text-sm font-black">{doc.recipient.name}</p>
			{#if doc.recipient.detail}<p>{doc.recipient.detail}</p>{/if}
		</div>
		<div>
			<p class="font-black tracking-wider text-ink-dim uppercase">{m.doc_for()}</p>
			<p class="mt-1 text-sm font-black">{doc.deal.title}</p>
			<p class="font-mono">{doc.deal.reference}</p>
			{#if doc.deal.contractReference}
				<p>{m.doc_contract({ reference: doc.deal.contractReference })}</p>
			{/if}
		</div>
	</section>

	<table class="w-full text-left text-xs">
		<thead>
			<tr class="border-b-2 border-edge">
				<th class="py-2 font-black">{m.doc_description()}</th>
				<th class="py-2 text-end font-black">{m.doc_amount()}</th>
			</tr>
		</thead>
		<tbody>
			{#each doc.lines as line, index (index)}
				<tr class="border-b border-edge-soft">
					<td class="py-2">
						{lineLabel(line.label)}
						{#if line.rate}<span class="text-ink-dim">({line.rate})</span>{/if}
					</td>
					<td class="py-2 text-end tabular-nums">
						{line.deducted ? '− ' : ''}{money(line.amount)}
					</td>
				</tr>
			{/each}
		</tbody>
		<tfoot>
			<tr>
				<td class="pt-3 text-sm font-black">{totalLabel}</td>
				<td class="pt-3 text-end text-sm font-black tabular-nums">{money(doc.total)}</td>
			</tr>
		</tfoot>
	</table>

	<p class="border-t border-edge pt-4 text-[10px] leading-relaxed text-ink-dim">
		{doc.kind === 'brand_invoice'
			? m.doc_note_invoice()
			: doc.kind === 'creator_statement'
				? m.doc_note_statement()
				: m.doc_note_withholding()}
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
