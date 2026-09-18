<script lang="ts">
	import { ShieldCheck, CircleDashed } from '@lucide/svelte';
	import * as m from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';
	import { isConfirmedSource, statSourceLabel } from '$lib/domain/stat-source';

	/**
	 * Where a channel's figures came from, in one or two short lines.
	 *
	 * Shown under the numbers wherever a channel is — the creator's own channels
	 * page and the public profile — so the same figure never reads as checked in
	 * one place and unchecked in the other. When both figures share a source the
	 * note says it once; when they differ, each gets its own line. An engagement
	 * rate of 0 is "none on file" and gets no line at all.
	 */
	let {
		platform,
		followersSource,
		followersUpdatedAt,
		engagementSource,
		engagementUpdatedAt,
		engagementRate
	}: {
		platform: string;
		followersSource: string;
		followersUpdatedAt: string | Date | null;
		engagementSource: string;
		engagementUpdatedAt: string | Date | null;
		engagementRate: number;
	} = $props();

	const formatDate = (value: string | Date | null) =>
		value
			? new Date(value).toLocaleDateString(getLocale() === 'am' ? 'am-ET' : 'en-GB', {
					day: 'numeric',
					month: 'short',
					year: 'numeric'
				})
			: '';

	const line = (source: string, updatedAt: string | Date | null) => {
		const label = statSourceLabel(source, platform);
		const date = formatDate(updatedAt);
		return date ? m.src_dated({ label, date }) : label;
	};

	const lines = $derived.by(() => {
		const hasEngagement = engagementRate > 0;
		if (!hasEngagement || engagementSource === followersSource) {
			return [
				{
					confirmed: isConfirmedSource(followersSource),
					text: line(followersSource, followersUpdatedAt)
				}
			];
		}
		return [
			{
				confirmed: isConfirmedSource(followersSource),
				text: m.src_followers_line({ text: line(followersSource, followersUpdatedAt) })
			},
			{
				confirmed: isConfirmedSource(engagementSource),
				text: m.src_engagement_line({ text: line(engagementSource, engagementUpdatedAt) })
			}
		];
	});
</script>

<ul class="space-y-0.5">
	{#each lines as entry (entry.text)}
		<li
			class="flex items-center gap-1 text-[10px] font-bold {entry.confirmed
				? 'text-brand-soft-fg'
				: 'text-ink-dim'}"
		>
			{#if entry.confirmed}
				<ShieldCheck class="h-3 w-3 shrink-0" aria-hidden="true" />
			{:else}
				<CircleDashed class="h-3 w-3 shrink-0" aria-hidden="true" />
			{/if}
			<span>{entry.text}</span>
		</li>
	{/each}
</ul>
