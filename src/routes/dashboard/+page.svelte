<script lang="ts">
	import {
		TrendingUp,
		Wallet,
		Handshake,
		Send,
		ShieldCheck,
		Users,
		Megaphone,
		Star,
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

	let { data } = $props();

	const money = (value: number) => value.toLocaleString();
</script>

<svelte:head><title>Dashboard — Creator Network</title></svelte:head>

<div class="space-y-6">
	{#if data.view === 'onboarding'}
		<PageHeader
			eyebrow="Welcome"
			title="Finish setting up your account"
			description="One more step before you can be discovered or take bookings."
		/>

		<div class="grid grid-cols-1 gap-6 md:grid-cols-2">
			<a href="/dashboard/profile/create" class="bento-card space-y-3">
				<div
					class="flex h-12 w-12 items-center justify-center rounded-2xl border-2 border-slate-900 bg-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]"
				>
					<UserRoundCog class="h-6 w-6 text-emerald-400" />
				</div>
				<h3 class="text-lg font-black text-slate-900">Create your creator profile</h3>
				<p class="text-xs font-medium text-slate-600">
					Your handle, audience and rates. Takes about two minutes.
				</p>
			</a>

			<a href="/dashboard/organization/create" class="bento-card space-y-3">
				<div
					class="flex h-12 w-12 items-center justify-center rounded-2xl border-2 border-slate-900 bg-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]"
				>
					<Building2 class="h-6 w-6 text-indigo-300" />
				</div>
				<h3 class="text-lg font-black text-slate-900">Register an organisation</h3>
				<p class="text-xs font-medium text-slate-600">
					Set up a brand, agency, NGO or event account so you can post briefs.
				</p>
			</a>
		</div>

		<!-- ============================= CREATOR ============================= -->
	{:else if data.view === 'creator'}
		<PageHeader
			eyebrow="Creator studio"
			title="Your work at a glance"
			description="Everything currently in flight, and what is waiting on you."
		>
			{#snippet actions()}
				<a
					href="/campaigns"
					class="flex items-center gap-1.5 rounded-2xl border-2 border-slate-900 bg-emerald-600 px-4 py-2.5 text-xs font-black text-white shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] hover:bg-emerald-700"
				>
					<Send class="h-4 w-4" />
					Find briefs to pitch
				</a>
			{/snippet}
		</PageHeader>

		<div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
			<StatTile
				tone="dark"
				label="Earned to date"
				value={money(data.totals.earned)}
				note="Net of the 15% marketplace fee, from completed bookings"
			>
				{#snippet icon()}
					<span class="rounded-lg border border-emerald-500/30 bg-emerald-950/80 p-1.5 text-emerald-400">
						<Wallet class="h-4 w-4" />
					</span>
				{/snippet}
			</StatTile>
			<StatTile
				tone="mint"
				label="Awaiting settlement"
				value={money(data.totals.pending)}
				note="Approved work not yet marked fulfilled"
			/>
			<StatTile
				tone="yellow"
				label="Active bookings"
				value={data.totals.activeBookings}
				note="In negotiation, production or review"
			/>
			<StatTile
				tone="indigo"
				label="Open applications"
				value={data.totals.openApplications}
				note="Applied or shortlisted"
			/>
		</div>

		<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
			{@render bookingList(data.bookings, 'Your bookings', '/dashboard/bookings')}
			{@render applicationList(data.applications, '/dashboard/applications')}
		</div>

		<!-- ============================= BUSINESS ============================= -->
	{:else if data.view === 'business'}
		<PageHeader
			eyebrow="Brand operations"
			title="Campaign and spend overview"
			description="Committed budget, live briefs and the bookings that need your attention."
		>
			{#snippet actions()}
				<a
					href="/dashboard/campaigns"
					class="flex items-center gap-1.5 rounded-2xl border-2 border-slate-900 bg-emerald-600 px-4 py-2.5 text-xs font-black text-white shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] hover:bg-emerald-700"
				>
					<Plus class="h-4 w-4" />
					Post a brief
				</a>
				<a
					href="/discover"
					class="flex items-center gap-1.5 rounded-2xl border-2 border-slate-900 bg-white px-4 py-2.5 text-xs font-black text-slate-900 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] hover:bg-slate-50"
				>
					<Users class="h-4 w-4 text-emerald-600" />
					Find creators
				</a>
			{/snippet}
		</PageHeader>

		<div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
			<StatTile
				tone="dark"
				label="Committed spend"
				value={money(data.totals.committed)}
				note="Across every booking you have opened"
			>
				{#snippet icon()}
					<span class="rounded-lg border border-emerald-500/30 bg-emerald-950/80 p-1.5 text-emerald-400">
						<TrendingUp class="h-4 w-4" />
					</span>
				{/snippet}
			</StatTile>
			<StatTile
				tone="mint"
				label="Settled"
				value={money(data.totals.settled)}
				note="Compensation marked fulfilled"
			/>
			<StatTile
				tone="yellow"
				label="Active bookings"
				value={data.totals.activeBookings}
				note="Not yet completed or cancelled"
			/>
			<StatTile
				tone="indigo"
				label="Applications to review"
				value={data.totals.pendingApplications}
				note="Waiting on a shortlist decision"
			/>
		</div>

		{#if data.spend.length}
			<div class="bento-card bento-card-static space-y-4">
				<div>
					<span class="text-[10px] font-black tracking-widest text-slate-500 uppercase">
						Booking value by month
					</span>
					<h3 class="text-base font-black text-slate-900">Spend trend</h3>
				</div>
				<SpendChart data={data.spend} />
			</div>
		{/if}

		<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
			{@render bookingList(data.bookings, 'Recent bookings', '/dashboard/bookings')}
			{@render applicationList(data.applications, '/dashboard/applications')}
		</div>

		<!-- ============================= ADMIN ============================= -->
	{:else}
		<PageHeader
			eyebrow="Platform operations"
			title="Marketplace health"
			description="Supply, demand and the operational queues that need a human."
		>
			{#snippet actions()}
				<a
					href="/dashboard/admin/verification"
					class="flex items-center gap-1.5 rounded-2xl border-2 border-slate-900 bg-emerald-600 px-4 py-2.5 text-xs font-black text-white shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] hover:bg-emerald-700"
				>
					<ShieldCheck class="h-4 w-4" />
					Verification queue ({data.pendingVerifications})
				</a>
			{/snippet}
		</PageHeader>

		<div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
			<StatTile
				tone="dark"
				label="Booking volume"
				value={money(data.stats.volume)}
				note="{data.stats.bookings} bookings · {money(data.stats.fees)} in platform fees"
			>
				{#snippet icon()}
					<span class="rounded-lg border border-emerald-500/30 bg-emerald-950/80 p-1.5 text-emerald-400">
						<TrendingUp class="h-4 w-4" />
					</span>
				{/snippet}
			</StatTile>
			<StatTile
				tone="mint"
				label="Published creators"
				value={data.stats.creators}
				note="{formatReach(data.stats.totalReach)} combined reach"
			/>
			<StatTile
				tone="indigo"
				label="Organisations"
				value={data.stats.organizations}
				note="{data.stats.campaigns} live campaigns"
			/>
			<StatTile
				tone="yellow"
				label="Verification queue"
				value={data.pendingVerifications}
				note="Cases waiting on an operator decision"
			/>
		</div>

		{#if data.spend.length}
			<div class="bento-card bento-card-static space-y-4">
				<div>
					<span class="text-[10px] font-black tracking-widest text-slate-500 uppercase">
						Marketplace value by month
					</span>
					<h3 class="text-base font-black text-slate-900">Booking volume trend</h3>
				</div>
				<SpendChart data={data.spend} />
			</div>
		{/if}

		<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
			{@render bookingList(data.bookings, 'Recent bookings', '/dashboard/bookings')}

			<div class="bento-card bento-card-static space-y-3">
				<div class="flex items-center justify-between border-b-2 border-slate-900 pb-3">
					<h3 class="text-sm font-black text-slate-900">Recent activity</h3>
					<a
						href="/dashboard/admin/audit"
						class="flex items-center gap-1 text-xs font-black text-emerald-700 hover:underline"
					>
						Full log <ArrowRight class="h-3 w-3" />
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
									{new Date(entry.createdAt).toLocaleDateString('en-GB', {
										day: 'numeric',
										month: 'short'
									})}
								</span>
							</li>
						{/each}
					</ul>
				{:else}
					<p class="py-6 text-center text-xs font-medium text-slate-500">
						No recorded activity yet.
					</p>
				{/if}
			</div>
		</div>
	{/if}
</div>

<!-- ---------------- shared snippets ---------------- -->

{#snippet bookingList(bookings: any[], title: string, href: string)}
	<div class="bento-card bento-card-static space-y-3">
		<div class="flex items-center justify-between border-b-2 border-slate-900 pb-3">
			<h3 class="flex items-center gap-1.5 text-sm font-black text-slate-900">
				<Handshake class="h-4 w-4 text-emerald-600" />
				{title}
			</h3>
			<a {href} class="flex items-center gap-1 text-xs font-black text-emerald-700 hover:underline">
				View all <ArrowRight class="h-3 w-3" />
			</a>
		</div>

		{#if bookings.length}
			<ul class="space-y-2">
				{#each bookings as booking (booking.id)}
					<li>
						<a
							href="/dashboard/bookings/{booking.id}"
							class="flex items-center gap-3 rounded-xl border-2 border-slate-200 bg-white p-3 transition-colors hover:border-slate-900"
						>
							<img
								src={booking.creatorAvatar ?? booking.organizationLogo ?? ''}
								alt=""
								class="h-9 w-9 shrink-0 rounded-xl border border-slate-900 object-cover"
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
			<p class="py-6 text-center text-xs font-medium text-slate-500">No bookings yet.</p>
		{/if}
	</div>
{/snippet}

{#snippet applicationList(applications: any[], href: string)}
	<div class="bento-card bento-card-static space-y-3">
		<div class="flex items-center justify-between border-b-2 border-slate-900 pb-3">
			<h3 class="flex items-center gap-1.5 text-sm font-black text-slate-900">
				<Send class="h-4 w-4 text-emerald-600" />
				Applications
			</h3>
			<a {href} class="flex items-center gap-1 text-xs font-black text-emerald-700 hover:underline">
				View all <ArrowRight class="h-3 w-3" />
			</a>
		</div>

		{#if applications.length}
			<ul class="space-y-2">
				{#each applications as application (application.id)}
					<li
						class="flex items-center gap-3 rounded-xl border-2 border-slate-200 bg-white p-3"
					>
						<img
							src={application.creatorAvatar ?? ''}
							alt=""
							class="h-9 w-9 shrink-0 rounded-xl border border-slate-900 object-cover"
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
			<p class="py-6 text-center text-xs font-medium text-slate-500">No applications yet.</p>
		{/if}
	</div>
{/snippet}
