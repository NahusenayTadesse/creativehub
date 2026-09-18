<script lang="ts">
	import { resolve } from '$app/paths';
	import * as m from '$lib/paraglide/messages';
	import AppImage from '$lib/components/app-image.svelte';
	import * as Carousel from '$lib/components/ui/carousel/index.js';
	import type { CarouselAPI } from '$lib/components/ui/carousel/context.js';
	import { CarouselPager } from '$lib/carousel-pager.svelte.js';
	import { formatPostDate } from '$lib/blog';
	import { ArrowRight, ChevronLeft, ChevronRight, Newspaper } from '@lucide/svelte';

	/**
	 * The homepage's blog strip.
	 *
	 * The card is the reference design's insight card — a picture, a small
	 * coloured kicker naming the section and the reading time, a tight headline,
	 * a line of standfirst, and "Read blog" pinned to the bottom edge so a row
	 * of cards of different lengths still ends on one line.
	 *
	 * What the reference draws as a three-column grid is a carousel here, for
	 * the reason the trending strip is one: a grid shows whatever fits and
	 * silently drops the rest, and the blog is the one section on this page that
	 * grows every week. Same Embla, same arrows, same dots — a second slider on
	 * one page that behaved differently from the first would be a bug a reader
	 * feels before they can name it.
	 */
	type Post = {
		id: number;
		title: string;
		slug: string;
		excerpt: string | null;
		featuredImage: string | null;
		featuredImageAlt: string | null;
		readingMinutes: number;
		publishedAt: Date | string | null;
		categoryName: string | null;
	};

	let { posts }: { posts: Post[] } = $props();

	let api = $state<CarouselAPI>();
	const pager = new CarouselPager();
	$effect(() => pager.watch(api));

	const arrowButton =
		'place-items-center rounded-full border-2 border-edge bg-surface text-ink shadow-[3px_3px_0px_0px_rgb(var(--bento-shadow))] transition-all hover:bg-brand-soft hover:shadow-[4px_4px_0px_0px_rgb(var(--bento-shadow))] focus-visible:ring-2 focus-visible:ring-brand-strong focus-visible:outline-none active:shadow-[1px_1px_0px_0px_rgb(var(--bento-shadow))]';

	/**
	 * The line above the headline: the section, then how long the piece takes.
	 *
	 * Joined here rather than in the markup so a post with no section and no
	 * measured reading time produces nothing at all, instead of a stray
	 * separator floating above the title.
	 */
	const kicker = (post: Post) =>
		[
			post.categoryName,
			post.readingMinutes ? m.bp_read_minutes({ minutes: post.readingMinutes }) : ''
		]
			.filter(Boolean)
			.join(' · ');
</script>

