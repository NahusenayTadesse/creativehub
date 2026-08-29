<script lang="ts">
	import AppImage from '$lib/components/app-image.svelte';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';
	import { toast } from 'svelte-sonner';
	import PageHeader from '$lib/components/page-header.svelte';
	import BookingStatusBadge from '$lib/components/booking-status-badge.svelte';
	import CompensationBadge from '$lib/components/compensation-badge.svelte';
	import { Inbox, Award, Users, ExternalLink } from '@lucide/svelte';
	import PaginationBar from '$lib/components/pagination-bar.svelte';
	import NoResults from '$lib/components/no-results.svelte';
	import SearchInput from '$lib/components/search-input.svelte';
	import { page } from '$app/state';
	import { withParams } from '$lib/query';
	import { formatReach } from '$lib/domain/money';
	import * as m from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';

	let { data } = $props();

	const isCreatorView = $derived(data.role === 'creator');

	/* Tab and search live in the URL. The tallies come from the database, so a
	   tab still knows its count when its rows are on another page. */
	const listState = $derived(data.applications.state);
	const activeTab = $derived(listState.values.status ?? 'all');
	const tabLink = (key: string) => withParams(page.url, { status: key === 'all' ? null : key });
	const countFor = (status: string) =>
		status === 'all'
			? Object.values(data.statusCounts).reduce((sum, n) => sum + n, 0)
			: (data.statusCounts[status] ?? 0);

	const tabs = $derived([
		{ key: 'all', label: m.bl_tab_all() },
		{ key: 'applied', label: m.ap_tab_new() },
		{ key: 'shortlisted', label: m.ap_tab_shortlisted() },
		{ key: 'selected', label: m.ap_tab_selected() },
		{ key: 'rejected', label: m.ap_tab_rejected() }
	]);

	const handle =
		(message: string): SubmitFunction =>
		() => {
			return async ({ result, update }) => {
				if (result.type === 'failure') toast.error(result.data?.message ?? m.ap_refused());
				else if (result.type === 'success' || result.type === 'redirect') toast.success(message);
				await update();
			};
		};

	const formatDate = (value: string | Date) =>
		new Date(value).toLocaleDateString(getLocale() === 'am' ? 'am-ET' : 'en-GB', {
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		});
</script>

<svelte:head><title>{m.ap_meta_title()}</title></svelte:head>

