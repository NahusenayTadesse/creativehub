<script lang="ts">
	import * as m from '$lib/paraglide/messages';
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
		Flame,
		Building2,
		Bookmark,
		Globe,
		Tags,
		Languages,
		Settings,
		GalleryHorizontal,
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
			items: [{ title: m.sb_overview(), url: '/dashboard', icon: LayoutDashboard }]
		};

		if (role === 'creator') {
			return [
				overview,
				{
					section: m.sb_my_work(),
					items: [
						{
							title: m.sb_bookings(),
							url: '/dashboard/bookings',
							icon: Handshake,
							counter: counts.bookings
						},
						{
							title: m.sb_applications(),
							url: '/dashboard/applications',
							icon: Send,
							counter: counts.applications
						},
						{ title: m.sb_reviews(), url: '/dashboard/reviews', icon: Star }
					]
				},
				{
					section: m.sb_my_profile(),
					items: [
						{ title: m.sb_profile(), url: '/dashboard/profile', icon: UserRoundCog },
						{ title: m.sb_packages(), url: '/dashboard/packages', icon: Package },
						{ title: m.sb_channels(), url: '/dashboard/channels', icon: Radio },
						{ title: m.sb_portfolio(), url: '/dashboard/portfolio', icon: Image },
						{ title: m.sb_verification(), url: '/dashboard/verification', icon: ShieldCheck }
					]
				}
			];
		}

		if (role === 'business') {
			return [
				overview,
				{
					section: m.sb_campaigns(),
					items: [
						{ title: m.sb_my_campaigns(), url: '/dashboard/campaigns', icon: Megaphone },
						{
							title: m.sb_applications(),
							url: '/dashboard/applications',
							icon: Send,
							counter: counts.applications
						},
						{
							title: m.sb_bookings(),
							url: '/dashboard/bookings',
							icon: Handshake,
							counter: counts.bookings
						}
					]
				},
				{
					section: m.sb_organisation(),
					items: [
						{ title: m.sb_shortlist(), url: '/dashboard/shortlist', icon: Bookmark },
						{ title: m.sb_organisation(), url: '/dashboard/organization', icon: Building2 },
						{ title: m.sb_verification(), url: '/dashboard/verification', icon: ShieldCheck }
					]
				}
			];
		}

		/* Admin operator */
		return [
			overview,
			{
				section: m.sb_operations(),
				items: [
					{
						title: m.sb_verification_queue(),
						url: '/dashboard/admin/verification',
						icon: ShieldCheck,
						counter: counts.verifications
					},
					{
						title: m.sb_all_bookings(),
						url: '/dashboard/bookings',
						icon: Handshake,
						counter: counts.bookings
					},
					{ title: m.sb_all_campaigns(), url: '/dashboard/campaigns', icon: Megaphone },
					{ title: m.sb_audit_log(), url: '/dashboard/admin/audit', icon: ScrollText }
				]
			},
			{
				section: m.sb_marketplace(),
				items: [
					{ title: m.sb_creators(), url: '/dashboard/admin/creators', icon: Users },
					{ title: m.sb_trending(), url: '/dashboard/admin/trending', icon: Flame },
					{ title: m.sb_organisations(), url: '/dashboard/admin/organizations', icon: Building2 },
					{ title: m.sb_users_roles(), url: '/dashboard/admin/users', icon: UserRoundCog }
				]
			},
			{
				section: m.sb_reference_data(),
				items: [
					{
						title: m.sb_countries(),
						url: '/dashboard/admin/countries',
						icon: Globe,
						items: [
							{ title: m.sb_countries(), url: '/dashboard/admin/countries' },
							{ title: m.sb_regions(), url: '/dashboard/admin/regions' }
						]
					},
					{ title: m.sb_categories(), url: '/dashboard/admin/categories', icon: Tags },
					{ title: m.sb_platforms(), url: '/dashboard/admin/platforms', icon: Radio },
					{ title: m.sb_languages(), url: '/dashboard/admin/languages', icon: Languages },
					{ title: m.sb_gallery(), url: '/dashboard/admin/gallery', icon: GalleryHorizontal },
					{ title: m.sb_site_settings(), url: '/dashboard/admin/settings', icon: Settings }
				]
			}
		];
	});

	const sidebar = useSidebar();
	function closeSidebar() {
		if (sidebar.isMobile) sidebar.setOpenMobile(false);
	}

	const roleLabel = $derived(
		role === 'admin'
			? m.sb_role_operator()
			: role === 'business'
				? m.sb_role_brand()
				: m.sb_role_creator()
	);
</script>

<Sidebar.Root collapsible="offcanvas" {...restProps}>
	<Sidebar.Content class="thin-scroll z-[9999] flex h-full flex-col overflow-y-auto bg-white pt-0">
		<div class="sticky top-0 z-10 border-b-2 border-slate-900 bg-white px-4 py-4">
			<a href="/" title={m.sb_go_public_site()} class="flex flex-row items-center gap-2">
				<div
					class="flex h-8 w-8 items-center justify-center rounded-xl border-2 border-slate-900 bg-slate-900 text-sm font-black text-white shadow-[2px_2px_0px_0px_rgba(16,185,129,1)]"
				>
					ET
				</div>
				<div>
					<div class="text-[13px] font-black tracking-tight text-slate-900">{m.brand_name()}</div>
					<div class="text-[10px] font-bold tracking-widest text-slate-500 uppercase">
						{m.sb_role_dashboard({ role: roleLabel })}
					</div>
				</div>
			</a>
		</div>

		<div class="flex-1 py-2">
			<NavMain {closeSidebar} sections={navigation} />
		</div>
	</Sidebar.Content>
</Sidebar.Root>
