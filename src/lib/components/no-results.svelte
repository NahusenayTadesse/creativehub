<script lang="ts">
	import * as m from '$lib/paraglide/messages';
	import { SearchX } from '@lucide/svelte';

	/**
	 * The empty screen a *search* produced, as opposed to the one an empty list
	 * produced.
	 *
	 * Worth telling apart: "you have no deals yet — go find a creator" is wrong
	 * and a little insulting when the reader has forty deals and has simply
	 * mistyped one of them.
	 */
	let { search }: { search: string } = $props();
</script>

<div class="bento-card bento-card-static space-y-3 py-16 text-center">
	<SearchX class="mx-auto h-10 w-10 text-slate-400" />
	<h3 class="text-base font-black text-slate-900">{m.pg_no_results()}</h3>
	<p class="mx-auto max-w-sm text-xs font-medium text-slate-600">
		{m.crud_no_search_match({ search })}
	</p>
</div>
