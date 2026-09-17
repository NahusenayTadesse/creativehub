<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import type { ResolvedPathname } from '$app/types';
	import { ArrowRight, BarChart3, ChevronRight, MapPin, Search, ShieldCheck } from '@lucide/svelte';
	import AppImage from '$lib/components/app-image.svelte';
	import PlatformGlyph from '$lib/components/platform-glyph.svelte';
	import InputComp from '$lib/formComponents/InputComp.svelte';
	import { formatReach } from '$lib/domain/money';
	import * as m from '$lib/paraglide/messages';

	/**
	 * The top of the homepage.
	 *
	 * Left, the pitch on the inverse tile: headline, search, the two ways in, and
	 * the platform's live figures. Right, the platform itself — a photograph with
	 * real creators pinned over it — and, when an operator has added any, the
	 * partners. Both halves are drawn in the bento vocabulary the rest of the
	 * site uses: a hard 2px edge and a solid offset shadow, never a blur.
	 *
	 * Every figure and every face is read from the database.
	 */

	type Creator = {
		id: number;
		username: string;
		fullName: string;
		avatar: string | null;
		city: string | null;
		countryName: string | null;
		totalReach: number;
		engagementRate: number;
		platformName: string | null;
		categories: string[];
	};

	let {
		headline,
		subtitle,
		image = '',
		creators = [],
		partners = [],
		stats
	}: {
		headline: { title: string; accent: string; end: string };
		subtitle: string;
		/** The operator's hero picture. The shipped photograph when unset. */
		image?: string;
		/** In the order they should fill the collage; the first three are drawn. */
		creators?: Creator[];
		/** Operator-managed logos, from /dashboard/admin/partners. None, no tile. */
		partners?: { id: number; name: string; logo: string; websiteUrl: string | null }[];
		stats: { creators: number; totalReach: number; campaigns: number };
	} = $props();

	/* ---------------- The pitch ---------------- */

	let query = $state('');

	/* Resolved once, then given its query string — appending to a resolved path
	   keeps it resolved, which is what `goto` needs to be handed. */
	const searchHref = $derived(
		`${resolve('/discover')}${query ? `?q=${encodeURIComponent(query)}` : ''}` as ResolvedPathname
	);

	/* ---------------- The collage ---------------- */

	/* The figure from the design mockup in front of Addis Ababa's skyline. Its
	   sources and licence are in assets-src/landing/CREDITS.md. */
	const picture = $derived(image || '/hero/creator-camera.webp');
	const collage = $derived(creators.slice(0, 3));

	const platformColor = (name: string | null) =>
		page.data.reference?.platforms?.find((platform: { name: string }) => platform.name === name)
			?.color ?? '';

	/* The location chip goes to discovery narrowed to the home market. By id,
	   because that is the filter discovery reads; found by ISO code, because ids
	   differ between installs. */
	const homeMarketHref = $derived.by(() => {
		const ethiopia = page.data.reference?.countries?.find(
			(country: { code: string }) => country.code === 'ET'
		);
		const discover = resolve('/discover');
		return (ethiopia ? `${discover}?country=${ethiopia.id}` : discover) as ResolvedPathname;
	});

	/*
	 * Three corners of the picture, leaving the top right clear: that is where
	 * the face is in the shipped photograph, and a collage that covers its own
	 * subject is just a stack of cards. The middle slot waits for `sm` — on a
	 * phone two cards over one picture is already the most it holds.
	 */
	const slots = [
		'left-0 top-0 w-[42%] sm:w-[32%]',
		'left-0 bottom-14 hidden w-[32%] sm:block',
		'right-0 bottom-2 w-[42%] sm:w-[32%]'
	];

	const hardShadow = 'shadow-[3px_3px_0px_0px_rgb(var(--bento-shadow))]';
</script>

