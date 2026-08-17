<script lang="ts">
	import { MapPin, Star, Heart, Award, Eye } from '@lucide/svelte';
	import { formatReach } from '$lib/domain/money';
	import VerificationBadge from './verification-badge.svelte';
	import type { CreatorCard } from '$lib/server/queries';

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

	const profileHref = $derived(`/creators/${creator.username}`);
</script>

<div
	id="creator-card-{creator.id}"
	class="group flex flex-col justify-between overflow-hidden rounded-3xl border-2 border-slate-900 bg-white shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[6px_6px_0px_0px_rgba(15,23,42,1)]"
>
	<div>
		<!-- Cover with score, save and quick-view controls -->
		<div class="relative h-28 border-b-2 border-slate-900 bg-slate-100">
			{#if creator.cover}
				<img
					src={creator.cover}
					alt=""
					loading="lazy"
					class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
				/>
			{/if}
			<div
				class="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-black/20"
			></div>

			{#if onSave}
				<button
					type="button"
					onclick={() => onSave?.(creator)}
					title={saved ? 'Remove from shortlist' : 'Save to shortlist'}
					class="absolute top-2.5 right-2.5 rounded-xl border-2 border-slate-900 p-2 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] transition-colors {saved
						? 'bg-red-500 text-white'
						: 'bg-white text-slate-900 hover:bg-slate-100'}"
				>
					<Heart class="h-3.5 w-3.5 {saved ? 'fill-white' : ''}" />
				</button>
			{/if}

			<div class="absolute top-2.5 left-2.5 flex items-center gap-1.5">
				<div
					class="flex items-center gap-1 rounded-xl border border-slate-900 bg-slate-900 px-2.5 py-1 text-[11px] font-black text-white shadow-[2px_2px_0px_0px_rgba(16,185,129,1)]"
				>
					<Award class="h-3.5 w-3.5 text-emerald-400" />
					<span>Score {creator.score}</span>
				</div>
				{#if matchScore !== undefined}
					<div
						class="flex items-center gap-1 rounded-xl border border-slate-900 bg-emerald-500 px-2 py-1 text-[11px] font-black text-slate-950 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]"
					>
						<span>✨ {matchScore}% Match</span>
					</div>
				{/if}
			</div>

			{#if onQuickView}
				<button
					type="button"
					onclick={() => onQuickView?.(creator)}
					title="Quick view portfolio and packages"
					class="absolute right-2.5 bottom-2.5 flex cursor-pointer items-center gap-1 rounded-xl border border-slate-700 bg-slate-900/90 px-2.5 py-1 text-[10px] font-black text-white shadow-md backdrop-blur-xs transition-all hover:scale-105 hover:bg-slate-900"
				>
					<Eye class="h-3 w-3 text-emerald-400" />
					<span>Quick View</span>
				</button>
			{/if}

			<div class="absolute -bottom-5 left-4">
				<div class="relative">
					<img
						src={creator.avatar ?? ''}
						alt={creator.fullName}
						loading="lazy"
						class="h-14 w-14 rounded-2xl border-2 border-slate-900 object-cover shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]"
					/>
					<span
						class="absolute right-0 bottom-0 h-4 w-4 rounded-full border-2 border-slate-900 {creator.availability ===
						'available'
							? 'bg-emerald-500'
							: 'bg-amber-500'}"
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
						class="line-clamp-1 block text-base font-black text-slate-900 transition-colors group-hover:text-emerald-600"
					>
						{creator.fullName}
					</a>
					<p class="text-xs font-bold text-slate-500">@{creator.username}</p>
				</div>
				<VerificationBadge level={creator.verificationLevel} />
			</div>

			<div class="mt-2 mb-3 flex flex-wrap items-center gap-1.5 text-xs text-slate-600">
				<span
					class="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-800"
				>
					<span class="text-sm">{creator.countryFlag ?? '🌍'}</span>
					<span>{creator.countryName ?? 'Ethiopia'}</span>
				</span>
				{#if creator.city}
					<span class="flex items-center gap-1 text-[11px] font-medium text-slate-500">
						<MapPin class="h-3 w-3 shrink-0 text-emerald-600" />
						{creator.city}
					</span>
				{/if}
				{#if creator.categories?.[0]}
					<span>•</span>
					<span
						class="truncate rounded-md border border-slate-900 bg-[#e0e7ff] px-2 py-0.5 text-[10px] font-black tracking-wider text-slate-900 uppercase"
					>
						{creator.categories[0]}
					</span>
				{/if}
			</div>

			<p class="mb-4 line-clamp-2 text-xs leading-relaxed font-medium text-slate-600">
				{creator.bio}
			</p>

			<!-- Stats strip -->
			<div
				class="mb-4 grid grid-cols-3 gap-2 rounded-2xl border-2 border-slate-900 bg-[#fef9c3] p-2.5 text-center text-xs shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]"
			>
				<div>
					<div class="text-[9px] font-black tracking-wider text-slate-600 uppercase">Reach</div>
					<div class="mt-0.5 text-sm font-black text-slate-900">
						{formatReach(creator.totalReach)}
					</div>
				</div>
				<div>
					<div class="text-[9px] font-black tracking-wider text-slate-600 uppercase">Platform</div>
					<div class="mt-0.5 text-xs font-black text-emerald-800">
						{creator.platformName ?? '—'}
					</div>
				</div>
				<div>
					<div class="text-[9px] font-black tracking-wider text-slate-600 uppercase">Rating</div>
					<div class="mt-0.5 flex items-center justify-center gap-0.5 text-xs font-black text-slate-900">
						<Star class="h-3.5 w-3.5 fill-amber-400 text-slate-900" />
						<span>{creator.averageRating.toFixed(1)}</span>
					</div>
				</div>
			</div>
		</div>
	</div>

	<!-- Footer -->
	<div
		class="flex items-center justify-between gap-2 border-t-2 border-slate-900 bg-slate-50 px-4 pt-3 pb-4"
	>
		<div>
			<span class="block text-[9px] font-black tracking-wider text-slate-500 uppercase">
				Starting from
			</span>
			<span class="text-sm font-black text-slate-900">
				{creator.startingPrice.toLocaleString()}
				<span class="text-xs font-black text-emerald-600">{creator.currencyCode}</span>
			</span>
		</div>

		<div class="flex flex-wrap items-center justify-end gap-1.5">
			{#if onQuickView}
				<button
					type="button"
					onclick={() => onQuickView?.(creator)}
					class="flex cursor-pointer items-center gap-1 rounded-xl border-2 border-slate-900 bg-amber-100 px-2.5 py-1.5 text-xs font-black text-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] transition-colors hover:bg-amber-200"
				>
					<Eye class="h-3.5 w-3.5 text-slate-900" />
					<span>Quick View</span>
				</button>
			{/if}
			<a
				href={profileHref}
				class="cursor-pointer rounded-xl border-2 border-slate-900 bg-white px-2.5 py-1.5 text-xs font-black text-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] transition-colors hover:bg-slate-100"
			>
				View Profile
			</a>
			{#if onBook}
				<button
					type="button"
					onclick={() => onBook?.(creator)}
					class="cursor-pointer rounded-xl border-2 border-slate-900 bg-emerald-600 px-2.5 py-1.5 text-xs font-black text-white shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] transition-colors hover:bg-emerald-700"
				>
					Book Creator
				</button>
			{:else}
				<a
					href="{profileHref}#packages"
					class="cursor-pointer rounded-xl border-2 border-slate-900 bg-emerald-600 px-2.5 py-1.5 text-xs font-black text-white shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] transition-colors hover:bg-emerald-700"
				>
					Book Creator
				</a>
			{/if}
		</div>
	</div>
</div>
