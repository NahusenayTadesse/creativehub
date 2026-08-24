<script lang="ts">
	import AppImage from '$lib/components/app-image.svelte';
	import * as Carousel from '$lib/components/ui/carousel/index.js';
	import type { CarouselAPI } from '$lib/components/ui/carousel/context.js';
	import { assetUrl } from '$lib/assets';
	import { ArrowRight } from '@lucide/svelte';
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
	/** Paused while a visitor is reading a slide, or dragging one. */
	let paused = $state(false);

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
	 * Auto-advance. Anyone who has asked their system to reduce motion gets a
	 * gallery that only moves when they move it.
	 */
	$effect(() => {
		if (!api || paused || interval <= 0 || slides.length < 2) return;
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

		const timer = setInterval(() => {
			if (api!.canScrollNext()) api!.scrollNext();
			else api!.scrollTo(0);
		}, interval);

		return () => clearInterval(timer);
	});
</script>

{#if slides.length}
	<Carousel.Root
		opts={{ loop: true }}
		setApi={(value) => (api = value)}
		class="relative"
		aria-label={m.home_gallery_label()}
	>
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			onpointerenter={() => (paused = true)}
			onpointerleave={() => (paused = false)}
			onfocusin={() => (paused = true)}
			onfocusout={() => (paused = false)}
		>
			<Carousel.Content class="ms-0">
				{#each slides as slide, index (slide.id)}
					<Carousel.Item class="ps-0">
						<div
							class="relative h-[260px] overflow-hidden rounded-3xl border-2 border-slate-900 bg-slate-900 shadow-[6px_6px_0px_0px_rgba(15,23,42,1)] sm:h-[340px] lg:h-[420px]"
						>
							<!-- The first slide sits at the top of the page, so it is not deferred. -->
							<AppImage
								src={assetUrl(slide.image)}
								alt={slide.title}
								kind="cover"
								seed={slide.title}
								loading={index === 0 ? 'eager' : 'lazy'}
								class="h-full w-full object-cover"
								decoding="async"
							/>
							<div
								class="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/35 to-transparent"
							></div>

							<div class="absolute inset-x-0 bottom-0 space-y-3 p-6 sm:p-8 lg:max-w-2xl">
								<h2 class="text-xl font-black text-white sm:text-3xl">{slide.title}</h2>
								{#if slide.subtitle}
									<p class="text-xs leading-relaxed font-medium text-slate-200 sm:text-sm">
										{slide.subtitle}
									</p>
								{/if}
								{#if slide.linkUrl}
									<!-- An operator types this destination, and it may well leave the
									     site, so it is a navigation rather than a route. -->
									<a
										href={slide.linkUrl}
										rel="external"
										class="inline-flex items-center gap-1.5 rounded-xl border-2 border-slate-900 bg-[#fef9c3] px-5 py-2.5 text-xs font-black text-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] transition-all hover:shadow-[3px_3px_0px_0px_rgba(15,23,42,1)]"
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
		</div>

		{#if slides.length > 1}
			<Carousel.Previous
				aria-label={m.tbl_previous()}
				class="inset-y-0 start-4 my-auto size-10 rounded-xl border-2 border-slate-900 bg-white/90 text-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] backdrop-blur transition-colors hover:bg-white"
			/>
			<Carousel.Next
				aria-label={m.tbl_next()}
				class="inset-y-0 end-4 my-auto size-10 rounded-xl border-2 border-slate-900 bg-white/90 text-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] backdrop-blur transition-colors hover:bg-white"
			/>

			<div class="absolute inset-x-0 bottom-4 flex items-center justify-center gap-2">
				{#each slides as slide, index (slide.id)}
					<button
						type="button"
						aria-label={m.home_gallery_go_to({ index: index + 1 })}
						aria-current={index === selected}
						onclick={() => api?.scrollTo(index)}
						class="h-2.5 rounded-full border-2 border-slate-900 transition-all {index === selected
							? 'w-7 bg-emerald-400'
							: 'w-2.5 bg-white/80 hover:bg-white'}"
					></button>
				{/each}
			</div>
		{/if}
	</Carousel.Root>
{/if}