<section class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
	<Carousel.Root
		opts={{ align: 'start', containScroll: 'trimSnaps', slidesToScroll: 'auto' }}
		setApi={(instance) => (api = instance)}
		onkeydown={pager.onkeydown}
		aria-label={m.home_blog_title()}
		class="space-y-6"
	>
		<!-- The reference's header: eyebrow, headline, and the way out to the
		     whole section, with the two ends of the row aligned on their
		     baselines rather than their boxes. -->
		<div class="flex flex-wrap items-end justify-between gap-4">
			<div>
				<div
					class="flex items-center gap-2 text-xs font-bold tracking-wider text-brand-fg uppercase"
				>
					<Newspaper class="h-4 w-4" />
					<span>{m.home_blog_eyebrow()}</span>
				</div>
				<h2 class="mt-1 text-xl font-extrabold text-ink sm:text-2xl">{m.home_blog_title()}</h2>
			</div>

			<div class="flex items-center gap-4">
				<a
					href={resolve('/blog')}
					class="flex items-center gap-1 text-xs font-bold text-brand-soft-fg hover:text-brand-fg"
				>
					<span>{m.home_blog_all()}</span>
					<ArrowRight class="h-3.5 w-3.5" />
				</a>

				{#if pager.count > 1}
					<span
						class="rounded-full border-2 border-edge bg-surface px-2.5 py-1 text-[11px] font-black text-ink tabular-nums shadow-[2px_2px_0px_0px_rgb(var(--bento-shadow))]"
						aria-live="polite"
					>
						{m.home_trending_page({ current: pager.index + 1, total: pager.count })}
					</span>
				{/if}
			</div>
		</div>

		<div class="space-y-4">
			<!-- Cards sized to leave the next one peeking in at every width, so the
			     row reads as cut off rather than finished. -->
			<div class="relative">
				<Carousel.Content class="py-2">
					{#each posts as post (post.id)}
						<Carousel.Item
							class="flex basis-[84%] last:pe-2 sm:basis-[55%] lg:basis-[38%] xl:basis-[31.5%]"
						>
							<!-- `p-0!` and not `p-0`: `.bento-card` is declared outside Tailwind's
							     layers, so an unimportant utility loses to it however specific
							     it looks, and the picture would sit inset from the border. -->
							<a
								href={resolve(`/blog/${post.slug}`)}
								class="bento-card group flex w-full flex-col overflow-hidden p-0!"
							>
								<div class="aspect-[16/9] w-full shrink-0 overflow-hidden border-b-2 border-edge">
									<AppImage
										src={post.featuredImage}
										alt={post.featuredImageAlt ?? post.title}
										kind="cover"
										seed={post.slug}
										class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
										loading="lazy"
										decoding="async"
									/>
								</div>

								<div class="flex flex-1 flex-col p-5 sm:p-6">
									{#if kicker(post)}
										<p class="text-[11px] font-black tracking-[0.14em] text-brand-fg uppercase">
											{kicker(post)}
										</p>
									{/if}

									<h3
										class="mt-3 line-clamp-2 text-lg font-black tracking-tight text-pretty text-ink sm:text-xl"
									>
										{post.title}
									</h3>

									{#if post.excerpt}
										<p
											class="mt-2.5 line-clamp-3 text-xs leading-relaxed font-medium text-ink-soft"
										>
											{post.excerpt}
										</p>
									{/if}

									<!-- `mt-auto` is what pins this to the bottom edge, so a row of
									     cards with standfirsts of different lengths still ends on
									     one line — the whole point of the reference's card. -->
									<div
										class="mt-auto flex items-center justify-between gap-3 border-t-2 border-edge-soft pt-4"
									>
										<span class="flex items-center gap-1 text-xs font-black text-brand-fg">
											{m.home_blog_read()}
											<ArrowRight
												class="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
											/>
										</span>
										{#if post.publishedAt}
											<time
												datetime={new Date(post.publishedAt).toISOString()}
												class="shrink-0 text-[11px] font-bold text-ink-dim"
											>
												{formatPostDate(post.publishedAt)}
											</time>
										{/if}
									</div>
								</div>
							</a>
						</Carousel.Item>
					{/each}
				</Carousel.Content>

				<!-- A fade on whichever edge has more behind it, so the peeking card
				     reads as cut off by the strip rather than by the page. -->
				<div
					class="pointer-events-none absolute inset-y-0 end-0 w-10 bg-gradient-to-l from-background to-transparent transition-opacity duration-300 sm:w-16 {pager.canNext
						? 'opacity-100'
						: 'opacity-0'}"
				></div>
				<div
					class="pointer-events-none absolute inset-y-0 start-0 w-10 bg-gradient-to-r from-background to-transparent transition-opacity duration-300 sm:w-16 {pager.canPrev
						? 'opacity-100'
						: 'opacity-0'}"
				></div>

				<!-- Arrows on the track itself from `sm` up. They leave rather than
				     grey out at an end: a dead button mid-strip is noise. -->
				<button
					type="button"
					aria-label={m.tbl_previous()}
					onclick={() => pager.prev()}
					tabindex={pager.canPrev ? 0 : -1}
					class="{arrowButton} absolute -start-3 top-1/2 z-10 hidden size-12 -translate-y-1/2 sm:grid lg:-start-5 {pager.canPrev
						? 'opacity-100'
						: 'pointer-events-none opacity-0'}"
				>
					<ChevronLeft class="h-6 w-6" strokeWidth={3} />
				</button>
				<button
					type="button"
					aria-label={m.tbl_next()}
					onclick={() => pager.next()}
					tabindex={pager.canNext ? 0 : -1}
					class="{arrowButton} absolute -end-3 top-1/2 z-10 hidden size-12 -translate-y-1/2 sm:grid lg:-end-5 {pager.canNext
						? 'opacity-100'
						: 'pointer-events-none opacity-0'}"
				>
					<ChevronRight class="h-6 w-6" strokeWidth={3} />
				</button>
			</div>

			<!-- Where you are, and a way to get anywhere else. On a phone the arrows
			     live here, beside the dots, clear of the cards. -->
			{#if pager.count > 1}
				<div class="flex items-center justify-center gap-3">
					<button
						type="button"
						aria-label={m.tbl_previous()}
						onclick={() => pager.prev()}
						disabled={!pager.canPrev}
						class="{arrowButton} grid size-10 disabled:pointer-events-none disabled:opacity-40 disabled:shadow-none sm:hidden"
					>
						<ChevronLeft class="h-5 w-5" strokeWidth={3} />
					</button>

					<div class="flex flex-wrap items-center justify-center gap-2">
						{#each { length: pager.count }, index (index)}
							<button
								type="button"
								aria-label={m.home_trending_go_to({ index: index + 1 })}
								aria-current={index === pager.index}
								onclick={() => pager.go(index)}
								class="h-3 rounded-full border-2 border-edge transition-all {index === pager.index
									? 'w-8 bg-brand-strong'
									: 'w-3 bg-ink-dim hover:bg-brand-strong'}"
							></button>
						{/each}
					</div>

					<button
						type="button"
						aria-label={m.tbl_next()}
						onclick={() => pager.next()}
						disabled={!pager.canNext}
						class="{arrowButton} grid size-10 disabled:pointer-events-none disabled:opacity-40 disabled:shadow-none sm:hidden"
					>
						<ChevronRight class="h-5 w-5" strokeWidth={3} />
					</button>
				</div>
			{/if}
		</div>
	</Carousel.Root>
</section>
