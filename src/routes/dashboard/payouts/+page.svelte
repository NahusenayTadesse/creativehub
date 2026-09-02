<script lang="ts">
	import { untrack } from 'svelte';
	import { superForm } from 'sveltekit-superforms';
	import { toast } from 'svelte-sonner';
	import PageHeader from '$lib/components/page-header.svelte';
	import InputComp from '$lib/formComponents/InputComp.svelte';
	import Errors from '$lib/formComponents/Errors.svelte';
	import LoadingBtn from '$lib/formComponents/LoadingBtn.svelte';
	import { Landmark, ShieldCheck, Clock, TriangleAlert, Wallet } from '@lucide/svelte';
	import { formatAmountWithCode } from '$lib/domain/money';
	import { payoutStatusLabel } from '$lib/domain/payout';
	import * as m from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';

	let { data } = $props();

	const { form, errors, enhance, delayed, allErrors, message } = superForm(
		untrack(() => data.form)
	);

	$effect(() => {
		if (!$message) return;
		if ($message.type === 'error') toast.error($message.text);
		else toast.success($message.text);
	});

	const bankItems = $derived(data.banks.map((bank) => ({ value: bank.id, name: bank.name })));

	/* Chapa publishes an account length per bank, so the hint under the number
	   field can be specific once a bank is chosen. The server checks it too. */
	const chosenBank = $derived(data.banks.find((bank) => bank.id === Number($form.bank)));

	const numberHint = $derived(
		chosenBank && chosenBank.accountLength > 0
			? m.payo_account_length_hint({
					bank: chosenBank.name,
					length: chosenBank.accountLength
				})
			: m.payo_account_number_hint()
	);

	const formatDate = (value: string | Date) =>
		new Date(value).toLocaleDateString(getLocale() === 'am' ? 'am-ET' : 'en-GB', {
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		});

	/* The last four digits are all a creator needs to recognise their own row. */
	const tail = (account: string) => (account.length > 4 ? `••••${account.slice(-4)}` : account);

	const statusTone: Record<string, string> = {
		pending: 'border-info-edge bg-info-soft text-info-fg',
		queued: 'border-warn-edge bg-warn-soft text-warn-fg',
		success: 'border-brand-edge bg-brand-soft text-brand-soft-fg',
		failed: 'border-danger-edge bg-danger-soft text-danger-fg',
		cancelled: 'border-edge bg-panel text-ink-soft'
	};
</script>

<svelte:head><title>{m.payo_title()}</title></svelte:head>

