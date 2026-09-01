<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { afterNavigate } from '$app/navigation';
	import {
		Globe,
		Menu,
		X,
		LayoutDashboard,
		ShieldCheck,
		Briefcase,
		UserCheck,
		LogOut
	} from '@lucide/svelte';
	import { setLocale, getLocale } from '$lib/paraglide/runtime';
	import * as m from '$lib/paraglide/messages';
	import ThemeToggle from './theme-toggle.svelte';
	import ThemeChoice from './theme-choice.svelte';

	let {
		user = null,
		tagline = null
	}: {
		user?: { name: string; role: string } | null;
		tagline?: string | null;
	} = $props();

	let mobileOpen = $state(false);

	const isActive = (href: string) => page.url.pathname.startsWith(href);

	const dashboardLabel = $derived(
		user?.role === 'admin'
			? m.nav_admin_hub()
			: user?.role === 'business'
				? m.nav_brand_hub()
				: m.nav_creator_studio()
	);

	const locale = $derived(getLocale());
	const toggleLocale = () => setLocale(locale === 'en' ? 'am' : 'en');

	/* The panel is a menu, not a place: anything that moves the reader on has
	   finished with it. The per-link handlers below cannot cover the browser's
	   own back and forward, which navigate without ever touching a link. */
	afterNavigate(() => (mobileOpen = false));
</script>

<svelte:window
	onkeydown={(event) => {
		if (event.key === 'Escape') mobileOpen = false;
	}}
/>

<header
	id="main-navbar"
	class="sticky top-0 z-40 border-b-2 border-edge bg-surface shadow-[0_4px_0_0_rgb(var(--bento-shadow)/0.06)]"
