<script lang="ts">
	import '@fontsource-variable/caveat';
	import { resolve } from '$app/paths';
	import type { ResolvedPathname } from '$app/types';
	import { page } from '$app/state';
	import {
		ArrowRight,
		BarChart3,
		Building2,
		ChevronRight,
		MapPin,
		Megaphone,
		Users
	} from '@lucide/svelte';
	import AppImage from '$lib/components/app-image.svelte';
	import PlatformGlyph from '$lib/components/platform-glyph.svelte';
	import { formatReach } from '$lib/domain/money';
	import * as m from '$lib/paraglide/messages';

	/**
	 * The top of the homepage: the pitch on the left, real creators on the right,
	 * and the platform's live figures underneath.
	 *
	 * Everything that looks like a claim is read from the database. The cards are
	 * creators an operator featured or the board ranked, with their own photos
	 * and numbers; the figures are counts, not round marketing numbers. A fresh
	 * install with three creators shows three and says 3 — which is the point.
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
		/** The operator's hero picture. The shipped gallery photograph when unset. */
		image?: string;
		/** In the order they should fill the collage; the first four are drawn. */
		creators?: Creator[];
		/** Operator-managed logos, from /dashboard/admin/partners. None, no strip. */
		partners?: { id: number; name: string; logo: string; websiteUrl: string | null }[];
		stats: { creators: number; organizations: number; totalReach: number; campaigns: number };
	} = $props();

	const collage = $derived(creators.slice(0, 4));
	const faces = $derived(creators.filter((creator) => creator.avatar).slice(0, 3));
	/* The shipped picture: the figure from the design mockup in front of Addis
	   Ababa's skyline. Its sources and licence are in assets-src/landing/CREDITS.md. */
	const picture = $derived(image || '/hero/creator-camera.webp');

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

	const count = (value: number) => value.toLocaleString();

	/* The collage's four slots, as positions. Two of them only from `sm`: on a
	   phone four cards over one picture is a pile, not a collage. */
	const slots = [
		'left-0 top-2 w-[40%] sm:w-[30%]',
		'right-0 top-10 w-[40%] sm:w-[29%]',
		'left-[2%] bottom-16 hidden w-[28%] sm:block',
		'right-[1%] bottom-20 hidden w-[27%] sm:block'
	];

	const stripItems = $derived([
		{ icon: Users, value: count(stats.creators), label: m.home_stat_creators() },
		{ icon: Building2, value: count(stats.organizations), label: m.home_stat_brands() },
		{ icon: BarChart3, value: formatReach(stats.totalReach), label: m.home_stat_reach() },
		{ icon: Megaphone, value: count(stats.campaigns), label: m.home_stat_campaigns() }
	]);
</script>

