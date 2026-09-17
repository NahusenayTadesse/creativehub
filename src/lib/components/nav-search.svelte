<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { ResolvedPathname } from '$app/types';
	import { Search } from '@lucide/svelte';
	import InputComp from '$lib/formComponents/InputComp.svelte';
	import * as m from '$lib/paraglide/messages';

	/**
	 * The header's way into discovery.
	 *
	 * It used to live in the homepage hero, which made it the one search box a
	 * visitor had to scroll back up to find. Here it is on every public page. It
	 * goes to discovery rather than filtering anything in place: what a reader
	 * types in a header is a question about creators, whichever page they are on.
	 *
	 * A plain GET form underneath, so it still works before hydration.
	 */
	let { class: className = '' }: { class?: string } = $props();

	let query = $state('');

	const href = $derived(
		`${resolve('/discover')}${query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ''}` as ResolvedPathname
	);
</script>

<form
	method="GET"
	action={resolve('/discover')}
	role="search"
	onsubmit={(event) => {
		event.preventDefault();
		goto(href);
	}}
	class="flex items-center gap-2 rounded-full border border-edge-soft bg-panel ps-3.5 pe-1 transition-colors focus-within:border-brand-edge {className}"
>
	<Search class="h-4 w-4 shrink-0 text-ink-dim" />
	<InputComp
		name="q"
		label={m.search_placeholder()}
		labelHidden
		placeholder={m.nav_search_placeholder()}
		bind:value={query}
		className="h-9 border-none bg-transparent px-0 text-xs shadow-none focus-visible:ring-0"
	/>
</form>
