<script lang="ts">
	import { enhance } from '$app/forms';
	import { toast } from 'svelte-sonner';
	import PageHeader from '$lib/components/page-header.svelte';
	import BookingStatusBadge from '$lib/components/booking-status-badge.svelte';
	import CompensationBadge from '$lib/components/compensation-badge.svelte';
	import { Inbox, Award, Users, ExternalLink } from '@lucide/svelte';
	import { formatReach } from '$lib/domain/money';

	let { data } = $props();

	const isCreatorView = $derived(data.role === 'creator');

	let statusFilter = $state('all');

	const filtered = $derived(
		statusFilter === 'all'
			? data.applications
			: data.applications.filter((a) => a.status === statusFilter)
	);

	const countFor = (status: string) =>
		status === 'all'
			? data.applications.length
			: data.applications.filter((a) => a.status === status).length;

	const tabs = [
		{ key: 'all', label: 'All' },
		{ key: 'applied', label: 'New' },
		{ key: 'shortlisted', label: 'Shortlisted' },
		{ key: 'selected', label: 'Selected' },
		{ key: 'rejected', label: 'Rejected' }
	];

	const handle = (message: string) => () => {
		return async ({ result, update }: any) => {
			if (result.type === 'failure') toast.error(result.data?.message ?? 'That was refused.');
			else if (result.type === 'success' || result.type === 'redirect') toast.success(message);
			await update();
		};
	};

	const formatDate = (value: string | Date) =>
		new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
</script>

<svelte:head><title>Applications — Creator Network</title></svelte:head>

