<script lang="ts">
	import AppImage from '$lib/components/app-image.svelte';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';
	import { toast } from 'svelte-sonner';
	import PageHeader from '$lib/components/page-header.svelte';
	import PaginationBar from '$lib/components/pagination-bar.svelte';
	import InputComp from '$lib/formComponents/InputComp.svelte';
	import SearchInput from '$lib/components/search-input.svelte';
	import { page } from '$app/state';
	import { withParams } from '$lib/query';
	import { formatReach } from '$lib/domain/money';
	import { Check, ExternalLink, Inbox, Link2, X } from '@lucide/svelte';
	import * as m from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';

	let { data } = $props();

	let notes = $state<Record<number, string>>({});

	/* The queue opens on what is waiting, so an absent parameter means pending. */
	const statusFilter = $derived(page.url.searchParams.get('status') ?? 'pending');
	const statusLink = (status: string) => withParams(page.url, { status });
	const countFor = (status: string) =>
		status === 'all'
			? Object.values(data.statusCounts).reduce((sum, n) => sum + n, 0)
			: (data.statusCounts[status] ?? 0);

	const handle =
		(text: string): SubmitFunction =>
		() => {
			return async ({ result, update }) => {
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
		{ key: 'pending', label: m.acl_tab_pending() },
		{ key: 'approved', label: m.acl_tab_approved() },
		{ key: 'rejected', label: m.acl_tab_rejected() },
		{ key: 'withdrawn', label: m.acl_tab_withdrawn() },
		{ key: 'all', label: m.bl_tab_all() }
	]);

	const statusTone: Record<string, string> = {
		pending: 'border-amber-500 bg-amber-100 text-amber-900',
		approved: 'border-emerald-600 bg-emerald-100 text-emerald-900',
		rejected: 'border-red-500 bg-red-100 text-red-900',
		withdrawn: 'border-slate-400 bg-slate-100 text-slate-700'
	};
</script>

<svelte:head><title>{m.acl_meta_title()}</title></svelte:head>

