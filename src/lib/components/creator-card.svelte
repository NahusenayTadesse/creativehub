<script lang="ts">
	import AppImage from '$lib/components/app-image.svelte';
	import * as m from '$lib/paraglide/messages';
	import { MapPin, Star, Heart, Award, Eye } from '@lucide/svelte';
	import { formatReach } from '$lib/domain/money';
	import VerificationBadge from './verification-badge.svelte';
	import RepresentationBadge from './representation-badge.svelte';
	import type { CreatorCard } from '$lib/server/queries';
	import { resolve } from '$app/paths';

	let {
		creator,
		matchScore = undefined,
		saved = false,
		onQuickView = undefined,
		onSave = undefined,
		onBook = undefined
	}: {
		creator: CreatorCard;
		matchScore?: number;
		saved?: boolean;
		onQuickView?: (creator: CreatorCard) => void;
		onSave?: (creator: CreatorCard) => void;
		onBook?: (creator: CreatorCard) => void;
	} = $props();

	const profileHref = $derived(resolve(`/creators/${creator.username}`));
</script>

<div
	id="creator-card-{creator.id}"
	class="group flex flex-col justify-between overflow-hidden rounded-3xl border-2 border-edge bg-surface shadow-[4px_4px_0px_0px_rgb(var(--bento-shadow))] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[6px_6px_0px_0px_rgb(var(--bento-shadow))]"
