<script lang="ts">
	import { resolve } from '$app/paths';
	import PageHeader from '$lib/components/page-header.svelte';
	import PaginationBar from '$lib/components/pagination-bar.svelte';
	import NoResults from '$lib/components/no-results.svelte';
	import SearchInput from '$lib/components/search-input.svelte';
	import { Star, Inbox } from '@lucide/svelte';
	import * as m from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';

	let { data } = $props();

	/* Counted and averaged in the database over every review, not over the page
	   on screen — otherwise the headline rating would move as pages turn. */
	const summary = $derived(data.summary);

	/** Which direction counts as "received" depends on which side is reading. */
	const receivedDirection = $derived(
		data.role === 'creator' ? 'brand_to_creator' : 'creator_to_brand'
	);

	const formatDate = (value: string | Date) =>
		new Date(value).toLocaleDateString(getLocale() === 'am' ? 'am-ET' : 'en-GB', {
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		});
</script>

<svelte:head><title>{m.rv_meta_title()}</title></svelte:head>

<div class="space-y-6">
	<PageHeader eyebrow={m.rv_eyebrow()} title={m.rv_title()} description={m.rv_description()} />

	{#if summary.received}
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
			<div class="bento-card-mint">
				<span class="block text-[10px] font-black tracking-widest text-ink-soft uppercase">
					{m.rv_average_rating()}
				</span>
				<span class="flex items-center gap-1.5 text-3xl font-black text-ink">
					<Star class="h-6 w-6 fill-warn text-warn" />
					{summary.average.toFixed(1)}
				</span>
			</div>
			<div class="bento-card bento-card-static">
				<span class="block text-[10px] font-black tracking-widest text-ink-soft uppercase">
					{m.rv_received_count()}
				</span>
				<span class="text-3xl font-black text-ink">{summary.received}</span>
			</div>
			<div class="bento-card bento-card-static">
				<span class="block text-[10px] font-black tracking-widest text-ink-soft uppercase">
					{m.rv_written_count()}
				</span>
				<span class="text-3xl font-black text-ink">{summary.given}</span>
			</div>
		</div>
	{/if}

	{#if data.reviews.total > 0 || data.reviews.state.search}
		<SearchInput value={data.reviews.state.search} class="sm:w-72" />
	{/if}

	{#if data.reviews.rows.length === 0 && data.reviews.state.search}
		<NoResults search={data.reviews.state.search} />
	{:else if data.reviews.rows.length === 0}
		<div class="bento-card bento-card-static space-y-3 py-16 text-center">
			<Inbox class="mx-auto h-10 w-10 text-ink-faint" />
			<h3 class="text-base font-black text-ink">{m.rv_empty_title()}</h3>
			<p class="mx-auto max-w-sm text-xs font-medium text-ink-soft">
				{m.rv_empty_body()}
			</p>
		</div>
	{:else}
		<div class="space-y-3">
			{#each data.reviews.rows as review (review.id)}
				<div class="bento-card bento-card-static space-y-3">
					<div class="flex flex-wrap items-start justify-between gap-2">
						<div>
							<span
								class="mb-1 inline-block rounded-md border border-edge-mid bg-well px-2 py-0.5 text-[10px] font-black tracking-wider text-ink-soft uppercase"
							>
								{review.direction === receivedDirection ? m.rv_received() : m.rv_written_by_you()}
							</span>
							<a
								href={resolve(`/dashboard/bookings/${review.bookingId}`)}
								class="block text-sm font-black text-ink hover:text-brand-fg"
							>
								{review.bookingTitle}
							</a>
							<p class="text-[11px] font-bold text-ink-dim">
								{review.direction === 'brand_to_creator'
									? review.organizationName
									: review.creatorName}
								· {formatDate(review.createdAt)}
							</p>
						</div>

						<div
							class="flex items-center gap-1 rounded-lg border border-warn-edge bg-warn-soft px-2 py-1"
						>
							{#each Array(review.rating) as _, i (i)}
								<Star class="h-3.5 w-3.5 fill-warn text-warn" />
							{/each}
							<span class="ml-1 text-xs font-black text-ink">{review.rating}.0</span>
						</div>
					</div>

					<p
						class="rounded-xl border border-edge-soft bg-panel p-3 text-xs leading-relaxed font-medium text-ink-soft"
					>
						"{review.body}"
					</p>

					<div class="flex flex-wrap gap-2 text-[10px] font-bold text-ink-soft">
						<span class="rounded-lg bg-well px-2.5 py-1">💬 {review.communication}/5</span>
						<span class="rounded-lg bg-well px-2.5 py-1">✨ {review.quality}/5</span>
						<span class="rounded-lg bg-well px-2.5 py-1">⏱️ {review.timeliness}/5</span>
						<span class="rounded-lg bg-well px-2.5 py-1">💼 {review.professionalism}/5</span>
					</div>
				</div>
			{/each}
		</div>

		<PaginationBar result={data.reviews} />
	{/if}
</div>
