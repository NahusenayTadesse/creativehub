<script lang="ts">
	import * as m from '$lib/paraglide/messages';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { Compass, ShieldAlert, TriangleAlert, ArrowRight } from '@lucide/svelte';

	/**
	 * The page behind every thrown error and every 404.
	 *
	 * Without one, SvelteKit renders an unstyled default in English, which in a
	 * fully bilingual app is where the illusion breaks. Three things matter
	 * here: say which of the three situations this is, offer a way out that is
	 * not the back button, and — for a real fault — show the reference
	 * `handleError` logged, so a report can be tied to a log line.
	 */
	const status = $derived(page.status);
	const detail = $derived(
		status === 404
			? { icon: Compass, title: m.err_title_404(), body: m.err_body_404() }
			: status === 403 || status === 401
				? { icon: ShieldAlert, title: m.err_title_403(), body: m.err_body_403() }
				: { icon: TriangleAlert, title: m.err_title_generic(), body: m.err_body_generic() }
	);

	/* A 404 or a refusal is not a fault, so neither carries a reference. */
	const reference = $derived(
		status >= 500 ? (page.error as { id?: string } | null)?.id : undefined
	);

	/* Someone already inside the dashboard is better served by going back to it. */
	const inDashboard = $derived(page.url.pathname.startsWith('/dashboard'));
</script>

<svelte:head><title>{detail.title}</title></svelte:head>

<div class="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center px-4 py-16">
	<div class="bento-card bento-card-static w-full space-y-4 py-12 text-center">
		<detail.icon class="mx-auto h-12 w-12 text-ink-faint" />

		<span class="block text-[10px] font-black tracking-widest text-ink-dim uppercase">
			{m.err_status({ status })}
		</span>

		<h1 class="text-xl font-black text-ink">{detail.title}</h1>
		<p class="mx-auto max-w-sm text-xs font-medium text-ink-soft">{detail.body}</p>

		{#if page.error?.message && page.error.message !== detail.body}
			<p class="mx-auto max-w-sm text-xs font-bold text-ink-soft">{page.error.message}</p>
		{/if}

		{#if reference}
			<p class="text-[11px] font-medium text-ink-dim">
				{m.err_reference()}
				<code class="rounded bg-well px-1.5 py-0.5 font-mono text-[10px] text-ink-soft">
					{reference}
				</code>
			</p>
		{/if}

		<a
			href={inDashboard ? resolve('/dashboard') : resolve('/')}
			class="inline-flex items-center gap-1.5 rounded-xl border-2 border-edge bg-inverse px-5 py-2.5 text-xs font-black text-inverse-ink shadow-[2px_2px_0px_0px_rgb(var(--bento-shadow-accent))] transition-all hover:shadow-[3px_3px_0px_0px_rgb(var(--bento-shadow-accent))]"
		>
			{inDashboard ? m.err_go_dashboard() : m.err_go_home()}
			<ArrowRight class="h-3.5 w-3.5" />
		</a>
	</div>
</div>
