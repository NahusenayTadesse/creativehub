<script lang="ts">
	import PageHeader from '$lib/components/page-header.svelte';
	import PaginationBar from '$lib/components/pagination-bar.svelte';
	import SearchInput from '$lib/components/search-input.svelte';
	import { ScrollText } from '@lucide/svelte';
	import { page } from '$app/state';
	import { withParams } from '$lib/query';
	import * as m from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';

	let { data } = $props();

	/* The chips list the entities the log actually holds, with their tallies —
	   both from the database, so neither depends on which page is open. */
	const listState = $derived(data.entries.state);
	const entityFilter = $derived(listState.values.entity ?? 'all');
	const entities = $derived(Object.keys(data.entityCounts).sort());
	const totalEntries = $derived(Object.values(data.entityCounts).reduce((sum, n) => sum + n, 0));
	const entityLink = (entity: string) =>
		withParams(page.url, { entity: entity === 'all' ? null : entity });

	const formatTime = (value: string | Date) =>
		new Date(value).toLocaleString(getLocale() === 'am' ? 'am-ET' : 'en-GB', {
			day: 'numeric',
			month: 'short',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
</script>

<svelte:head><title>{m.ad_meta_title()}</title></svelte:head>

<div class="space-y-6">
	<PageHeader
		eyebrow={m.dash_platform_operations()}
		title={m.ad_title()}
		description={m.ad_description()}
	/>

	<div class="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
		<div class="flex flex-wrap items-center gap-2">
			<a
				href={entityLink('all')}
				data-sveltekit-noscroll
				class="cursor-pointer rounded-xl border-2 border-slate-900 px-3 py-1.5 text-xs font-black shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] {entityFilter ===
				'all'
					? 'bg-slate-900 text-white'
					: 'bg-white text-slate-800 hover:bg-slate-100'}"
			>
				{m.ad_all_count({ count: totalEntries })}
			</a>
			{#each entities as entity (entity)}
				<a
					href={entityLink(entity)}
					data-sveltekit-noscroll
					class="cursor-pointer rounded-xl border-2 border-slate-900 px-3 py-1.5 text-xs font-black capitalize shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] {entityFilter ===
					entity
						? 'bg-slate-900 text-white'
						: 'bg-white text-slate-800 hover:bg-slate-100'}"
				>
					{entity} ({data.entityCounts[entity]})
				</a>
			{/each}
		</div>

		<SearchInput value={listState.search} placeholder={m.ad_search_placeholder()} class="sm:w-64" />
	</div>

	{#if data.entries.rows.length === 0}
		<div class="bento-card bento-card-static space-y-3 py-16 text-center">
			<ScrollText class="mx-auto h-10 w-10 text-slate-400" />
			<h3 class="text-base font-black text-slate-900">{m.ad_empty()}</h3>
		</div>
	{:else}
		<div class="bento-card bento-card-static overflow-x-auto p-0!">
			<table class="w-full min-w-[800px] text-sm">
				<thead>
					<tr class="border-b-2 border-slate-900 bg-slate-50">
						<th
							class="px-4 py-3 text-left text-[11px] font-black tracking-wider text-slate-600 uppercase"
						>
							{m.ad_col_when()}
						</th>
						<th
							class="px-4 py-3 text-left text-[11px] font-black tracking-wider text-slate-600 uppercase"
						>
							{m.ad_col_actor()}
						</th>
						<th
							class="px-4 py-3 text-left text-[11px] font-black tracking-wider text-slate-600 uppercase"
						>
							{m.ad_col_object()}
						</th>
						<th
							class="px-4 py-3 text-left text-[11px] font-black tracking-wider text-slate-600 uppercase"
						>
							{m.ad_col_transition()}
						</th>
						<th
							class="px-4 py-3 text-left text-[11px] font-black tracking-wider text-slate-600 uppercase"
						>
							{m.ad_col_reason()}
						</th>
					</tr>
				</thead>
				<tbody>
					{#each data.entries.rows as entry (entry.id)}
						<tr class="border-b border-slate-200 last:border-0">
							<td class="px-4 py-2.5 text-[11px] font-bold whitespace-nowrap text-slate-500">
								{formatTime(entry.createdAt)}
							</td>
							<td class="px-4 py-2.5 text-[11px] font-bold text-slate-700">
								{entry.actorLabel ?? entry.actorId?.slice(0, 8) ?? m.ad_system()}
							</td>
							<td class="px-4 py-2.5">
								<span
									class="rounded-md border border-slate-400 bg-slate-100 px-1.5 py-0.5 text-[10px] font-black tracking-wider text-slate-700 uppercase"
								>
									{entry.entity}{entry.entityId ? ` #${entry.entityId}` : ''}
								</span>
							</td>
							<td class="px-4 py-2.5 text-[11px] font-bold text-slate-700">
								{entry.action.replace(/_/g, ' ')}
								{#if entry.fromState || entry.toState}
									<span class="text-slate-400">
										{entry.fromState ?? '—'} → {entry.toState ?? '—'}
									</span>
								{/if}
							</td>
							<td class="max-w-xs px-4 py-2.5 text-[11px] font-medium text-slate-600">
								{entry.reason ?? ''}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<PaginationBar result={data.entries} />
	{/if}
</div>
