<script lang="ts">
	import SiteNav from '$lib/components/site-nav.svelte';
	import SiteFooter from '$lib/components/site-footer.svelte';
	import { resolveLogos } from '$lib/brand';

	let { data, children } = $props();

	/* Resolved once for the shell rather than in each of the two components, so
	   the header and the footer cannot end up drawing different marks. */
	const logos = $derived(resolveLogos(data.settings));
</script>

<div class="flex min-h-screen flex-col justify-between font-sans text-ink selection:bg-brand-soft">
	<SiteNav user={data.user} {logos} />

	<main class="flex-1">
		{@render children()}
	</main>

	<SiteFooter categories={data.reference.categories} regions={data.reference.regions} {logos} />
</div>