<section class="hero-ground relative isolate overflow-hidden pb-6 sm:pb-10">
	<!-- Decoration only: the logo's emerald-to-ocean sweep, behind the collage. -->
	<div aria-hidden="true" class="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
		<!-- Addis Ababa across the right half on desktop: the city the pitch is
		     about, behind the creators it is making. Under the sweep, not over it. -->
		<div class="hero-city-half hidden lg:block"></div>
		<div class="hero-glow"></div>
		<div class="hero-ring"></div>
		<div class="hero-ring hero-ring-inner"></div>
	</div>

	<div
		class="mx-auto grid max-w-7xl grid-cols-1 items-center gap-10 px-4 pt-8 sm:px-6 sm:pt-12 lg:grid-cols-[minmax(0,1.12fr)_minmax(0,1fr)] lg:gap-8 lg:px-8 lg:pt-16"
	>
		<!-- ---------------- The pitch ---------------- -->
		<div>
			<p class="text-[10px] font-bold tracking-[0.35em] text-ink-dim uppercase sm:text-[11px]">
				{m.home_hero_eyebrow()}
			</p>

			<!-- Sized per breakpoint so the shipped headline's longest line,
			     "With Real Opportunities.", fits its column on one line. -->
			<h1
				class="mt-4 text-[2.2rem] leading-[1.04] font-black tracking-tight text-ink sm:text-[2.9rem] lg:text-[2.6rem] xl:text-[3.2rem]"
			>
				{#if headline.title}<span class="block">{headline.title}</span>{/if}
				{#if headline.accent}<span class="hero-accent block pb-1">{headline.accent}</span>{/if}
				{#if headline.end}<span class="block">{headline.end}</span>{/if}
			</h1>

			<p class="mt-5 max-w-xl text-base leading-relaxed font-medium text-ink-soft sm:text-lg">
				{subtitle}
			</p>

			<div class="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
				<a
					href={resolve('/register?role=creator')}
					class="hero-cta group inline-flex items-center justify-center gap-2 rounded-full px-7 py-3.5 text-sm font-bold text-white shadow-lg shadow-brand/25 transition-transform hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none"
				>
					{m.home_hero_join_creator()}
					<ArrowRight class="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
				</a>
				<a
					href={resolve('/register?role=business')}
					class="inline-flex items-center justify-center rounded-full border-2 border-brand-edge bg-surface px-7 py-3.5 text-sm font-bold text-ink transition-colors hover:bg-brand-soft focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none"
				>
					{m.home_hero_partner_brand()}
				</a>
			</div>

			<!-- Faces and counts that are actually on the platform, then the
			     partners an operator has added. -->
			{#if stats.creators || partners.length}
				<div class="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
					{#if stats.creators}
						<div class="flex items-center gap-3">
							{#if faces.length}
								<div class="flex shrink-0 -space-x-3">
									{#each faces as face (face.id)}
										<AppImage
											src={face.avatar}
											alt=""
											kind="avatar"
											seed={face.username}
											label={face.fullName}
											class="size-9 rounded-full object-cover ring-2 ring-surface"
											width="36"
											height="36"
										/>
									{/each}
								</div>
							{/if}
							<p class="max-w-[16rem] text-sm leading-snug font-medium text-ink-soft">
								{stats.organizations
									? m.home_hero_trust({
											creators: count(stats.creators),
											brands: count(stats.organizations)
										})
									: m.home_hero_trust_creators({ creators: count(stats.creators) })}
							</p>
						</div>
					{/if}

					{#if partners.length}
						{#if stats.creators}
							<span aria-hidden="true" class="hidden h-8 w-px bg-edge-mid sm:block"></span>
						{/if}
						<!-- Each logo on a white chip in the dark theme only: most partner
						     marks are drawn for a light page, and a black wordmark on navy
						     is no logo at all. -->
						<ul
							class="flex flex-wrap items-center gap-x-5 gap-y-3"
							aria-label={m.home_hero_partners()}
						>
							{#each partners as partner (partner.id)}
								{#snippet mark()}
									<AppImage
										src={partner.logo}
										alt={partner.name}
										kind="logo"
										seed={partner.name}
										class="h-8 w-auto max-w-[8rem] object-contain"
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
											class="block rounded-lg transition-opacity hover:opacity-80 dark:bg-white dark:px-2 dark:py-1"
										>
											{@render mark()}
										</a>
									{:else}
										<span
											class="block rounded-lg dark:bg-white dark:px-2 dark:py-1"
											title={partner.name}
										>
											{@render mark()}
										</span>
									{/if}
								</li>
							{/each}
						</ul>
					{/if}
				</div>
			{/if}
		</div>

		<!-- ---------------- The collage ---------------- -->
		<div
			class="relative isolate h-[400px] sm:h-[500px] lg:h-[540px]"
			aria-label={m.home_hero_collage_label()}
			role="group"
		>
			<!-- Addis Ababa's skyline behind the whole collage, faded out at every
			     edge, so the city runs past the photo and under the cards. -->
			<div
				aria-hidden="true"
				class="hero-city absolute inset-x-[-12%] bottom-4 -z-10 h-[62%] lg:hidden"
			></div>

			<!-- The picture in the middle. -->
			<div
				class="absolute inset-y-6 right-[9%] left-[14%] overflow-hidden rounded-[2rem] shadow-2xl ring-1 shadow-slate-900/20 ring-white/40 sm:right-[19%] sm:left-[22%]"
			>
				<AppImage
					src={picture}
					alt=""
					kind="cover"
					seed="hero"
					loading="eager"
					class="h-full w-full object-cover"
				/>
				<div
					class="absolute inset-0 bg-gradient-to-t from-slate-950/55 via-transparent to-transparent"
				></div>
				<!-- In the one stretch of the picture no card covers: its middle. -->
				<p
					class="hero-script absolute top-[44%] left-1/2 hidden -translate-x-1/2 -rotate-[8deg] text-center text-4xl leading-[0.95] whitespace-nowrap text-white drop-shadow-lg sm:block"
				>
					{m.home_hero_script()}
				</p>
			</div>

			<!-- Creators, each a link to their profile. -->
			{#each collage as creator, index (creator.id)}
				<a
					href={resolve(`/creators/${creator.username}`)}
					class="group absolute {slots[
						index
					]} max-w-[200px] rounded-2xl bg-surface/95 p-1.5 shadow-xl ring-1 shadow-slate-900/15 ring-edge-soft backdrop-blur transition-transform hover:-translate-y-1 focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
				>
					<AppImage
						src={creator.avatar}
						alt={creator.fullName}
						kind="avatar"
						seed={creator.username}
						label={creator.fullName}
						class="aspect-[16/11] w-full rounded-xl object-cover"
						loading="eager"
					/>
					<div class="px-1.5 pt-2 pb-1">
						<p class="truncate text-[11px] font-black text-ink">
							{creator.categories[0]
								? m.home_hero_card_role({ category: creator.categories[0] })
								: creator.fullName}
						</p>
						{#if creator.city || creator.countryName}
							<p class="mt-0.5 flex items-center gap-1 truncate text-[10px] text-ink-dim">
								<MapPin class="h-2.5 w-2.5 shrink-0" />
								<span class="truncate">{creator.city || creator.countryName}</span>
							</p>
						{/if}
						<div class="mt-1.5 flex items-end justify-between gap-2">
							<div class="min-w-0">
								{#if index % 2 === 1 && creator.engagementRate > 0}
									<p class="text-sm leading-none font-black text-ink">
										{creator.engagementRate}%
									</p>
									<p class="mt-0.5 text-[10px] text-ink-dim">{m.home_hero_engagement()}</p>
								{:else}
									<p class="text-sm leading-none font-black text-ink">
										{formatReach(creator.totalReach)}
									</p>
									<p class="mt-0.5 text-[10px] text-ink-dim">{m.home_hero_followers()}</p>
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

			<!-- The platform's combined reach, from the database. -->
			{#if stats.totalReach}
				<div
					class="absolute bottom-0 left-[30%] flex items-center gap-3 rounded-2xl bg-surface/95 px-4 py-3 shadow-xl ring-1 shadow-slate-900/15 ring-edge-soft backdrop-blur sm:left-[34%]"
				>
					<span class="hero-cta grid size-9 place-items-center rounded-xl text-white">
						<BarChart3 class="h-4 w-4" />
					</span>
					<span>
						<span class="block text-xl leading-none font-black text-ink">
							{formatReach(stats.totalReach)}
						</span>
						<span class="mt-1 block text-[11px] text-ink-dim">{m.home_hero_reach()}</span>
					</span>
				</div>
			{/if}

			<a
				href={homeMarketHref}
				aria-label={m.home_hero_location_label()}
				class="absolute right-0 bottom-0 hidden items-center gap-3 rounded-2xl bg-slate-950/70 px-4 py-3 text-white shadow-xl ring-1 ring-white/15 backdrop-blur transition-colors hover:bg-slate-950/85 sm:flex"
			>
				<MapPin class="h-5 w-5 text-slab-brand" />
				<span class="text-xs leading-tight">
					<span class="block font-bold">{m.home_hero_location_city()}</span>
					<span class="block text-white/70">{m.home_hero_location_country()}</span>
				</span>
				<ChevronRight class="h-4 w-4 text-white/70" />
			</a>

			<p
				aria-hidden="true"
				class="hero-script absolute -top-4 right-0 hidden rotate-[-8deg] text-right text-3xl leading-[0.95] text-white drop-shadow-[0_2px_6px_rgb(2_12_25/0.55)] xl:block"
			>
				{m.home_hero_tagline_script()}
			</p>
		</div>
	</div>

	<!-- ---------------- The live figures ---------------- -->
	<div class="relative z-10 mx-auto mt-10 max-w-7xl px-4 sm:px-6 lg:mt-6 lg:px-8">
		<div
			class="grid grid-cols-2 gap-x-4 gap-y-6 rounded-3xl bg-surface/90 p-5 shadow-xl ring-1 shadow-slate-900/10 ring-edge-soft backdrop-blur sm:p-6 lg:grid-cols-[repeat(4,minmax(0,1fr))_auto] lg:divide-x lg:divide-edge-soft lg:p-7"
		>
			{#each stripItems as item (item.label)}
				{@const Icon = item.icon}
				<div class="flex items-center gap-3 lg:px-6 lg:first:ps-0">
					<span
						class="grid size-11 shrink-0 place-items-center rounded-full bg-brand-soft text-brand-fg sm:size-12"
					>
						<Icon class="h-5 w-5" />
					</span>
					<span class="min-w-0">
						<span class="block text-xl leading-none font-black text-ink sm:text-2xl">
							{item.value}
						</span>
						<span
							class="mt-1.5 block text-[10px] leading-tight font-bold tracking-[0.08em] text-ink-dim uppercase sm:tracking-[0.18em]"
						>
							{item.label}
						</span>
					</span>
				</div>
			{/each}
			<div class="col-span-2 flex flex-col justify-center lg:col-span-1 lg:ps-6">
				<p class="text-sm leading-snug font-medium text-ink-soft">
					{m.home_hero_closing_first()}<br />{m.home_hero_closing_second()}
				</p>
				<span class="hero-cta mt-2 block h-1.5 w-24 rounded-full"></span>
			</div>
		</div>
	</div>
</section>

<style>
	/* The ground: white into the page colour, so the hero lifts off the page
	   without a hard edge where the sections below begin. */
	.hero-ground {
		background: linear-gradient(180deg, var(--surface) 0%, #eaf3fa 55%, var(--ground) 100%);
	}
	:global(.dark) .hero-ground {
		background: linear-gradient(180deg, #0b1a2e 0%, #0a1829 55%, var(--ground) 100%);
	}

	/*
	 * The headline's coloured line and the primary button run the logo's dot
	 * gradient, darkened where text sits on or in it: both ends clear 4.5:1 for
	 * white text on the button, and 3:1 as large text on the light ground.
	 */
	.hero-accent {
		background-image: linear-gradient(90deg, #0157a8, #017f8c);
		-webkit-background-clip: text;
		background-clip: text;
		color: transparent;
	}
	:global(.dark) .hero-accent {
		background-image: linear-gradient(90deg, #4cc9e0, #2edcae);
	}
	.hero-cta {
		background-image: linear-gradient(90deg, #017f8c, #0157a8);
	}

	.hero-city {
		background: url('/hero/addis-skyline.webp') center bottom / cover no-repeat;
		mask-image:
			linear-gradient(to right, transparent, #000 22%, #000 78%, transparent),
			linear-gradient(to bottom, transparent, #000 35%, #000 80%, transparent);
		mask-composite: intersect;
		opacity: 0.55;
	}
	:global(.dark) .hero-city {
		opacity: 0.35;
	}

	/*
	 * The right half of the hero on desktop. Faded only where it has to be: into
	 * the headline on its left, so no building sits behind the words, and into
	 * the figures strip at the foot. Everywhere else it runs to the edge.
	 */
	.hero-city-half {
		position: absolute;
		inset: 0 0 0 50%;
		background: url('/hero/addis-city.webp') left center / cover no-repeat;
		mask-image:
			linear-gradient(to right, transparent 0%, #000 24%),
			linear-gradient(to bottom, #000 72%, transparent 100%);
		mask-composite: intersect;
		opacity: 0.9;
	}
	:global(.dark) .hero-city-half {
		background-image:
			linear-gradient(rgb(7 17 31 / 0.45), rgb(7 17 31 / 0.45)), url('/hero/addis-city.webp');
		opacity: 0.8;
	}

	.hero-script {
		font-family: 'Caveat Variable', 'Segoe Script', cursive;
		font-weight: 600;
	}

	/* The sweep: two gradient rings cut out of circles with a mask, and a soft
	   glow under them. Positioned against the collage column. */
	.hero-glow {
		position: absolute;
		right: -10%;
		top: 5%;
		width: 60rem;
		height: 40rem;
		border-radius: 9999px;
		background: radial-gradient(closest-side, rgb(0 180 180 / 0.25), transparent);
		filter: blur(20px);
	}
	.hero-ring {
		position: absolute;
		right: -34rem;
		top: -22rem;
		width: 64rem;
		height: 64rem;
		border-radius: 9999px;
		background: linear-gradient(200deg, #07da8b 10%, #00b4b4 45%, #0157a8 85%);
		mask: radial-gradient(
			farthest-side,
			transparent calc(100% - 7rem),
			#000 calc(100% - 7rem + 1px)
		);
		opacity: 0.9;
	}
	.hero-ring-inner {
		right: -22rem;
		top: -8rem;
		width: 44rem;
		height: 44rem;
		background: linear-gradient(160deg, #2edcae 0%, #0172a4 100%);
		mask: radial-gradient(
			farthest-side,
			transparent calc(100% - 2.5rem),
			#000 calc(100% - 2.5rem + 1px)
		);
		opacity: 0.35;
	}
	/* Over the city photo on desktop the sweep steps back: one ring, lighter, so
	   the skyline is what reads first. */
	@media (min-width: 1024px) {
		.hero-ring {
			opacity: 0.6;
		}
		.hero-ring-inner {
			display: none;
		}
	}
	@media (max-width: 1023px) {
		.hero-ring {
			right: -44rem;
			top: 18rem;
			opacity: 0.5;
		}
		.hero-ring-inner {
			display: none;
		}
	}
</style>