<div class="space-y-6">
	<PageHeader
		eyebrow={m.dash_platform_operations()}
		title={m.acl_title()}
		description={m.acl_description()}
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

		<SearchInput value={data.claims.state.search} class="sm:w-64" />
	</div>

	{#if data.claims.rows.length === 0}
		<div class="bento-card bento-card-static space-y-3 py-16 text-center">
			<Inbox class="mx-auto h-10 w-10 text-slate-400" />
			<h3 class="text-base font-black text-slate-900">{m.acl_empty_title()}</h3>
			<p class="text-xs font-medium text-slate-600">{m.acl_empty_body()}</p>
		</div>
	{:else}
		<div class="space-y-4">
			{#each data.claims.rows as row (row.id)}
				{@const open = row.status === 'pending'}
				<div class="bento-card bento-card-static space-y-4">
					<div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
						<div class="flex items-start gap-3">
							<AppImage
								src={row.creatorAvatar}
								alt=""
								kind="avatar"
								seed={row.creatorUsername}
								label={row.creatorName}
								class="h-11 w-11 shrink-0 rounded-2xl border-2 border-slate-900 object-cover"
								loading="lazy"
								decoding="async"
								width="44"
								height="44"
							/>
							<div>
								<div class="mb-1 flex flex-wrap items-center gap-2">
									<span
										class="rounded-md border-2 px-2 py-0.5 text-[10px] font-black tracking-wider uppercase {statusTone[
											row.status
										]}"
									>
										{row.status}
									</span>
									{#if row.creatorIsClaimed}
										<!-- The profile went to somebody else while this one waited.
										     Approving it now is not a decision that exists. -->
										<span
											class="rounded-md border border-red-400 bg-red-50 px-2 py-0.5 text-[10px] font-black tracking-wider text-red-800 uppercase"
										>
											{m.acl_taken()}
										</span>
									{/if}
								</div>

								<p class="text-[11px] font-bold text-slate-600">
									{m.acl_asking_for({ claimant: `${row.claimantName} · ${row.claimantEmail}` })}
								</p>
								<a
									href={resolve(`/creators/${row.creatorUsername}`)}
									target="_blank"
									class="text-sm font-black text-slate-900 hover:text-emerald-600"
								>
									{row.creatorName}
								</a>
								<p class="text-[11px] font-bold text-slate-500">
									@{row.creatorUsername}
									{#if row.countryName}
										· {row.countryFlag ?? '🌍'}
										{row.countryName}
									{/if}
									{#if row.platformName}
										· {row.platformName}
									{/if}
									· {m.ap_reach_suffix({ reach: formatReach(row.creatorReach) })}
								</p>
							</div>
						</div>

						<div class="shrink-0 text-right">
							<span class="block text-[9px] font-black tracking-wider text-slate-500 uppercase">
								{m.acl_waiting_since()}
							</span>
							<span class="mt-1 block text-xs font-black text-slate-900">
								{formatDate(row.createdAt)}
							</span>
						</div>
					</div>

					<!-- What the claimant offered. Read by an operator, trusted by nothing. -->
					<div class="space-y-2 rounded-2xl border-2 border-slate-200 bg-slate-50 p-3">
						<span class="block text-[9px] font-black tracking-wider text-slate-500 uppercase">
							{m.acl_evidence()}
						</span>
						<p class="text-xs font-medium whitespace-pre-line text-slate-800">{row.evidence}</p>
						{#if row.proofUrl}
							<a
								href={row.proofUrl}
								target="_blank"
								rel="noopener noreferrer nofollow"
								class="inline-flex items-center gap-1 text-[11px] font-black text-emerald-700 hover:underline"
							>
								<Link2 class="h-3.5 w-3.5" />
								{m.acl_proof()}
								<ExternalLink class="h-3 w-3" />
							</a>
						{/if}
					</div>

					{#if row.adminNotes}
						<p class="rounded-xl bg-slate-100 p-2 text-[11px] font-medium text-slate-700">
							<strong class="font-black">{m.av_note()}</strong>
							{row.adminNotes}
						</p>
					{/if}

					{#if open}
						<div class="space-y-2 border-t-2 border-slate-200 pt-3">
							{#if row.creatorIsClaimed}
								<p
									class="rounded-xl border-2 border-red-300 bg-red-50 p-2 text-[11px] font-medium text-slate-800"
								>
									{m.acl_taken_help()}
								</p>
							{/if}

							<!-- One note carried into whichever outcome is picked, as a hidden
							     field, so switching between them keeps what was typed. -->
							<InputComp
								name="note-{row.id}"
								type="textarea"
								rows={2}
								label={m.acl_decision_note()}
								placeholder={m.acl_decision_placeholder()}
								bind:value={notes[row.id]}
							/>

							<div class="flex flex-wrap justify-end gap-2">
								<form method="POST" action="?/decide" use:enhance={handle(m.acl_rejected_toast())}>
									<input type="hidden" name="id" value={row.id} />
									<input type="hidden" name="status" value="rejected" />
									<input type="hidden" name="adminNotes" value={notes[row.id] ?? ''} />
									<button
										type="submit"
										class="flex items-center gap-1.5 rounded-xl border-2 border-slate-900 bg-white px-3 py-1.5 text-xs font-black text-red-700 hover:bg-red-50"
									>
										<X class="h-3.5 w-3.5" />
										{m.acl_reject()}
									</button>
								</form>

								{#if !row.creatorIsClaimed}
									<form
										method="POST"
										action="?/decide"
										use:enhance={handle(m.acl_approved_toast())}
									>
										<input type="hidden" name="id" value={row.id} />
										<input type="hidden" name="status" value="approved" />
										<input type="hidden" name="adminNotes" value={notes[row.id] ?? ''} />
										<button
											type="submit"
											class="flex items-center gap-1.5 rounded-xl border-2 border-slate-900 bg-emerald-600 px-3 py-1.5 text-xs font-black text-white shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] hover:bg-emerald-700"
										>
											<Check class="h-3.5 w-3.5" />
											{m.acl_approve()}
										</button>
									</form>
								{/if}
							</div>
						</div>
					{/if}
				</div>
			{/each}
		</div>

		<PaginationBar result={data.claims} />
	{/if}
</div>
