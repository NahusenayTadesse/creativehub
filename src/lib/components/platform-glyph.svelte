<script lang="ts">
	import { siFacebook, siInstagram, siTelegram, siTiktok, siX, siYoutube } from 'simple-icons';

	/**
	 * A platform's own logo, small, beside a figure measured on that platform.
	 *
	 * The shapes come from Simple Icons (CC0), imported one by one so the bundle
	 * carries six paths rather than the whole library. A platform it does not
	 * carry — LinkedIn asked to be removed from it — gets its initial on the
	 * platform's colour instead of a wrong or missing picture.
	 *
	 * TikTok and X are black marks, and a black mark on a dark card is no mark
	 * at all, so those two draw in an ink colour rather than their own — which
	 * one is `monoClass`, because the caller is the only one that knows what it
	 * has put behind them. It is a prop rather than something passed in `class`
	 * for a reason: both would be colour utilities of the same specificity, and
	 * which of the two won would be decided by their order in the generated
	 * stylesheet rather than by the caller. It happened to come out right; that
	 * is not the same as being right.
	 */
	let {
		name,
		/** Used for the fallback badge. `platforms.color`, when the caller has it. */
		color = '',
		/** The ink a monochrome mark draws in — override it on a dark background. */
		monoClass = 'text-ink',
		class: className = 'size-5'
	}: {
		name: string | null | undefined;
		color?: string;
		monoClass?: string;
		class?: string;
	} = $props();

	const ICONS = {
		instagram: siInstagram,
		tiktok: siTiktok,
		youtube: siYoutube,
		telegram: siTelegram,
		facebook: siFacebook,
		x: siX,
		twitter: siX
	} as const;

	const icon = $derived(ICONS[(name ?? '').trim().toLowerCase() as keyof typeof ICONS]);
	const monochrome = $derived(icon === siTiktok || icon === siX);
</script>

{#if icon}
	<svg
		role="img"
		viewBox="0 0 24 24"
		class="shrink-0 {className} {monochrome ? `fill-current ${monoClass}` : ''}"
		style:fill={monochrome ? undefined : `#${icon.hex}`}
		aria-label={icon.title}
	>
		<path d={icon.path} />
	</svg>
{:else if name}
	<span
		role="img"
		aria-label={name}
		class="grid shrink-0 place-items-center rounded-md text-[10px] font-black text-white {className}"
		style:background-color={color || '#384860'}
	>
		{name.trim().charAt(0).toUpperCase()}
	</span>
{/if}
