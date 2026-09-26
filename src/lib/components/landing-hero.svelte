<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import type { ResolvedPathname } from '$app/types';
	import { ArrowRight, ChevronRight, MapPin, Search, ShieldCheck } from '@lucide/svelte';
	import AppImage from '$lib/components/app-image.svelte';
	import PlatformGlyph from '$lib/components/platform-glyph.svelte';
	import InputComp from '$lib/formComponents/InputComp.svelte';
	import { formatReach } from '$lib/domain/money';
	import { hostedAssetUrl } from '$lib/assets';
	import * as m from '$lib/paraglide/messages';

	/**
	 * The top of the homepage.
	 *
	 * Left, the pitch on a slab: headline, search, the two ways in, and the
	 * platform's live figures. A slab rather than the inverse tile because the
	 * tile is defined to flip with the theme, which turned the first thing on a
	 * dark page into a near-white block; this half grounds the page, so it keeps
	 * its navy and its own ink in both themes.
	 *
	 * Right, the platform itself — a photograph with
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
		creators = [],
		partners = [],
		slides = [],
		intervalSeconds = 6,
		stats
	}: {
		headline: { title: string; accent: string; end: string };
		subtitle: string;
		/** In the order they should fill the collage; the first three are drawn. */
		creators?: Creator[];
		/** Operator-managed logos, from /dashboard/admin/partners. None, no tile. */
		partners?: { id: number; name: string; logo: string; websiteUrl: string | null }[];
		/** Operator-managed photographs, from /dashboard/admin/hero. None, the shipped set. */
		slides?: { id: number; image: string; alt: string }[];
		/** Seconds per photograph. 0 holds the first. */
		intervalSeconds?: number;
		stats: { creators: number; totalReach: number; campaigns: number };
	} = $props();

	/* ---------------- The pitch ---------------- */

	let query = $state('');

	/* Resolved once, then given its query string — appending to a resolved path
	   keeps it resolved, which is what `goto` needs to be handed. */
	const searchHref = $derived(
		`${resolve('/discover')}${query ? `?q=${encodeURIComponent(query)}` : ''}` as ResolvedPathname
	);

	/* ---------------- The photographs ---------------- */

	/*
	 * An operator's own photographs from /dashboard/admin/hero when there are
	 * any, and the shipped set when there are none — shown whole, since they mix
	 * portrait, square and landscape. Built from the originals in
	 * assets-src/landing/hero-gallery.
	 */
	const SHIPPED = [1, 2, 3, 4, 5, 6].map((n) => ({
		src: `/hero/gallery-${n}.webp`,
		alt: ''
	}));
	const pictures = $derived(
		slides.length
			? slides.map((slide) => ({ src: hostedAssetUrl(slide.image), alt: slide.alt }))
			: SHIPPED
	);

	/* A cross-fade, not a cut: long enough to read as calm, short enough that
	   two pictures are never half-visible for long. */
	const FADE_MS = 900;

	let current = $state(0);
	let hovered = $state(false);
	let focused = $state(false);
	let hidden = $state(false);
	let reducedMotion = $state(false);
	let touchStartX = 0;
	let touchStartY = 0;

	/*
	 * Held while a pointer rests on it or focus is inside it, while the tab is
	 * in the background, and always for a reader who asked for less motion —
	 * they still get every picture, through the dots and a swipe.
	 */
	const paused = $derived(
		hovered || focused || hidden || reducedMotion || intervalSeconds <= 0 || pictures.length < 2
	);

	const go = (index: number) => (current = (index + pictures.length) % pictures.length);

	/* Clamped, for a list an operator shortened while a reader was on a later picture. */
	const active = $derived(current < pictures.length ? current : 0);

	/* One timer per picture, restarted by every change however it happened. */
	$effect(() => {
		if (paused) return;
		void active;
		const timer = setTimeout(() => go(active + 1), intervalSeconds * 1000);
		return () => clearTimeout(timer);
	});

	onMount(() => {
		const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
		reducedMotion = motion.matches;
		const onMotion = () => (reducedMotion = motion.matches);
		motion.addEventListener('change', onMotion);

		const onVisibility = () => (hidden = document.visibilityState === 'hidden');
		document.addEventListener('visibilitychange', onVisibility);

		/* The pictures after the first are fetched now, idle, so a change never
		   fades into a half-loaded image. */
		const preload = () => {
			for (const picture of pictures.slice(1)) new Image().src = picture.src;
		};
		const idle = 'requestIdleCallback' in window ? window.requestIdleCallback(preload) : null;
		if (idle === null) setTimeout(preload, 1500);

		return () => {
			motion.removeEventListener('change', onMotion);
			document.removeEventListener('visibilitychange', onVisibility);
			if (idle !== null) window.cancelIdleCallback(idle);
		};
	});

	function onTouchStart(event: TouchEvent) {
		touchStartX = event.touches[0].clientX;
		touchStartY = event.touches[0].clientY;
	}

	function onTouchEnd(event: TouchEvent) {
		const dx = event.changedTouches[0].clientX - touchStartX;
		const dy = event.changedTouches[0].clientY - touchStartY;
		if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) go(active + (dx < 0 ? 1 : -1));
	}

	/* ---------------- The creators, floating ---------------- */

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

	const bubbles = $derived(creators.slice(0, 5));

	/* Around the gallery's edge, half on and half off it, so they frame the
	   picture instead of covering it. Each drifts on its own clock. */
	const orbit = [
		{ place: '-left-3 top-[9%]', delay: '0s' },
		{ place: '-right-3 top-[24%]', delay: '-1.6s' },
		{ place: '-left-4 bottom-[26%]', delay: '-3.1s' },
		{ place: '-right-4 bottom-[18%]', delay: '-2.3s' },
		{ place: 'left-[38%] top-2 sm:-top-5', delay: '-4.4s' }
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
			class="relative flex flex-col justify-between overflow-hidden rounded-3xl border-2 border-edge bg-slab-raised p-5 text-slab-ink shadow-[6px_6px_0px_0px_rgb(var(--bento-shadow))] sm:min-h-[460px] sm:p-10 lg:col-span-7"
		>
			<div class="relative z-10 space-y-5 sm:space-y-6">
				<div
					class="inline-flex items-center gap-2 rounded-full border-2 border-edge bg-tile-mint px-4 py-1.5 text-xs font-black tracking-wider text-tile-mint-ink uppercase shadow-[2px_2px_0px_0px_rgb(var(--bento-shadow))]"
				>
					<ShieldCheck class="h-4 w-4 text-tile-mint-ink" />
					<span>{m.home_badge_marketplace()}</span>
				</div>

				<h1 class="text-3xl leading-[1.1] font-black tracking-tight sm:text-5xl">
					{headline.title}
					{#if headline.accent}
						<br />
						<span class="text-brand-gradient-slab">{headline.accent}</span>
					{/if}
					{#if headline.end}
						<br />
						{headline.end}
					{/if}
				</h1>

				<p class="max-w-xl text-sm leading-relaxed font-medium text-slab-ink-dim sm:text-base">
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
						class="flex items-center justify-center gap-2 rounded-xl border-2 border-edge bg-slab-brand px-5 py-3 text-xs font-black text-slab shadow-[2px_2px_0px_0px_rgb(var(--bento-shadow))] transition-all hover:shadow-[3px_3px_0px_0px_rgb(var(--bento-shadow))] sm:py-2.5"
					>
						<span>{m.home_cta_create_account()}</span>
					</a>
				</div>
			</div>

			<!-- Live figures, read from the database rather than written into the page -->
			<div
				class="relative z-10 mt-6 grid grid-cols-3 gap-2 border-t-2 border-slab-edge pt-5 text-xs sm:gap-4 sm:pt-6"
			>
				<div>
					<div class="text-xl font-black text-slab-ink sm:text-2xl">{stats.creators}</div>
					<div class="text-[10px] font-bold tracking-wider text-slab-ink-dim uppercase">
						{m.home_stat_published_creators()}
					</div>
				</div>
				<div>
					<div class="text-xl font-black text-slab-brand sm:text-2xl">
						{formatReach(stats.totalReach)}
					</div>
					<div class="text-[10px] font-bold tracking-wider text-slab-ink-dim uppercase">
						{m.home_stat_combined_reach()}
					</div>
				</div>
				<div>
					<div class="text-xl font-black text-slab-ink sm:text-2xl">{stats.campaigns}</div>
					<div class="text-[10px] font-bold tracking-wider text-slab-ink-dim uppercase">
						{m.home_stat_live_campaigns()}
					</div>
				</div>
			</div>
		</div>

		<!-- ---------------- The gallery, with creators floating round it ---------------- -->
		<div class="flex flex-col gap-4 sm:gap-6 lg:col-span-5">
			<div
				class="relative h-[440px] sm:h-[520px] lg:h-auto lg:min-h-[520px] lg:flex-1"
				role="region"
				aria-roledescription="carousel"
				aria-label={m.home_hero_gallery_label()}
				onpointerenter={() => (hovered = true)}
				onpointerleave={() => (hovered = false)}
				onfocusin={() => (focused = true)}
				onfocusout={() => (focused = false)}
			>
				<!-- The tile: the brand's ocean-to-emerald ground, a light vignette and two
				     soft glows, behind whichever picture is up. -->
				<!-- Swipe is an extra: the dots are the keyboard and screen-reader way
				     through, so the touch handlers need no role of their own. -->
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div
					class="hero-gallery absolute inset-0 touch-pan-y overflow-hidden rounded-3xl border-2 border-edge shadow-[6px_6px_0px_0px_rgb(var(--bento-shadow))]"
					ontouchstart={onTouchStart}
					ontouchend={onTouchEnd}
				>
					<div
						class="pointer-events-none absolute -top-24 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-white/25 blur-3xl"
					></div>
					<div
						class="pointer-events-none absolute -right-20 bottom-6 h-72 w-72 rounded-full bg-[#2edcae]/35 blur-3xl"
					></div>
					<div
						class="pointer-events-none absolute inset-0 z-10 bg-[radial-gradient(circle_at_50%_25%,transparent,rgba(2,12,25,0.35))]"
					></div>

					<!--
						Every picture is in the page at once, stacked, and only the current
						one is opaque: the change is a cross-fade in CSS, which the browser
						runs off the main thread, rather than one element leaving as the next
						arrives. Only the first is fetched eagerly; the rest wait on idle.
					-->
					{#each pictures as picture, index (picture.src)}
						<div
							class="hero-slide absolute inset-0 z-[5] flex items-center justify-center px-5 pt-12 pb-12 sm:px-7 sm:pt-14 sm:pb-14"
							class:is-current={index === active}
							style:--fade-ms="{FADE_MS}ms"
							aria-hidden={index !== active}
						>
							<img
								src={picture.src}
								alt={picture.alt ||
									m.home_hero_gallery_alt({ index: index + 1, total: pictures.length })}
								class="hero-picture max-h-full max-w-full rounded-2xl border-2 border-edge object-contain"
								draggable="false"
								decoding="async"
								loading={index === 0 ? 'eager' : 'lazy'}
								fetchpriority={index === 0 ? 'high' : 'low'}
							/>
						</div>
					{/each}

					<div class="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 gap-2">
						{#each pictures as picture, index (picture.src)}
							<button
								type="button"
								aria-label={m.home_gallery_go_to({ index: index + 1 })}
								aria-current={index === active}
								onclick={() => go(index)}
								class="h-2 rounded-full border border-edge transition-all duration-500 {index ===
								active
									? 'w-8 bg-white'
									: 'w-2 bg-white/50 hover:bg-white/80'}"
							></button>
						{/each}
					</div>
				</div>

				<!-- Creators, small and round, drifting on the tile's edge. -->
				{#each bubbles as creator, index (creator.id)}
					<div
						class="hero-bubble absolute z-30 {orbit[index].place}"
						style:--float-delay={orbit[index].delay}
					>
						<a
							href={resolve(`/creators/${creator.username}`)}
							title={creator.fullName}
							class="group flex flex-col items-center gap-1 focus-visible:outline-none"
						>
							<span class="relative block">
								<AppImage
									src={creator.avatar}
									alt={creator.fullName}
									kind="avatar"
									seed={creator.username}
									label={creator.fullName}
									class="size-14 rounded-full border-2 border-edge object-cover {hardShadow} transition-transform duration-300 group-hover:scale-110 group-focus-visible:ring-2 group-focus-visible:ring-brand sm:size-16"
									width="64"
									height="64"
								/>
								<span
									class="absolute -right-1 -bottom-1 grid size-6 place-items-center rounded-full border-2 border-edge bg-surface"
								>
									<PlatformGlyph
										name={creator.platformName}
										color={platformColor(creator.platformName)}
										class="size-3.5"
									/>
								</span>
							</span>
							<span
								class="max-w-[6.5rem] truncate rounded-full border-2 border-edge bg-surface px-2 py-0.5 text-[10px] leading-tight font-black text-ink shadow-[2px_2px_0px_0px_rgb(var(--bento-shadow))]"
							>
								{creator.fullName.split(' ')[0]}
								<span class="text-brand-fg">· {formatReach(creator.totalReach)}</span>
							</span>
						</a>
					</div>
				{/each}

				<!-- The home market, pinned to the tile's top corner. -->
				<div
					class="hero-bubble absolute top-3 right-3 z-30 hidden sm:block"
					style:--float-delay="-0.8s"
				>
					<a
						href={homeMarketHref}
						aria-label={m.home_hero_location_label()}
						class="flex items-center gap-1.5 rounded-full border-2 border-edge bg-inverse px-3 py-1.5 text-[11px] font-black whitespace-nowrap text-inverse-ink {hardShadow} transition-colors hover:bg-inverse-hover"
					>
						<MapPin class="h-3.5 w-3.5 text-inverse-brand" />
						{m.home_hero_location_city()}
						<ChevronRight class="h-3.5 w-3.5 text-inverse-ink-dim" />
					</a>
				</div>
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

<style>
	/* The tile's ground: the logo's gradient, deep ocean into emerald. */
	.hero-gallery {
		background: linear-gradient(145deg, #0157a8 0%, #017f8c 55%, #10b88a 100%);
	}

	/* Stacked pictures, one opaque at a time: the cross-fade. */
	.hero-slide {
		opacity: 0;
		transition: opacity var(--fade-ms, 900ms) ease-in-out;
	}
	.hero-slide.is-current {
		opacity: 1;
		z-index: 6;
	}

	/* The picture on show, drifting like the device in tmax's hero. */
	.hero-picture {
		animation: picture-float 5s ease-in-out infinite;
		box-shadow: 0 24px 40px rgb(2 12 25 / 0.35);
		user-select: none;
		-webkit-user-drag: none;
	}
	@keyframes picture-float {
		0%,
		100% {
			transform: translateY(0) rotate(-0.8deg);
		}
		50% {
			transform: translateY(-12px) rotate(0.8deg);
		}
	}

	/* The creator bubbles drift on their own clocks. `translate` is animated, so
	   the hover scale on the avatar inside is never overwritten. */
	.hero-bubble {
		animation: bubble-float 5.5s ease-in-out var(--float-delay, 0s) infinite;
	}
	.hero-bubble:hover,
	.hero-bubble:focus-within {
		animation-play-state: paused;
	}
	@keyframes bubble-float {
		0%,
		100% {
			translate: 0 0;
		}
		50% {
			translate: 0 -10px;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.hero-picture,
		.hero-bubble {
			animation: none;
		}
		.hero-slide {
			transition-duration: 1ms;
		}
	}
</style>
