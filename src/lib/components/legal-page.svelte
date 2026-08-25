<script lang="ts">
	import type { Snippet } from 'svelte';
	import * as m from '$lib/paraglide/messages';
	import { Info } from '@lucide/svelte';

	/**
	 * The frame both legal pages share.
	 *
	 * They are long, plain prose — the only thing worth centralising is the
	 * measure, the heading rhythm and the notice about which language governs,
	 * so that the two pages cannot drift apart on any of them.
	 */
	let {
		title,
		updated,
		intro,
		children
	}: { title: string; updated: string; intro: string; children: Snippet } = $props();
</script>

<div class="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
	<header class="mb-8 space-y-3">
		<h1 class="text-2xl font-black text-slate-900 md:text-3xl">{title}</h1>
		<p class="text-xs font-bold text-slate-500">{m.legal_updated({ date: updated })}</p>
		<p class="text-sm font-medium text-slate-700">{intro}</p>
		<p
			class="flex items-start gap-2 rounded-xl border-2 border-slate-200 bg-slate-50 p-3 text-[11px] font-medium text-slate-600"
		>
			<Info class="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" />
			<span>{m.legal_lang_note()}</span>
		</p>
	</header>

	<div class="space-y-8">
		{@render children()}
	</div>
</div>
