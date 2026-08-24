<script lang="ts">
	import { placeholderImage, type PlaceholderKind } from '$lib/domain/placeholder';

	/**
	 * An `<img>` that always renders something.
	 *
	 * Three ways an image on this site fails, and this handles all three the
	 * same way: the column is null or empty (an imported creator with no avatar),
	 * the upload behind it is gone, or the host refuses — including the
	 * Content-Security-Policy refusing every remote host, which is what happens
	 * to a scraped avatar URL today.
	 *
	 * A null `src` never reaches the DOM: `src=""` makes the browser re-request
	 * the page and draw *that* as a broken image. The placeholder is drawn
	 * instead, from `$lib/domain/placeholder.ts`, before the first paint.
	 *
	 * No page should write its own `<img>` for a value that came out of the
	 * database — use this, the way forms use the shared field components.
	 */
	let {
		src,
		alt,
		kind = 'media',
		seed = '',
		label = '',
		class: className = '',
		...rest
	}: {
		src?: string | null;
		alt: string;
		/** Which artwork to draw when there is nothing to show. */
		kind?: PlaceholderKind;
		/** Stable identity — a username or slug — so the colour never changes. */
		seed?: string;
		/** Drawn as initials by the `avatar` and `logo` kinds. Defaults to `alt`. */
		label?: string;
		class?: string;
		width?: number | string;
		height?: number | string;
		loading?: 'lazy' | 'eager';
		decoding?: 'async' | 'sync' | 'auto';
	} = $props();

	const fallback = $derived(placeholderImage(kind, seed || label || alt, label || alt));

	/**
	 * The `src` that failed, rather than a boolean: a card recycled onto a new
	 * creator gets a new `src`, and that one deserves its own attempt.
	 */
	let failed = $state<string | null>(null);

	const resolved = $derived(src && src !== failed ? src : fallback);

	let element = $state<HTMLImageElement | null>(null);

	/**
	 * The `onerror` above only catches images that fail *after* hydration
	 * attaches it. The server renders the real `src`, the browser starts
	 * fetching it while the page is still parsing, and a URL that fails fast —
	 * a dead host, or the CSP refusing it outright — has already fired `error`
	 * into nothing by the time this component is alive. Such an image is left
	 * `complete` with no intrinsic width, which is the only way to tell it apart
	 * from one still in flight, so check for it once the element exists.
	 */
	$effect(() => {
		if (element && element.complete && element.naturalWidth === 0 && src) failed = src;
	});
</script>

<img
	bind:this={element}
	src={resolved}
	{alt}
	class={className}
	onerror={() => (failed = src ?? null)}
	{...rest}
/>