>
	<div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
		<!-- Shorter on a phone: this bar is sticky, so every pixel it takes is a
		     pixel of the page nobody can scroll into view. -->
		<div class="flex h-16 items-center justify-between sm:h-20">
			<a href={resolve('/')} class="flex min-w-0 items-center gap-2 sm:gap-3">
				<div
					class="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border-2 border-edge bg-inverse text-lg font-black text-inverse-ink shadow-[3px_3px_0px_0px_rgb(var(--bento-shadow-accent))] sm:h-11 sm:w-11 sm:text-xl"
				>
					ET
				</div>
				<div class="min-w-0">
					<div class="flex items-center gap-2">
						<span class="truncate text-lg font-black tracking-tight text-ink sm:text-xl"
							>{m.brand_name()}</span
						>
						<!-- The mark already says ET. On a phone the name needs the room
						     more than the badge needs to repeat it. -->
						<span
							class="hidden rounded-full border border-edge bg-tile-mint px-2 py-0.5 text-[10px] font-black tracking-widest text-brand-soft-fg uppercase sm:inline-block"
						>
							ET
						</span>
					</div>
					<p class="hidden text-[10px] font-bold tracking-wider text-ink-dim uppercase sm:block">
						{tagline ?? m.tagline()}
					</p>
				</div>
			</a>

			<nav class="hidden items-center gap-2 lg:flex">
				<a
					href={resolve('/discover')}
					class="rounded-xl px-4 py-2 text-xs font-black tracking-wider uppercase transition-all {isActive(
						'/discover'
					)
						? 'border-2 border-edge bg-inverse text-inverse-ink shadow-[2px_2px_0px_0px_rgb(var(--bento-shadow))]'
						: 'border-2 border-transparent text-ink-soft hover:bg-well'}"
				>
					{m.nav_discover()}
				</a>
				<a
					href={resolve('/campaigns')}
					class="rounded-xl px-4 py-2 text-xs font-black tracking-wider uppercase transition-all {isActive(
						'/campaigns'
					)
						? 'border-2 border-edge bg-inverse text-inverse-ink shadow-[2px_2px_0px_0px_rgb(var(--bento-shadow))]'
						: 'border-2 border-transparent text-ink-soft hover:bg-well'}"
				>
					{m.nav_opportunities()}
				</a>
				<a
					href={resolve('/blog')}
					class="rounded-xl px-4 py-2 text-xs font-black tracking-wider uppercase transition-all {isActive(
						'/blog'
					)
						? 'border-2 border-edge bg-inverse text-inverse-ink shadow-[2px_2px_0px_0px_rgb(var(--bento-shadow))]'
						: 'border-2 border-transparent text-ink-soft hover:bg-well'}"
				>
					{m.nav_blog()}
				</a>
			</nav>

			<div class="hidden items-center gap-3 lg:flex">
				<button
					type="button"
					onclick={toggleLocale}
					title={m.nav_switch_language()}
					class="flex items-center gap-1.5 rounded-lg border border-edge-mid px-2.5 py-1.5 text-xs font-bold text-ink-soft transition-colors hover:bg-panel"
				>
					<Globe class="h-3.5 w-3.5 text-ink-dim" />
					<span>{locale === 'en' ? '🇬🇧 EN' : '🇪🇹 አማርኛ'}</span>
				</button>

				<ThemeToggle />

				{#if user}
					<span
						class="flex items-center gap-1.5 rounded-lg border border-edge-soft bg-panel px-3 py-1.5 text-xs font-bold text-ink"
					>
						<span class="h-2 w-2 rounded-full bg-brand"></span>
						<span class="capitalize">{user.role}</span>
					</span>

					<a
						href={resolve('/dashboard')}
						class="flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-colors {user.role ===
						'admin'
							? 'bg-tint-violet-solid text-white hover:bg-tint-violet-solid-hover'
							: user.role === 'business'
								? 'bg-inverse text-inverse-ink hover:bg-inverse-hover'
								: 'bg-brand text-brand-ink hover:bg-brand-strong'}"
					>
						{#if user.role === 'admin'}
							<ShieldCheck class="h-3.5 w-3.5" />
						{:else if user.role === 'business'}
							<Briefcase class="h-3.5 w-3.5" />
						{:else}
							<LayoutDashboard class="h-3.5 w-3.5" />
						{/if}
						<span>{dashboardLabel}</span>
					</a>

					<form method="POST" action="/logout">
						<button
							type="submit"
							title={m.nav_sign_out()}
							class="rounded-lg p-2 text-ink-dim transition-colors hover:bg-well hover:text-ink"
						>
							<LogOut class="h-4 w-4" />
						</button>
					</form>
				{:else}
					<a
						href={resolve('/login')}
						class="rounded-lg px-3 py-2 text-xs font-semibold text-ink-soft transition-colors hover:bg-well"
					>
						{m.nav_sign_in()}
					</a>
					<a
						href={resolve('/register')}
						class="flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-xs font-semibold text-brand-ink transition-colors hover:bg-brand-strong"
					>
						<UserCheck class="h-3.5 w-3.5" />
						{m.nav_join()}
					</a>
				{/if}
			</div>

			<!--
				Both of these are the whole tap target, not an icon with padding
				around it: 44px square is the smallest a finger reliably hits, and
				the language button used to be a bare emoji with no label at all.
			-->
			<div class="flex items-center gap-1 lg:hidden">
				<button
					type="button"
					onclick={toggleLocale}
					aria-label={m.nav_switch_language()}
					title={m.nav_switch_language()}
					class="flex h-11 w-11 items-center justify-center rounded-xl text-base text-ink-soft hover:bg-well"
				>
					{locale === 'en' ? '🇬🇧' : '🇪🇹'}
				</button>
				<button
					type="button"
					onclick={() => (mobileOpen = !mobileOpen)}
					aria-label={m.nav_toggle_menu()}
					aria-expanded={mobileOpen}
					aria-controls="mobile-menu"
					class="flex h-11 w-11 items-center justify-center rounded-xl text-ink-soft hover:bg-well"
				>
					{#if mobileOpen}
						<X class="h-6 w-6" />
					{:else}
						<Menu class="h-6 w-6" />
					{/if}
				</button>
			</div>
		</div>
	</div>

	{#if mobileOpen}
		<!--
			Capped and scrollable, because it now carries the appearance controls
			as well as the links, and a short phone in landscape has less room for
			it than the content it is listing.
		-->
		<div
			id="mobile-menu"
			class="max-h-[calc(100dvh-4rem)] space-y-2 overflow-y-auto border-t-2 border-edge bg-surface px-4 py-4 shadow-[0_8px_16px_-8px_rgb(var(--bento-shadow)/0.35)] lg:hidden"
		>
			<a
				href={resolve('/discover')}
				onclick={() => (mobileOpen = false)}
				class="block rounded-xl px-3 py-3 text-sm font-black text-ink hover:bg-panel {isActive(
					'/discover'
				)
					? 'bg-panel'
					: ''}"
			>
				{m.nav_discover()}
			</a>
			<a
				href={resolve('/campaigns')}
				onclick={() => (mobileOpen = false)}
				class="block rounded-xl px-3 py-3 text-sm font-black text-ink hover:bg-panel {isActive(
					'/campaigns'
				)
					? 'bg-panel'
					: ''}"
			>
				{m.nav_opportunities()}
			</a>
			<a
				href={resolve('/blog')}
				onclick={() => (mobileOpen = false)}
				class="block rounded-xl px-3 py-3 text-sm font-black text-ink hover:bg-panel {isActive(
					'/blog'
				)
					? 'bg-panel'
					: ''}"
			>
				{m.nav_blog()}
			</a>

			{#if user}
				<!-- Which account you are signed in as. The desktop bar has said this
				     all along; on a phone it was the one thing the menu never told you. -->
				<div
					class="flex items-center gap-2 rounded-xl border-2 border-edge bg-panel px-3 py-2.5 text-xs font-black text-ink"
				>
					<span class="h-2 w-2 shrink-0 rounded-full bg-brand"></span>
					<span class="truncate">{user.name}</span>
					<span class="ms-auto shrink-0 text-ink-dim capitalize">{user.role}</span>
				</div>
				<a
					href={resolve('/dashboard')}
					onclick={() => (mobileOpen = false)}
					class="flex items-center gap-2 rounded-xl border-2 border-edge bg-brand px-3 py-3 text-sm font-black text-brand-ink shadow-[2px_2px_0px_0px_rgb(var(--bento-shadow))]"
				>
					{#if user.role === 'admin'}
						<ShieldCheck class="h-4 w-4" />
					{:else if user.role === 'business'}
						<Briefcase class="h-4 w-4" />
					{:else}
						<LayoutDashboard class="h-4 w-4" />
					{/if}
					{dashboardLabel}
				</a>
				<form method="POST" action="/logout">
					<button
						type="submit"
						class="flex w-full items-center gap-2 rounded-xl px-3 py-3 text-left text-sm font-black text-ink hover:bg-panel"
					>
						<LogOut class="h-4 w-4 text-ink-dim" />
						{m.nav_sign_out()}
					</button>
				</form>
			{:else}
				<a
					href={resolve('/login')}
					onclick={() => (mobileOpen = false)}
					class="block rounded-xl px-3 py-3 text-sm font-black text-ink hover:bg-panel"
				>
					{m.nav_sign_in()}
				</a>
				<a
					href={resolve('/register')}
					onclick={() => (mobileOpen = false)}
					class="flex items-center justify-center gap-1.5 rounded-xl border-2 border-edge bg-brand px-3 py-3 text-sm font-black text-brand-ink shadow-[2px_2px_0px_0px_rgb(var(--bento-shadow))]"
				>
					<UserCheck class="h-4 w-4" />
					{m.nav_join()}
				</a>
			{/if}

			<!--
				Language and appearance. Both were desktop-only: the flag in the bar
				switches locale but never said what it did, and there was no way at
				all to leave the theme the operating system chose from a phone.
			-->
			<div class="space-y-3 border-t-2 border-edge pt-4">
				<button
					type="button"
					onclick={toggleLocale}
					class="flex w-full items-center justify-between rounded-xl border-2 border-edge bg-surface px-3 py-3 text-sm font-black text-ink shadow-[2px_2px_0px_0px_rgb(var(--bento-shadow))]"
				>
					<span class="flex items-center gap-2">
						<Globe class="h-4 w-4 text-ink-dim" />
						{m.nav_switch_language()}
					</span>
					<span>{locale === 'en' ? '🇬🇧 EN' : '🇪🇹 አማርኛ'}</span>
				</button>

				<div class="space-y-2">
					<span class="block text-[10px] font-black tracking-widest text-ink-dim uppercase">
						{m.theme_appearance()}
					</span>
					<ThemeChoice />
				</div>
			</div>
		</div>
	{/if}
</header>