<div class="space-y-6">
	<PageHeader
		eyebrow={isCreatorView ? 'Creator studio' : 'Campaign operations'}
		title={isCreatorView ? 'Your applications' : 'Applications received'}
		description={isCreatorView
			? 'Every brief you have pitched on, and where each one stands.'
			: 'Shortlist, reject, or select. Selecting opens a booking with the terms still to be agreed — it is not a contract on its own.'}
	/>

	<div class="flex flex-wrap items-center gap-2">
		{#each tabs as tab (tab.key)}
			<button
				type="button"
				onclick={() => (statusFilter = tab.key)}
				class="cursor-pointer rounded-xl border-2 border-slate-900 px-3 py-1.5 text-xs font-black shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] transition-all {statusFilter ===
				tab.key
					? 'bg-slate-900 text-white'
					: 'bg-white text-slate-800 hover:bg-slate-100'}"
			>
				{tab.label} ({countFor(tab.key)})
			</button>
		{/each}
	</div>

	{#if filtered.length === 0}
		<div class="bento-card bento-card-static space-y-3 py-16 text-center">
			<Inbox class="mx-auto h-10 w-10 text-slate-400" />
			<h3 class="text-base font-black text-slate-900">Nothing here</h3>
			<p class="mx-auto max-w-sm text-xs font-medium text-slate-600">
				{isCreatorView
					? 'Pitch on a live brief and it will appear here.'
					: 'Applications from creators appear here once your campaign is published.'}
			</p>
			<a
				href={isCreatorView ? '/campaigns' : '/dashboard/campaigns'}
				class="inline-block rounded-xl border-2 border-slate-900 bg-emerald-600 px-4 py-2 text-xs font-black text-white shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] hover:bg-emerald-700"
			>
				{isCreatorView ? 'Browse briefs' : 'Manage campaigns'}
			</a>
		</div>
	{:else}
		<div class="space-y-3">
			{#each filtered as application (application.id)}
				<div class="bento-card bento-card-static space-y-3">
					<div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
						<div class="flex min-w-0 items-start gap-3">
							{#if !isCreatorView}
								<img
									src={application.creatorAvatar ?? ''}
									alt=""
									class="h-11 w-11 shrink-0 rounded-2xl border-2 border-slate-900 object-cover"
								/>
							{/if}
							<div class="min-w-0">
								<div class="mb-1 flex flex-wrap items-center gap-2">
									<BookingStatusBadge status={application.status} kind="application" />
									<CompensationBadge type={application.compensationType} />
									<span class="text-[10px] font-bold text-slate-400">
										{formatDate(application.createdAt)}
									</span>
								</div>

								{#if isCreatorView}
									<a
										href="/campaigns/{application.campaignSlug}"
										class="text-sm font-black text-slate-900 hover:text-emerald-600"
									>
										{application.campaignTitle}
									</a>
									<p class="text-[11px] font-bold text-slate-500">
										{application.organizationName}
									</p>
								{:else}
									<a
										href="/creators/{application.creatorUsername}"
										class="text-sm font-black text-slate-900 hover:text-emerald-600"
									>
										{application.creatorName}
									</a>
									<p class="text-[11px] font-bold text-slate-500">
										for {application.campaignTitle}
									</p>
									<div class="mt-1 flex flex-wrap items-center gap-2 text-[10px] font-bold text-slate-600">
										<span class="flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5">
											<Award class="h-3 w-3 text-emerald-600" />
											Score {application.creatorScore}
										</span>
										<span class="flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5">
											<Users class="h-3 w-3 text-emerald-600" />
											{formatReach(application.creatorReach)} reach
										</span>
									</div>
								{/if}
							</div>
						</div>

						<div class="shrink-0 text-right">
							{#if application.compensationType === 'paid'}
								<span class="block text-[9px] font-black tracking-wider text-slate-500 uppercase">
									Proposed rate
								</span>
								<span class="text-sm font-black text-slate-900">
									{application.proposedPrice.toLocaleString()}
									<span class="text-emerald-600">{application.currencyCode}</span>
								</span>
							{:else}
								<span class="text-xs font-black text-slate-600">Non-cash compensation</span>
							{/if}
						</div>
					</div>

					<p
						class="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed font-medium text-slate-700"
					>
						"{application.pitch}"
					</p>

					{#if application.decisionNote}
						<p class="text-[11px] font-medium text-slate-500 italic">
							Note: {application.decisionNote}
						</p>
					{/if}

					<!-- Actions -->
					<div class="flex flex-wrap items-center justify-end gap-2 border-t-2 border-slate-200 pt-3">
						{#if isCreatorView}
							{#if ['applied', 'shortlisted'].includes(application.status)}
								<form method="POST" action="?/withdraw" use:enhance={handle('Application withdrawn')}>
									<input type="hidden" name="id" value={application.id} />
									<button
										type="submit"
										class="rounded-xl border-2 border-slate-900 bg-white px-3 py-1.5 text-xs font-black text-slate-900 hover:bg-slate-50"
									>
										Withdraw
									</button>
								</form>
							{/if}
							<a
								href="/campaigns/{application.campaignSlug}"
								class="inline-flex items-center gap-1 rounded-xl border-2 border-slate-900 bg-white px-3 py-1.5 text-xs font-black text-slate-900 hover:bg-slate-50"
							>
								<ExternalLink class="h-3 w-3" />
								View brief
							</a>
						{:else if application.status !== 'selected' && application.status !== 'withdrawn'}
							<form method="POST" action="?/decide" use:enhance={handle('Applicant rejected')}>
								<input type="hidden" name="id" value={application.id} />
								<input type="hidden" name="status" value="rejected" />
								<button
									type="submit"
									class="rounded-xl border-2 border-slate-900 bg-white px-3 py-1.5 text-xs font-black text-slate-900 hover:bg-red-50"
								>
									Reject
								</button>
							</form>

							{#if application.status !== 'shortlisted'}
								<form method="POST" action="?/decide" use:enhance={handle('Added to shortlist')}>
									<input type="hidden" name="id" value={application.id} />
									<input type="hidden" name="status" value="shortlisted" />
									<button
										type="submit"
										class="rounded-xl border-2 border-slate-900 bg-[#e0e7ff] px-3 py-1.5 text-xs font-black text-indigo-950 hover:bg-indigo-200"
									>
										Shortlist
									</button>
								</form>
							{/if}

							<form method="POST" action="?/decide" use:enhance={handle('Selected — booking opened')}>
								<input type="hidden" name="id" value={application.id} />
								<input type="hidden" name="status" value="selected" />
								<button
									type="submit"
									class="rounded-xl border-2 border-slate-900 bg-emerald-600 px-3 py-1.5 text-xs font-black text-white shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] hover:bg-emerald-700"
								>
									Select & open booking
								</button>
							</form>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
