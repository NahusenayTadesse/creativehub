<script lang="ts">
	import { resolve } from '$app/paths';
	import { CircleAlert, Clock, Target, TrendingUp } from '@lucide/svelte';
	import PageHeader from '$lib/components/page-header.svelte';
	import BookingStatusBadge from '$lib/components/booking-status-badge.svelte';
	import StatTile from '$lib/components/stat-tile.svelte';
	import InputComp from '$lib/formComponents/InputComp.svelte';
	import { statusLabel } from '$lib/domain/booking';
	import { formatAmountWithCode } from '$lib/domain/money';
	import * as m from '$lib/paraglide/messages';

	let { data } = $props();

	const etb = (amount: number) => formatAmountWithCode(amount, 'ETB');
	const gateShare = $derived(
		Math.min(100, Math.round((data.totals.completedPaid / data.totals.gate) * 100))
	);

	const reasonLabel = (reason: string) =>
		({
			disputed: m.db_reason_disputed(),
			introduction: m.db_reason_introduction(),
			cancel_requested: m.db_reason_cancel(),
			overdue: m.db_reason_overdue(),
			stale: m.db_reason_stale({ days: data.staleDays })
		})[reason] ?? reason;

	/* The board only draws columns with something in them on a phone; on a wide
	   screen every state keeps its place so the pipeline reads left to right. */
	let showEmpty = $state(false);
	const columns = $derived(showEmpty ? data.columns : data.columns.filter((c) => c.count > 0));
</script>

<svelte:head><title>{m.db_meta_title()}</title></svelte:head>

