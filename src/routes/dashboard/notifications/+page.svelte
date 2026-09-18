<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { Bell, CheckCheck, ChevronLeft, ChevronRight } from '@lucide/svelte';
	import PageHeader from '$lib/components/page-header.svelte';
	import { withParams } from '$lib/query';
	import * as m from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';

	let { data } = $props();

	const stamp = (value: Date | string) =>
		new Date(value).toLocaleString(getLocale() === 'am' ? 'am-ET' : 'en-GB', {
			day: 'numeric',
			month: 'short',
			hour: '2-digit',
			minute: '2-digit'
		});

	const tabs = $derived([
		{ key: 'all', label: m.np_tab_all(), active: !data.unreadOnly },
		{ key: 'unread', label: m.np_tab_unread({ count: data.unread }), active: data.unreadOnly }
	]);

	const tabLink = (key: string) =>
		withParams(page.url, { show: key === 'unread' ? 'unread' : null, page: null });
	const pageLink = (to: number) => withParams(page.url, { page: to > 1 ? to : null });
</script>

<svelte:head><title>{m.np_meta_title()}</title></svelte:head>

<div class="mx-auto max-w-3xl space-y-6">
	<PageHeader eyebrow={m.np_eyebrow()} title={m.np_title()} description={m.np_description()}>
		{#snippet actions()}
			{#if data.unread}
				<form method="POST" action="?/readAll" use:enhance>
					<button
						type="submit"
						class="flex items-center gap-2 rounded-2xl border-2 border-edge bg-surface px-3 py-2 text-xs font-black whitespace-nowrap text-ink shadow-[3px_3px_0px_0px_rgb(var(--bento-shadow))] hover:bg-well"
					>
						<CheckCheck class="h-3.5 w-3.5" />
						{m.nb_mark_all_read()}
					</button>
				</form>
			{/if}
		{/snippet}
	</PageHeader>

	<div class="flex flex-wrap gap-2">
		{#each tabs as tab (tab.key)}
			<a
				href={tabLink(tab.key)}
				data-sveltekit-noscroll
				aria-current={tab.active ? 'page' : undefined}
				class="rounded-xl border-2 border-edge px-3 py-1.5 text-xs font-black shadow-[2px_2px_0px_0px_rgb(var(--bento-shadow))] {tab.active
					? 'bg-inverse text-inverse-ink'
					: 'bg-surface text-ink hover:bg-well'}"
			>
				{tab.label}
			</a>
		{/each}
	</div>

	{#if !data.items.length}
		<div class="bento-card bento-card-static space-y-2 py-14 text-center">
			<Bell class="mx-auto h-9 w-9 text-ink-faint" />
			<p class="text-sm font-black text-ink">
				{data.unreadOnly ? m.np_empty_unread() : m.nb_empty()}
			</p>
		</div>
	{:else}
		<ul class="bento-card bento-card-static divide-y-2 divide-edge-soft p-0!">
			{#each data.items as item (item.id)}
				<li>
					<form method="POST" action="?/open" use:enhance>
						<input type="hidden" name="id" value={item.id} />
						<button
							type="submit"
							class="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-well {item.readAt
								? ''
								: 'bg-brand-soft/40'}"
						>
							<span
								class="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full {item.readAt
									? 'bg-edge-soft'
									: 'bg-brand'}"
								aria-hidden="true"
							></span>
							<span class="min-w-0 flex-1">
								<span class="flex flex-wrap items-baseline justify-between gap-x-3">
									<span class="text-sm text-ink {item.readAt ? 'font-bold' : 'font-black'}">
										{item.title}
									</span>
									<span class="text-[10px] font-bold text-ink-faint">{stamp(item.createdAt)}</span>
								</span>
								{#if item.body}
									<span class="mt-0.5 line-clamp-3 block text-xs font-medium text-ink-soft">
										{item.body}
									</span>
								{/if}
								{#if !item.readAt}<span class="sr-only">{m.nb_unread()}</span>{/if}
							</span>
						</button>
					</form>
				</li>
			{/each}
		</ul>

		{#if data.pageCount > 1}
			<nav class="flex items-center justify-between" aria-label={m.np_pages_label()}>
				{#if data.page > 1}
					<a
						href={pageLink(data.page - 1)}
						class="flex items-center gap-1 text-xs font-black text-ink hover:text-brand-fg"
					>
						<ChevronLeft class="h-3.5 w-3.5" />{m.tbl_previous()}
					</a>
				{:else}<span></span>{/if}
				<span class="text-[11px] font-bold text-ink-dim">
					{m.np_page_of({ page: data.page, pages: data.pageCount })}
				</span>
				{#if data.page < data.pageCount}
					<a
						href={pageLink(data.page + 1)}
						class="flex items-center gap-1 text-xs font-black text-ink hover:text-brand-fg"
					>
						{m.tbl_next()}<ChevronRight class="h-3.5 w-3.5" />
					</a>
				{:else}<span></span>{/if}
			</nav>
		{/if}
	{/if}

	<p class="text-center text-[11px] font-medium text-ink-dim">
		{m.np_prefs_note()}
		<a href={resolve('/dashboard/settings')} class="font-black text-brand-soft-fg hover:underline">
			{m.np_prefs_link()}
		</a>
	</p>
</div>
