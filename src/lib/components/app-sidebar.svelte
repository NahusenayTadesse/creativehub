<script lang="ts">
	import { resolve } from '$app/paths';
	import * as m from '$lib/paraglide/messages';
	import { PAYMENT_GATEWAY_ENABLED } from '$lib/payment-gateway';
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
		Newspaper,
		UserRoundCog,
		ScrollText,
		UserRoundCheck,
		SlidersHorizontal,
		Banknote,
		Gavel
	} from '@lucide/svelte';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import { useSidebar } from '$lib/components/ui/sidebar/index.js';
	import NavMain from './NavMain.svelte';
	import SiteLogo from './site-logo.svelte';
	import type { Logos } from '$lib/brand';
	import type { ComponentProps } from 'svelte';

	let {
		role = 'creator',
		counts = {},
		logos = null,
		...restProps
	}: ComponentProps<typeof Sidebar.Root> & {
		logos?: Logos | null;
		role?: string;
		counts?: Record<string, number>;
	} = $props();

	/** Each role gets only the sections it can actually act on. */
	const navigation = $derived.by(() => {
		const overview = {
			section: null,
			items: [{ title: m.sb_overview(), url: resolve('/dashboard'), icon: LayoutDashboard }]
		};

		/*
		 * Appended to every role rather than repeated in each branch: an account
		 * is an account whoever holds it, and three copies would drift.
		 *
		 * It carries a heading rather than `section: null` because NavMain keys
		 * its sections by that value, and the overview group is already null —
		 * two null keys is a duplicate key, which stops the whole dashboard
		 * hydrating rather than merely looking wrong.
		 */
		const withAccount = <T,>(sections: T[]) => [
			...sections,
			{
				section: m.sb_account(),
				items: [
					{
						title: m.sb_settings(),
						url: resolve('/dashboard/settings'),
						icon: SlidersHorizontal
					}
				]
			}
		];

		if (role === 'creator') {
			return withAccount([
				overview,
				{
					section: m.sb_my_work(),
					items: [
						{
							title: m.sb_bookings(),
							url: resolve('/dashboard/bookings'),
							icon: Handshake,
							counter: counts.bookings
						},
						{
							title: m.sb_applications(),
							url: resolve('/dashboard/applications'),
							icon: Send,
							counter: counts.applications
						},
						{ title: m.sb_reviews(), url: resolve('/dashboard/reviews'), icon: Star },
						/* Both payout pages 404 while the gateway is off — a creator has
						   nowhere to be paid from, so there is nothing to collect bank
						   details for. The entries come back with the switch. */
						...(PAYMENT_GATEWAY_ENABLED
							? [{ title: m.sb_payouts(), url: resolve('/dashboard/payouts'), icon: Banknote }]
							: [])
					]
				},
				{
					section: m.sb_my_profile(),
					items: [
						{ title: m.sb_profile(), url: resolve('/dashboard/profile'), icon: UserRoundCog },
						{ title: m.sb_packages(), url: resolve('/dashboard/packages'), icon: Package },
						{ title: m.sb_channels(), url: resolve('/dashboard/channels'), icon: Radio },
						{ title: m.sb_portfolio(), url: resolve('/dashboard/portfolio'), icon: Image },
						{
							title: m.sb_verification(),
							url: resolve('/dashboard/verification'),
							icon: ShieldCheck
						}
					]
				}
			]);
		}

		/* The reference tables, shared by the operator and the data encoder whose
		   whole job they are — one list, so the two cannot drift apart. */
		const referenceData = [
			{
				title: m.sb_countries(),
				url: resolve('/dashboard/admin/countries'),
				icon: Globe,
				items: [
					{ title: m.sb_countries(), url: resolve('/dashboard/admin/countries') },
					{ title: m.sb_regions(), url: resolve('/dashboard/admin/regions') }
				]
			},
			{ title: m.sb_categories(), url: resolve('/dashboard/admin/categories'), icon: Tags },
			{ title: m.sb_platforms(), url: resolve('/dashboard/admin/platforms'), icon: Radio },
			{ title: m.sb_languages(), url: resolve('/dashboard/admin/languages'), icon: Languages },
			{
				title: m.sb_gallery(),
				url: resolve('/dashboard/admin/gallery'),
				icon: GalleryHorizontal
			}
		];

		/*
		 * The data encoder keeps the reference tables and sees nothing else. There
		 * is no overview entry because /dashboard has nothing to show an account
		 * with neither a profile nor an organisation — it sends them here instead.
		 */
		if (role === 'encoder') {
			return withAccount([{ section: m.sb_reference_data(), items: referenceData }]);
		}

		if (role === 'business') {
			return withAccount([
				overview,
				{
					section: m.sb_campaigns(),
					items: [
						{ title: m.sb_my_campaigns(), url: resolve('/dashboard/campaigns'), icon: Megaphone },
						{
							title: m.sb_applications(),
							url: resolve('/dashboard/applications'),
							icon: Send,
							counter: counts.applications
						},
						{
							title: m.sb_bookings(),
							url: resolve('/dashboard/bookings'),
							icon: Handshake,
							counter: counts.bookings
						}
					]
				},
				{
					section: m.sb_organisation(),
					items: [
						{ title: m.sb_shortlist(), url: resolve('/dashboard/shortlist'), icon: Bookmark },
						{
							title: m.sb_organisation(),
							url: resolve('/dashboard/organization'),
							icon: Building2
						},
						{
							title: m.sb_verification(),
							url: resolve('/dashboard/verification'),
							icon: ShieldCheck
						}
					]
				}
			]);
		}

		/* Admin operator */
		return withAccount([
			overview,
			{
				section: m.sb_operations(),
				items: [
					{
						title: m.sb_verification_queue(),
						url: resolve('/dashboard/admin/verification'),
						icon: ShieldCheck,
						counter: counts.verifications
					},
					{
						title: m.sb_introductions(),
						url: resolve('/dashboard/admin/introductions'),
						icon: Handshake,
						counter: counts.introductions
					},
					{
						title: m.sb_claims(),
						url: resolve('/dashboard/admin/claims'),
						icon: UserRoundCheck,
						counter: counts.claims
					},
					{
						title: m.sb_all_bookings(),
						url: resolve('/dashboard/bookings'),
						icon: Handshake,
						counter: counts.bookings
					},
					{ title: m.sb_all_campaigns(), url: resolve('/dashboard/campaigns'), icon: Megaphone },
					...(PAYMENT_GATEWAY_ENABLED
						? [{ title: m.sb_payouts(), url: resolve('/dashboard/admin/payouts'), icon: Banknote }]
						: []),
					{ title: m.sb_disputes(), url: resolve('/dashboard/admin/disputes'), icon: Gavel },
					{ title: m.sb_audit_log(), url: resolve('/dashboard/admin/audit'), icon: ScrollText }
				]
			},
			{
				section: m.sb_marketplace(),
				items: [
					{ title: m.sb_creators(), url: resolve('/dashboard/admin/creators'), icon: Users },
					{ title: m.sb_trending(), url: resolve('/dashboard/admin/trending'), icon: Flame },
					{
						title: m.sb_organisations(),
						url: resolve('/dashboard/admin/organizations'),
						icon: Building2
					},
					{ title: m.sb_users_roles(), url: resolve('/dashboard/admin/users'), icon: UserRoundCog }
				]
			},
			{
				section: m.sb_blog(),
				items: [
					{ title: m.sb_blog_posts(), url: resolve('/dashboard/admin/blog'), icon: Newspaper },
					{
						title: m.sb_blog_categories(),
						url: resolve('/dashboard/admin/blog/categories'),
						icon: Tags
					}
				]
			},
			{
				section: m.sb_reference_data(),
				items: [
					...referenceData,
					{ title: m.sb_site_settings(), url: resolve('/dashboard/admin/settings'), icon: Settings }
				]
			}
		]);
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
				: role === 'encoder'
					? m.sb_role_encoder()
					: m.sb_role_creator()
	);
</script>

<Sidebar.Root collapsible="offcanvas" {...restProps}>
	<Sidebar.Content
		class="thin-scroll z-[9999] flex h-full flex-col overflow-y-auto bg-surface pt-0"
	>
		<div class="sticky top-0 z-10 border-b-2 border-edge bg-surface px-4 py-4">
			<!-- `wordmark` and not `responsive`: the sidebar is a fixed 16rem panel
			     at every width, so there is no phone case to fall back for — the
			     panel is off-canvas on a phone and full width when it is open. -->
			<a href={resolve('/')} title={m.sb_go_public_site()} class="flex flex-col items-start gap-1">
				<SiteLogo {logos} variant="wordmark" heightClass="h-8" />
				<div class="text-[10px] font-bold tracking-widest text-ink-dim uppercase">
					{m.sb_role_dashboard({ role: roleLabel })}
				</div>
			</a>
		</div>

		<div class="flex-1 py-2">
			<NavMain {closeSidebar} sections={navigation} />
		</div>
	</Sidebar.Content>
</Sidebar.Root>
