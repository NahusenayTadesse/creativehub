<script lang="ts">
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import AppSidebar from '$lib/components/app-sidebar.svelte';
	import { LogOut, ExternalLink } from '@lucide/svelte';
	import { page } from '$app/state';

	let { data, children } = $props();

	/**
	 * Turns /dashboard/admin/countries into "Countries". A record page ends in an
	 * id, which reads as nothing on its own, so it borrows its section's name.
	 */
	const crumb = $derived.by(() => {
		const parts = page.url.pathname.split('/').filter(Boolean).slice(1);
		if (!parts.length) return 'Overview';

		const last = parts[parts.length - 1];
		const label = /^\d+$/.test(last) ? (parts[parts.length - 2] ?? last) : last;
		const title = label.replace(/-/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

		return /^\d+$/.test(last) ? title.replace(/s$/, '') + ' detail' : title;
	});
</script>

<Sidebar.Provider>
	<AppSidebar role={data.role} counts={data.counts} />

	<Sidebar.Inset class="bg-[var(--bento-ground)]">
		<header
			class="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-2 border-b-2 border-slate-900 bg-white px-4"
		>
			<Sidebar.Trigger class="-ml-1" />
			<div class="flex flex-1 items-center justify-between gap-3">
				<div>
					<span class="block text-[10px] font-black tracking-widest text-slate-500 uppercase">
						{data.role === 'admin'
							? 'Platform operations'
							: data.role === 'business'
								? (data.organization?.name ?? 'Brand')
								: (data.creator?.fullName ?? 'Creator studio')}
					</span>
					<h1 class="text-sm font-black text-slate-900">{crumb}</h1>
				</div>

				<div class="flex items-center gap-2">
					<a
						href="/"
						class="hidden items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 sm:flex"
					>
						<ExternalLink class="h-3.5 w-3.5" />
						Public site
					</a>
					<form method="POST" action="/logout">
						<button
							type="submit"
							title="Sign out"
							class="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
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
