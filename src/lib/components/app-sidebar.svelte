<script lang="ts">
	import {
		LayoutDashboard,
		Users,
		Megaphone,
		Send,
		Handshake,
		ShieldCheck,
		Star,
		Package,
		Image,
		Radio,
		Building2,
		Bookmark,
		Globe,
		Tags,
		Languages,
		Settings,
		UserRoundCog,
		ScrollText
	} from '@lucide/svelte';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import { useSidebar } from '$lib/components/ui/sidebar/index.js';
	import NavMain from './NavMain.svelte';
	import type { ComponentProps } from 'svelte';

	let {
		role = 'creator',
		counts = {},
		...restProps
	}: ComponentProps<typeof Sidebar.Root> & {
		role?: string;
		counts?: Record<string, number>;
	} = $props();

	/** Each role gets only the sections it can actually act on. */
	const navigation = $derived.by(() => {
		const overview = {
			section: null,
			items: [{ title: 'Overview', url: '/dashboard', icon: LayoutDashboard }]
		};

		if (role === 'creator') {
			return [
				overview,
				{
					section: 'My work',
					items: [
						{ title: 'Bookings', url: '/dashboard/bookings', icon: Handshake, counter: counts.bookings },
						{ title: 'Applications', url: '/dashboard/applications', icon: Send, counter: counts.applications },
						{ title: 'Reviews', url: '/dashboard/reviews', icon: Star }
					]
				},
				{
					section: 'My profile',
					items: [
						{ title: 'Profile', url: '/dashboard/profile', icon: UserRoundCog },
						{ title: 'Packages', url: '/dashboard/packages', icon: Package },
						{ title: 'Channels', url: '/dashboard/channels', icon: Radio },
						{ title: 'Portfolio', url: '/dashboard/portfolio', icon: Image },
						{ title: 'Verification', url: '/dashboard/verification', icon: ShieldCheck }
					]
				}
			];
		}

		if (role === 'business') {
			return [
				overview,
				{
					section: 'Campaigns',
					items: [
						{ title: 'My campaigns', url: '/dashboard/campaigns', icon: Megaphone },
						{ title: 'Applications', url: '/dashboard/applications', icon: Send, counter: counts.applications },
						{ title: 'Bookings', url: '/dashboard/bookings', icon: Handshake, counter: counts.bookings }
					]
				},
				{
					section: 'Organisation',
					items: [
						{ title: 'Shortlist', url: '/dashboard/shortlist', icon: Bookmark },
						{ title: 'Organisation', url: '/dashboard/organization', icon: Building2 },
						{ title: 'Verification', url: '/dashboard/verification', icon: ShieldCheck }
					]
				}
			];
		}

		/* Admin operator */
		return [
			overview,
			{
				section: 'Operations',
				items: [
					{
						title: 'Verification queue',
						url: '/dashboard/admin/verification',
						icon: ShieldCheck,
						counter: counts.verifications
					},
					{ title: 'All bookings', url: '/dashboard/bookings', icon: Handshake, counter: counts.bookings },
					{ title: 'All campaigns', url: '/dashboard/campaigns', icon: Megaphone },
					{ title: 'Audit log', url: '/dashboard/admin/audit', icon: ScrollText }
				]
			},
			{
				section: 'Marketplace',
				items: [
					{ title: 'Creators', url: '/dashboard/admin/creators', icon: Users },
					{ title: 'Organisations', url: '/dashboard/admin/organizations', icon: Building2 },
					{ title: 'Users & roles', url: '/dashboard/admin/users', icon: UserRoundCog }
				]
			},
			{
				section: 'Reference data',
				items: [
					{
						title: 'Countries',
						url: '/dashboard/admin/countries',
						icon: Globe,
						items: [
							{ title: 'Countries', url: '/dashboard/admin/countries' },
							{ title: 'Regions', url: '/dashboard/admin/regions' }
						]
					},
					{ title: 'Categories', url: '/dashboard/admin/categories', icon: Tags },
					{ title: 'Platforms', url: '/dashboard/admin/platforms', icon: Radio },
					{ title: 'Languages', url: '/dashboard/admin/languages', icon: Languages },
					{ title: 'Site settings', url: '/dashboard/admin/settings', icon: Settings }
				]
			}
		];
	});

	const sidebar = useSidebar();
	function closeSidebar() {
		if (sidebar.isMobile) sidebar.setOpenMobile(false);
	}

	const roleLabel = $derived(
		role === 'admin' ? 'Operator' : role === 'business' ? 'Brand' : 'Creator'
	);
</script>

<Sidebar.Root collapsible="offcanvas" {...restProps}>
	<Sidebar.Content
		class="thin-scroll z-[9999] flex h-full flex-col overflow-y-auto bg-white pt-0"
	>
		<div class="sticky top-0 z-10 border-b-2 border-slate-900 bg-white px-4 py-4">
			<a href="/" title="Go to the public site" class="flex flex-row items-center gap-2">
				<div
					class="flex h-8 w-8 items-center justify-center rounded-xl border-2 border-slate-900 bg-slate-900 text-sm font-black text-white shadow-[2px_2px_0px_0px_rgba(16,185,129,1)]"
				>
					ET
				</div>
				<div>
					<div class="text-[13px] font-black tracking-tight text-slate-900">Creator Network</div>
					<div class="text-[10px] font-bold tracking-widest text-slate-500 uppercase">
						{roleLabel} dashboard
					</div>
				</div>
			</a>
		</div>

		<div class="flex-1 py-2">
			<NavMain {closeSidebar} sections={navigation} />
		</div>
	</Sidebar.Content>
</Sidebar.Root>
