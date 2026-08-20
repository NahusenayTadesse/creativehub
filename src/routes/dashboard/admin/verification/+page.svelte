<script lang="ts">
	import { enhance } from '$app/forms';
	import { toast } from 'svelte-sonner';
	import PageHeader from '$lib/components/page-header.svelte';
	import PaginationBar from '$lib/components/pagination-bar.svelte';
	import SearchInput from '$lib/components/search-input.svelte';
	import VerificationBadge from '$lib/components/verification-badge.svelte';
	import { page } from '$app/state';
	import { withParams } from '$lib/query';
	import { ShieldCheck, ExternalLink, Inbox } from '@lucide/svelte';
	import { assetUrl } from '$lib/assets';
	import * as m from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';

	let { data } = $props();

	let notes = $state<Record<number, string>>({});

	/* The queue opens on the pending cases, so an absent parameter means
	   "pending" here rather than "everything". */
	const statusFilter = $derived(page.url.searchParams.get('status') ?? 'pending');
	const statusLink = (status: string) => withParams(page.url, { status });
	const countFor = (status: string) =>
		status === 'all'
			? Object.values(data.statusCounts).reduce((sum, n) => sum + n, 0)
			: (data.statusCounts[status] ?? 0);

	const handle = (text: string) => () => {
		return async ({ result, update }: any) => {
			if (result.type === 'failure') toast.error(result.data?.message ?? m.common_refused());
			else if (result.type === 'success') toast.success(text);
			await update();
		};
	};

	const formatDate = (value: string | Date) =>
		new Date(value).toLocaleDateString(getLocale() === 'am' ? 'am-ET' : 'en-GB', {
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		});

	const tabs = $derived([
		{ key: 'pending', label: m.av_tab_pending() },
		{ key: 'under_review', label: m.av_tab_under_review() },
		{ key: 'more_info', label: m.av_tab_more_info() },
		{ key: 'approved', label: m.av_tab_approved() },
		{ key: 'rejected', label: m.av_tab_rejected() },
		{ key: 'all', label: m.bl_tab_all() }
	]);

	const statusTone: Record<string, string> = {
		pending: 'border-amber-500 bg-amber-100 text-amber-900',
		under_review: 'border-indigo-500 bg-indigo-100 text-indigo-900',
		more_info: 'border-orange-500 bg-orange-100 text-orange-900',
		approved: 'border-emerald-600 bg-emerald-100 text-emerald-900',
		rejected: 'border-red-500 bg-red-100 text-red-900'
	};
</script>

<svelte:head><title>{m.av_meta_title()}</title></svelte:head>