>
	<div>
		<!-- Cover with score, save and quick-view controls -->
		<div class="relative h-28 border-b-2 border-edge bg-well">
			<AppImage
				src={creator.cover}
				alt=""
				kind="cover"
				seed={creator.username}
				loading="lazy"
				class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
				decoding="async"
			/>
			<div
				class="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-black/20"
			></div>

			{#if onSave}
				<button
					type="button"
					onclick={() => onSave?.(creator)}
					title={saved ? m.card_remove_shortlist() : m.card_save_shortlist()}
					class="absolute top-2.5 right-2.5 rounded-xl border-2 border-edge p-2 shadow-[2px_2px_0px_0px_rgb(var(--bento-shadow))] transition-colors {saved
						? 'bg-danger text-danger-ink'
						: 'bg-surface text-ink hover:bg-well'}"
				>
					<Heart class="h-3.5 w-3.5 {saved ? 'fill-current' : ''}" />
				</button>
			{/if}

			<div class="absolute top-2.5 left-2.5 flex items-center gap-1.5">
				<div
					class="flex items-center gap-1 rounded-xl border border-edge bg-inverse px-2.5 py-1 text-[11px] font-black text-inverse-ink shadow-[2px_2px_0px_0px_rgb(var(--bento-shadow-accent))]"
				>
					<Award class="h-3.5 w-3.5 text-inverse-brand" />
					<span>{m.card_score({ score: creator.score })}</span>
				</div>
				{#if matchScore !== undefined}
					<div
						class="flex items-center gap-1 rounded-xl border border-edge bg-brand px-2 py-1 text-[11px] font-black text-brand-ink-deep shadow-[2px_2px_0px_0px_rgb(var(--bento-shadow))]"
					>
						<span>{m.card_match({ score: matchScore })}</span>
					</div>
				{/if}
			</div>

			{#if onQuickView}
				<button
					type="button"
					onclick={() => onQuickView?.(creator)}
					title={m.card_quick_view_title()}
					class="absolute right-2.5 bottom-2.5 flex cursor-pointer items-center gap-1 rounded-xl border border-edge-mid bg-slate-900/90 px-2.5 py-1 text-[10px] font-black text-inverse-ink shadow-md backdrop-blur-xs transition-all hover:scale-105 hover:bg-inverse"
				>
					<Eye class="h-3 w-3 text-emerald-400" />
					<span>{m.card_quick_view()}</span>
				</button>
			{/if}

			<div class="absolute -bottom-5 left-4">
				<div class="relative">
					<AppImage
						src={creator.avatar}
						alt={creator.fullName}
						kind="avatar"
						seed={creator.username}
						label={creator.fullName}
						loading="lazy"
						class="h-14 w-14 rounded-2xl border-2 border-edge object-cover shadow-[2px_2px_0px_0px_rgb(var(--bento-shadow))]"
						decoding="async"
						width="56"
						height="56"
					/>
					<span
						class="absolute right-0 bottom-0 h-4 w-4 rounded-full border-2 border-edge {creator.availability ===
						'available'
							? 'bg-brand'
							: 'bg-warn'}"
					></span>
				</div>
			</div>
		</div>

		<!-- Body -->
		<div class="px-4 pt-7 pb-4">
			<div class="mb-1 flex items-start justify-between gap-2">
				<div class="min-w-0">
					<a
						href={profileHref}
						class="line-clamp-1 block text-base font-black text-ink transition-colors group-hover:text-brand-fg"
					>
						{creator.fullName}
					</a>
					<p class="text-xs font-bold text-ink-dim">@{creator.username}</p>
				</div>
				<div class="flex shrink-0 flex-col items-end gap-1">
					<VerificationBadge level={creator.verificationLevel} />
					<RepresentationBadge claimed={creator.isClaimed} />
				</div>
			</div>

			<div class="mt-2 mb-3 flex flex-wrap items-center gap-1.5 text-xs text-ink-soft">
				<span
					class="inline-flex items-center gap-1 rounded-lg border border-edge-mid bg-well px-2 py-0.5 text-[11px] font-bold text-ink"
				>
					<span class="text-sm">{creator.countryFlag ?? '🌍'}</span>
					<span>{creator.countryName ?? 'Ethiopia'}</span>
				</span>
				{#if creator.city}
					<span class="flex items-center gap-1 text-[11px] font-medium text-ink-dim">
						<MapPin class="h-3 w-3 shrink-0 text-brand-fg" />
						{creator.city}
					</span>
				{/if}
				{#if creator.categories?.[0]}
					<span>•</span>
					<span
						class="truncate rounded-md border border-edge bg-tile-indigo px-2 py-0.5 text-[10px] font-black tracking-wider text-ink uppercase"
					>
						{creator.categories[0]}
					</span>
				{/if}
			</div>

			<p class="mb-4 line-clamp-2 text-xs leading-relaxed font-medium text-ink-soft">
				{creator.bio}
			</p>

			<!-- Stats strip -->
			<div
				class="mb-4 grid grid-cols-3 gap-2 rounded-2xl border-2 border-edge bg-tile-yellow p-2.5 text-center text-xs shadow-[2px_2px_0px_0px_rgb(var(--bento-shadow))]"
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
						{m.card_platform()}
					</div>
					<div class="mt-0.5 text-xs font-black text-brand-soft-fg">
						{creator.platformName ?? '—'}
					</div>
				</div>
				<div>
					<div class="text-[9px] font-black tracking-wider text-ink-soft uppercase">
						{m.card_rating()}
					</div>
					<div class="mt-0.5 flex items-center justify-center gap-0.5 text-xs font-black text-ink">
						<Star class="h-3.5 w-3.5 fill-warn text-ink" />
						<span>{creator.averageRating.toFixed(1)}</span>
					</div>
				</div>
			</div>
		</div>
	</div>

	<!--
		Footer. The price sits above the actions on a phone and beside them from
		`sm`: sharing one row at 358px, the button cluster squeezed "starting from
		11,000 ETB" into three wrapped lines.
	-->
	<div
		class="flex flex-col gap-3 border-t-2 border-edge bg-panel px-4 pt-3 pb-4 sm:flex-row sm:items-center sm:justify-between sm:gap-2"
	>
		<div>
			<span class="block text-[9px] font-black tracking-wider text-ink-dim uppercase">
				{m.starting_from()}
			</span>
			<span class="text-sm font-black whitespace-nowrap text-ink">
				{creator.startingPrice.toLocaleString()}
				<span class="text-xs font-black text-brand-fg">{creator.currencyCode}</span>
			</span>
		</div>

		<div class="flex flex-wrap items-center gap-1.5 sm:justify-end">
			{#if onQuickView}
				<!--
					Hidden on a phone, where the cover carries the same control: three
					buttons wrapped two-and-one and left "book" — the action the card
					exists for — stranded on its own line.
				-->
				<button
					type="button"
					onclick={() => onQuickView?.(creator)}
					class="hidden cursor-pointer items-center gap-1 rounded-xl border-2 border-edge bg-warn-soft px-2.5 py-1.5 text-xs font-black text-ink shadow-[2px_2px_0px_0px_rgb(var(--bento-shadow))] transition-colors hover:bg-warn-soft sm:flex"
				>
					<Eye class="h-3.5 w-3.5 text-ink" />
					<span>{m.card_quick_view()}</span>
				</button>
			{/if}
			<a
				href={profileHref}
				class="cursor-pointer rounded-xl border-2 border-edge bg-surface px-2.5 py-1.5 text-xs font-black text-ink shadow-[2px_2px_0px_0px_rgb(var(--bento-shadow))] transition-colors hover:bg-well"
			>
				{m.view_profile()}
			</a>
			{#if onBook}
				<button
					type="button"
					onclick={() => onBook?.(creator)}
					class="cursor-pointer rounded-xl border-2 border-edge bg-brand px-2.5 py-1.5 text-xs font-black text-brand-ink shadow-[2px_2px_0px_0px_rgb(var(--bento-shadow))] transition-colors hover:bg-brand-strong"
				>
					{m.book_creator()}
				</button>
			{:else}
				<a
					href="{profileHref}#packages"
					class="cursor-pointer rounded-xl border-2 border-edge bg-brand px-2.5 py-1.5 text-xs font-black text-brand-ink shadow-[2px_2px_0px_0px_rgb(var(--bento-shadow))] transition-colors hover:bg-brand-strong"
				>
					{m.book_creator()}
				</a>
			{/if}
		</div>
	</div>
</div>
