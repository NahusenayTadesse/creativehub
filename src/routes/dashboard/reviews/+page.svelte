<script lang="ts">
	import PageHeader from '$lib/components/page-header.svelte';
	import { Star, Inbox } from '@lucide/svelte';

	let { data } = $props();

	const received = $derived(
		data.role === 'creator'
			? data.reviews.filter((r) => r.direction === 'brand_to_creator')
			: data.reviews.filter((r) => r.direction === 'creator_to_brand')
	);
	const given = $derived(data.reviews.filter((r) => !received.includes(r)));

	const average = $derived(
		received.length ? received.reduce((sum, r) => sum + r.rating, 0) / received.length : 0
	);

	const formatDate = (value: string | Date) =>
		new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
</script>

<svelte:head><title>Reviews — Creator Network</title></svelte:head>

<div class="space-y-6">
	<PageHeader
		eyebrow="Trust"
		title="Reviews"
		description="Every review here is attached to a booking that actually completed — which is what makes it worth reading."
	/>

	{#if received.length}
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
			<div class="bento-card-mint">
				<span class="block text-[10px] font-black tracking-widest text-slate-600 uppercase">
					Average rating
				</span>
				<span class="flex items-center gap-1.5 text-3xl font-black text-slate-900">
					<Star class="h-6 w-6 fill-amber-400 text-amber-500" />
					{average.toFixed(1)}
				</span>
			</div>
			<div class="bento-card bento-card-static">
				<span class="block text-[10px] font-black tracking-widest text-slate-600 uppercase">
					Reviews received
				</span>
				<span class="text-3xl font-black text-slate-900">{received.length}</span>
			</div>
			<div class="bento-card bento-card-static">
				<span class="block text-[10px] font-black tracking-widest text-slate-600 uppercase">
					Reviews written
				</span>
				<span class="text-3xl font-black text-slate-900">{given.length}</span>
			</div>
		</div>
	{/if}

	{#if data.reviews.length === 0}
		<div class="bento-card bento-card-static space-y-3 py-16 text-center">
			<Inbox class="mx-auto h-10 w-10 text-slate-400" />
			<h3 class="text-base font-black text-slate-900">No reviews yet</h3>
			<p class="mx-auto max-w-sm text-xs font-medium text-slate-600">
				Reviews unlock once a booking reaches completed, so both sides are describing work that
				actually happened.
			</p>
		</div>
	{:else}
		<div class="space-y-3">
			{#each data.reviews as review (review.id)}
				<div class="bento-card bento-card-static space-y-3">
					<div class="flex flex-wrap items-start justify-between gap-2">
						<div>
							<span
								class="mb-1 inline-block rounded-md border border-slate-400 bg-slate-100 px-2 py-0.5 text-[10px] font-black tracking-wider text-slate-700 uppercase"
							>
								{received.includes(review) ? 'Received' : 'Written by you'}
							</span>
							<a
								href="/dashboard/bookings/{review.bookingId}"
								class="block text-sm font-black text-slate-900 hover:text-emerald-600"
							>
								{review.bookingTitle}
							</a>
							<p class="text-[11px] font-bold text-slate-500">
								{review.direction === 'brand_to_creator'
									? review.organizationName
									: review.creatorName}
								· {formatDate(review.createdAt)}
							</p>
						</div>

						<div
							class="flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1"
						>
							{#each Array(review.rating) as _, i (i)}
								<Star class="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
							{/each}
							<span class="ml-1 text-xs font-black text-slate-900">{review.rating}.0</span>
						</div>
					</div>

					<p
						class="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed font-medium text-slate-700"
					>
						"{review.body}"
					</p>

					<div class="flex flex-wrap gap-2 text-[10px] font-bold text-slate-600">
						<span class="rounded-lg bg-slate-100 px-2.5 py-1">💬 {review.communication}/5</span>
						<span class="rounded-lg bg-slate-100 px-2.5 py-1">✨ {review.quality}/5</span>
						<span class="rounded-lg bg-slate-100 px-2.5 py-1">⏱️ {review.timeliness}/5</span>
						<span class="rounded-lg bg-slate-100 px-2.5 py-1">💼 {review.professionalism}/5</span>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