<div class="space-y-6">
	<PageHeader
		eyebrow={m.dash_platform_operations()}
		title={m.av_title()}
		description={m.av_description()}
	/>

	<div class="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
		<div class="flex flex-wrap items-center gap-2">
			{#each tabs as tab (tab.key)}
				<a
					href={statusLink(tab.key)}
					data-sveltekit-noscroll
					class="cursor-pointer rounded-xl border-2 border-slate-900 px-3 py-1.5 text-xs font-black shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] transition-all {statusFilter ===
					tab.key
						? 'bg-slate-900 text-white'
						: 'bg-white text-slate-800 hover:bg-slate-100'}"
				>
					{m.bl_tab_count({ label: tab.label, count: countFor(tab.key) })}
				</a>
			{/each}
		</div>

		<SearchInput value={data.requests.state.search} class="sm:w-64" />
	</div>

	{#if data.requests.rows.length === 0}
		<div class="bento-card bento-card-static space-y-3 py-16 text-center">
			<Inbox class="mx-auto h-10 w-10 text-slate-400" />
			<h3 class="text-base font-black text-slate-900">{m.av_empty_title()}</h3>
			<p class="text-xs font-medium text-slate-600">{m.av_empty_body()}</p>
		</div>
	{:else}
		<div class="space-y-4">
			{#each data.requests.rows as request (request.id)}
				{@const open = ['pending', 'under_review', 'more_info'].includes(request.status)}
				<div class="bento-card bento-card-static space-y-4">
					<div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
						<div class="flex items-start gap-3">
							{#if request.creatorAvatar}
								<img
									src={request.creatorAvatar}
									alt=""
									class="h-11 w-11 shrink-0 rounded-2xl border-2 border-slate-900 object-cover"
								/>
							{/if}
							<div>
								<div class="mb-1 flex flex-wrap items-center gap-2">
									<span
										class="rounded-md border-2 px-2 py-0.5 text-[10px] font-black tracking-wider uppercase {statusTone[
											request.status
										]}"
									>
										{request.status.replace('_', ' ')}
									</span>
									<span
										class="rounded-md border border-slate-400 bg-slate-100 px-2 py-0.5 text-[10px] font-black tracking-wider text-slate-700 uppercase"
									>
										{request.subjectType}
									</span>
								</div>

								{#if request.creatorUsername}
									<a
										href="/creators/{request.creatorUsername}"
										target="_blank"
										class="text-sm font-black text-slate-900 hover:text-emerald-600"
									>
										{request.creatorName}
									</a>
									<p class="text-[11px] font-bold text-slate-500">@{request.creatorUsername}</p>
								{:else}
									<span class="text-sm font-black text-slate-900">{request.organizationName}</span>
								{/if}
							</div>
						</div>

						<div class="shrink-0 text-right">
							<span class="block text-[9px] font-black tracking-wider text-slate-500 uppercase">
								{m.av_requested_badge()}
							</span>
							<div class="mt-1 flex justify-end">
								<VerificationBadge level={request.requestedLevel} />
							</div>
							<span class="mt-1 block text-[10px] font-bold text-slate-400">
								{formatDate(request.createdAt)}
							</span>
						</div>
					</div>

					<!-- Evidence -->
					<div class="space-y-2 rounded-2xl border-2 border-slate-200 bg-slate-50 p-3">
						<span class="block text-[9px] font-black tracking-wider text-slate-500 uppercase">
							{m.av_evidence()}
						</span>
						{#if request.documentUrl}
							<a
								href={assetUrl(request.documentUrl)}
								target="_blank"
								rel="noreferrer"
								class="inline-flex items-center gap-1 text-xs font-black text-emerald-700 hover:underline"
							>
								<ExternalLink class="h-3.5 w-3.5" />
								{m.av_open_document()}
							</a>
						{:else}
							<p class="text-xs font-medium text-slate-500">{m.av_no_document()}</p>
						{/if}

						{#if request.socialProofs?.length}
							<ul class="space-y-0.5">
								{#each request.socialProofs as proof (proof)}
									<li>
										<a
											href={proof}
											target="_blank"
											rel="noreferrer"
											class="text-[11px] font-bold text-slate-600 hover:text-emerald-700 hover:underline"
										>
											{proof}
										</a>
									</li>
								{/each}
							</ul>
						{/if}
					</div>

					{#if request.adminNotes}
						<p class="rounded-xl bg-slate-100 p-2 text-[11px] font-medium text-slate-700">
							<strong class="font-black">{m.av_note()}</strong>
							{request.adminNotes}
						</p>
					{/if}

					{#if open}
						<div class="space-y-2 border-t-2 border-slate-200 pt-3">
							<label for="note-{request.id}" class="text-xs font-black text-slate-900">
								{m.av_decision_note()}
							</label>
							<textarea
								id="note-{request.id}"
								rows="2"
								bind:value={notes[request.id]}
								placeholder={m.av_decision_placeholder()}
								class="w-full rounded-xl border-2 border-slate-900 bg-white px-3 py-2 text-xs font-medium"
							></textarea>

							<div class="flex flex-wrap justify-end gap-2">
								<form method="POST" action="?/decide" use:enhance={handle(m.av_more_info_toast())}>
									<input type="hidden" name="id" value={request.id} />
									<input type="hidden" name="status" value="more_info" />
									<input type="hidden" name="adminNotes" value={notes[request.id] ?? ''} />
									<button
										type="submit"
										class="rounded-xl border-2 border-slate-900 bg-white px-3 py-1.5 text-xs font-black text-slate-900 hover:bg-orange-50"
									>
										{m.av_need_more_info()}
									</button>
								</form>

								<form method="POST" action="?/decide" use:enhance={handle(m.av_rejected_toast())}>
									<input type="hidden" name="id" value={request.id} />
									<input type="hidden" name="status" value="rejected" />
									<input type="hidden" name="adminNotes" value={notes[request.id] ?? ''} />
									<button
										type="submit"
										class="rounded-xl border-2 border-slate-900 bg-white px-3 py-1.5 text-xs font-black text-red-700 hover:bg-red-50"
									>
										{m.av_reject()}
									</button>
								</form>

								<form method="POST" action="?/decide" use:enhance={handle(m.av_granted_toast())}>
									<input type="hidden" name="id" value={request.id} />
									<input type="hidden" name="status" value="approved" />
									<input type="hidden" name="adminNotes" value={notes[request.id] ?? ''} />
									<button
										type="submit"
										class="flex items-center gap-1.5 rounded-xl border-2 border-slate-900 bg-emerald-600 px-3 py-1.5 text-xs font-black text-white shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] hover:bg-emerald-700"
									>
										<ShieldCheck class="h-3.5 w-3.5" />
										{m.av_approve()}
									</button>
								</form>
							</div>
						</div>
					{/if}
				</div>
			{/each}
		</div>

		<PaginationBar result={data.requests} />
	{/if}
</div>
