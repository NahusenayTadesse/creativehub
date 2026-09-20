<script lang="ts">
	import type { SubmitFunction } from '@sveltejs/kit';
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import AppImage from '$lib/components/app-image.svelte';
	import PageHeader from '$lib/components/page-header.svelte';
	import PaginationBar from '$lib/components/pagination-bar.svelte';
	import SearchInput from '$lib/components/search-input.svelte';
	import InputComp from '$lib/formComponents/InputComp.svelte';
	import { withParams } from '$lib/query';
	import { formatReach } from '$lib/domain/money';
	import { statSourceLabel } from '$lib/domain/stat-source';
	import {
		BadgeCheck,
		CircleAlert,
		CircleHelp,
		ExternalLink,
		Inbox,
		ShieldCheck,
		Undo2,
		UserRoundX
	} from '@lucide/svelte';
	import * as m from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';

	/**
	 * The queue where somebody says whether a handle really is this creator's.
	 *
	 * Everything on a row is here so the decision can be made without leaving
	 * the page: the handle, a link to the live profile, what the automatic link
	 * check found, whether the bio-code proof was ever attempted, and where the
	 * follower count came from. The judgement is a person's; the evidence is
	 * whatever the machine already gathered.
	 */
	let { data } = $props();

	/* An absent parameter means "waiting", as on the other operator queues. */
	const stateFilter = $derived(page.url.searchParams.get('state') ?? 'unconfirmed');
	const stateLink = (state: string) => withParams(page.url, { state, page: null });

	const tabs = $derived([
		{ key: 'unconfirmed', label: m.cown_tab_waiting(), count: data.counts.unconfirmed },
		{ key: 'confirmed', label: m.cown_tab_confirmed(), count: data.counts.confirmed },
		{ key: 'all', label: m.bl_tab_all(), count: data.counts.unconfirmed + data.counts.confirmed }
	]);

	const platformFilter = $derived(page.url.searchParams.get('platform') ?? 'all');

	/* The same control the directory filters with, so an encoder working the
	   queue and a brand browsing it are picking a platform the same way. */
	const platformItems = $derived([
		{ value: 'all', name: m.cown_all_platforms() },
		...data.platforms.map((p) => ({
			value: String(p.id),
			name: p.name,
			glyph: p.name,
			color: p.color
		}))
	]);

	const decided =
		(text: string): SubmitFunction =>
		() =>
		async ({ result, update }) => {
			if (result.type === 'failure')
				toast.error(String(result.data?.message ?? m.common_refused()));
			else if (result.type === 'success') toast.success(text);
			await update();
		};

	const formatDate = (value: string | Date | null) =>
		value
			? new Date(value).toLocaleDateString(getLocale() === 'am' ? 'am-ET' : 'en-GB', {
					day: 'numeric',
					month: 'short',
					year: 'numeric'
				})
			: '';
</script>

<svelte:head><title>{m.cown_meta_title()}</title></svelte:head>

