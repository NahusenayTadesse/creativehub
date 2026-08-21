<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
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
</script>

<header
	id="main-navbar"
	class="sticky top-0 z-40 border-b-2 border-slate-900 bg-white shadow-[0_4px_0_0_rgba(15,23,42,0.06)]"
>
	<div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
		<div class="flex h-20 items-center justify-between">
			<a href={resolve('/')} class="flex items-center gap-3">
				<div
					class="flex h-11 w-11 items-center justify-center rounded-2xl border-2 border-slate-900 bg-slate-900 text-xl font-black text-white shadow-[3px_3px_0px_0px_rgba(16,185,129,1)]"
				>
					ET
				</div>
				<div>
					<div class="flex items-center gap-2">
						<span class="text-xl font-black tracking-tight text-slate-900">{m.brand_name()}</span>
						<span
							class="rounded-full border border-slate-900 bg-[#dcfce7] px-2 py-0.5 text-[10px] font-black tracking-widest text-emerald-800 uppercase"
						>
							ET
						</span>
					</div>
					<p class="hidden text-[10px] font-bold tracking-wider text-slate-500 uppercase sm:block">
						{tagline ?? m.tagline()}
					</p>
				</div>
			</a>

			<nav class="hidden items-center gap-2 md:flex">
				<a
					href={resolve('/discover')}
					class="rounded-xl px-4 py-2 text-xs font-black tracking-wider uppercase transition-all {isActive(
						'/discover'
					)
						? 'border-2 border-slate-900 bg-slate-900 text-white shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]'
						: 'border-2 border-transparent text-slate-700 hover:bg-slate-100'}"
				>
					{m.nav_discover()}
				</a>
				<a
					href={resolve('/campaigns')}
					class="rounded-xl px-4 py-2 text-xs font-black tracking-wider uppercase transition-all {isActive(
						'/campaigns'
					)
						? 'border-2 border-slate-900 bg-slate-900 text-white shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]'
						: 'border-2 border-transparent text-slate-700 hover:bg-slate-100'}"
				>
					{m.nav_opportunities()}
				</a>
			</nav>

			<div class="hidden items-center gap-3 md:flex">
				<button
					type="button"
					onclick={toggleLocale}
					title={m.nav_switch_language()}
					class="flex items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50"
				>
					<Globe class="h-3.5 w-3.5 text-slate-500" />
					<span>{locale === 'en' ? '🇬🇧 EN' : '🇪🇹 አማርኛ'}</span>
				</button>

				{#if user}
					<span
						class="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-800"
					>
						<span class="h-2 w-2 rounded-full bg-emerald-500"></span>
						<span class="capitalize">{user.role}</span>
					</span>

					<a
						href={resolve('/dashboard')}
						class="flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold text-white transition-colors {user.role ===
						'admin'
							? 'bg-purple-700 hover:bg-purple-800'
							: user.role === 'business'
								? 'bg-slate-900 hover:bg-slate-800'
								: 'bg-emerald-600 hover:bg-emerald-700'}"
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
							class="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
						>
							<LogOut class="h-4 w-4" />
						</button>
					</form>
				{:else}
					<a
						href={resolve('/login')}
						class="rounded-lg px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100"
					>
						{m.nav_sign_in()}
					</a>
					<a
						href={resolve('/register')}
						class="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-700"
					>
						<UserCheck class="h-3.5 w-3.5" />
						{m.nav_join()}
					</a>
				{/if}
			</div>

			<div class="flex items-center gap-2 md:hidden">
				<button type="button" onclick={toggleLocale} class="p-2 text-xs font-bold text-slate-700">
					{locale === 'en' ? '🇬🇧' : '🇪🇹'}
				</button>
				<button
					type="button"
					onclick={() => (mobileOpen = !mobileOpen)}
					aria-label={m.nav_toggle_menu()}
					class="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
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
		<div class="space-y-3 border-t border-slate-100 bg-white px-4 py-4 md:hidden">
			<a
				href={resolve('/discover')}
				onclick={() => (mobileOpen = false)}
				class="block rounded-lg px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
			>
				{m.nav_discover()}
			</a>
			<a
				href={resolve('/campaigns')}
				onclick={() => (mobileOpen = false)}
				class="block rounded-lg px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
			>
				{m.nav_opportunities()}
			</a>
			{#if user}
				<a
					href={resolve('/dashboard')}
					onclick={() => (mobileOpen = false)}
					class="block rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700"
				>
					{dashboardLabel}
				</a>
				<form method="POST" action="/logout">
					<button
						type="submit"
						class="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-800 hover:bg-slate-50"
					>
						{m.nav_sign_out()}
					</button>
				</form>
			{:else}
				<a
					href={resolve('/login')}
					onclick={() => (mobileOpen = false)}
					class="block rounded-lg px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
				>
					{m.nav_sign_in()}
				</a>
				<a
					href={resolve('/register')}
					onclick={() => (mobileOpen = false)}
					class="block rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white"
				>
					{m.nav_join()}
				</a>
			{/if}
		</div>
	{/if}
</header>
