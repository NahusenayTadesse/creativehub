<script lang="ts">
	import SiteNav from '$lib/components/site-nav.svelte';
	import SiteFooter from '$lib/components/site-footer.svelte';
	import BottomNav, { type BottomNavItem } from '$lib/components/bottom-nav.svelte';
	import { resolveLogos } from '$lib/brand';
	import { resolve } from '$app/paths';
	import { Home, Compass, Megaphone, Newspaper, CircleUserRound } from '@lucide/svelte';
	import * as m from '$lib/paraglide/messages';

	let { data, children } = $props();

	/* Resolved once for the shell rather than in each of the two components, so
	   the header and the footer cannot end up drawing different marks. */
	const logos = $derived(resolveLogos(data.settings));

	/**
	 * The four public destinations, plus the way in to an account.
	 *
	 * The same four the header carries, in the same order, so the bar is not a
	 * second opinion about what this site is for. The last slot changes with who
	 * is asking: a signed-in reader has a dashboard to go back to, and everyone
	 * else has a sign-in.
	 */
	const bottomNav = $derived<BottomNavItem[]>([
		{ title: m.bnav_home(), icon: Home, url: resolve('/') },
		{ title: m.bnav_discover(), icon: Compass, url: resolve('/discover'), match: 'prefix' },
		{ title: m.bnav_campaigns(), icon: Megaphone, url: resolve('/campaigns'), match: 'prefix' },
		{ title: m.bnav_blog(), icon: Newspaper, url: resolve('/blog'), match: 'prefix' },
		data.user
			? { title: m.bnav_account(), icon: CircleUserRound, url: resolve('/dashboard') }
			: { title: m.bnav_signin(), icon: CircleUserRound, url: resolve('/login') }
	]);
</script>

<div class="flex min-h-screen flex-col justify-between font-sans text-ink selection:bg-brand-soft">
	<SiteNav user={data.user} {logos} />

	<main class="flex-1">
		{@render children()}
	</main>

	<!-- Room for the fixed bar, so the footer's last line is not underneath it. -->
	<div class="pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0">
		<SiteFooter categories={data.reference.categories} regions={data.reference.regions} {logos} />
	</div>
</div>

<BottomNav items={bottomNav} />
