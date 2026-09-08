<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import * as m from '$lib/paraglide/messages';
	import SiteLogo from '$lib/components/site-logo.svelte';
	import { resolveLogos } from '$lib/brand';
	import { BadgeCheck, TriangleAlert } from '@lucide/svelte';

	let { data } = $props();

	const logos = $derived(resolveLogos(page.data.settings));
</script>

<svelte:head><title>{m.ve_meta_title()}</title></svelte:head>

<div class="flex min-h-screen items-center justify-center px-4 py-12">
	<div class="w-full max-w-md space-y-6">
		<!-- The auth pages sit outside the app shell, so the logo comes from
		     `page.data` — the root layout's settings, which every route carries. -->
		<a href={resolve('/')} class="flex items-center justify-center">
			<SiteLogo {logos} variant="wordmark" heightClass="h-12" />
		</a>

		<div class="bento-card bento-card-static space-y-4 text-center">
			<div
				class="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border-2 border-edge {data.ok
					? 'bg-brand-soft'
					: 'bg-well'}"
			>
				{#if data.ok}
					<BadgeCheck class="h-5 w-5 text-brand-soft-fg" />
				{:else}
					<TriangleAlert class="h-5 w-5 text-ink-soft" />
				{/if}
			</div>

			<h1 class="text-2xl font-black text-ink">
				{data.ok ? m.ve_ok_title() : m.ve_bad_title()}
			</h1>
			<p class="text-xs font-medium text-ink-soft">
				{data.ok ? m.ve_ok_body() : m.ve_bad_body()}
			</p>

			<!-- Verification signs them in, so the dashboard is normally reachable.
			     A failed link may well have been opened by someone with no session
			     at all, and pointing them at settings would only bounce to login. -->
			{#if data.signedIn}
				<a
					href={resolve(data.ok ? '/dashboard' : '/dashboard/settings')}
					class="inline-block rounded-2xl border-2 border-edge bg-brand px-5 py-2.5 text-xs font-black text-brand-ink shadow-[3px_3px_0px_0px_rgb(var(--bento-shadow))] transition-colors hover:bg-brand-strong"
					>{data.ok ? m.ve_continue() : m.ve_settings()}</a
				>
			{:else}
				<a
					href={resolve('/login')}
					class="inline-block rounded-2xl border-2 border-edge bg-brand px-5 py-2.5 text-xs font-black text-brand-ink shadow-[3px_3px_0px_0px_rgb(var(--bento-shadow))] transition-colors hover:bg-brand-strong"
					>{m.fp_back()}</a
				>
			{/if}
		</div>
	</div>
</div>