<div class="mx-auto max-w-3xl space-y-6">
	<PageHeader eyebrow={m.sb_payouts()} title={m.payo_title()} description={m.payo_subtitle()} />

	<!-- What is owed but not yet sent -->
	<div class="bento-card-mint flex flex-wrap items-center justify-between gap-3">
		<div>
			<span class="block text-[10px] font-black tracking-widest text-ink-soft uppercase">
				{m.payo_owed_heading()}
			</span>
			<p class="mt-1 flex items-center gap-2 text-lg font-black text-ink">
				<Wallet class="h-5 w-5" />
				{#if data.owed.count}
					{m.payo_owed_summary({
						amount: formatAmountWithCode(data.owed.total, data.owed.currencyCode),
						count: data.owed.count
					})}
				{:else}
					{formatAmountWithCode(0, data.owed.currencyCode)}
				{/if}
			</p>
		</div>
		{#if !data.owed.count}
			<p class="max-w-sm text-[11px] font-medium text-brand-soft-fg">{m.payo_owed_none()}</p>
		{/if}
	</div>

	<!-- The bank account -->
	<div class="bento-card bento-card-static space-y-4">
		<div class="flex flex-wrap items-center justify-between gap-2 border-b-2 border-edge pb-3">
			<h2 class="flex items-center gap-2 text-sm font-black text-ink">
				<Landmark class="h-4 w-4" />
				{m.payo_account_heading()}
			</h2>
			{#if data.account}
				<span
					class="inline-flex items-center gap-1 rounded-full border-2 px-2 py-0.5 text-[10px] font-black tracking-wide uppercase {data
						.account.isVerified
						? 'border-brand-edge bg-brand-soft text-brand-soft-fg'
						: 'border-warn-edge bg-warn-soft text-warn-fg'}"
				>
					{#if data.account.isVerified}
						<ShieldCheck class="h-3 w-3" />{m.payo_checked()}
					{:else}
						<Clock class="h-3 w-3" />{m.payo_awaiting_check()}
					{/if}
				</span>
			{/if}
		</div>

		<p class="text-xs font-medium text-ink-soft">{m.payo_account_hint()}</p>

		{#if !data.banks.length}
			<p
				class="flex items-start gap-2 rounded-2xl border-2 border-danger-edge bg-danger-soft p-3 text-xs font-bold text-danger-fg"
			>
				<TriangleAlert class="mt-0.5 h-4 w-4 shrink-0" />
				{m.payo_banks_unavailable()}
			</p>
		{:else}
			<form method="POST" action="?/saveAccount" use:enhance class="space-y-4">
				<Errors {allErrors} />

				<InputComp
					label={m.payo_bank()}
					name="bank"
					type="select"
					items={bankItems}
					{form}
					{errors}
					required
				/>

				<InputComp
					label={m.payo_account_name()}
					name="accountName"
					hint={m.payo_account_name_hint()}
					{form}
					{errors}
					required
				/>

				<InputComp
					label={m.payo_account_number()}
					name="accountNumber"
					hint={numberHint}
					{form}
					{errors}
					required
				/>

				{#if data.account?.isVerified}
					<p class="text-[11px] font-medium text-ink-soft">{m.payo_edit_clears_check()}</p>
				{:else if data.account}
					<p class="text-[11px] font-medium text-ink-soft">{m.payo_awaiting_check_hint()}</p>
				{/if}

				<button
					type="submit"
					disabled={$delayed}
					class="mt-1 w-full rounded-2xl border-2 border-edge bg-brand py-3 text-xs font-black text-brand-ink shadow-[3px_3px_0px_0px_rgb(var(--bento-shadow))] hover:bg-brand-strong disabled:opacity-60"
				>
					{#if $delayed}
						<LoadingBtn name={m.common_saving()} />
					{:else}
						{m.payo_save_account()}
					{/if}
				</button>
			</form>
		{/if}
	</div>

	<!-- What has been sent -->
	<div class="bento-card bento-card-static space-y-3">
		<h2 class="border-b-2 border-edge pb-3 text-sm font-black text-ink">
			{m.payo_history_heading()}
		</h2>

		{#if !data.history.length}
			<p class="py-6 text-center text-xs font-medium text-ink-soft">{m.payo_history_none()}</p>
		{:else}
			{#each data.history as payout (payout.id)}
				<div class="rounded-2xl border-2 border-edge-soft bg-panel p-3">
					<div class="flex flex-wrap items-center justify-between gap-2">
						<div>
							<p class="text-sm font-black text-ink">
								{formatAmountWithCode(payout.amount, payout.currencyCode)}
							</p>
							<p class="text-[11px] font-medium text-ink-soft">
								{payout.bookingTitle ?? payout.bookingReference}
							</p>
						</div>
						<span
							class="rounded-full border-2 px-2 py-0.5 text-[10px] font-black tracking-wide uppercase {statusTone[
								payout.status
							] ?? 'border-edge bg-panel text-ink-soft'}"
						>
							{payoutStatusLabel(payout.status)}
						</span>
					</div>

					<p class="mt-2 text-[11px] font-medium text-ink-soft">
						{m.payo_to_account({ bank: payout.bankName, account: tail(payout.accountNumber) })}
						·
						{m.payo_sent_on({ date: formatDate(payout.verifiedAt ?? payout.createdAt) })}
					</p>

					<!--
						A failure reason is shown to the creator only when we wrote it
						ourselves. Chapa's own text is about our API call as often as
						their bank, and none of it is something a creator can act on —
						the message they get instead says to check their details.
					-->
					{#if payout.status === 'failed'}
						<p class="mt-2 text-[11px] font-bold text-danger-fg">
							{m.notif_payout_failed_body({ reference: payout.reference })}
						</p>
					{/if}
				</div>
			{/each}
		{/if}
	</div>
</div>
