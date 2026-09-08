<script lang="ts">
	import { DEFAULT_LOGOS, type Logos } from '$lib/brand';
	import * as m from '$lib/paraglide/messages';

	/**
	 * The brand, drawn at whatever size the caller asks for.
	 *
	 * Three images and never more than one visible. The wide wordmark carries
	 * the name and the tagline and needs about 140px to stay legible, which a
	 * 360px phone header does not have once a menu button and a language toggle
	 * are on it — so below `sm` this falls back to the textless square, which is
	 * the whole reason that file exists.
	 *
	 * The theme swap is two files rather than one file and a CSS filter, because
	 * the only filter that lifts black text to white also turns the red mark
	 * cyan. `scripts/build-brand-assets.sh` generates the dark copy by masking
	 * the negation to the greyscale parts.
	 *
	 * Every variant is in the markup at all times and hidden with CSS, not with
	 * `{#if}`: the theme is stamped on `<html>` before first paint and the
	 * breakpoint is the viewport's business, so neither is known on the server,
	 * and deciding either in JavaScript means the wrong mark on first paint.
	 */

	let {
		logos = null,
		/** `responsive` swaps at `sm`; the other two are for callers with a fixed
		    amount of room, like the collapsed sidebar or a tab icon. */
		variant = 'responsive',
		/** Tailwind height for the wordmark. The mark is squared off `markClass`. */
		heightClass = 'h-9',
		markClass = 'h-9 w-9',
		/** Shown beside the square mark, since that file carries no name. */
		showNameWithMark = true,
		/**
		 * Pins the dark artwork whatever the theme says.
		 *
		 * For the footer, which is a slab: a band that stays dark in *both*
		 * themes. Left to swap on `.dark`, it would draw the black-text wordmark
		 * onto a near-black ground for every light-theme reader.
		 */
		onSlab = false
	}: {
		logos?: Logos | null;
		variant?: 'responsive' | 'wordmark' | 'mark';
		heightClass?: string;
		markClass?: string;
		showNameWithMark?: boolean;
		onSlab?: boolean;
	} = $props();

	/* A caller that has no settings to hand — an auth page outside the app
	   shell — still gets the shipped identity rather than four broken images. */
	const art = $derived<Logos>(logos ?? { ...DEFAULT_LOGOS });

	/* One alt between all three: they are the same logo at different widths, and
	   a screen reader that met each of them separately would hear the brand
	   name three times on one link. Only the visible one is ever announced, but
	   only because the others are `display: none` — which is exactly why they
	   are hidden that way rather than with `opacity`. */
	const alt = $derived(m.brand_name());
</script>

{#snippet wordmark()}
	{#if onSlab}
		<img src={art.wordmarkDark} {alt} class="{heightClass} w-auto" />
	{:else}
		<img src={art.wordmark} {alt} class="{heightClass} w-auto dark:hidden" />
		<img src={art.wordmarkDark} {alt} class="hidden {heightClass} w-auto dark:block" />
	{/if}
{/snippet}

{#snippet mark()}
	<img src={art.mark} {alt} class="{markClass} shrink-0" />
{/snippet}

{#if variant === 'wordmark'}
	{@render wordmark()}
{:else if variant === 'mark'}
	{@render mark()}
{:else}
	<!-- `contents` rather than `block`: the two wordmarks must stay direct
	     children of the caller's flex row, or they inherit a wrapper's width
	     instead of their own. -->
	<span class="hidden sm:contents">{@render wordmark()}</span>
	<span class="flex items-center gap-2 sm:hidden">
		{@render mark()}
		{#if showNameWithMark}
			<span class="truncate text-lg font-black tracking-tight text-ink">{m.brand_name()}</span>
		{/if}
	</span>
{/if}
