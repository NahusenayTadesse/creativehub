<script lang="ts">
	import AppImage from '$lib/components/app-image.svelte';
	import * as Carousel from '$lib/components/ui/carousel/index.js';
	import type { CarouselAPI } from '$lib/components/ui/carousel/context.js';
	import { assetUrl } from '$lib/assets';
	import { ArrowRight, ChevronLeft, ChevronRight, Pause, Play } from '@lucide/svelte';
	import * as m from '$lib/paraglide/messages';

	/** One row of `gallery_slides`, as an admin arranged it. */
	type Slide = {
		id: number;
		title: string;
		subtitle: string | null;
		image: string;
		linkUrl: string | null;
		linkLabel: string | null;
	};

	let {
		slides,
		/** Milliseconds between automatic advances. 0 leaves it entirely manual. */
		interval = 6000
	}: { slides: Slide[]; interval?: number } = $props();

	let api = $state<CarouselAPI>();
	let selected = $state(0);

	/*
	 * Three reasons to hold still, kept apart because they end differently: the
	 * pause button stays pressed until pressed again, while hovering, focusing a
	 * slide and switching tabs each end on their own. Folding them into one flag
	 * would let moving the mouse away undo a visitor's explicit pause.
	 */
	let pausedByVisitor = $state(false);
	let resting = $state(false);
	let tabHidden = $state(false);
	let reducedMotion = $state(false);

	const autoplay = $derived(interval > 0 && slides.length > 1 && !reducedMotion);
	const running = $derived(autoplay && !pausedByVisitor && !resting && !tabHidden);

	$effect(() => {
		reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		const onVisibility = () => (tabHidden = document.hidden);
		onVisibility();
		document.addEventListener('visibilitychange', onVisibility);
		return () => document.removeEventListener('visibilitychange', onVisibility);
	});

	$effect(() => {
		if (!api) return;
		const sync = () => (selected = api!.selectedScrollSnap());
		sync();
		api.on('select', sync);
		return () => {
			api?.off('select', sync);
		};
	});

	/*
	 * One timeout per slide: every arrival — by timer, swipe, arrow or dot —
	 * starts the wait again, so a visitor who has just moved to a slide gets the
	 * whole of it. Deliberately nothing that runs per frame: the progress bar
	 * below is a CSS animation, because driving it from JavaScript re-rendered
	 * the carousel sixty times a second and sent Embla into a loop that flipped
	 * slides every few frames.
	 */
	$effect(() => {
		if (!api || !running) return;
		void selected;
		const timer = setTimeout(() => api!.scrollNext(), interval);
		return () => clearTimeout(timer);
	});

	function onKeydown(event: KeyboardEvent) {
		if (event.key === 'ArrowLeft') {
			event.preventDefault();
			api?.scrollPrev();
		} else if (event.key === 'ArrowRight') {
			event.preventDefault();
			api?.scrollNext();
		}
	}

	const control =
		'place-items-center rounded-full border-2 border-edge bg-surface text-ink shadow-[2px_2px_0px_0px_rgb(var(--bento-shadow))] transition-colors hover:bg-brand-soft focus-visible:ring-2 focus-visible:ring-brand-strong focus-visible:outline-none';
</script>

