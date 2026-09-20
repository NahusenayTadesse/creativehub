<script lang="ts">
	import AppImage from '$lib/components/app-image.svelte';
	import { creatorTransitionStyle } from '$lib/domain/view-transition';
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

	/* The second figure. Engagement is the one the reference leads with and the
	   one a brand actually buys, so it wins when we have it; a profile with no
	   live channel has no rate to show and falls back to the rating. */
	const showEngagement = $derived(creator.engagementRate > 0);

	/* Channels beyond the primary one. The card is handed ids rather than names
	   — naming them all would need the platform table — so the extras are a
	   count, which is honest at this width and costs no query. */
	const extraChannels = $derived(Math.max(0, (creator.platformIds?.length ?? 0) - 1));
</script>

<!--
	The reference card: a portrait down the left, everything else stacked beside
	it, one hairline rule above the price, and two actions on a row of their own.

	`h-full` fills the grid cell or the carousel slot, and every variable line
	holds one truncated line, so a row of cards lines up whatever a creator
	wrote. The portrait is what makes that work — it is a fixed height, and it is
	the tallest thing in the upper block.
-->
<article
	id="creator-card-{creator.id}"
	class="group flex h-full w-full flex-col rounded-[22px] border border-edge-soft bg-surface p-4 shadow-[0_20px_44px_-34px_rgb(var(--bento-shadow)_/_0.55)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_26px_54px_-32px_rgb(var(--bento-shadow)_/_0.6)]"
