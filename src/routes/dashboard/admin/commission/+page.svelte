<script lang="ts">
	import { untrack } from 'svelte';
	import { superForm } from 'sveltekit-superforms';
	import { toast } from 'svelte-sonner';
	import { Calculator, Plus, Trash2 } from '@lucide/svelte';
	import PageHeader from '$lib/components/page-header.svelte';
	import InputComp from '$lib/formComponents/InputComp.svelte';
	import Errors from '$lib/formComponents/Errors.svelte';
	import LoadingBtn from '$lib/formComponents/LoadingBtn.svelte';
	import { normaliseTiers, quoteDeal } from '$lib/domain/commission';
	import { formatAmountWithCode } from '$lib/domain/money';
	import * as m from '$lib/paraglide/messages';

	let { data } = $props();

	const { form, errors, enhance, delayed, allErrors, message } = superForm(
		untrack(() => data.form),
		{ dataType: 'json' }
	);

	$effect(() => {
		if (!$message) return;
		if ($message.type === 'error') toast.error($message.text);
		else toast.success($message.text);
	});

	/* The card as it stands in the form, read the way the server will read it. */
	const tiers = $derived(
		normaliseTiers(
			$form.tierPercent.map((percent: number, index: number) => {
				const ceiling = Number(String($form.tierUpTo[index] ?? '').replace(/[,\s]/g, ''));
				return {
					upTo: Number.isFinite(ceiling) && ceiling > 0 ? ceiling : null,
					percent: Number(percent)
				};
			})
		)
	);

	function addTier() {
		$form.tierUpTo = [...$form.tierUpTo, ''];
		$form.tierPercent = [...$form.tierPercent, 10];
	}

	function removeTier(index: number) {
		$form.tierUpTo = $form.tierUpTo.filter((_: string, i: number) => i !== index);
		$form.tierPercent = $form.tierPercent.filter((_: number, i: number) => i !== index);
	}

	/* ---------------- The calculator ---------------- */

	let sample = $state(200_000);
	const quote = $derived(
		quoteDeal(Number(sample) || 0, {
			tiers,
			minCommission: Number($form.minCommission) || 0,
			minProjectSize: Number($form.minProjectSize) || 0,
			brandServiceFeePercent: Number($form.brandServiceFeePercent) || 0,
			vatRegistered: Boolean($form.vatRegistered),
			vatPercent: Number($form.vatPercent) || 0
		})
	);
	const withheld = $derived(
		Math.round((quote.creatorPayout * (Number($form.withholdingPercent) || 0)) / 100)
	);
	const etb = (amount: number) => formatAmountWithCode(amount, 'ETB');
	const belowMinimum = $derived(
		Number(sample) > 0 && Number(sample) < Number($form.minProjectSize)
	);
</script>

<svelte:head><title>{m.cm_meta_title()}</title></svelte:head>

