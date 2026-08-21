<script lang="ts">
	import { untrack } from 'svelte';
	import { superForm } from 'sveltekit-superforms';
	import { toast } from 'svelte-sonner';
	import PageHeader from '$lib/components/page-header.svelte';
	import VerificationBadge from '$lib/components/verification-badge.svelte';
	import InputComp from '$lib/formComponents/InputComp.svelte';
	import Errors from '$lib/formComponents/Errors.svelte';
	import LoadingBtn from '$lib/formComponents/LoadingBtn.svelte';
	import { ShieldCheck, Clock } from '@lucide/svelte';
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

	const hasOpenCase = $derived(
		data.requests.some((r) => ['pending', 'under_review', 'more_info'].includes(r.status))
	);

	const levelItems = $derived([
		{ value: 'social_verified', name: m.vf_level_social() },
		{ value: 'identity_verified', name: m.vf_level_identity() },
		{ value: 'cn_verified', name: m.vf_level_cn() }
	]);

	const formatDate = (value: string | Date) =>
		new Date(value).toLocaleDateString(getLocale() === 'am' ? 'am-ET' : 'en-GB', {
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		});

	const statusTone: Record<string, string> = {
		pending: 'border-amber-500 bg-amber-100 text-amber-900',
		under_review: 'border-indigo-500 bg-indigo-100 text-indigo-900',
		more_info: 'border-orange-500 bg-orange-100 text-orange-900',
		approved: 'border-emerald-600 bg-emerald-100 text-emerald-900',
		rejected: 'border-red-500 bg-red-100 text-red-900'
	};
</script>

<svelte:head><title>{m.vf_meta_title()}</title></svelte:head>

<div class="mx-auto max-w-3xl space-y-6">
	<PageHeader eyebrow={m.rv_eyebrow()} title={m.vf_title()} description={m.vf_description()} />

	{#if data.subject}
		<div class="bento-card-mint flex flex-wrap items-center justify-between gap-3">
			<div>
				<span class="block text-[10px] font-black tracking-widest text-slate-600 uppercase">
					{m.vf_current_badge()}
				</span>
				<div class="mt-1">
					<VerificationBadge level={data.subject.level} />
				</div>
			</div>
			<p class="max-w-sm text-[11px] font-medium text-emerald-900">
				{m.vf_badge_note()}
			</p>
		</div>

		<!-- History -->
		{#if data.requests.length}
			<div class="bento-card bento-card-static space-y-3">
				<h2 class="border-b-2 border-slate-900 pb-3 text-sm font-black text-slate-900">
					{m.vf_your_cases()}
				</h2>
				{#each data.requests as request (request.id)}
					<div class="rounded-2xl border-2 border-slate-200 bg-slate-50 p-3">
						<div class="flex flex-wrap items-center justify-between gap-2">
							<div class="flex items-center gap-2">
								<span
									class="rounded-md border-2 px-2 py-0.5 text-[10px] font-black tracking-wider uppercase {statusTone[
										request.status
									] ?? 'border-slate-400 bg-slate-100 text-slate-700'}"
								>
									{request.status.replace('_', ' ')}
								</span>
								<span class="text-xs font-black text-slate-900">
									{request.requestedLevel.replace(/_/g, ' ')}
								</span>
							</div>
							<span class="flex items-center gap-1 text-[10px] font-bold text-slate-400">
								<Clock class="h-3 w-3" />
								{formatDate(request.createdAt)}
							</span>
						</div>

						{#if request.adminNotes}
							<p class="mt-2 rounded-lg bg-white p-2 text-[11px] font-medium text-slate-700">
								<strong class="font-black">{m.vf_operator_note()}</strong>
								{request.adminNotes}
							</p>
						{/if}
					</div>
				{/each}
			</div>
		{/if}

		<!-- Submit -->
		<div class="bento-card bento-card-static">
			{#if hasOpenCase}
				<div class="space-y-2 py-8 text-center">
					<Clock class="mx-auto h-8 w-8 text-amber-500" />
					<h3 class="text-sm font-black text-slate-900">{m.vf_case_open_title()}</h3>
					<p class="mx-auto max-w-sm text-xs font-medium text-slate-600">
						{m.vf_case_open_body()}
					</p>
				</div>
			{:else}
				<form method="POST" use:enhance enctype="multipart/form-data" class="space-y-2">
					<h2 class="mb-2 flex items-center gap-1.5 text-sm font-black text-slate-900">
						<ShieldCheck class="h-4 w-4 text-emerald-600" />
						{m.vf_request()}
					</h2>

					<Errors allErrors={$allErrors} />

					<InputComp
						{form}
						{errors}
						label={m.vf_what_verify()}
						name="requestedLevel"
						type="select"
						items={levelItems}
						required
					/>

					<InputComp
						{form}
						{errors}
						label={m.vf_evidence_doc()}
						name="documentUrl"
						type="file"
						placeholder={m.vf_evidence_placeholder()}
					/>

					<InputComp
						{form}
						{errors}
						label={m.vf_channel_links()}
						name="socialProofs"
						type="textarea"
						rows={4}
						placeholder="https://www.tiktok.com/@yourhandle&#10;https://instagram.com/yourhandle"
					/>

					<p class="text-[11px] font-medium text-slate-500">
						{m.vf_privacy_note()}
					</p>

					<button
						type="submit"
						disabled={$delayed}
						class="mt-3 w-full rounded-2xl border-2 border-slate-900 bg-emerald-600 py-3 text-xs font-black text-white shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] hover:bg-emerald-700 disabled:opacity-60"
					>
						{#if $delayed}
							<LoadingBtn name={m.bk_submitting()} />
						{:else}
							{m.bk_submit_for_review()}
						{/if}
					</button>
				</form>
			{/if}
		</div>
	{:else}
		<div class="bento-card bento-card-static space-y-3 py-12 text-center">
			<h3 class="text-base font-black text-slate-900">{m.vf_nothing_title()}</h3>
			<p class="mx-auto max-w-sm text-xs font-medium text-slate-600">
				{m.vf_nothing_body()}
			</p>
		</div>
	{/if}
</div>