<div class="min-w-0 space-y-6">
	<PageHeader
		eyebrow={m.dash_platform_operations()}
		title={m.db_title()}
		description={m.db_description()}
	/>

	<!-- ---------------- The month, and the gate ---------------- -->
	<div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
		<StatTile
			label={m.db_open_deals()}
			value={data.totals.open}
			note={m.db_pipeline_value({ value: etb(data.totals.pipelineValue) })}
		/>
		<StatTile
			label={m.db_expected_revenue()}
			value={etb(data.totals.expectedRevenue)}
			note={m.db_expected_revenue_note()}
		/>
		<StatTile
			label={m.db_completed_month()}
			value={data.totals.completed}
			note={m.db_revenue_month({ value: etb(data.totals.revenue) })}
		/>
		<StatTile label={m.db_cancelled_month()} value={data.totals.cancelled} />
	</div>

	<div class="bento-card bento-card-static space-y-2">
		<div class="flex flex-wrap items-center justify-between gap-2">
			<h2 class="flex items-center gap-1.5 text-sm font-black text-ink">
				<Target class="h-4 w-4 text-brand-fg" />
				{m.db_gate_title()}
			</h2>
			<span class="text-sm font-black text-ink tabular-nums">
				{data.totals.completedPaid} / {data.totals.gate}
			</span>
		</div>
		<div
			class="h-3 overflow-hidden rounded-full border-2 border-edge bg-well"
			role="progressbar"
			aria-valuemin={0}
			aria-valuemax={data.totals.gate}
			aria-valuenow={data.totals.completedPaid}
		>
			<div class="h-full bg-brand" style:width="{gateShare}%"></div>
		</div>
		<p class="text-[11px] font-medium text-ink-dim">{m.db_gate_note()}</p>
	</div>

	<!-- ---------------- Needs a person ---------------- -->
	{#if data.attention.length}
		<div class="bento-card bento-card-static space-y-3">
			<h2 class="flex items-center gap-1.5 text-sm font-black text-ink">
				<CircleAlert class="h-4 w-4 text-danger-fg" />
				{m.db_attention({ count: data.attention.length })}
			</h2>
			<ul class="divide-y-2 divide-edge-soft">
				{#each data.attention as deal (deal.id)}
					<li class="flex flex-wrap items-center justify-between gap-2 py-2">
						<a href={resolve(`/dashboard/bookings/${deal.id}`)} class="min-w-0">
							<span class="block truncate text-xs font-black text-ink hover:underline"
								>{deal.title}</span
							>
							<span class="block text-[11px] text-ink-dim">
								{deal.reference} · {deal.creatorName} · {deal.organizationName}
							</span>
						</a>
						<span class="flex flex-wrap items-center gap-1.5">
							<BookingStatusBadge status={deal.status} />
							{#each deal.reasons as reason (reason)}
								<span
									class="rounded-full border border-danger-edge bg-danger-soft px-2 py-0.5 text-[10px] font-black text-danger-fg"
								>
									{reasonLabel(reason)}
								</span>
							{/each}
						</span>
					</li>
				{/each}
			</ul>
		</div>
	{/if}

	<!-- ---------------- The board ---------------- -->
	<div class="flex items-center justify-between gap-2">
		<h2 class="flex items-center gap-1.5 text-sm font-black whitespace-nowrap text-ink">
			<TrendingUp class="h-4 w-4 text-brand-fg" />
			{m.db_board()}
		</h2>
		<InputComp
			label={m.db_show_empty()}
			labelHidden
			name="showEmpty"
			type="checkboxSingle"
			placeholder={m.db_show_empty()}
			bind:value={showEmpty}
		/>
	</div>

	{#if columns.length === 0}
		<p class="bento-card bento-card-static text-center text-sm font-bold text-ink-soft">
			{m.db_empty()}
		</p>
	{:else}
		<!-- `contain: inline-size` keeps the columns from widening the page: the row
		     scrolls inside the width it is given rather than asking for more. -->
		<div
			class="thin-scroll -mx-4 flex gap-3 overflow-x-auto px-4 pb-3 [contain:inline-size] sm:mx-0 sm:px-0"
		>
			{#each columns as column (column.status)}
				<section
					class="flex w-64 shrink-0 flex-col gap-2 rounded-2xl border-2 border-edge bg-well p-2"
					aria-label={statusLabel(column.status)}
				>
					<header class="flex items-center justify-between gap-2 px-1">
						<a
							href={resolve(`/dashboard/bookings?status=${column.status}`)}
							class="text-xs font-black text-ink hover:underline"
						>
							{statusLabel(column.status)}
						</a>
						<span
							class="rounded-full bg-surface px-2 py-0.5 text-[11px] font-black text-ink tabular-nums"
							>{column.count}</span
						>
					</header>
					<p class="px-1 text-[10px] font-bold text-ink-dim">{etb(column.value)}</p>
					{#each column.deals.slice(0, 25) as deal (deal.id)}
						<a
							href={resolve(`/dashboard/bookings/${deal.id}`)}
							class="block space-y-1 rounded-xl border-2 bg-surface p-2.5 text-[11px] hover:-translate-y-0.5 {deal.overdue ||
							deal.stale
								? 'border-danger-edge'
								: 'border-edge-soft'} transition-transform"
						>
							<span class="line-clamp-2 font-black text-ink">{deal.title}</span>
							<span class="block truncate text-ink-dim"
								>{deal.creatorName} · {deal.organizationName}</span
							>
							<span class="flex items-center justify-between gap-2">
								<span class="font-bold text-ink tabular-nums"
									>{formatAmountWithCode(deal.price, deal.currencyCode)}</span
								>
								<span
									class="inline-flex items-center gap-0.5 {deal.stale
										? 'font-black text-danger-fg'
										: 'text-ink-faint'}"
								>
									<Clock class="h-3 w-3" />
									{m.db_idle({ days: deal.idleDays })}
								</span>
							</span>
						</a>
					{/each}
					{#if column.count > 25}
						<a
							href={resolve(`/dashboard/bookings?status=${column.status}`)}
							class="px-1 text-[11px] font-black text-brand-soft-fg underline"
						>
							{m.db_more({ count: column.count - 25 })}
						</a>
					{/if}
				</section>
			{/each}
		</div>
	{/if}
</div>