<div class="space-y-6">
	<PageHeader
		eyebrow={m.dash_platform_operations()}
		title={m.cown_title()}
		description={m.cown_description()}
	/>

	<div class="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
		<div class="flex flex-wrap items-center gap-2">
			{#each tabs as tab (tab.key)}
				<a
					href={stateLink(tab.key)}
					data-sveltekit-noscroll
					class="inline-flex min-h-9 cursor-pointer items-center rounded-xl border-2 border-edge px-3 py-1.5 text-xs font-black shadow-[2px_2px_0px_0px_rgb(var(--bento-shadow))] transition-all sm:min-h-0 {stateFilter ===
					tab.key
						? 'bg-inverse text-inverse-ink'
						: 'bg-surface text-ink hover:bg-well'}"
				>
					{m.bl_tab_count({ label: tab.label, count: tab.count })}
				</a>
			{/each}
		</div>

		<SearchInput value={data.channels.state.search} class="sm:w-64" />
	</div>

	<!-- One encoder working through TikTok handles is the usual shape of a session. -->
	<InputComp
		name="platform"
		type="boxSelect"
		label={m.cown_filter_platform()}
		items={platformItems}
		value={platformFilter}
		onChange={(next) =>
			goto(withParams(page.url, { platform: next === 'all' ? null : String(next), page: null }), {
				noScroll: true,
				keepFocus: true
			})}
	/>

	{#if data.channels.rows.length === 0}
		<div class="bento-card bento-card-static space-y-3 py-16 text-center">
			<Inbox class="mx-auto h-10 w-10 text-ink-faint" />
			<h3 class="text-base font-black text-ink">{m.cown_empty_title()}</h3>
			<p class="text-xs font-medium text-ink-soft">{m.cown_empty_body()}</p>
		</div>
	{:else}
		<div class="space-y-4">
			{#each data.channels.rows as channel (channel.id)}
				{@const platform = channel.platformName ?? m.ch_fallback_name()}
				<div class="bento-card bento-card-static space-y-4">
					<div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
						<div class="flex items-start gap-3">
							<AppImage
								src={channel.creatorAvatar}
								alt=""
								kind="avatar"
								seed={channel.creatorUsername}
								label={channel.creatorName}
								class="h-11 w-11 shrink-0 rounded-2xl border-2 border-edge object-cover"
								loading="lazy"
								decoding="async"
								width="44"
								height="44"
							/>
							<div class="space-y-1">
								<a
									href={resolve(`/creators/${channel.creatorUsername}`)}
									target="_blank"
									class="block text-sm font-black text-ink hover:text-brand-fg"
								>
									{channel.creatorName}
								</a>
								<p class="text-[11px] font-bold text-ink-dim">
									{platform} · {channel.handle}
									{#if channel.profileUrl}
										<a
											href={channel.profileUrl}
											target="_blank"
											rel="noopener noreferrer nofollow"
											class="ml-1 inline-flex items-center gap-0.5 text-brand-fg hover:underline"
										>
											{m.cown_open_profile()}
											<ExternalLink class="h-3 w-3" />
										</a>
									{/if}
								</p>

								<div class="flex flex-wrap items-center gap-1.5">
									{#if channel.isVerified}
										<span
											class="inline-flex items-center gap-1 rounded-md border-2 border-brand-edge bg-brand-soft px-2 py-0.5 text-[10px] font-black text-brand-soft-fg"
										>
											<ShieldCheck class="h-3 w-3" />
											{m.cown_badge_confirmed()}
										</span>
									{/if}

									<!-- What the bio-code proof concluded, if the creator ever ran it. -->
									{#if channel.ownershipStatus === 'verified'}
										<span
											class="inline-flex items-center gap-1 rounded-md border-2 border-brand-edge bg-brand-soft px-2 py-0.5 text-[10px] font-black text-brand-soft-fg"
											title={m.cown_proof_on({ date: formatDate(channel.ownershipVerifiedAt) })}
										>
											<BadgeCheck class="h-3 w-3" />
											{m.cown_badge_bio_code()}
										</span>
									{:else if channel.ownershipStatus === 'pending'}
										<span
											class="inline-flex items-center gap-1 rounded-md border-2 border-warn-edge bg-warn-soft px-2 py-0.5 text-[10px] font-black text-warn-fg"
										>
											{m.cown_badge_proof_pending()}
										</span>
									{/if}

									<!-- The cheap automatic check: does the account exist at all? -->
									{#if channel.linkStatus === 'not_found'}
										<span
											class="inline-flex items-center gap-1 rounded-md border-2 border-danger-edge bg-danger-soft px-2 py-0.5 text-[10px] font-black text-danger-fg"
											title={m.ch_link_checked_on({ date: formatDate(channel.linkCheckedAt) })}
										>
											<CircleAlert class="h-3 w-3" />
											{m.ch_link_missing()}
										</span>
									{:else if channel.linkStatus === 'found'}
										<span
											class="inline-flex items-center gap-1 rounded-md border border-edge-mid bg-well px-2 py-0.5 text-[10px] font-bold text-ink-soft"
											title={m.ch_link_checked_on({ date: formatDate(channel.linkCheckedAt) })}
										>
											{m.ch_link_live()}
										</span>
									{:else}
										<span
											class="inline-flex items-center gap-1 rounded-md border border-edge-mid bg-well px-2 py-0.5 text-[10px] font-bold text-ink-dim"
										>
											<CircleHelp class="h-3 w-3" />
											{m.ch_link_unknown()}
										</span>
									{/if}

									{#if !channel.creatorIsClaimed}
										<!-- Nobody has signed in to this profile, so the claim being
										     confirmed is the operator's own data entry. -->
										<span
											class="inline-flex items-center gap-1 rounded-md border border-edge-mid bg-well px-2 py-0.5 text-[10px] font-bold text-ink-dim"
										>
											<UserRoundX class="h-3 w-3" />
											{m.cown_badge_unclaimed()}
										</span>
									{/if}
								</div>
							</div>
						</div>

						<div class="text-right text-xs">
							<span class="block text-[9px] font-black tracking-wider text-ink-dim uppercase">
								{m.ch_followers()}
							</span>
							<span class="font-black text-ink">{formatReach(channel.followers)}</span>
							<span class="mt-0.5 block text-[10px] font-bold text-ink-dim">
								{statSourceLabel(channel.followersSource, platform)}
							</span>
							<span class="mt-1 block text-[10px] font-medium text-ink-faint">
								{m.cown_added_on({ date: formatDate(channel.createdAt) })}
							</span>
						</div>
					</div>

					<div class="flex flex-wrap items-center gap-2 border-t-2 border-edge-soft pt-3">
						{#if channel.isVerified}
							<form method="POST" action="?/decide" use:enhance={decided(m.cown_withdrawn())}>
								<input type="hidden" name="id" value={channel.id} />
								<input type="hidden" name="confirmed" value="false" />
								<button
									type="submit"
									class="inline-flex items-center gap-1 rounded-lg border-2 border-edge bg-surface px-3 py-1.5 text-[11px] font-black text-danger-fg hover:bg-danger-soft"
								>
									<Undo2 class="h-3.5 w-3.5" />
									{m.cown_withdraw()}
								</button>
							</form>
							<p class="text-[11px] font-medium text-ink-dim">{m.cown_withdraw_note()}</p>
						{:else}
							<form method="POST" action="?/decide" use:enhance={decided(m.cown_confirmed())}>
								<input type="hidden" name="id" value={channel.id} />
								<input type="hidden" name="confirmed" value="true" />
								<button
									type="submit"
									class="inline-flex items-center gap-1 rounded-lg border-2 border-edge bg-brand px-3 py-1.5 text-[11px] font-black text-brand-ink hover:bg-brand-strong"
								>
									<ShieldCheck class="h-3.5 w-3.5" />
									{m.cown_confirm()}
								</button>
							</form>
							<p class="text-[11px] font-medium text-ink-dim">
								{channel.creatorVerificationLevel === 'unverified'
									? m.cown_confirm_note_first()
									: m.cown_confirm_note()}
							</p>
						{/if}
					</div>
				</div>
			{/each}
		</div>

		<PaginationBar result={data.channels} />
	{/if}
</div>
