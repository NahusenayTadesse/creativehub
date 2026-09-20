<script lang="ts">
	import { resolve } from '$app/paths';
	import BottomNav, { type BottomNavItem } from './bottom-nav.svelte';
	import { useSidebar } from '$lib/components/ui/sidebar/index.js';
	import {
		LayoutDashboard,
		Handshake,
		Send,
		UserRoundCog,
		Megaphone,
		Bookmark,
		Users,
		Building2,
		ShieldCheck,
		Menu
	} from '@lucide/svelte';
	import * as m from '$lib/paraglide/messages';

	/**
	 * The dashboard's own bottom bar: four destinations and the way to the rest.
	 *
	 * The sidebar holds everything a role can reach — a creator's is fourteen
	 * entries deep — and a bar of five cannot be a shorter copy of it without
	 * choosing. What it carries is the work: the pages somebody opens several
	 * times a day, the ones with a counter that changes. Everything else stays
	 * one tap away behind the last slot, which opens the full sidebar rather
	 * than navigating, so nothing is actually removed from a phone.
	 *
	 * Separate from the layout because `useSidebar()` has to be called under
	 * `Sidebar.Provider`, and the layout *is* the provider.
	 */
	/* `role` is a plain string for the same reason it is on `AppSidebar`: the
	   layout reads it off the session, where it is whatever the column holds.
	   The `default` branch below is what an unrecognised value falls into. */
	let { role = 'creator', counts }: { role?: string; counts: Record<string, number> } = $props();

	const sidebar = useSidebar();

	const overview: BottomNavItem = {
		title: m.bnav_overview(),
		icon: LayoutDashboard,
		url: resolve('/dashboard')
	};

	/** Opens the sidebar sheet — the same one the header's trigger opens. */
	const menu: BottomNavItem = {
		title: m.bnav_menu(),
		icon: Menu,
		onSelect: () => sidebar.setOpenMobile(true)
	};

	const items = $derived.by<BottomNavItem[]>(() => {
		switch (role) {
			case 'creator':
				return [
					overview,
					{
						title: m.bnav_bookings(),
						icon: Handshake,
						url: resolve('/dashboard/bookings'),
						match: 'prefix',
						counter: counts.bookings
					},
					{
						title: m.bnav_applications(),
						icon: Send,
						url: resolve('/dashboard/applications'),
						match: 'prefix',
						counter: counts.applications
					},
					{
						title: m.bnav_profile(),
						icon: UserRoundCog,
						url: resolve('/dashboard/profile'),
						match: 'prefix'
					},
					menu
				];

			case 'business':
				return [
					overview,
					{
						title: m.bnav_campaigns(),
						icon: Megaphone,
						url: resolve('/dashboard/campaigns'),
						match: 'prefix'
					},
					{
						title: m.bnav_applications(),
						icon: Send,
						url: resolve('/dashboard/applications'),
						match: 'prefix',
						counter: counts.applications
					},
					{
						title: m.bnav_shortlist(),
						icon: Bookmark,
						url: resolve('/dashboard/shortlist'),
						match: 'prefix'
					},
					menu
				];

			case 'encoder':
				/*
				 * No overview: /dashboard has nothing to show an account with neither
				 * a profile nor an organisation, and the sidebar leaves it out for the
				 * same reason. The catalogue is the job, so the catalogue is the bar.
				 */
				return [
					{
						title: m.bnav_creators(),
						icon: Users,
						url: resolve('/dashboard/admin/creators'),
						match: 'prefix'
					},
					{
						title: m.bnav_brands(),
						icon: Building2,
						url: resolve('/dashboard/admin/organizations'),
						match: 'prefix'
					},
					{
						title: m.bnav_ownership(),
						icon: ShieldCheck,
						url: resolve('/dashboard/admin/channel-ownership'),
						match: 'prefix',
						counter: counts.channelOwnership
					},
					menu
				];

			default:
				/* An operator's day is the queues, so the two with a backlog lead. */
				return [
					overview,
					{
						title: m.bnav_queue(),
						icon: ShieldCheck,
						url: resolve('/dashboard/admin/verification'),
						match: 'prefix',
						counter: counts.verifications
					},
					{
						title: m.bnav_ownership(),
						icon: ShieldCheck,
						url: resolve('/dashboard/admin/channel-ownership'),
						match: 'prefix',
						counter: counts.channelOwnership
					},
					{
						title: m.bnav_creators(),
						icon: Users,
						url: resolve('/dashboard/admin/creators'),
						match: 'prefix'
					},
					menu
				];
		}
	});
</script>

<BottomNav {items} />
