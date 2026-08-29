<script lang="ts">
	import SiteNav from '$lib/components/site-nav.svelte';
	import SiteFooter from '$lib/components/site-footer.svelte';

	let { data, children } = $props();
</script>

<div class="flex min-h-screen flex-col justify-between font-sans text-ink selection:bg-brand-soft">
	<SiteNav user={data.user} tagline={data.settings?.tagline ?? undefined} />

	<main class="flex-1">
		{@render children()}
	</main>

	<SiteFooter categories={data.reference.categories} regions={data.reference.regions} />
</div>
