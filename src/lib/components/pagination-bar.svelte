<script lang="ts">
	import * as m from '$lib/paraglide/messages';
	import { page as currentPage } from '$app/state';
	import { ChevronLeft, ChevronRight, Sparkles } from '@lucide/svelte';
	import { pageLink, pageWindow, type PageResult } from '$lib/query';

	/**
	 * The controls under a paginated list.
	 *
	 * Every control is an `<a href>` built from the current URL, so the whole
	 * result stays linkable and the back button walks pages the way a reader
	 * expects. `data-sveltekit-noscroll` keeps the viewport where it is: the
	 * reader is already looking at the list they just paged.
	 */
	let {
		result,
		class: className = ''
	}: {
		result: Pick<
			PageResult<unknown>,
			'page' | 'pageCount' | 'total' | 'from' | 'to' | 'hasPrev' | 'hasNext' | 'rankedWithin'
		>;
		class?: string;
	} = $props();

	const url = $derived(currentPage.url);
	const windowed = $derived(pageWindow(result.page, result.pageCount));

	const linkClass =
		'flex h-8 min-w-8 cursor-pointer items-center justify-center gap-1 rounded-xl border-2 border-edge px-2.5 text-xs font-black shadow-[2px_2px_0px_0px_rgb(var(--bento-shadow))] transition-colors';
	const idleClass = 'bg-surface text-ink hover:bg-well';
	const currentClass = 'bg-inverse text-inverse-ink';
	const disabledClass =
		'flex h-8 min-w-8 items-center justify-center gap-1 rounded-xl border-2 border-edge-mid px-2.5 text-xs font-black text-ink-faint';
</script>

{#if result.total > 0}
	<div
		class="flex flex-col items-center justify-between gap-3 border-t-2 border-edge pt-4 sm:flex-row {className}"
	>
		<div class="flex flex-wrap items-center gap-2">
			<p class="text-xs font-bold text-ink-soft">
				{#if result.total === 1}
					{m.pg_showing_one()}
				{:else}
					{m.pg_showing({ start: result.from, end: result.to, total: result.total })}
				{/if}
			</p>
			{#if result.rankedWithin}
				<!-- The order below this cut is the database's, not the ranker's. -->
				<span
					class="flex items-center gap-1 rounded-full border border-warn-edge bg-warn-soft px-2 py-0.5 text-[11px] font-black text-warn-fg"
				>
					<Sparkles class="h-3 w-3" />
					{m.pg_ranked_note({ count: result.rankedWithin })}
				</span>
			{/if}
		</div>

		{#if result.pageCount > 1}
			<nav
				class="flex flex-wrap items-center gap-1.5"
				aria-label={m.pg_page_of({ page: result.page, pages: result.pageCount })}
			>
				{#if result.hasPrev}
					<a
						href={pageLink(url, result.page - 1)}
						data-sveltekit-noscroll
						class="{linkClass} {idleClass}"
					>
						<ChevronLeft class="h-3.5 w-3.5" />
						<span class="hidden sm:inline">{m.pg_previous()}</span>
					</a>
				{:else}
					<span class={disabledClass} aria-hidden="true">
						<ChevronLeft class="h-3.5 w-3.5" />
						<span class="hidden sm:inline">{m.pg_previous()}</span>
					</span>
				{/if}

				{#each windowed as number, index (index)}
					{#if number === null}
						<span class="px-1 text-xs font-black text-ink-faint">…</span>
					{:else if number === result.page}
						<span class="{linkClass} {currentClass}" aria-current="page">{number}</span>
					{:else}
						<a
							href={pageLink(url, number)}
							data-sveltekit-noscroll
							aria-label={m.pg_goto_page({ page: number })}
							class="{linkClass} {idleClass}">{number}</a
						>
					{/if}
				{/each}

				{#if result.hasNext}
					<a
						href={pageLink(url, result.page + 1)}
						data-sveltekit-noscroll
						class="{linkClass} {idleClass}"
					>
						<span class="hidden sm:inline">{m.pg_next()}</span>
						<ChevronRight class="h-3.5 w-3.5" />
					</a>
				{:else}
					<span class={disabledClass} aria-hidden="true">
						<span class="hidden sm:inline">{m.pg_next()}</span>
						<ChevronRight class="h-3.5 w-3.5" />
					</span>
				{/if}
			</nav>
		{/if}
	</div>
{/if}
