<script lang="ts">
	import PageHeader from '$lib/components/page-header.svelte';
	import { Search, ScrollText } from '@lucide/svelte';

	let { data } = $props();

	let query = $state('');
	let entityFilter = $state('all');

	const entities = $derived([...new Set(data.entries.map((e) => e.entity))]);

	const filtered = $derived.by(() => {
		const q = query.trim().toLowerCase();
		return data.entries.filter((entry) => {
			if (entityFilter !== 'all' && entry.entity !== entityFilter) return false;
			if (q) {
				const haystack = [entry.action, entry.reason ?? '', entry.actorLabel ?? '', entry.entity]
					.join(' ')
					.toLowerCase();
				if (!haystack.includes(q)) return false;
			}
			return true;
		});
	});

	const formatTime = (value: string | Date) =>
		new Date(value).toLocaleString('en-GB', {
			day: 'numeric',
			month: 'short',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
</script>

<svelte:head><title>Audit log — Creator Network</title></svelte:head>

<div class="space-y-6">
	<PageHeader
		eyebrow="Platform operations"
		title="Audit log"
		description="Append-only. Every state change records who did it, what moved, and why — nothing here can be edited or removed, including by an operator."
	/>

	<div class="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
		<div class="flex flex-wrap items-center gap-2">
			<button
				type="button"
				onclick={() => (entityFilter = 'all')}
				class="cursor-pointer rounded-xl border-2 border-slate-900 px-3 py-1.5 text-xs font-black shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] {entityFilter ===
				'all'
					? 'bg-slate-900 text-white'
					: 'bg-white text-slate-800 hover:bg-slate-100'}"
			>
				All ({data.entries.length})
			</button>
			{#each entities as entity (entity)}
				<button
					type="button"
					onclick={() => (entityFilter = entity)}
					class="cursor-pointer rounded-xl border-2 border-slate-900 px-3 py-1.5 text-xs font-black capitalize shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] {entityFilter ===
					entity
						? 'bg-slate-900 text-white'
						: 'bg-white text-slate-800 hover:bg-slate-100'}"
				>
					{entity}
				</button>
			{/each}
		</div>

		<div class="relative sm:w-64">
			<Search class="absolute top-3 left-3 h-4 w-4 text-slate-500" />
			<input
				type="text"
				bind:value={query}
				placeholder="Search actions and reasons…"
				class="w-full rounded-2xl border-2 border-slate-900 bg-white py-2.5 pr-3 pl-9 text-xs font-bold shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] outline-none focus:ring-2 focus:ring-emerald-500"
			/>
		</div>
	</div>

	{#if filtered.length === 0}
		<div class="bento-card bento-card-static space-y-3 py-16 text-center">
			<ScrollText class="mx-auto h-10 w-10 text-slate-400" />
			<h3 class="text-base font-black text-slate-900">Nothing recorded yet</h3>
		</div>
	{:else}
		<div class="bento-card bento-card-static overflow-x-auto p-0!">
			<table class="w-full min-w-[800px] text-sm">
				<thead>
					<tr class="border-b-2 border-slate-900 bg-slate-50">
						<th class="px-4 py-3 text-left text-[11px] font-black tracking-wider text-slate-600 uppercase">
							When
						</th>
						<th class="px-4 py-3 text-left text-[11px] font-black tracking-wider text-slate-600 uppercase">
							Actor
						</th>
						<th class="px-4 py-3 text-left text-[11px] font-black tracking-wider text-slate-600 uppercase">
							Object
						</th>
						<th class="px-4 py-3 text-left text-[11px] font-black tracking-wider text-slate-600 uppercase">
							Transition
						</th>
						<th class="px-4 py-3 text-left text-[11px] font-black tracking-wider text-slate-600 uppercase">
							Reason
						</th>
					</tr>
				</thead>
				<tbody>
					{#each filtered as entry (entry.id)}
						<tr class="border-b border-slate-200 last:border-0">
							<td class="px-4 py-2.5 text-[11px] font-bold whitespace-nowrap text-slate-500">
								{formatTime(entry.createdAt)}
							</td>
							<td class="px-4 py-2.5 text-[11px] font-bold text-slate-700">
								{entry.actorLabel ?? entry.actorId?.slice(0, 8) ?? 'System'}
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
	{/if}
</div>
