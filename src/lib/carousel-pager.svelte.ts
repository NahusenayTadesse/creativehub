import type { CarouselAPI } from '$lib/components/ui/carousel/context.js';

/**
 * The controls a carousel needs and Embla does not give you as state.
 *
 * Embla exposes `selectedScrollSnap()`, `scrollSnapList()` and the two
 * `canScroll*()` predicates as method calls that change under you without
 * telling Svelte, so anything drawn from them — a dot per page, an arrow that
 * leaves at the end, a "3 of 7" chip — has to be mirrored into `$state` and
 * re-read on `select` and `reInit`. That mirroring is about fifteen lines of
 * glue, and it was written once for the trending strip and needed again the
 * moment a second strip appeared on the same page.
 *
 * Pages, not cards. The arrows and the dots move by a screenful, because the
 * number of cards in one is a function of the viewport — four on a desktop,
 * one on a phone — and a dot per *card* on a phone is forty dots. `reInit` is
 * what re-reads that count when the window is resized.
 */
export class CarouselPager {
	/** The page on screen, zero-based. */
	index = $state(0);
	/** How many pages there are. Zero until Embla has measured. */
	count = $state(0);
	canPrev = $state(false);
	canNext = $state(false);

	#api: CarouselAPI | undefined = undefined;

	/**
	 * Binds to an Embla instance.
	 *
	 * Call it from a `$effect` and return what it returns: the listeners have to
	 * come off when the carousel is rebuilt, and an effect that forgets to
	 * detach leaves the old instance writing into this one's state.
	 */
	watch(api: CarouselAPI | undefined): (() => void) | undefined {
		this.#api = api;
		if (!api) return;

		const sync = () => {
			this.index = api.selectedScrollSnap();
			this.count = api.scrollSnapList().length;
			this.canPrev = api.canScrollPrev();
			this.canNext = api.canScrollNext();
		};

		sync();
		api.on('select', sync).on('reInit', sync);
		return () => {
			api.off('select', sync).off('reInit', sync);
		};
	}

	prev() {
		this.#api?.scrollPrev();
	}

	next() {
		this.#api?.scrollNext();
	}

	go(index: number) {
		this.#api?.scrollTo(index);
	}

	/**
	 * Arrow keys page the strip whenever focus is anywhere inside it — on a
	 * card, a chip or a control — so a keyboard reader is not sent hunting for
	 * the buttons.
	 *
	 * A field rather than a method: it is handed straight to `onkeydown`, and a
	 * prototype method passed that way loses its `this`.
	 */
	onkeydown = (event: KeyboardEvent) => {
		const target = event.target as HTMLElement | null;
		/* Inside a text field the arrows move the caret, and that wins. */
		if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;

		if (event.key === 'ArrowLeft' && this.canPrev) {
			event.preventDefault();
			this.prev();
		} else if (event.key === 'ArrowRight' && this.canNext) {
			event.preventDefault();
			this.next();
		}
	};
}
