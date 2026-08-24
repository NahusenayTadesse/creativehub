<script lang="ts">
	import AppImage from '$lib/components/app-image.svelte';
	import type { BookingRow, ApplicationRow } from '$lib/server/queries';
	import type { ResolvedPathname } from '$app/types';
	import { resolve } from '$app/paths';
	import {
		TrendingUp,
		Wallet,
		Handshake,
		Send,
		ShieldCheck,
		Users,
		ArrowRight,
		Plus,
		Building2,
		UserRoundCog
	} from '@lucide/svelte';
	import PageHeader from '$lib/components/page-header.svelte';
	import StatTile from '$lib/components/stat-tile.svelte';
	import BookingStatusBadge from '$lib/components/booking-status-badge.svelte';
	import SpendChart from '$lib/components/spend-chart.svelte';
	import { formatReach } from '$lib/domain/money';
	import * as m from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';

	let { data } = $props();

	const money = (value: number) => value.toLocaleString();

	const dateLocale = $derived(getLocale() === 'am' ? 'am-ET' : 'en-GB');
</script>

<svelte:head><title>{m.dash_meta_title()}</title></svelte:head>

<div class="space-y-6">
	{#if data.view === 'onboarding'}
		<PageHeader eyebrow={m.ob_eyebrow()} title={m.ob_title()} description={m.ob_description()} />

		<div class="grid grid-cols-1 gap-6 md:grid-cols-2">
			<a href={resolve('/dashboard/profile/create')} class="bento-card space-y-3">
				<div
					class="flex h-12 w-12 items-center justify-center rounded-2xl border-2 border-slate-900 bg-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]"
				>
					<UserRoundCog class="h-6 w-6 text-emerald-400" />
				</div>
				<h3 class="text-lg font-black text-slate-900">{m.ob_creator_title()}</h3>
				<p class="text-xs font-medium text-slate-600">
					{m.ob_creator_body()}
				</p>
			</a>

			<a href={resolve('/dashboard/organization/create')} class="bento-card space-y-3">
				<div
					class="flex h-12 w-12 items-center justify-center rounded-2xl border-2 border-slate-900 bg-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]"
				>
					<Building2 class="h-6 w-6 text-indigo-300" />
				</div>
				<h3 class="text-lg font-black text-slate-900">{m.ob_org_title()}</h3>
				<p class="text-xs font-medium text-slate-600">
					{m.ob_org_body()}
				</p>
			</a>
		</div>

		<!-- ============================= CREATOR ============================= -->
	{:else if data.view === 'creator'}
		<PageHeader
			eyebrow={m.dashc_eyebrow()}
			title={m.dashc_title()}
			description={m.dashc_description()}
		>
			{#snippet actions()}
				<a
					href={resolve('/campaigns')}
					class="flex items-center gap-1.5 rounded-2xl border-2 border-slate-900 bg-emerald-600 px-4 py-2.5 text-xs font-black text-white shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] hover:bg-emerald-700"
				>
					<Send class="h-4 w-4" />
					{m.dashc_find_briefs()}
				</a>
			{/snippet}
		</PageHeader>

		<div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
			<StatTile
				tone="dark"
				label={m.dashc_earned()}
				value={money(data.totals.earned)}
				note={m.dashc_earned_note()}
			>
				{#snippet icon()}
					<span
						class="rounded-lg border border-emerald-500/30 bg-emerald-950/80 p-1.5 text-emerald-400"
					>
						<Wallet class="h-4 w-4" />
					</span>
				{/snippet}
			</StatTile>
			<StatTile
				tone="mint"
				label={m.dashc_awaiting()}
				value={money(data.totals.pending)}
				note={m.dashc_awaiting_note()}
			/>
			<StatTile
				tone="yellow"
				label={m.dashc_active_bookings()}
				value={data.totals.activeBookings}
				note={m.dashc_active_bookings_note()}
			/>
			<StatTile
				tone="indigo"
				label={m.dashc_open_applications()}
				value={data.totals.openApplications}
				note={m.dashc_open_applications_note()}
			/>
		</div>

		<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
			{@render bookingList(data.bookings, m.dashc_your_bookings(), resolve('/dashboard/bookings'))}
			{@render applicationList(data.applications, resolve('/dashboard/applications'))}
		</div>

		<!-- ============================= BUSINESS ============================= -->
	{:else if data.view === 'business'}
		<PageHeader
			eyebrow={m.dashb_eyebrow()}
			title={m.dashb_title()}
			description={m.dashb_description()}
		>
			{#snippet actions()}
				<a
					href={resolve('/dashboard/campaigns')}
					class="flex items-center gap-1.5 rounded-2xl border-2 border-slate-900 bg-emerald-600 px-4 py-2.5 text-xs font-black text-white shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] hover:bg-emerald-700"
				>
					<Plus class="h-4 w-4" />
					{m.dashb_post_brief()}
				</a>
				<a
					href={resolve('/discover')}
					class="flex items-center gap-1.5 rounded-2xl border-2 border-slate-900 bg-white px-4 py-2.5 text-xs font-black text-slate-900 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] hover:bg-slate-50"
				>
					<Users class="h-4 w-4 text-emerald-600" />
					{m.dashb_find_creators()}
				</a>
			{/snippet}
		</PageHeader>

		<div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
			<StatTile
				tone="dark"
				label={m.dashb_committed()}
				value={money(data.totals.committed)}
				note={m.dashb_committed_note()}
			>
				{#snippet icon()}
					<span
						class="rounded-lg border border-emerald-500/30 bg-emerald-950/80 p-1.5 text-emerald-400"
					>
						<TrendingUp class="h-4 w-4" />
					</span>
				{/snippet}
			</StatTile>
			<StatTile
				tone="mint"
				label={m.dashb_settled()}
				value={money(data.totals.settled)}
				note={m.dashb_settled_note()}
			/>
			<StatTile
				tone="yellow"
				label={m.dashc_active_bookings()}
				value={data.totals.activeBookings}
				note={m.dashb_active_note()}
			/>
			<StatTile
				tone="indigo"
				label={m.dashb_apps_to_review()}
				value={data.totals.pendingApplications}
				note={m.dashb_apps_to_review_note()}
			/>
		</div>

		{#if data.spend.length}
			<div class="bento-card bento-card-static space-y-4">
				<div>
					<span class="text-[10px] font-black tracking-widest text-slate-500 uppercase">
						{m.dashb_chart_eyebrow()}
					</span>
					<h3 class="text-base font-black text-slate-900">{m.dashb_chart_title()}</h3>
				</div>
				<SpendChart data={data.spend} />
			</div>
		{/if}

		<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
			{@render bookingList(
				data.bookings,
				m.dashb_recent_bookings(),
				resolve('/dashboard/bookings')
			)}
			{@render applicationList(data.applications, resolve('/dashboard/applications'))}
		</div>

		<!-- ============================= ADMIN ============================= -->
	{:else}
		<PageHeader
			eyebrow={m.dash_platform_operations()}
			title={m.dasha_title()}
			description={m.dasha_description()}
		>
			{#snippet actions()}
				<a
					href={resolve('/dashboard/admin/verification')}
					class="flex items-center gap-1.5 rounded-2xl border-2 border-slate-900 bg-emerald-600 px-4 py-2.5 text-xs font-black text-white shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] hover:bg-emerald-700"
				>
					<ShieldCheck class="h-4 w-4" />
					{m.dasha_verification_queue({ count: data.pendingVerifications })}
				</a>
			{/snippet}
		</PageHeader>

		<div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
			<StatTile
				tone="dark"
				label={m.dasha_booking_volume()}
				value={money(data.stats.volume)}
				note={m.dasha_booking_volume_note({
					bookings: data.stats.bookings,
					fees: money(data.stats.fees)
				})}
			>
				{#snippet icon()}
					<span
						class="rounded-lg border border-emerald-500/30 bg-emerald-950/80 p-1.5 text-emerald-400"
					>
						<TrendingUp class="h-4 w-4" />
					</span>
				{/snippet}
			</StatTile>
			<StatTile
				tone="mint"
				label={m.dasha_published_creators()}
				value={data.stats.creators}
				note={m.dasha_combined_reach_note({ reach: formatReach(data.stats.totalReach) })}
			/>
			<StatTile
				tone="indigo"
				label={m.dasha_organisations()}
				value={data.stats.organizations}
				note={m.dasha_live_campaigns_note({ count: data.stats.campaigns })}
			/>
			<StatTile
				tone="yellow"
				label={m.dasha_verification_queue_label()}
				value={data.pendingVerifications}
				note={m.dasha_verification_queue_note()}
			/>
		</div>

		{#if data.spend.length}
			<div class="bento-card bento-card-static space-y-4">
				<div>
					<span class="text-[10px] font-black tracking-widest text-slate-500 uppercase">
						{m.dasha_chart_eyebrow()}
					</span>
					<h3 class="text-base font-black text-slate-900">{m.dasha_chart_title()}</h3>
				</div>
				<SpendChart data={data.spend} />
			</div>
		{/if}

		<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
			{@render bookingList(
				data.bookings,
				m.dashb_recent_bookings(),
				resolve('/dashboard/bookings')
			)}

			<div class="bento-card bento-card-static space-y-3">
				<div class="flex items-center justify-between border-b-2 border-slate-900 pb-3">
					<h3 class="text-sm font-black text-slate-900">{m.dasha_recent_activity()}</h3>
					<a
						href={resolve('/dashboard/admin/audit')}
						class="flex items-center gap-1 text-xs font-black text-emerald-700 hover:underline"
					>
						{m.dasha_full_log()}
						<ArrowRight class="h-3 w-3" />
					</a>
				</div>

				{#if data.recentAudit.length}
					<ul class="space-y-2">
						{#each data.recentAudit as entry (entry.id)}
							<li class="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
								<span
									class="mt-0.5 rounded-md border border-slate-900 bg-white px-1.5 py-0.5 text-[9px] font-black tracking-wider uppercase"
								>
									{entry.entity}
								</span>
								<div class="min-w-0 flex-1">
									<p class="text-xs font-bold text-slate-900">
										{entry.action}{entry.toState ? ` → ${entry.toState}` : ''}
									</p>
									{#if entry.reason}
										<p class="truncate text-[11px] font-medium text-slate-500">{entry.reason}</p>
									{/if}
								</div>
								<span class="shrink-0 text-[10px] font-bold text-slate-400">
									{new Date(entry.createdAt).toLocaleDateString(dateLocale, {
										day: 'numeric',
										month: 'short'
									})}
								</span>
							</li>
						{/each}
					</ul>
				{:else}
					<p class="py-6 text-center text-xs font-medium text-slate-500">
						{m.dasha_no_activity()}
					</p>
				{/if}
			</div>
		</div>
	{/if}
</div>

<!-- ---------------- shared snippets ---------------- -->

{#snippet bookingList(bookings: BookingRow[], title: string, href: ResolvedPathname)}
	<div class="bento-card bento-card-static space-y-3">
		<div class="flex items-center justify-between border-b-2 border-slate-900 pb-3">
			<h3 class="flex items-center gap-1.5 text-sm font-black text-slate-900">
				<Handshake class="h-4 w-4 text-emerald-600" />
				{title}
			</h3>
			<a {href} class="flex items-center gap-1 text-xs font-black text-emerald-700 hover:underline">
				{m.dash_view_all()}
				<ArrowRight class="h-3 w-3" />
			</a>
		</div>

		{#if bookings.length}
			<ul class="space-y-2">
				{#each bookings as booking (booking.id)}
					<li>
						<a
							href={resolve(`/dashboard/bookings/${booking.id}`)}
							class="flex items-center gap-3 rounded-xl border-2 border-slate-200 bg-white p-3 transition-colors hover:border-slate-900"
						>
							<AppImage
								src={booking.creatorAvatar ?? booking.organizationLogo}
								alt=""
								kind="avatar"
								seed={booking.reference ?? booking.title}
								label={booking.creatorName ?? booking.organizationName}
								class="h-9 w-9 shrink-0 rounded-xl border border-slate-900 object-cover"
								loading="lazy"
								decoding="async"
								width="36"
								height="36"
							/>
							<div class="min-w-0 flex-1">
								<p class="truncate text-xs font-black text-slate-900">{booking.title}</p>
								<p class="truncate text-[11px] font-bold text-slate-500">
									{booking.creatorName} · {booking.organizationName}
								</p>
							</div>
							<div class="flex shrink-0 flex-col items-end gap-1">
								<BookingStatusBadge status={booking.status} />
								<span class="text-[11px] font-black text-slate-900">
									{booking.price.toLocaleString()}
									{booking.currencyCode}
								</span>
							</div>
						</a>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="py-6 text-center text-xs font-medium text-slate-500">{m.dash_no_bookings()}</p>
		{/if}
	</div>
{/snippet}

{#snippet applicationList(applications: ApplicationRow[], href: ResolvedPathname)}
	<div class="bento-card bento-card-static space-y-3">
		<div class="flex items-center justify-between border-b-2 border-slate-900 pb-3">
			<h3 class="flex items-center gap-1.5 text-sm font-black text-slate-900">
				<Send class="h-4 w-4 text-emerald-600" />
				{m.dash_applications()}
			</h3>
			<a {href} class="flex items-center gap-1 text-xs font-black text-emerald-700 hover:underline">
				{m.dash_view_all()}
				<ArrowRight class="h-3 w-3" />
			</a>
		</div>

		{#if applications.length}
			<ul class="space-y-2">
				{#each applications as application (application.id)}
					<li class="flex items-center gap-3 rounded-xl border-2 border-slate-200 bg-white p-3">
						<AppImage
							src={application.creatorAvatar}
							alt=""
							kind="avatar"
							seed={application.creatorName ?? application.campaignTitle}
							label={application.creatorName}
							class="h-9 w-9 shrink-0 rounded-xl border border-slate-900 object-cover"
							loading="lazy"
							decoding="async"
							width="36"
							height="36"
						/>
						<div class="min-w-0 flex-1">
							<p class="truncate text-xs font-black text-slate-900">
								{application.campaignTitle}
							</p>
							<p class="truncate text-[11px] font-bold text-slate-500">
								{application.creatorName}
							</p>
						</div>
						<BookingStatusBadge status={application.status} kind="application" />
					</li>
				{/each}
			</ul>
		{:else}
			<p class="py-6 text-center text-xs font-medium text-slate-500">{m.dash_no_applications()}</p>
		{/if}
	</div>
{/snippet}
