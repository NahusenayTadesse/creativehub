<script lang="ts">
	import { superForm } from 'sveltekit-superforms';
	import { toast } from 'svelte-sonner';
	import PageHeader from '$lib/components/page-header.svelte';
	import VerificationBadge from '$lib/components/verification-badge.svelte';
	import InputComp from '$lib/formComponents/InputComp.svelte';
	import Errors from '$lib/formComponents/Errors.svelte';
	import LoadingBtn from '$lib/formComponents/LoadingBtn.svelte';
	import { ShieldCheck, Clock } from '@lucide/svelte';

	let { data } = $props();

	const { form, errors, enhance, delayed, allErrors, message } = superForm(data.form);

	$effect(() => {
		if (!$message) return;
		if ($message.type === 'error') toast.error($message.text);
		else toast.success($message.text);
	});

	const hasOpenCase = $derived(
		data.requests.some((r) => ['pending', 'under_review', 'more_info'].includes(r.status))
	);

	const levelItems = [
		{ value: 'social_verified', name: 'Social — I own these channels' },
		{ value: 'identity_verified', name: 'Identity — government ID' },
		{ value: 'cn_verified', name: 'CN Verified — identity and channels' }
	];

	const formatDate = (value: string | Date) =>
		new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

	const statusTone: Record<string, string> = {
		pending: 'border-amber-500 bg-amber-100 text-amber-900',
		under_review: 'border-indigo-500 bg-indigo-100 text-indigo-900',
		more_info: 'border-orange-500 bg-orange-100 text-orange-900',
		approved: 'border-emerald-600 bg-emerald-100 text-emerald-900',
		rejected: 'border-red-500 bg-red-100 text-red-900'
	};
</script>

<svelte:head><title>Verification — Creator Network</title></svelte:head>

<div class="mx-auto max-w-3xl space-y-6">
	<PageHeader
		eyebrow="Trust"
		title="Verification"
		description="Badges name the evidence that was actually checked — there is no generic “verified” tick, because it would not tell a brand anything."
	/>

	{#if data.subject}
		<div class="bento-card-mint flex flex-wrap items-center justify-between gap-3">
			<div>
				<span class="block text-[10px] font-black tracking-widest text-slate-600 uppercase">
					Current badge
				</span>
				<div class="mt-1">
					<VerificationBadge level={data.subject.level} />
				</div>
			</div>
			<p class="max-w-sm text-[11px] font-medium text-emerald-900">
				Your badge appears on your public profile and in discovery filters. An operator reviews
				every case by hand.
			</p>
		</div>

		<!-- History -->
		{#if data.requests.length}
			<div class="bento-card bento-card-static space-y-3">
				<h2 class="border-b-2 border-slate-900 pb-3 text-sm font-black text-slate-900">
					Your cases
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
								<strong class="font-black">Operator note:</strong>
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
					<h3 class="text-sm font-black text-slate-900">A case is already open</h3>
					<p class="mx-auto max-w-sm text-xs font-medium text-slate-600">
						An operator is reviewing your evidence. You will see the outcome here, with a note
						explaining the decision either way.
					</p>
				</div>
			{:else}
				<form method="POST" use:enhance enctype="multipart/form-data" class="space-y-2">
					<h2 class="mb-2 flex items-center gap-1.5 text-sm font-black text-slate-900">
						<ShieldCheck class="h-4 w-4 text-emerald-600" />
						Request verification
					</h2>

					<Errors allErrors={$allErrors} />

					<InputComp
						{form}
						{errors}
						label="What should we verify?"
						name="requestedLevel"
						type="select"
						items={levelItems}
						required
					/>

					<InputComp
						{form}
						{errors}
						label="Evidence document"
						name="documentUrl"
						type="file"
						placeholder="Government ID or registration certificate (PDF or image)"
					/>

					<InputComp
						{form}
						{errors}
						label="Channel links (one per line)"
						name="socialProofs"
						type="textarea"
						rows={4}
						placeholder="https://www.tiktok.com/@yourhandle&#10;https://instagram.com/yourhandle"
					/>

					<p class="text-[11px] font-medium text-slate-500">
						Identity documents are visible only to operators reviewing your case, and are never
						shown on your public profile.
					</p>

					<button
						type="submit"
						disabled={$delayed}
						class="mt-3 w-full rounded-2xl border-2 border-slate-900 bg-emerald-600 py-3 text-xs font-black text-white shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] hover:bg-emerald-700 disabled:opacity-60"
					>
						{#if $delayed}
							<LoadingBtn name="Submitting" />
						{:else}
							Submit for review
						{/if}
					</button>
				</form>
			{/if}
		</div>
	{:else}
		<div class="bento-card bento-card-static space-y-3 py-12 text-center">
			<h3 class="text-base font-black text-slate-900">Nothing to verify yet</h3>
			<p class="mx-auto max-w-sm text-xs font-medium text-slate-600">
				Create your creator profile or register an organisation first.
			</p>
		</div>
	{/if}
</div>