<div class="space-y-6">
	<PageHeader
		eyebrow={isCreatorView ? m.dashc_eyebrow() : m.ap_eyebrow_campaign_ops()}
		title={isCreatorView ? m.ap_title_creator() : m.ap_title_brand()}
		description={isCreatorView ? m.ap_description_creator() : m.ap_description_brand()}
	/>

	<div class="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
		<div class="flex flex-wrap items-center gap-2">
			{#each tabs as tab (tab.key)}
				<a
					href={tabLink(tab.key)}
					data-sveltekit-noscroll
					class="cursor-pointer rounded-xl border-2 border-edge px-3 py-1.5 text-xs font-black shadow-[2px_2px_0px_0px_rgb(var(--bento-shadow))] transition-all {activeTab ===
					tab.key
						? 'bg-inverse text-inverse-ink'
						: 'bg-surface text-ink hover:bg-well'}"
				>
					{m.bl_tab_count({ label: tab.label, count: countFor(tab.key) })}
				</a>
			{/each}
		</div>

		<SearchInput value={listState.search} placeholder={m.ap_search_placeholder()} class="sm:w-64" />
	</div>

	{#if data.applications.rows.length === 0 && listState.search}
		<NoResults search={listState.search} />
	{:else if data.applications.rows.length === 0}
		<div class="bento-card bento-card-static space-y-3 py-16 text-center">
			<Inbox class="mx-auto h-10 w-10 text-ink-faint" />
			<h3 class="text-base font-black text-ink">{m.ap_empty_title()}</h3>
			<p class="mx-auto max-w-sm text-xs font-medium text-ink-soft">
				{isCreatorView ? m.ap_empty_creator() : m.ap_empty_brand()}
			</p>
			<a
				href={isCreatorView ? resolve('/campaigns') : resolve('/dashboard/campaigns')}
				class="inline-block rounded-xl border-2 border-edge bg-brand px-4 py-2 text-xs font-black text-brand-ink shadow-[2px_2px_0px_0px_rgb(var(--bento-shadow))] hover:bg-brand-strong"
			>
				{isCreatorView ? m.bl_browse_briefs() : m.ap_manage_campaigns()}
			</a>
		</div>
	{:else}
		<div class="space-y-3">
			{#each data.applications.rows as application (application.id)}
				<div class="bento-card bento-card-static space-y-3">
					<div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
						<div class="flex min-w-0 items-start gap-3">
							{#if !isCreatorView}
								<AppImage
									src={application.creatorAvatar}
									alt=""
									kind="avatar"
									seed={application.creatorUsername ?? application.creatorName}
									label={application.creatorName}
									class="h-11 w-11 shrink-0 rounded-2xl border-2 border-edge object-cover"
									loading="lazy"
									decoding="async"
									width="44"
									height="44"
								/>
							{/if}
							<div class="min-w-0">
								<div class="mb-1 flex flex-wrap items-center gap-2">
									<BookingStatusBadge status={application.status} kind="application" />
									<CompensationBadge type={application.compensationType} />
									<span class="text-[10px] font-bold text-ink-faint">
										{formatDate(application.createdAt)}
									</span>
								</div>

								{#if isCreatorView}
									<a
										href={resolve(`/campaigns/${application.campaignSlug}`)}
										class="text-sm font-black text-ink hover:text-brand-fg"
									>
										{application.campaignTitle}
									</a>
									<p class="text-[11px] font-bold text-ink-dim">
										{application.organizationName}
									</p>
								{:else}
									<a
										href={resolve(`/creators/${application.creatorUsername}`)}
										class="text-sm font-black text-ink hover:text-brand-fg"
									>
										{application.creatorName}
									</a>
									<p class="text-[11px] font-bold text-ink-dim">
										{m.ap_for_campaign({ title: application.campaignTitle })}
									</p>
									<div
										class="mt-1 flex flex-wrap items-center gap-2 text-[10px] font-bold text-ink-soft"
									>
										<span class="flex items-center gap-1 rounded bg-well px-1.5 py-0.5">
											<Award class="h-3 w-3 text-brand-fg" />
											{m.card_score({ score: application.creatorScore })}
										</span>
										<span class="flex items-center gap-1 rounded bg-well px-1.5 py-0.5">
											<Users class="h-3 w-3 text-brand-fg" />
											{m.ap_reach_suffix({ reach: formatReach(application.creatorReach) })}
										</span>
									</div>
								{/if}
							</div>
						</div>

						<div class="shrink-0 text-right">
							{#if application.compensationType === 'paid'}
								<span class="block text-[9px] font-black tracking-wider text-ink-dim uppercase">
									{m.ap_proposed_rate()}
								</span>
								<span class="text-sm font-black text-ink">
									{application.proposedPrice.toLocaleString()}
									<span class="text-brand-fg">{application.currencyCode}</span>
								</span>
							{:else}
								<span class="text-xs font-black text-ink-soft">{m.ap_non_cash()}</span>
							{/if}
						</div>
					</div>

					<p
						class="rounded-xl border border-edge-soft bg-panel p-3 text-xs leading-relaxed font-medium text-ink-soft"
					>
						"{application.pitch}"
					</p>

					{#if application.decisionNote}
						<p class="text-[11px] font-medium text-ink-dim italic">
							{m.ap_note_prefix({ note: application.decisionNote })}
						</p>
					{/if}

					<!-- Actions -->
					<div
						class="flex flex-wrap items-center justify-end gap-2 border-t-2 border-edge-soft pt-3"
					>
						{#if isCreatorView}
							{#if ['applied', 'shortlisted'].includes(application.status)}
								<form
									method="POST"
									action="?/withdraw"
									use:enhance={handle(m.ap_withdrawn_toast())}
								>
									<input type="hidden" name="id" value={application.id} />
									<button
										type="submit"
										class="rounded-xl border-2 border-edge bg-surface px-3 py-1.5 text-xs font-black text-ink hover:bg-panel"
									>
										{m.ap_withdraw()}
									</button>
								</form>
							{/if}
							<a
								href={resolve(`/campaigns/${application.campaignSlug}`)}
								class="inline-flex items-center gap-1 rounded-xl border-2 border-edge bg-surface px-3 py-1.5 text-xs font-black text-ink hover:bg-panel"
							>
								<ExternalLink class="h-3 w-3" />
								{m.ap_view_brief()}
							</a>
						{:else if application.status !== 'selected' && application.status !== 'withdrawn'}
							<form method="POST" action="?/decide" use:enhance={handle(m.ap_rejected_toast())}>
								<input type="hidden" name="id" value={application.id} />
								<input type="hidden" name="status" value="rejected" />
								<button
									type="submit"
									class="rounded-xl border-2 border-edge bg-surface px-3 py-1.5 text-xs font-black text-ink hover:bg-danger-soft"
								>
									{m.ap_reject()}
								</button>
							</form>

							{#if application.status !== 'shortlisted'}
								<form
									method="POST"
									action="?/decide"
									use:enhance={handle(m.ap_shortlisted_toast())}
								>
									<input type="hidden" name="id" value={application.id} />
									<input type="hidden" name="status" value="shortlisted" />
									<button
										type="submit"
										class="rounded-xl border-2 border-edge bg-tile-indigo px-3 py-1.5 text-xs font-black text-info-fg hover:bg-info-soft"
									>
										{m.ap_shortlist()}
									</button>
								</form>
							{/if}

							<form method="POST" action="?/decide" use:enhance={handle(m.ap_selected_toast())}>
								<input type="hidden" name="id" value={application.id} />
								<input type="hidden" name="status" value="selected" />
								<button
									type="submit"
									class="rounded-xl border-2 border-edge bg-brand px-3 py-1.5 text-xs font-black text-brand-ink shadow-[2px_2px_0px_0px_rgb(var(--bento-shadow))] hover:bg-brand-strong"
								>
									{m.ap_select_open()}
								</button>
							</form>
						{/if}
					</div>
				</div>
			{/each}
		</div>

		<PaginationBar result={data.applications} />
	{/if}
</div>
