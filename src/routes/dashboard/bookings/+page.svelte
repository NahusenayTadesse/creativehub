<script lang="ts">
	import PageHeader from '$lib/components/page-header.svelte';
	import BookingStatusBadge from '$lib/components/booking-status-badge.svelte';
	import CompensationBadge from '$lib/components/compensation-badge.svelte';
	import { Handshake, ArrowRight, Search, Inbox } from '@lucide/svelte';

	let { data } = $props();

	let query = $state('');
	let statusFilter = $state('all');

	const GROUPS: Record<string, string[]> = {
		all: [],
		negotiating: ['proposed', 'negotiating'],
		active: ['booked', 'in_production', 'submitted', 'revision', 'approved', 'awaiting_settlement'],
		completed: ['completed'],
		closed: ['cancelled', 'disputed']
	};

	const filtered = $derived.by(() => {
		const q = query.trim().toLowerCase();
		return data.bookings.filter((booking) => {
			const group = GROUPS[statusFilter];
			if (group?.length && !group.includes(booking.status)) return false;

			if (q) {
				const haystack = [
					booking.title,
					booking.reference,
					booking.creatorName,
					booking.organizationName
				]
					.join(' ')
					.toLowerCase();
				if (!haystack.includes(q)) return false;
			}
			return true;
		});
	});

	const countFor = (key: string) =>
		key === 'all'
			? data.bookings.length
			: data.bookings.filter((b) => GROUPS[key].includes(b.status)).length;

	const formatDate = (value: string | Date | null) =>
		value ? new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—';
</script>

<svelte:head><title>Bookings — Creator Network</title></svelte:head>

<div class="space-y-6">
	<PageHeader
		eyebrow={data.role === 'admin' ? 'Platform operations' : 'Deals'}
		title="Bookings"
		description="Every agreement, from the first proposal through delivery to settlement. Terms freeze the moment both sides accept."
	/>

	<!-- Filters -->
	<div class="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
		<div class="flex flex-wrap items-center gap-2">
			{#each [{ key: 'all', label: 'All' }, { key: 'negotiating', label: 'Negotiating' }, { key: 'active', label: 'In progress' }, { key: 'completed', label: 'Completed' }, { key: 'closed', label: 'Closed' }] as tab (tab.key)}
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

		<div class="relative sm:w-64">
			<Search class="absolute top-3 left-3 h-4 w-4 text-slate-500" />
			<input
				type="text"
				bind:value={query}
				placeholder="Search by reference, creator, brand…"
				class="w-full rounded-2xl border-2 border-slate-900 bg-white py-2.5 pr-3 pl-9 text-xs font-bold shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] outline-none focus:ring-2 focus:ring-emerald-500"
			/>
		</div>
	</div>

	{#if filtered.length === 0}
		<div class="bento-card bento-card-static space-y-3 py-16 text-center">
			<Inbox class="mx-auto h-10 w-10 text-slate-400" />
			<h3 class="text-base font-black text-slate-900">No bookings here</h3>
			<p class="mx-auto max-w-sm text-xs font-medium text-slate-600">
				{data.role === 'creator'
					? 'Bookings appear once a brand sends you a proposal or selects your application.'
					: 'Book a creator from their profile, or select an applicant from one of your briefs.'}
			</p>
			<a
				href={data.role === 'creator' ? '/campaigns' : '/discover'}
				class="inline-block rounded-xl border-2 border-slate-900 bg-emerald-600 px-4 py-2 text-xs font-black text-white shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] hover:bg-emerald-700"
			>
				{data.role === 'creator' ? 'Browse briefs' : 'Find creators'}
			</a>
		</div>
	{:else}
		<div class="space-y-3">
			{#each filtered as booking (booking.id)}
				<a
					href="/dashboard/bookings/{booking.id}"
					class="bento-card bento-card-static block transition-all hover:border-emerald-600"
				>
					<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
						<div class="flex min-w-0 items-center gap-3">
							<img
								src={booking.creatorAvatar ?? ''}
								alt=""
								class="h-11 w-11 shrink-0 rounded-2xl border-2 border-slate-900 object-cover"
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
									{booking.creatorName} · {booking.organizationName} · due {formatDate(booking.deadline)}
								</p>
							</div>
						</div>

						<div class="flex shrink-0 items-center gap-4">
							<div class="text-right">
								<span class="block text-[9px] font-black tracking-wider text-slate-500 uppercase">
									{data.role === 'creator' ? 'Your payout' : 'Value'}
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
	{/if}
</div>
