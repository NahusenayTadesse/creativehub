/**
 * The launch screens iOS shows while an installed app starts.
 *
 * Android composes one from the manifest's icon and `background_color`. iOS
 * does not: without a `apple-touch-startup-image` that matches the device
 * exactly it shows a white rectangle for as long as the app takes to boot,
 * which is the most "this is a web page in a costume" moment an installed app
 * has.
 *
 * Matching is by media query on the CSS size and pixel ratio, and a file that
 * does not match one is ignored rather than scaled — hence a row per device
 * family per orientation. The images themselves are built by
 * `scripts/build-brand-assets.sh` at the pixel sizes below.
 *
 * `width` and `height` are the CSS dimensions in portrait; the ratio turns them
 * into the pixel size, and `portrait`/`landscape` swap them. Devices that share
 * a CSS size at different ratios — the iPhone XR and the XS Max are both
 * 414×896 — are told apart by `ratio`, which is why it is part of the query
 * rather than assumed.
 */
export type SplashScreen = {
	/** CSS pixels, portrait. */
	width: number;
	height: number;
	ratio: number;
	/** Which device families this row covers. For the reader of this file only. */
	note: string;
};

export const SPLASH_SCREENS: SplashScreen[] = [
	{ width: 393, height: 852, ratio: 3, note: 'iPhone 14/15/16 Pro' },
	{ width: 430, height: 932, ratio: 3, note: 'iPhone 14/15 Pro Max' },
	{ width: 390, height: 844, ratio: 3, note: 'iPhone 12/13/14' },
	{ width: 428, height: 926, ratio: 3, note: 'iPhone 12/13 Pro Max' },
	{ width: 375, height: 812, ratio: 3, note: 'iPhone X/XS/11 Pro' },
	{ width: 414, height: 896, ratio: 3, note: 'iPhone XS Max/11 Pro Max' },
	{ width: 414, height: 896, ratio: 2, note: 'iPhone XR/11' },
	{ width: 375, height: 667, ratio: 2, note: 'iPhone SE/8' },
	{ width: 820, height: 1180, ratio: 2, note: 'iPad Air' },
	{ width: 834, height: 1194, ratio: 2, note: 'iPad Pro 11"' }
];

export type SplashLink = { media: string; href: string };

/**
 * Both orientations of every screen above, as `<link>` attributes.
 *
 * The file is named by its pixel size, so the landscape copy of a 393×852
 * device is `splash-2556x1179.png` — the same numbers the other way round,
 * which is exactly how the build script names them.
 */
export function splashLinks(version: string): SplashLink[] {
	return SPLASH_SCREENS.flatMap(({ width, height, ratio }) => {
		const base = `(device-width: ${width}px) and (device-height: ${height}px) and (-webkit-device-pixel-ratio: ${ratio})`;
		const portrait = `${width * ratio}x${height * ratio}`;
		const landscape = `${height * ratio}x${width * ratio}`;
		return [
			{
				media: `${base} and (orientation: portrait)`,
				href: `/icons/splash/splash-${portrait}.png?v=${version}`
			},
			{
				media: `${base} and (orientation: landscape)`,
				href: `/icons/splash/splash-${landscape}.png?v=${version}`
			}
		];
	});
}