{#if slides.length}
	<Carousel.Root
		opts={{ loop: true }}
		setApi={(value) => (api = value)}
		onkeydown={onKeydown}
		class="space-y-3"
		aria-label={m.home_gallery_label()}
	>
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="relative"
			onpointerenter={() => (resting = true)}
			onpointerleave={() => (resting = false)}
			onfocusin={() => (resting = true)}
			onfocusout={() => (resting = false)}
		>
			<Carousel.Content class="ms-0">
				{#each slides as slide, index (slide.id)}
					<!-- Room on the right and below for the card's offset shadow, which the
					     track would otherwise clip. -->
					<Carousel.Item
						class="ps-0 pe-1.5 pb-1.5"
						aria-label={m.home_gallery_slide_of({ index: index + 1, total: slides.length })}
					>
						<!-- Taller on a phone than it used to be: the title, subtitle and
						     button all sit on the picture, and at 260px they covered it. -->
						<div
							class="relative h-[360px] overflow-hidden rounded-3xl border-2 border-edge bg-inverse shadow-[6px_6px_0px_0px_rgb(var(--bento-shadow))] sm:h-[360px] lg:h-[420px]"
						>
							<!-- The first slide sits near the top of the page, so it is not deferred. -->
							<AppImage
								src={assetUrl(slide.image)}
								alt={slide.title}
								kind="cover"
								seed={slide.title}
								loading={index === 0 ? 'eager' : 'lazy'}
								class="h-full w-full object-cover"
								decoding="async"
							/>
							<!-- Darker where the words are: bottom on a phone, left from `sm`,
							     so white text stays readable on any photograph. -->
							<div
								class="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-950/60 to-slate-950/10 sm:bg-gradient-to-r sm:from-slate-950/90 sm:via-slate-950/55 sm:to-transparent"
							></div>

							<!-- Inset from `sm` so the side arrows never sit on the headline. -->
							<div class="absolute inset-x-0 bottom-0 space-y-3 p-5 sm:px-20 sm:py-10 lg:max-w-3xl">
								<h2 class="text-2xl leading-tight font-black text-white sm:text-3xl">
									{slide.title}
								</h2>
								{#if slide.subtitle}
									<p
										class="line-clamp-3 text-sm leading-relaxed font-medium text-white/85 sm:line-clamp-none"
									>
										{slide.subtitle}
									</p>
								{/if}
								{#if slide.linkUrl}
									<!-- An operator types this destination, and it may well leave the
									     site, so it is a navigation rather than a route. -->
									<a
										href={slide.linkUrl}
										rel="external"
										class="inline-flex items-center gap-1.5 rounded-xl border-2 border-edge bg-tile-yellow px-5 py-2.5 text-xs font-black text-ink shadow-[2px_2px_0px_0px_rgb(var(--bento-shadow))] transition-all hover:shadow-[3px_3px_0px_0px_rgb(var(--bento-shadow))]"
									>
										<span>{slide.linkLabel || m.home_gallery_cta()}</span>
										<ArrowRight class="h-4 w-4" />
									</a>
								{/if}
							</div>
						</div>
					</Carousel.Item>
				{/each}
			</Carousel.Content>

			{#if slides.length > 1}
				<!-- On the picture from `sm` up, clear of the words. A phone swipes,
				     and has the same two buttons in the bar below. -->
				<button
					type="button"
					aria-label={m.tbl_previous()}
					onclick={() => api?.scrollPrev()}
					class="{control} absolute start-4 top-1/2 hidden size-11 -translate-y-1/2 sm:grid"
				>
					<ChevronLeft class="h-5 w-5" strokeWidth={3} />
				</button>
				<button
					type="button"
					aria-label={m.tbl_next()}
					onclick={() => api?.scrollNext()}
					class="{control} absolute end-4 top-1/2 hidden size-11 -translate-y-1/2 sm:grid"
				>
					<ChevronRight class="h-5 w-5" strokeWidth={3} />
				</button>
			{/if}
		</div>

		<!-- Below the picture rather than on it, where the dots used to sit on top
		     of the call to action. -->
		{#if slides.length > 1}
			<div class="flex items-center justify-center gap-3">
				<button
					type="button"
					aria-label={m.tbl_previous()}
					onclick={() => api?.scrollPrev()}
					class="{control} grid size-9 sm:hidden"
				>
					<ChevronLeft class="h-4 w-4" strokeWidth={3} />
				</button>

				<div class="flex items-center gap-2">
					{#each slides as slide, index (slide.id)}
						<button
							type="button"
							aria-label={m.home_gallery_go_to({ index: index + 1 })}
							aria-current={index === selected}
							onclick={() => api?.scrollTo(index)}
							class="relative h-3 overflow-hidden rounded-full border-2 border-edge transition-all {index ===
							selected
								? 'w-10 bg-brand-soft'
								: 'w-3 bg-ink-dim hover:bg-brand-strong'}"
						>
							{#if index === selected}
								<!-- How long until the next slide. Restarted whenever the timer
								     is — on arrival, and on resuming after a pause — so the two
								     always agree. With no autoplay it is simply full: this is
								     the slide you are on. -->
								{#key `${selected}:${running}`}
									<span
										class="absolute inset-y-0 start-0 bg-brand-strong {running
											? 'gallery-progress'
											: 'w-full'}"
										style:animation-duration="{interval}ms"
									></span>
								{/key}
							{/if}
						</button>
					{/each}
				</div>

				<button
					type="button"
					aria-label={m.tbl_next()}
					onclick={() => api?.scrollNext()}
					class="{control} grid size-9 sm:hidden"
				>
					<ChevronRight class="h-4 w-4" strokeWidth={3} />
				</button>

				{#if autoplay}
					<!-- Moving content has to be stoppable (WCAG 2.2.2), and a slide
					     someone is halfway through reading should not leave. -->
					<button
						type="button"
						aria-label={pausedByVisitor ? m.home_gallery_play() : m.home_gallery_pause()}
						aria-pressed={pausedByVisitor}
						onclick={() => (pausedByVisitor = !pausedByVisitor)}
						class="{control} grid size-9"
					>
						{#if pausedByVisitor}
							<Play class="h-4 w-4" />
						{:else}
							<Pause class="h-4 w-4" />
						{/if}
					</button>
				{/if}
			</div>
		{/if}
	</Carousel.Root>
{/if}

<style>
	/* The countdown on the active dot. CSS rather than JavaScript on purpose —
	   see the note on the timer above. */
	.gallery-progress {
		width: 0;
		animation-name: gallery-fill;
		animation-timing-function: linear;
		animation-fill-mode: forwards;
	}

	@keyframes gallery-fill {
		to {
			width: 100%;
		}
	}
</style>
