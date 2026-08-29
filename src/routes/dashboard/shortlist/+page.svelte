<script lang="ts">
	import AppImage from '$lib/components/app-image.svelte';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { resolve } from '$app/paths';
	import * as m from '$lib/paraglide/messages';
	import { enhance } from '$app/forms';
	import { toast } from 'svelte-sonner';
	import PageHeader from '$lib/components/page-header.svelte';
	import PaginationBar from '$lib/components/pagination-bar.svelte';
	import NoResults from '$lib/components/no-results.svelte';
	import SearchInput from '$lib/components/search-input.svelte';
	import VerificationBadge from '$lib/components/verification-badge.svelte';
	import RepresentationBadge from '$lib/components/representation-badge.svelte';
	import { Bookmark, Star, Award, X } from '@lucide/svelte';
	import { formatReach } from '$lib/domain/money';

	let { data } = $props();

	const removeHandler: SubmitFunction = () => {
		return async ({ result, update }) => {
			if (result.type === 'success') toast.success(m.discover_removed_toast());
			await update();
		};
	};
</script>

<svelte:head><title>{m.sl_meta_title()}</title></svelte:head>

<div class="space-y-6">
	<PageHeader eyebrow={m.dashb_eyebrow()} title={m.sl_title()} description={m.sl_description()}>
		{#snippet actions()}
			<a
				href={resolve('/discover')}
				class="rounded-2xl border-2 border-edge bg-brand px-4 py-2.5 text-xs font-black text-brand-ink shadow-[3px_3px_0px_0px_rgb(var(--bento-shadow))] hover:bg-brand-strong"
			>
				{m.sl_find_more()}
			</a>
		{/snippet}
	</PageHeader>

	{#if data.saved.total > 0 || data.saved.state.search}
		<SearchInput value={data.saved.state.search} class="sm:w-72" />
	{/if}

	{#if data.saved.rows.length === 0 && data.saved.state.search}
		<NoResults search={data.saved.state.search} />
	{:else if data.saved.rows.length === 0}
		<div class="bento-card bento-card-static space-y-3 py-16 text-center">
			<Bookmark class="mx-auto h-10 w-10 text-ink-faint" />
			<h3 class="text-base font-black text-ink">{m.sl_empty_title()}</h3>
			<p class="mx-auto max-w-sm text-xs font-medium text-ink-soft">
				{m.sl_empty_body()}
			</p>
		</div>
	{:else}
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{#each data.saved.rows as entry (entry.id)}
				<div class="bento-card bento-card-static flex flex-col justify-between gap-3">
					<div class="space-y-3">
						<div class="flex items-start justify-between gap-2">
							<div class="flex items-center gap-3">
								<AppImage
									src={entry.avatar}
									alt=""
									kind="avatar"
									seed={entry.username}
									label={entry.fullName}
									class="h-11 w-11 rounded-2xl border-2 border-edge object-cover"
									loading="lazy"
									decoding="async"
									width="44"
									height="44"
								/>
								<div class="min-w-0">
									<a
										href={resolve(`/creators/${entry.username}`)}
										class="block truncate text-sm font-black text-ink hover:text-brand-fg"
									>
										{entry.fullName}
									</a>
									<p class="truncate text-[11px] font-bold text-ink-dim">@{entry.username}</p>
								</div>
							</div>
							<form method="POST" action="?/remove" use:enhance={removeHandler}>
								<input type="hidden" name="creatorId" value={entry.creatorId} />
								<button
									type="submit"
									aria-label={m.sl_remove()}
									class="rounded-lg p-1.5 text-ink-faint hover:bg-danger-soft hover:text-danger"
								>
									<X class="h-4 w-4" />
								</button>
							</form>
						</div>

						<div class="flex flex-wrap items-center gap-1.5 text-[11px]">
							<VerificationBadge level={entry.verificationLevel} />
							<RepresentationBadge claimed={entry.isClaimed} />
							<span
								class="inline-flex items-center gap-1 rounded-lg border border-edge-mid bg-well px-2 py-0.5 font-bold text-ink"
							>
								<span>{entry.countryFlag ?? '🌍'}</span>
								{entry.countryName}
							</span>
						</div>

						<p class="line-clamp-2 text-xs font-medium text-ink-soft">{entry.bio}</p>

						<div
							class="grid grid-cols-3 gap-2 rounded-2xl border-2 border-edge bg-tile-yellow p-2.5 text-center text-xs"
						>
							<div>
								<div class="text-[9px] font-black tracking-wider text-ink-soft uppercase">
									{m.card_reach()}
								</div>
								<div class="mt-0.5 text-sm font-black text-ink">
									{formatReach(entry.totalReach)}
								</div>
							</div>
							<div>
								<div class="text-[9px] font-black tracking-wider text-ink-soft uppercase">
									{m.home_score()}
								</div>
								<div
									class="mt-0.5 flex items-center justify-center gap-0.5 text-sm font-black text-ink"
								>
									<Award class="h-3 w-3 text-brand-soft-fg" />
									{entry.score}
								</div>
							</div>
							<div>
								<div class="text-[9px] font-black tracking-wider text-ink-soft uppercase">
									{m.card_rating()}
								</div>
								<div
									class="mt-0.5 flex items-center justify-center gap-0.5 text-sm font-black text-ink"
								>
									<Star class="h-3 w-3 fill-warn text-ink" />
									{entry.averageRating.toFixed(1)}
								</div>
							</div>
						</div>
					</div>

					<div class="flex items-center justify-between border-t-2 border-edge-soft pt-3">
						<div>
							<span class="block text-[9px] font-black tracking-wider text-ink-dim uppercase">
								{m.sl_from()}
							</span>
							<span class="text-sm font-black text-ink">
								{entry.startingPrice.toLocaleString()}
								<span class="text-xs text-brand-fg">{entry.currencyCode}</span>
							</span>
						</div>
						<a
							href={resolve(`/creators/${entry.username}`)}
							class="rounded-xl border-2 border-edge bg-brand px-3 py-1.5 text-xs font-black text-brand-ink shadow-[2px_2px_0px_0px_rgb(var(--bento-shadow))] hover:bg-brand-strong"
						>
							{m.sl_book()}
						</a>
					</div>
				</div>
			{/each}
		</div>

		<PaginationBar result={data.saved} />
	{/if}
</div>
