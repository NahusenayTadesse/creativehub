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
	 * It also works with scripting off: the `<form method="GET">` below submits
	 * the same parameter this would have set, and carries the rest of the list
	 * state — every filter and the sort — as hidden fields so submitting the box
	 * narrows the current view instead of resetting it.
	 */
	let {
		value = '',
		placeholder = m.pg_search(),
		delay = 300,
		class: className = ''
	}: { value?: string; placeholder?: string; delay?: number; class?: string } = $props();

	/*
	 * What is typed, over what the server last accepted.
	 *
	 * The draft is retired only when the arriving `value` is the one this box
	 * asked for. Retiring it on *any* new value loses keystrokes: type `abc`,
	 * let the debounce fire, keep typing `def`, and the response to `abc` — two
	 * keystrokes stale by the time it lands — would snap the box back to `abc`
	 * and move the caret.
	 */
	let draft = $state<string | null>(null);
	let submitted = $state<string | null>(null);
	const text = $derived(draft ?? value);
	let timer: ReturnType<typeof setTimeout> | undefined;

	$effect(() => {
		/* Reading `value` is the dependency: a new one arriving may retire the
		   draft, but only if it is the answer to the last thing submitted. */
		const accepted = value;
		if (submitted === null || accepted === submitted) {
			draft = null;
			submitted = null;
		}
	});

	function submit(next: string) {
		submitted = next;
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
		/* With scripting on, the client-side navigation below is the submit —
		   letting the form post as well would reload the page. */
		event.preventDefault();
		clearTimeout(timer);
		submit(text.trim());
	}

	function clear() {
		clearTimeout(timer);
		draft = '';
		submit('');
	}

	/*
	 * The rest of the list state, for the scripting-off path. `q` is the field
	 * itself and `page` is deliberately dropped — a new search belongs on page
	 * one, which is what `withParams` does for the scripted path too.
	 */
	const carried = $derived(
		[...currentPage.url.searchParams.entries()].filter(
			([key]) => key !== PARAM.search && key !== PARAM.page
		)
	);
</script>

<form method="GET" action={currentPage.url.pathname} class="contents">
	{#each carried as [key, carriedValue], i (`${key}:${i}`)}
		<input type="hidden" name={key} value={carriedValue} />
	{/each}
	<div class="relative {className}">
		<Search class="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-dim" />
		<input
			type="search"
			name={PARAM.search}
			value={text}
			oninput={onInput}
			onkeydown={onKeydown}
			{placeholder}
			aria-label={placeholder}
			class="w-full rounded-2xl border-2 border-edge bg-surface py-2.5 pr-9 pl-9 text-xs font-bold shadow-[2px_2px_0px_0px_rgb(var(--bento-shadow))] outline-none focus:ring-2 focus:ring-brand-edge"
		/>
		{#if text}
			<button
				type="button"
				onclick={clear}
				aria-label={m.pg_clear_search()}
				class="absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer text-ink-dim hover:text-ink"
			>
				<X class="h-4 w-4" />
			</button>
		{/if}
	</div>
</form>