<section class="mx-auto max-w-7xl px-4 pt-5 sm:px-6 sm:pt-6 lg:px-8">
	<div class="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-12">
		<!--
			`min-h` only from `sm`. On a 390px phone the content is taller than
			460px anyway, so the floor did nothing but risk dead space on the
			short viewports where it would have bitten.
		-->
		<div
			class="relative flex flex-col justify-between overflow-hidden rounded-3xl border-2 border-edge bg-inverse p-5 text-inverse-ink shadow-[6px_6px_0px_0px_rgb(var(--bento-shadow))] sm:min-h-[460px] sm:p-10 lg:col-span-7"
		>
			<div class="relative z-10 space-y-5 sm:space-y-6">
				<div
					class="inline-flex items-center gap-2 rounded-full border-2 border-edge bg-tile-mint px-4 py-1.5 text-xs font-black tracking-wider text-ink uppercase shadow-[2px_2px_0px_0px_rgb(var(--bento-shadow))]"
				>
					<ShieldCheck class="h-4 w-4 text-brand-soft-fg" />
					<span>{m.home_badge_marketplace()}</span>
				</div>

				<h1 class="text-3xl leading-[1.1] font-black tracking-tight sm:text-5xl">
					{headline.title}
					{#if headline.accent}
						<br />
						<span class="text-brand-gradient">{headline.accent}</span>
					{/if}
					{#if headline.end}
						<br />
						{headline.end}
					{/if}
				</h1>

				<p class="max-w-xl text-sm leading-relaxed font-medium text-inverse-ink-dim sm:text-base">
					{subtitle}
				</p>

				<form
					onsubmit={(e) => {
						e.preventDefault();
						goto(searchHref);
					}}
					class="flex flex-col items-center gap-2 rounded-2xl border-2 border-edge bg-surface p-2 shadow-[4px_4px_0px_0px_rgb(var(--bento-shadow))] sm:flex-row"
				>
					<div class="flex w-full items-center gap-2 px-3 text-ink">
						<Search class="h-5 w-5 shrink-0 text-brand-fg" />
						<InputComp
							name="q"
							label={m.search_placeholder()}
							labelHidden
							placeholder={m.search_placeholder()}
							bind:value={query}
							className="border-none bg-transparent shadow-none focus-visible:ring-0"
						/>
					</div>
					<button
						type="submit"
						class="w-full shrink-0 rounded-xl border-2 border-edge bg-brand px-6 py-3 text-xs font-black text-brand-ink shadow-[2px_2px_0px_0px_rgb(var(--bento-shadow))] transition-colors hover:bg-brand-strong sm:w-auto"
					>
						{m.nav_discover()}
					</button>
				</form>

				<!--
					Stacked to one width on a phone. Wrapped, the two sat on separate
					lines at whatever width their own labels happened to be, which
					read as a mistake rather than as a pair of choices.
				-->
				<div class="grid grid-cols-1 gap-2 pt-2 sm:flex sm:flex-wrap sm:items-center sm:gap-3">
					<a
						href={resolve('/campaigns')}
						class="flex items-center justify-center gap-1.5 rounded-xl border-2 border-edge bg-surface px-5 py-3 text-xs font-black text-ink shadow-[2px_2px_0px_0px_rgb(var(--bento-shadow))] transition-all hover:bg-well sm:py-2.5"
					>
						<span>{m.home_cta_view_briefs()}</span>
						<ArrowRight class="h-4 w-4" />
					</a>
					<a
						href={resolve('/register')}
						class="flex items-center justify-center gap-2 rounded-xl border-2 border-edge bg-tile-yellow px-5 py-3 text-xs font-black text-ink shadow-[2px_2px_0px_0px_rgb(var(--bento-shadow))] transition-all hover:shadow-[3px_3px_0px_0px_rgb(var(--bento-shadow))] sm:py-2.5"
					>
						<span>{m.home_cta_create_account()}</span>
					</a>
				</div>
			</div>

			<!-- Live figures, read from the database rather than written into the page -->
			<div
				class="relative z-10 mt-6 grid grid-cols-3 gap-2 border-t-2 border-edge pt-5 text-xs sm:gap-4 sm:pt-6"
			>
				<div>
					<div class="text-xl font-black text-inverse-ink sm:text-2xl">{stats.creators}</div>
					<div class="text-[10px] font-bold tracking-wider text-inverse-ink-dim uppercase">
						{m.home_stat_published_creators()}
					</div>
				</div>
				<div>
					<div class="text-xl font-black text-inverse-brand sm:text-2xl">
						{formatReach(stats.totalReach)}
					</div>
					<div class="text-[10px] font-bold tracking-wider text-inverse-ink-dim uppercase">
						{m.home_stat_combined_reach()}
					</div>
				</div>
				<div>
					<div class="text-xl font-black text-inverse-ink sm:text-2xl">{stats.campaigns}</div>
					<div class="text-[10px] font-bold tracking-wider text-inverse-ink-dim uppercase">
						{m.home_stat_live_campaigns()}
					</div>
				</div>
			</div>
		</div>

		<!-- ---------------- The platform, pictured ---------------- -->
		<div class="flex flex-col gap-4 sm:gap-6 lg:col-span-5">
			<div
				class="relative h-[400px] sm:h-[480px] lg:h-auto lg:min-h-[470px] lg:flex-1"
				role="group"
				aria-label={m.home_hero_collage_label()}
			>
				<!-- The photograph, inset so the cards can overhang its edges. -->
				<div
					class="absolute inset-y-5 right-[4%] left-[12%] overflow-hidden rounded-3xl border-2 border-edge bg-inverse shadow-[6px_6px_0px_0px_rgb(var(--bento-shadow))]"
				>
					<AppImage
						src={picture}
						alt=""
						kind="cover"
						seed="hero"
						loading="eager"
						class="h-full w-full object-cover"
					/>
				</div>

				<!-- Creators, each a link to their profile. -->
				{#each collage as creator, index (creator.id)}
					<a
						href={resolve(`/creators/${creator.username}`)}
						class="absolute {slots[
							index
						]} max-w-[190px] rounded-2xl border-2 border-edge bg-surface p-1.5 {hardShadow} transition-all hover:-translate-y-0.5 hover:shadow-[5px_5px_0px_0px_rgb(var(--bento-shadow))] focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
					>
						<AppImage
							src={creator.avatar}
							alt={creator.fullName}
							kind="avatar"
							seed={creator.username}
							label={creator.fullName}
							class="aspect-[16/11] w-full rounded-xl border-2 border-edge object-cover"
							loading="eager"
						/>
						<div class="px-1 pt-2 pb-0.5">
							<p class="truncate text-[11px] font-black text-ink">
								{creator.categories[0]
									? m.home_hero_card_role({ category: creator.categories[0] })
									: creator.fullName}
							</p>
							{#if creator.city || creator.countryName}
								<p
									class="mt-0.5 flex items-center gap-1 truncate text-[10px] font-bold text-ink-dim"
								>
									<MapPin class="h-2.5 w-2.5 shrink-0" />
									<span class="truncate">{creator.city || creator.countryName}</span>
								</p>
							{/if}
							<div class="mt-1.5 flex items-end justify-between gap-2">
								<div class="min-w-0">
									{#if index === 1 && creator.engagementRate > 0}
										<p class="text-sm leading-none font-black text-ink">
											{creator.engagementRate}%
										</p>
										<p class="mt-1 text-[9px] font-black tracking-wider text-ink-dim uppercase">
											{m.home_hero_engagement()}
										</p>
									{:else}
										<p class="text-sm leading-none font-black text-ink">
											{formatReach(creator.totalReach)}
										</p>
										<p class="mt-1 text-[9px] font-black tracking-wider text-ink-dim uppercase">
											{m.home_hero_followers()}
										</p>
									{/if}
								</div>
								<PlatformGlyph
									name={creator.platformName}
									color={platformColor(creator.platformName)}
									class="size-5"
								/>
							</div>
						</div>
					</a>
				{/each}

				<!-- The home market, pinned to the top of the picture. -->
				<a
					href={homeMarketHref}
					aria-label={m.home_hero_location_label()}
					class="absolute top-2 left-1/2 hidden -translate-x-1/2 items-center gap-1.5 rounded-full border-2 border-edge bg-inverse px-3 py-1.5 text-[11px] font-black whitespace-nowrap text-inverse-ink {hardShadow} transition-colors hover:bg-inverse-hover sm:flex"
				>
					<MapPin class="h-3.5 w-3.5 text-inverse-brand" />
					{m.home_hero_location_city()}
					<ChevronRight class="h-3.5 w-3.5 text-inverse-ink-dim" />
				</a>

				<!-- The platform's combined reach, on the mint tile the site uses for
				     a settled, positive figure. Bottom left on a phone, where the
				     hidden middle card leaves room; centred from `sm`. -->
				{#if stats.totalReach}
					<div
						class="absolute bottom-0 left-2 flex items-center gap-2.5 rounded-2xl border-2 border-edge bg-tile-mint px-3 py-2 whitespace-nowrap sm:left-1/2 sm:-translate-x-1/2 {hardShadow}"
					>
						<span
							class="grid size-8 place-items-center rounded-xl border-2 border-edge bg-inverse text-inverse-ink"
						>
							<BarChart3 class="h-4 w-4" />
						</span>
						<span>
							<span class="block text-lg leading-none font-black text-ink">
								{formatReach(stats.totalReach)}
							</span>
							<span
								class="mt-1 block text-[9px] font-black tracking-wider text-tile-mint-ink uppercase"
							>
								{m.home_hero_reach()}
							</span>
						</span>
					</div>
				{/if}
			</div>

			<!-- Partners an operator has added. Each logo sits on a white plate:
			     most are drawn for a light page, and the dark theme's surface is not. -->
			{#if partners.length}
				<div
					class="space-y-3 rounded-3xl border-2 border-edge bg-surface p-4 shadow-[4px_4px_0px_0px_rgb(var(--bento-shadow))]"
				>
					<p class="text-[10px] font-black tracking-widest text-ink-dim uppercase">
						{m.home_hero_partners()}
					</p>
					<ul class="flex flex-wrap items-center gap-2.5">
						{#each partners as partner (partner.id)}
							{#snippet mark()}
								<AppImage
									src={partner.logo}
									alt={partner.name}
									kind="logo"
									seed={partner.name}
									class="h-7 w-auto max-w-[7rem] object-contain"
									loading="lazy"
									decoding="async"
								/>
							{/snippet}
							<li>
								{#if partner.websiteUrl}
									<a
										href={partner.websiteUrl}
										rel="external noopener"
										target="_blank"
										title={partner.name}
										class="flex h-11 items-center rounded-xl border-2 border-edge bg-white px-3 shadow-[2px_2px_0px_0px_rgb(var(--bento-shadow))] transition-transform hover:-translate-y-0.5"
									>
										{@render mark()}
									</a>
								{:else}
									<span
										title={partner.name}
										class="flex h-11 items-center rounded-xl border-2 border-edge bg-white px-3 shadow-[2px_2px_0px_0px_rgb(var(--bento-shadow))]"
									>
										{@render mark()}
									</span>
								{/if}
							</li>
						{/each}
					</ul>
				</div>
			{/if}
		</div>
	</div>
</section>
