<script lang="ts">
	import AppImage from '$lib/components/app-image.svelte';
	import type { CreatorCard } from '$lib/server/queries';
	import { resolve } from '$app/paths';
	import * as m from '$lib/paraglide/messages';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Star, MapPin, Award, ArrowRight } from '@lucide/svelte';
	import VerificationBadge from './verification-badge.svelte';
	import RepresentationBadge from './representation-badge.svelte';
	import { formatReach } from '$lib/domain/money';

	let { creator = null, onClose }: { creator: CreatorCard | null; onClose: () => void } = $props();

	const open = $derived(creator !== null);
</script>

<Dialog.Root
	{open}
	onOpenChange={(next) => {
		if (!next) onClose();
	}}
>
	<Dialog.Content
		class="max-h-[88dvh] w-lg! max-w-[95vw]! overflow-x-hidden overflow-y-auto overscroll-contain p-0!"
	>
		{#if creator}
			<div class="relative h-28 border-b-2 border-edge bg-well">
				<AppImage
					src={creator.cover}
					alt=""
					kind="cover"
					seed={creator.username}
					class="h-full w-full object-cover"
					loading="lazy"
					decoding="async"
				/>
				<div class="absolute inset-0 bg-gradient-to-t from-slate-950/70 to-transparent"></div>
				<div
					class="absolute top-2.5 left-2.5 flex items-center gap-1 rounded-xl border border-edge bg-inverse px-2.5 py-1 text-[11px] font-black text-inverse-ink shadow-[2px_2px_0px_0px_rgb(var(--bento-shadow-accent))]"
				>
					<Award class="h-3.5 w-3.5 text-inverse-brand" />
					<span>{m.card_score({ score: creator.score })}</span>
				</div>
			</div>

			<div class="space-y-4 p-6 pt-4">
				<div class="flex items-start gap-3">
					<AppImage
						src={creator.avatar}
						alt={creator.fullName}
						kind="avatar"
						seed={creator.username}
						label={creator.fullName}
						class="-mt-10 h-16 w-16 rounded-2xl border-2 border-edge object-cover shadow-[2px_2px_0px_0px_rgb(var(--bento-shadow))]"
						loading="lazy"
						decoding="async"
						width="64"
						height="64"
					/>
					<div class="min-w-0 flex-1">
						<Dialog.Title class="text-lg font-black text-ink">
							{creator.fullName}
						</Dialog.Title>
						<p class="text-xs font-bold text-ink-dim">@{creator.username}</p>
					</div>
					<div class="flex shrink-0 flex-col items-end gap-1">
						<VerificationBadge level={creator.verificationLevel} />
						<RepresentationBadge claimed={creator.isClaimed} />
					</div>
				</div>

				<div class="flex flex-wrap items-center gap-2 text-xs">
					<span
						class="inline-flex items-center gap-1 rounded-lg border border-edge-mid bg-well px-2 py-0.5 text-[11px] font-bold text-ink"
					>
						<span>{creator.countryFlag ?? '🌍'}</span>
						<span>{creator.countryName}</span>
					</span>
					{#if creator.city}
						<span class="flex items-center gap-1 text-[11px] font-medium text-ink-dim">
							<MapPin class="h-3 w-3 text-brand-fg" />
							{creator.city}
						</span>
					{/if}
				</div>

				<p class="text-xs leading-relaxed font-medium text-ink-soft">{creator.bio}</p>

				<div
					class="grid grid-cols-4 gap-2 rounded-2xl border-2 border-edge bg-tile-yellow p-3 text-center text-xs shadow-[2px_2px_0px_0px_rgb(var(--bento-shadow))]"
				>
					<div>
						<div class="text-[9px] font-black tracking-wider text-ink-soft uppercase">
							{m.card_reach()}
						</div>
						<div class="mt-0.5 text-sm font-black text-ink">
							{formatReach(creator.totalReach)}
						</div>
					</div>
					<div>
						<div class="text-[9px] font-black tracking-wider text-ink-soft uppercase">
							{m.quick_engage()}
						</div>
						<div class="mt-0.5 text-sm font-black text-ink">
							{creator.engagementRate?.toFixed(1) ?? '—'}%
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
							{creator.averageRating?.toFixed(1)}
						</div>
					</div>
					<div>
						<div class="text-[9px] font-black tracking-wider text-ink-soft uppercase">
							{m.quick_done()}
						</div>
						<div class="mt-0.5 text-sm font-black text-ink">{creator.completedBookings}</div>
					</div>
				</div>

				{#if creator.categories?.length}
					<div class="flex flex-wrap gap-1.5">
						{#each creator.categories as category (category)}
							<span
								class="rounded-md border border-edge bg-tile-indigo px-2 py-0.5 text-[10px] font-black tracking-wider text-ink uppercase"
							>
								{category}
							</span>
						{/each}
					</div>
				{/if}

				<div class="flex items-center justify-between gap-3 border-t-2 border-edge pt-4">
					<div>
						<span class="block text-[9px] font-black tracking-wider text-ink-dim uppercase">
							{m.starting_from()}
						</span>
						<span class="text-sm font-black text-ink">
							{creator.startingPrice?.toLocaleString()}
							<span class="text-xs font-black text-brand-fg">{creator.currencyCode}</span>
						</span>
					</div>
					<a
						href={resolve(`/creators/${creator.username}`)}
						class="flex items-center gap-1.5 rounded-xl border-2 border-edge bg-brand px-4 py-2 text-xs font-black text-brand-ink shadow-[2px_2px_0px_0px_rgb(var(--bento-shadow))] hover:bg-brand-strong"
					>
						<span>{m.quick_full_profile()}</span>
						<ArrowRight class="h-3.5 w-3.5" />
					</a>
				</div>
			</div>
		{/if}
	</Dialog.Content>
</Dialog.Root>