<div class="mx-auto max-w-3xl space-y-6">
	<PageHeader
		eyebrow={m.dash_platform_operations()}
		title={m.cm_title()}
		description={m.cm_description()}
	/>

	<form method="POST" action="?/save" use:enhance class="space-y-6">
		<Errors allErrors={$allErrors} />

		<!-- ---------------- The tiers ---------------- -->
		<div class="bento-card bento-card-static space-y-3">
			<div>
				<h2 class="text-sm font-black text-ink">{m.cm_tiers_heading()}</h2>
				<p class="mt-1 text-[11px] leading-relaxed font-medium text-ink-dim">{m.cm_tiers_note()}</p>
			</div>

			<div class="space-y-2">
				{#each $form.tierPercent as _, index (index)}
					<div class="grid grid-cols-[1fr_7rem_auto] items-end gap-2">
						<InputComp
							label={m.cm_tier_up_to()}
							name="tierUpTo-{index}"
							type="text"
							placeholder={m.cm_tier_no_ceiling()}
							bind:value={$form.tierUpTo[index]}
						/>
						<InputComp
							label={m.cm_tier_percent()}
							name="tierPercent-{index}"
							type="number"
							min={0}
							max={100}
							step="0.5"
							bind:value={$form.tierPercent[index]}
						/>
						<button
							type="button"
							onclick={() => removeTier(index)}
							disabled={$form.tierPercent.length <= 1}
							aria-label={m.cm_tier_remove()}
							class="mb-1 grid size-10 place-items-center rounded-xl border-2 border-edge bg-surface text-ink-soft hover:text-danger-fg disabled:opacity-30"
						>
							<Trash2 class="h-4 w-4" />
						</button>
					</div>
				{/each}
			</div>
			<button
				type="button"
				onclick={addTier}
				class="inline-flex items-center gap-1.5 text-xs font-black text-brand-soft-fg"
			>
				<Plus class="h-3.5 w-3.5" />
				{m.cm_tier_add()}
			</button>

			<!-- The card as it will be read. -->
			<ul class="space-y-1 rounded-xl bg-well p-3 text-[11px] font-bold text-ink-soft">
				{#each tiers as tier, index (index)}
					<li>
						{tier.upTo === null
							? m.cm_tier_above({ amount: etb(tiers[index - 1]?.upTo ?? 0) })
							: m.cm_tier_up_to_line({ amount: etb(tier.upTo) })}
						— {tier.percent}%
					</li>
				{/each}
			</ul>

			<div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
				<InputComp
					{form}
					{errors}
					label={m.cm_min_commission()}
					name="minCommission"
					type="number"
					min={0}
					hint={m.cm_min_commission_hint()}
				/>
				<InputComp
					{form}
					{errors}
					label={m.cm_min_project()}
					name="minProjectSize"
					type="number"
					min={0}
					hint={m.cm_min_project_hint()}
				/>
			</div>
		</div>

		<!-- ---------------- Fees and tax ---------------- -->
		<div class="bento-card bento-card-static space-y-3">
			<h2 class="text-sm font-black text-ink">{m.cm_fees_heading()}</h2>
			<div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
				<InputComp
					{form}
					{errors}
					label={m.cm_brand_fee()}
					name="brandServiceFeePercent"
					type="number"
					min={0}
					max={50}
					step="0.5"
					hint={m.cm_brand_fee_hint()}
				/>
				<InputComp
					{form}
					{errors}
					label={m.cm_withholding()}
					name="withholdingPercent"
					type="number"
					min={0}
					max={50}
					step="0.5"
					hint={m.cm_withholding_hint()}
				/>
				<InputComp
					{form}
					{errors}
					label={m.cm_vat_registered()}
					name="vatRegistered"
					type="checkboxSingle"
					placeholder={m.cm_vat_registered_hint()}
				/>
				<InputComp
					{form}
					{errors}
					label={m.cm_vat_percent()}
					name="vatPercent"
					type="number"
					min={0}
					max={50}
					step="0.5"
				/>
			</div>
		</div>

		<!-- ---------------- Who invoices ---------------- -->
		<div class="bento-card bento-card-static space-y-3">
			<div>
				<h2 class="text-sm font-black text-ink">{m.cm_issuer_heading()}</h2>
				<p class="mt-1 text-[11px] leading-relaxed font-medium text-ink-dim">
					{m.cm_issuer_note()}
				</p>
			</div>
			<div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
				<InputComp {form} {errors} label={m.cm_legal_name()} name="invoiceLegalName" type="text" />
				<InputComp {form} {errors} label={m.cm_tin()} name="invoiceTin" type="text" />
				<InputComp {form} {errors} label={m.cm_vat_number()} name="invoiceVatNumber" type="text" />
			</div>
			<InputComp
				{form}
				{errors}
				label={m.cm_address()}
				name="invoiceAddress"
				type="textarea"
				rows={2}
			/>
		</div>

		<button
			type="submit"
			disabled={$delayed}
			class="w-full rounded-2xl border-2 border-edge bg-brand py-3 text-xs font-black text-brand-ink shadow-[3px_3px_0px_0px_rgb(var(--bento-shadow))] hover:bg-brand-strong disabled:opacity-60"
		>
			{#if $delayed}
				<LoadingBtn name={m.common_saving()} />
			{:else}
				{m.cm_save()}
			{/if}
		</button>
	</form>

	<!-- ---------------- The calculator: the unsaved card, applied to one deal ---------------- -->
	<div class="bento-card bento-card-static space-y-4">
		<h2 class="flex items-center gap-1.5 text-sm font-black text-ink">
			<Calculator class="h-4 w-4 text-brand-fg" />
			{m.cm_calculator()}
		</h2>
		<InputComp
			label={m.cm_calc_price()}
			name="sample"
			type="number"
			min={0}
			bind:value={sample}
			hint={m.cm_calc_hint()}
		/>
		{#if belowMinimum}
			<p class="text-[11px] font-bold text-warn-fg">{m.cm_calc_below_min()}</p>
		{/if}
		<div class="grid gap-4 text-xs sm:grid-cols-2">
			<dl class="space-y-1.5">
				<dt class="font-black tracking-wider text-ink-dim uppercase">{m.cm_calc_brand()}</dt>
				<div class="flex justify-between">
					<span>{m.md_campaign_fee()}</span><span class="tabular-nums">{etb(quote.price)}</span>
				</div>
				<div class="flex justify-between">
					<span>{m.md_service_fee()}</span><span class="tabular-nums"
						>{etb(quote.brandServiceFee)}</span
					>
				</div>
				<div class="flex justify-between">
					<span>{m.md_service_fee_vat()}</span><span class="tabular-nums"
						>{etb(quote.brandServiceFeeVat)}</span
					>
				</div>
				<div class="flex justify-between border-t-2 border-edge-soft pt-1 font-black">
					<span>{m.md_brand_total()}</span><span class="tabular-nums">{etb(quote.brandTotal)}</span>
				</div>
			</dl>
			<dl class="space-y-1.5">
				<dt class="font-black tracking-wider text-ink-dim uppercase">{m.cm_calc_creator()}</dt>
				<div class="flex justify-between">
					<span
						>{m.md_commission({ percent: String(quote.commissionPercent) })}{quote.minimumApplied
							? ` · ${m.cm_calc_minimum()}`
							: ''}</span
					>
					<span class="tabular-nums">− {etb(quote.commission)}</span>
				</div>
				<div class="flex justify-between">
					<span>{m.md_withholding()}</span><span class="tabular-nums">− {etb(withheld)}</span>
				</div>
				<div class="flex justify-between border-t-2 border-edge-soft pt-1 font-black">
					<span>{m.md_creator_receives()}</span><span class="tabular-nums"
						>{etb(quote.creatorPayout - withheld)}</span
					>
				</div>
				<div class="flex justify-between pt-2 text-brand-soft-fg">
					<span class="font-black">{m.cm_calc_platform()}</span><span
						class="font-black tabular-nums">{etb(quote.platformRevenue)}</span
					>
				</div>
			</dl>
		</div>
	</div>
</div>