>
	<div class="flex gap-3.5">
		<!--
			The portrait, and the only place a control sits on top of a picture.
			Every overlay here has a solid ground behind it rather than relying on
			the photo underneath being dark.
		-->
		<div
			class="relative h-[142px] w-[104px] shrink-0 overflow-hidden rounded-2xl bg-well sm:h-[158px] sm:w-[116px]"
		>
			<!-- Paired with the same picture on the profile, so the card opens into
			     the page rather than the two cross-fading past each other. -->
			<AppImage
				src={creator.avatar}
				alt={creator.fullName}
				kind="avatar"
				seed={creator.username}
				label={creator.fullName}
				loading="lazy"
				decoding="async"
				style={creatorTransitionStyle(creator.username)}
				class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
			/>

			<div class="absolute top-2 left-2 flex flex-col items-start gap-1">
				<span
					class="inline-flex items-center gap-1 rounded-lg bg-inverse/90 px-2 py-1 text-[10px] font-black text-inverse-ink backdrop-blur-xs"
				>
					<Award class="h-3 w-3 text-inverse-brand" />
					{creator.score}
				</span>
				{#if matchScore !== undefined}
					<span class="rounded-lg bg-brand px-2 py-1 text-[10px] font-black text-brand-ink-deep">
						{m.card_match({ score: matchScore })}
					</span>
				{/if}
			</div>

			{#if onSave}
				<button
					type="button"
					onclick={() => onSave?.(creator)}
					title={saved ? m.card_remove_shortlist() : m.card_save_shortlist()}
					class="absolute top-2 right-2 cursor-pointer rounded-full p-1.5 shadow-sm transition-colors {saved
						? 'bg-danger text-danger-ink'
						: 'bg-surface/90 text-ink backdrop-blur-xs hover:bg-surface'}"
				>
					<Heart class="h-3.5 w-3.5 {saved ? 'fill-current' : ''}" />
				</button>
			{/if}

			{#if onQuickView}
				<button
					type="button"
					onclick={() => onQuickView?.(creator)}
					title={m.card_quick_view_title()}
					class="absolute inset-x-1.5 bottom-1.5 flex cursor-pointer items-center justify-center gap-1 rounded-xl bg-inverse/90 py-1.5 text-[10px] font-black text-inverse-ink backdrop-blur-xs transition-colors hover:bg-inverse"
				>
					<Eye class="h-3 w-3 text-inverse-brand" />
					<span>{m.card_quick_view()}</span>
				</button>
			{/if}
		</div>

		<!-- Everything the reference stacks beside the portrait. -->
		<div class="flex min-w-0 flex-1 flex-col">
			<div class="flex items-center gap-1.5">
				<!-- `truncate`, not `line-clamp-1`: this link is `block`, and a block
				     display overrides the box display line-clamp depends on. -->
				<a
					href={profileHref}
					title={creator.fullName}
					class="block truncate text-[15px] font-extrabold tracking-tight text-ink transition-colors group-hover:text-brand-fg"
				>
					{creator.fullName}
				</a>
				<!-- The reference puts a bare tick here. A tick that says only
				     "verified" is the one badge this product does not make (FR-091),
				     so the slot carries availability instead and the evidence that
				     was actually checked stays on the labelled badge below. -->
				<span
					class="h-2 w-2 shrink-0 rounded-full {creator.availability === 'available'
						? 'bg-brand'
						: 'bg-warn'}"
					title={creator.availability}
				></span>
			</div>

			<p class="mt-1.5 truncate text-[11px] font-bold text-ink-dim">@{creator.username}</p>

			{#if creator.categories?.[0]}
				<p class="mt-1.5 truncate text-xs font-bold text-brand-fg" title={creator.categories[0]}>
					{creator.categories[0]}
				</p>
			{/if}

			<p
				class="mt-1.5 flex min-w-0 items-center gap-1 text-[11px] font-medium text-ink-dim"
				title={creator.city ?? creator.countryName ?? undefined}
			>
				<MapPin class="h-3 w-3 shrink-0" />
				<span class="truncate">
					{creator.city ?? creator.countryName ?? ''}
				</span>
				<span class="shrink-0" aria-hidden="true">{creator.countryFlag ?? ''}</span>
			</p>

			<div class="mt-2.5 flex flex-wrap items-center gap-1.5">
				{#if creator.platformName}
					<span class="rounded-md bg-well px-2 py-1 text-[10px] font-black text-ink-soft">
						{creator.platformName}
					</span>
				{/if}
				{#if extraChannels > 0}
					<span class="rounded-md bg-well px-2 py-1 text-[10px] font-black text-ink-dim">
						+{extraChannels}
					</span>
				{/if}
			</div>

			<div class="mt-3 flex gap-4">
				<div>
					<p class="text-[17px] leading-none font-extrabold tracking-tight text-ink">
						{formatReach(creator.totalReach)}
					</p>
					<p class="mt-1.5 text-[10px] font-medium text-ink-dim">{m.profile_followers()}</p>
				</div>
				<div>
					{#if showEngagement}
						<p class="text-[17px] leading-none font-extrabold tracking-tight text-brand-fg">
							{creator.engagementRate}%
						</p>
						<p class="mt-1.5 text-[10px] font-medium text-ink-dim">{m.profile_engagement()}</p>
					{:else}
						<p
							class="flex items-center gap-0.5 text-[17px] leading-none font-extrabold tracking-tight text-ink"
						>
							<Star class="h-3.5 w-3.5 fill-warn text-warn" />
							{creator.averageRating.toFixed(1)}
						</p>
						<p class="mt-1.5 text-[10px] font-medium text-ink-dim">{m.card_rating()}</p>
					{/if}
				</div>
			</div>
		</div>
	</div>

	<!--
		The price row. `mt-auto` rather than a fixed offset, so the rule and the
		actions sit at the foot of the tallest card in the row instead of leaving
		a short card's buttons floating halfway up it.
	-->
	<div class="mt-auto flex items-end justify-between gap-2 border-t border-edge-soft pt-3.5">
		<div class="min-w-0">
			<p class="text-[10px] font-medium tracking-wide whitespace-nowrap text-ink-dim">
				{m.starting_from()}
			</p>
			<p class="mt-1.5 text-sm font-extrabold whitespace-nowrap text-ink">
				{creator.startingPrice.toLocaleString()}
				<span class="text-xs font-bold text-ink-dim">{creator.currencyCode}</span>
			</p>
		</div>
		<div class="flex shrink-0 flex-col items-end gap-1">
			<VerificationBadge level={creator.verificationLevel} />
			<RepresentationBadge claimed={creator.isClaimed} />
		</div>
	</div>

	<div class="mt-3 grid grid-cols-2 gap-2">
		<a
			href={profileHref}
			class="cursor-pointer rounded-xl bg-well px-2 py-3 text-center text-xs font-bold text-ink transition-colors hover:bg-edge-soft"
		>
			{m.view_profile()}
		</a>
		{#if onBook}
			<button
				type="button"
				onclick={() => onBook?.(creator)}
				class="cursor-pointer rounded-xl bg-brand px-2 py-3 text-center text-xs font-black text-brand-ink transition-colors hover:bg-brand-strong"
			>
				{m.book_creator()}
			</button>
		{:else}
			<a
				href="{profileHref}#packages"
				class="cursor-pointer rounded-xl bg-brand px-2 py-3 text-center text-xs font-black text-brand-ink transition-colors hover:bg-brand-strong"
			>
				{m.book_creator()}
			</a>
		{/if}
	</div>
</article>
