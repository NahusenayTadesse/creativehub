<script lang="ts">
	import { resolve } from '$app/paths';
	import * as m from '$lib/paraglide/messages';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import AppSidebar from '$lib/components/app-sidebar.svelte';
	import ThemeToggle from '$lib/components/theme-toggle.svelte';
	import { LogOut, ExternalLink } from '@lucide/svelte';
	import { page } from '$app/state';

	let { data, children } = $props();

	/**
	 * Turns /dashboard/admin/countries into "Countries". A record page ends in an
	 * id, which reads as nothing on its own, so it borrows its section's name.
	 */
	const crumb = $derived.by(() => {
		const parts = page.url.pathname.split('/').filter(Boolean).slice(1);
		if (!parts.length) return m.dash_crumb_overview();

		const last = parts[parts.length - 1];
		const label = /^\d+$/.test(last) ? (parts[parts.length - 2] ?? last) : last;
		const title = label.replace(/-/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

		return /^\d+$/.test(last) ? m.dash_crumb_detail({ name: title.replace(/s$/, '') }) : title;
	});
</script>

<Sidebar.Provider>
	<AppSidebar role={data.role} counts={data.counts} />

	<Sidebar.Inset class="bg-[var(--bento-ground)]">
		<header
			class="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-2 border-b-2 border-edge bg-surface px-4"
		>
			<Sidebar.Trigger class="-ml-1" />
			<div class="flex flex-1 items-center justify-between gap-3">
				<div>
					<span class="block text-[10px] font-black tracking-widest text-ink-dim uppercase">
						{data.role === 'admin'
							? m.dash_platform_operations()
							: data.role === 'business'
								? (data.organization?.name ?? m.dash_brand())
								: (data.creator?.fullName ?? m.dash_creator_studio())}
					</span>
					<h1 class="text-sm font-black text-ink">{crumb}</h1>
				</div>

				<div class="flex items-center gap-2">
					<a
						href={resolve('/')}
						class="hidden items-center gap-1.5 rounded-lg border border-edge-soft px-3 py-1.5 text-xs font-bold text-ink-soft hover:bg-panel sm:flex"
					>
						<ExternalLink class="h-3.5 w-3.5" />
						{m.dash_public_site()}
					</a>
					<ThemeToggle />
					<form method="POST" action="/logout">
						<button
							type="submit"
							title={m.nav_sign_out()}
							class="rounded-lg p-2 text-ink-dim transition-colors hover:bg-well hover:text-ink"
						>
							<LogOut class="h-4 w-4" />
						</button>
					</form>
				</div>
			</div>
		</header>

		<div class="flex-1 p-4 sm:p-6">
			{@render children()}
		</div>
	</Sidebar.Inset>
</Sidebar.Provider>
