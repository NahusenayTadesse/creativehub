<script lang="ts">
	import { resolve } from '$app/paths';
	import AppImage from '$lib/components/app-image.svelte';
	import PageHeader from '$lib/components/page-header.svelte';
	import PaginationBar from '$lib/components/pagination-bar.svelte';
	import SearchInput from '$lib/components/search-input.svelte';
	import VerificationBadge from '$lib/components/verification-badge.svelte';
	import { formatReach } from '$lib/domain/money';
	import { EyeOff, Pencil } from '@lucide/svelte';
	import * as m from '$lib/paraglide/messages';

	let { data } = $props();

	const reasonLabel = (reason: 'unverified' | 'unpriced') =>
		reason === 'unverified' ? m.hc_reason_unverified() : m.hc_reason_unpriced();
</script>

<svelte:head><title>{m.hc_meta_title()}</title></svelte:head>

<div class="space-y-6">
	<PageHeader
		eyebrow={m.dash_platform_operations()}
		title={m.hc_title()}
		description={m.hc_description()}
	/>

	<div class="flex flex-wrap items-center justify-between gap-3">
		<p class="flex items-center gap-2 text-xs font-bold text-ink-soft">
			<EyeOff class="h-4 w-4" />
			{m.hc_count({ count: data.creators.total })}
			{#if !data.requirePrice}
				<span class="text-ink-dim">· {m.hc_price_rule_off()}</span>
			{/if}
		</p>
		<SearchInput value={data.creators.state.search} class="sm:w-64" />
	</div>

	{#if data.creators.rows.length === 0}
		<div class="bento-card bento-card-static text-center text-sm font-bold text-ink-soft">
			{m.hc_empty()}
		</div>
	{:else}
		<ul class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
			{#each data.creators.rows as creator (creator.id)}
				<li class="bento-card bento-card-static flex gap-3">
					<AppImage
						src={creator.avatar}
						alt={creator.fullName}
						kind="avatar"
						seed={creator.username}
						label={creator.fullName}
						class="size-12 shrink-0 rounded-full border-2 border-edge object-cover"
						width="48"
						height="48"
						loading="lazy"
					/>
					<div class="min-w-0 flex-1 space-y-1.5">
						<div class="flex items-center gap-2">
							<p class="truncate text-sm font-black text-ink">{creator.fullName}</p>
							<VerificationBadge level={creator.verificationLevel} />
						</div>
						<p class="truncate text-[11px] font-medium text-ink-dim">
							@{creator.username}
							{#if creator.countryName}· {creator.countryFlag} {creator.countryName}{/if}
							· {formatReach(creator.totalReach)}
						</p>
						<div class="flex flex-wrap gap-1.5">
							{#each creator.reasons as reason (reason)}
								<span
									class="rounded-full border border-edge-mid bg-well px-2 py-0.5 text-[10px] font-black tracking-wider text-ink-soft uppercase"
								>
									{reasonLabel(reason)}
								</span>
							{/each}
						</div>
						<div class="flex flex-wrap gap-3 pt-1 text-[11px] font-bold">
							<a
								href={resolve(
									`/dashboard/admin/creators?q=${encodeURIComponent(creator.username)}`
								)}
								class="inline-flex items-center gap-1 text-brand-soft-fg underline underline-offset-2"
							>
								<Pencil class="h-3 w-3" />
								{m.hc_fix()}
							</a>
							<a
								href={resolve(`/creators/${creator.username}`)}
								class="text-ink-soft underline underline-offset-2"
							>
								{m.hc_view_profile()}
							</a>
						</div>
					</div>
				</li>
			{/each}
		</ul>
		<PaginationBar result={data.creators} />
	{/if}
</div>
