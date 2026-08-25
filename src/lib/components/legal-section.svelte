<script lang="ts">
	import type { Snippet } from 'svelte';

	let { heading, children }: { heading: string; children: Snippet } = $props();
</script>

<section class="space-y-2">
	<h2 class="text-base font-black text-slate-900">{heading}</h2>
	<div class="space-y-2 text-sm leading-relaxed font-medium text-slate-700">
		{@render children()}
	</div>
</section>
