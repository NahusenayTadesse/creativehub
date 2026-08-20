<script lang="ts">
	import * as m from '$lib/paraglide/messages';
	import { page as currentPage } from '$app/state';
	import { goto } from '$app/navigation';
	import { Search, X } from '@lucide/svelte';
	import { PARAM, withParams } from '$lib/query';

	/**
	 * The search box over a server-filtered list.
	 *
	 * Typing rewrites the URL rather than filtering an array, because the rows
	 * that match may not be on this page — or in the browser at all. The trip is
	 * debounced so a word costs one query rather than one per keystroke, and it
	 * replaces the history entry so the back button leaves the list rather than
	 * replaying every prefix of what was typed.
	 *
	 * It also works with scripting off: the surrounding `<form method="GET">`
	 * submits the same parameter this would have set.
	 */
	let {
		value = '',
		placeholder = m.pg_search(),
		delay = 300,
		class: className = ''
	}: { value?: string; placeholder?: string; delay?: number; class?: string } = $props();

	/*
	 * What is typed, over what the server last accepted. The override is dropped
	 * whenever a new `value` arrives — a cleared filter, or a navigation — so the
	 * box can never disagree with the results underneath it.
	 */
	let draft = $state<string | null>(null);
	const text = $derived(draft ?? value);
	let timer: ReturnType<typeof setTimeout> | undefined;

	$effect(() => {
		/* Reading `value` is the dependency: a new one arriving retires the draft. */
		const accepted = value;
		if (accepted !== undefined) draft = null;
	});

	function submit(next: string) {
		const target = withParams(currentPage.url, { [PARAM.search]: next || null });
		goto(target, { keepFocus: true, noScroll: true, replaceState: true });
	}

	function onInput(event: Event & { currentTarget: HTMLInputElement }) {
		draft = event.currentTarget.value;
		clearTimeout(timer);
		const next = draft.trim();
		timer = setTimeout(() => submit(next), delay);
	}

	function onKeydown(event: KeyboardEvent) {
		if (event.key !== 'Enter') return;
		event.preventDefault();
		clearTimeout(timer);
		submit(text.trim());
	}

	function clear() {
		clearTimeout(timer);
		draft = '';
		submit('');
	}
</script>

<div class="relative {className}">
	<Search class="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-500" />
	<input
		type="search"
		name={PARAM.search}
		value={text}
		oninput={onInput}
		onkeydown={onKeydown}
		{placeholder}
		aria-label={placeholder}
		class="w-full rounded-2xl border-2 border-slate-900 bg-white py-2.5 pr-9 pl-9 text-xs font-bold shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] outline-none focus:ring-2 focus:ring-emerald-500"
	/>
	{#if text}
		<button
			type="button"
			onclick={clear}
			aria-label={m.pg_clear_search()}
			class="absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer text-slate-500 hover:text-slate-900"
		>
			<X class="h-4 w-4" />
		</button>
	{/if}
</div>
