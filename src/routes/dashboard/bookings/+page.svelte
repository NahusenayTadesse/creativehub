<script lang="ts">
	import AppImage from '$lib/components/app-image.svelte';
	import { resolve } from '$app/paths';
	import PageHeader from '$lib/components/page-header.svelte';
	import BookingStatusBadge from '$lib/components/booking-status-badge.svelte';
	import CompensationBadge from '$lib/components/compensation-badge.svelte';
	import PaginationBar from '$lib/components/pagination-bar.svelte';
	import NoResults from '$lib/components/no-results.svelte';
	import SearchInput from '$lib/components/search-input.svelte';
	import { ArrowRight, Inbox } from '@lucide/svelte';
	import { page } from '$app/state';
	import { withParams } from '$lib/query';
	import * as m from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';

	let { data } = $props();

	/* The tab and the search live in the URL; the counts beside each tab come
	   from the database, over the whole result rather than the page on screen. */
	const listState = $derived(data.bookings.state);
	const activeTab = $derived(listState.values.tab ?? 'all');
	const tabLink = (key: string) => withParams(page.url, { tab: key === 'all' ? null : key });

	const formatDate = (value: string | Date | null) =>
		value
			? new Date(value).toLocaleDateString(getLocale() === 'am' ? 'am-ET' : 'en-GB', {
					day: 'numeric',
					month: 'short'
				})
			: '—';

	const tabs = $derived([
		{ key: 'all', label: m.bl_tab_all() },
		{ key: 'negotiating', label: m.bl_tab_negotiating() },
		{ key: 'active', label: m.bl_tab_active() },
		{ key: 'completed', label: m.bl_tab_completed() },
		{ key: 'closed', label: m.bl_tab_closed() }
	]);
</script>

<svelte:head><title>{m.bl_meta_title()}</title></svelte:head>

<div class="space-y-6">
	<PageHeader
		eyebrow={data.role === 'admin' ? m.dash_platform_operations() : m.bl_eyebrow_deals()}
		title={m.bl_title()}
		description={m.bl_description()}
	/>

	<!-- Filters -->
	<div class="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
		<div class="flex flex-wrap items-center gap-2">
			{#each tabs as tab (tab.key)}
				<a
					href={tabLink(tab.key)}
					data-sveltekit-noscroll
					class="cursor-pointer rounded-xl border-2 border-slate-900 px-3 py-1.5 text-xs font-black shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] transition-all {activeTab ===
					tab.key
						? 'bg-slate-900 text-white'
						: 'bg-white text-slate-800 hover:bg-slate-100'}"
				>
					{m.bl_tab_count({ label: tab.label, count: data.tabCounts[tab.key] ?? 0 })}
				</a>
			{/each}
		</div>

		<SearchInput value={listState.search} placeholder={m.bl_search_placeholder()} class="sm:w-64" />
	</div>

	{#if data.bookings.rows.length === 0 && listState.search}
		<NoResults search={listState.search} />
	{:else if data.bookings.rows.length === 0}
		<div class="bento-card bento-card-static space-y-3 py-16 text-center">
			<Inbox class="mx-auto h-10 w-10 text-slate-400" />
			<h3 class="text-base font-black text-slate-900">{m.bl_empty_title()}</h3>
			<p class="mx-auto max-w-sm text-xs font-medium text-slate-600">
				{data.role === 'creator' ? m.bl_empty_creator() : m.bl_empty_brand()}
			</p>
			<a
				href={data.role === 'creator' ? resolve('/campaigns') : resolve('/discover')}
				class="inline-block rounded-xl border-2 border-slate-900 bg-emerald-600 px-4 py-2 text-xs font-black text-white shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] hover:bg-emerald-700"
			>
				{data.role === 'creator' ? m.bl_browse_briefs() : m.bl_find_creators()}
			</a>
		</div>
	{:else}
		<div class="space-y-3">
			{#each data.bookings.rows as booking (booking.id)}
				<a
					href={resolve(`/dashboard/bookings/${booking.id}`)}
					class="bento-card bento-card-static block transition-all hover:border-emerald-600"
				>
					<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
						<div class="flex min-w-0 items-center gap-3">
							<AppImage
								src={booking.creatorAvatar}
								alt=""
								kind="avatar"
								seed={booking.reference}
								label={booking.creatorName}
								class="h-11 w-11 shrink-0 rounded-2xl border-2 border-slate-900 object-cover"
								loading="lazy"
								decoding="async"
								width="44"
								height="44"
							/>
							<div class="min-w-0">
								<div class="mb-0.5 flex flex-wrap items-center gap-2">
									<span class="font-mono text-[10px] font-black tracking-wider text-slate-400">
										{booking.reference}
									</span>
									<BookingStatusBadge status={booking.status} />
									<CompensationBadge type={booking.compensationType} />
								</div>
								<h3 class="truncate text-sm font-black text-slate-900">{booking.title}</h3>
								<p class="truncate text-[11px] font-bold text-slate-500">
									{booking.creatorName} · {booking.organizationName} · {m.bk_due({
										date: formatDate(booking.deadline)
									})}
								</p>
							</div>
						</div>

						<div class="flex shrink-0 items-center gap-4">
							<div class="text-right">
								<span class="block text-[9px] font-black tracking-wider text-slate-500 uppercase">
									{data.role === 'creator' ? m.bl_your_payout() : m.bl_value()}
								</span>
								<span class="text-sm font-black text-slate-900">
									{(data.role === 'creator'
										? booking.creatorPayout
										: booking.price
									).toLocaleString()}
									<span class="text-xs text-emerald-600">{booking.currencyCode}</span>
								</span>
								<div class="mt-1">
									<BookingStatusBadge status={booking.escrowStatus} kind="escrow" />
								</div>
							</div>
							<ArrowRight class="h-4 w-4 shrink-0 text-slate-400" />
						</div>
					</div>
				</a>
			{/each}
		</div>

		<PaginationBar result={data.bookings} />
	{/if}
</div>
