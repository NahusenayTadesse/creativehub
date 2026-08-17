<script lang="ts">
	import { enhance } from '$app/forms';
	import { toast } from 'svelte-sonner';
	import PageHeader from '$lib/components/page-header.svelte';
	import VerificationBadge from '$lib/components/verification-badge.svelte';
	import { Bookmark, Star, MapPin, Award, X } from '@lucide/svelte';
	import { formatReach } from '$lib/domain/money';

	let { data } = $props();

	const removeHandler = () => {
		return async ({ result, update }: any) => {
			if (result.type === 'success') toast.success('Removed from shortlist');
			await update();
		};
	};
</script>

<svelte:head><title>Shortlist — Creator Network</title></svelte:head>

<div class="space-y-6">
	<PageHeader
		eyebrow="Brand operations"
		title="Shortlist"
		description="Creators your team saved from discovery. The list belongs to the organisation, so anyone on it sees the same names."
	>
		{#snippet actions()}
			<a
				href="/discover"
				class="rounded-2xl border-2 border-slate-900 bg-emerald-600 px-4 py-2.5 text-xs font-black text-white shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] hover:bg-emerald-700"
			>
				Find more creators
			</a>
		{/snippet}
	</PageHeader>

	{#if data.saved.length === 0}
		<div class="bento-card bento-card-static space-y-3 py-16 text-center">
			<Bookmark class="mx-auto h-10 w-10 text-slate-400" />
			<h3 class="text-base font-black text-slate-900">Nothing saved yet</h3>
			<p class="mx-auto max-w-sm text-xs font-medium text-slate-600">
				Use the heart on a creator card in discovery to keep them here while you build a campaign.
			</p>
		</div>
	{:else}
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{#each data.saved as entry (entry.id)}
				<div class="bento-card bento-card-static flex flex-col justify-between gap-3">
					<div class="space-y-3">
						<div class="flex items-start justify-between gap-2">
							<div class="flex items-center gap-3">
								<img
									src={entry.avatar ?? ''}
									alt=""
									class="h-11 w-11 rounded-2xl border-2 border-slate-900 object-cover"
								/>
								<div class="min-w-0">
									<a
										href="/creators/{entry.username}"
										class="block truncate text-sm font-black text-slate-900 hover:text-emerald-600"
									>
										{entry.fullName}
									</a>
									<p class="truncate text-[11px] font-bold text-slate-500">@{entry.username}</p>
								</div>
							</div>
							<form method="POST" action="?/remove" use:enhance={removeHandler}>
								<input type="hidden" name="creatorId" value={entry.creatorId} />
								<button
									type="submit"
									aria-label="Remove from shortlist"
									class="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
								>
									<X class="h-4 w-4" />
								</button>
							</form>
						</div>

						<div class="flex flex-wrap items-center gap-1.5 text-[11px]">
							<VerificationBadge level={entry.verificationLevel} />
							<span
								class="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-slate-100 px-2 py-0.5 font-bold text-slate-800"
							>
								<span>{entry.countryFlag ?? '🌍'}</span>
								{entry.countryName}
							</span>
						</div>

						<p class="line-clamp-2 text-xs font-medium text-slate-600">{entry.bio}</p>

						<div
							class="grid grid-cols-3 gap-2 rounded-2xl border-2 border-slate-900 bg-[#fef9c3] p-2.5 text-center text-xs"
						>
							<div>
								<div class="text-[9px] font-black tracking-wider text-slate-600 uppercase">Reach</div>
								<div class="mt-0.5 text-sm font-black text-slate-900">
									{formatReach(entry.totalReach)}
								</div>
							</div>
							<div>
								<div class="text-[9px] font-black tracking-wider text-slate-600 uppercase">Score</div>
								<div class="mt-0.5 flex items-center justify-center gap-0.5 text-sm font-black text-slate-900">
									<Award class="h-3 w-3 text-emerald-700" />
									{entry.score}
								</div>
							</div>
							<div>
								<div class="text-[9px] font-black tracking-wider text-slate-600 uppercase">Rating</div>
								<div class="mt-0.5 flex items-center justify-center gap-0.5 text-sm font-black text-slate-900">
									<Star class="h-3 w-3 fill-amber-400 text-slate-900" />
									{entry.averageRating.toFixed(1)}
								</div>
							</div>
						</div>
					</div>

					<div class="flex items-center justify-between border-t-2 border-slate-200 pt-3">
						<div>
							<span class="block text-[9px] font-black tracking-wider text-slate-500 uppercase">
								From
							</span>
							<span class="text-sm font-black text-slate-900">
								{entry.startingPrice.toLocaleString()}
								<span class="text-xs text-emerald-600">{entry.currencyCode}</span>
							</span>
						</div>
						<a
							href="/creators/{entry.username}"
							class="rounded-xl border-2 border-slate-900 bg-emerald-600 px-3 py-1.5 text-xs font-black text-white shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] hover:bg-emerald-700"
						>
							Book
						</a>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
