<script lang="ts">
	import AppImage from '$lib/components/app-image.svelte';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { toast } from 'svelte-sonner';
	import PageHeader from '$lib/components/page-header.svelte';
	import PaginationBar from '$lib/components/pagination-bar.svelte';
	import SearchInput from '$lib/components/search-input.svelte';
	import InputComp from '$lib/formComponents/InputComp.svelte';
	import { withParams } from '$lib/query';
	import { assetUrl } from '$lib/assets';
	import { formatReach } from '$lib/domain/money';
	import { statSourceLabel } from '$lib/domain/stat-source';
	import { ArrowRight, ExternalLink, Inbox, ShieldCheck } from '@lucide/svelte';
	import * as m from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';

	let { data } = $props();

	let notes = $state<Record<number, string>>({});

	/* An absent parameter means "pending" here, as on the other operator queues. */
	const statusFilter = $derived(page.url.searchParams.get('status') ?? 'pending');
	const statusLink = (status: string) => withParams(page.url, { status });
	const countFor = (status: string) =>
		status === 'all'
			? Object.values(data.statusCounts).reduce((sum, n) => sum + n, 0)
			: (data.statusCounts[status] ?? 0);

	const tabs = $derived([
		{ key: 'pending', label: m.av_tab_pending() },
		{ key: 'approved', label: m.av_tab_approved() },
		{ key: 'rejected', label: m.av_tab_rejected() },
		{ key: 'all', label: m.bl_tab_all() }
	]);

	const statusTone: Record<string, string> = {
		pending: 'border-warn-edge bg-warn-soft text-warn-fg',
		approved: 'border-brand-edge bg-brand-soft text-brand-soft-fg',
		rejected: 'border-danger-edge bg-danger-soft text-danger-fg'
	};

	const handle =
		(text: string): SubmitFunction =>
		() => {
			return async ({ result, update }) => {
				if (result.type === 'failure') toast.error(result.data?.message ?? m.common_refused());
				else if (result.type === 'success') toast.success(text);
				await update();
			};
		};

	const formatDate = (value: string | Date) =>
		new Date(value).toLocaleDateString(getLocale() === 'am' ? 'am-ET' : 'en-GB', {
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		});

	/* A PDF cannot be drawn inline; everything the proof form accepts is an image,
	   but rows older than that rule should still open. */
	const isImage = (stored: string) => /\.(png|jpe?g|webp|avif)$/i.test(stored);
</script>

<svelte:head><title>{m.sp_meta_title()}</title></svelte:head>

<div class="space-y-6">
	<PageHeader
		eyebrow={m.dash_platform_operations()}
		title={m.sp_title()}
		description={m.sp_description()}
	/>

	<div class="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
		<div class="flex flex-wrap items-center gap-2">
			{#each tabs as tab (tab.key)}
				<a
					href={statusLink(tab.key)}
					data-sveltekit-noscroll
					class="cursor-pointer rounded-xl border-2 border-edge px-3 py-1.5 text-xs font-black shadow-[2px_2px_0px_0px_rgb(var(--bento-shadow))] transition-all {statusFilter ===
					tab.key
						? 'bg-inverse text-inverse-ink'
						: 'bg-surface text-ink hover:bg-well'}"
				>
					{m.bl_tab_count({ label: tab.label, count: countFor(tab.key) })}
				</a>
			{/each}
		</div>

		<SearchInput value={data.proofs.state.search} class="sm:w-64" />
	</div>

	{#if data.proofs.rows.length === 0}
		<div class="bento-card bento-card-static space-y-3 py-16 text-center">
			<Inbox class="mx-auto h-10 w-10 text-ink-faint" />
			<h3 class="text-base font-black text-ink">{m.sp_empty_title()}</h3>
			<p class="text-xs font-medium text-ink-soft">{m.sp_empty_body()}</p>
		</div>
	{:else}
		<div class="space-y-4">
			{#each data.proofs.rows as proof (proof.id)}
				{@const platform = proof.platformName ?? m.ch_fallback_name()}
				<div class="bento-card bento-card-static space-y-4">
					<div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
						<div class="flex items-start gap-3">
							<AppImage
								src={proof.creatorAvatar}
								alt=""
								kind="avatar"
								seed={proof.creatorUsername}
								label={proof.creatorName}
								class="h-11 w-11 shrink-0 rounded-2xl border-2 border-edge object-cover"
								loading="lazy"
								decoding="async"
								width="44"
								height="44"
							/>
							<div>
								<span
									class="mb-1 inline-block rounded-md border-2 px-2 py-0.5 text-[10px] font-black tracking-wider uppercase {statusTone[
										proof.status
									]}"
								>
									{proof.status}
								</span>
								<a
									href={resolve(`/creators/${proof.creatorUsername}`)}
									target="_blank"
									class="block text-sm font-black text-ink hover:text-brand-fg"
								>
									{proof.creatorName}
								</a>
								<p class="text-[11px] font-bold text-ink-dim">
									{platform} · {proof.handle}
									{#if proof.profileUrl}
										<a
											href={proof.profileUrl}
											target="_blank"
											rel="noreferrer external"
											class="ml-1 inline-flex items-center text-brand-soft-fg hover:underline"
											aria-label={m.ch_open_channel()}
										>
											<ExternalLink class="h-3 w-3" />
										</a>
									{/if}
								</p>
							</div>
						</div>
						<span class="shrink-0 text-[10px] font-bold text-ink-faint">
							{formatDate(proof.createdAt)}
						</span>
					</div>

					<div class="grid gap-4 md:grid-cols-2">
						<!-- The claim beside the channel as it stands -->
						<div
							class="space-y-3 self-start rounded-2xl border-2 border-edge-soft bg-panel p-3 text-xs"
						>
							<div class="flex items-center justify-between gap-2">
								<div>
									<span class="block text-[9px] font-black tracking-wider text-ink-dim uppercase">
										{m.sp_on_file()}
									</span>
									<span class="font-black text-ink">{formatReach(proof.currentFollowers)}</span>
									{#if proof.currentEngagementRate > 0}
										<span class="text-ink-soft">· {proof.currentEngagementRate.toFixed(1)}%</span>
									{/if}
									<span class="block text-[10px] font-bold text-ink-dim">
										{statSourceLabel(proof.followersSource, platform)}
									</span>
								</div>
								<ArrowRight class="h-4 w-4 shrink-0 text-ink-faint" aria-hidden="true" />
								<div class="text-right">
									<span class="block text-[9px] font-black tracking-wider text-ink-dim uppercase">
										{m.sp_claimed()}
									</span>
									<span class="font-black text-ink">{proof.followers.toLocaleString()}</span>
									{#if proof.engagementRate !== null}
										<span class="text-ink-soft">· {proof.engagementRate.toFixed(1)}%</span>
									{/if}
								</div>
							</div>
							<p class="text-[11px] font-medium text-ink-dim">{m.sp_compare_hint()}</p>
						</div>

						<!-- The screenshot itself -->
						<a
							href={assetUrl(proof.screenshot)}
							target="_blank"
							rel="noreferrer external"
							class="block overflow-hidden rounded-2xl border-2 border-edge-soft bg-well"
						>
							{#if isImage(proof.screenshot)}
								<AppImage
									src={proof.screenshot}
									alt={m.sp_screenshot_alt({ name: proof.creatorName, platform })}
									class="max-h-72 w-full object-contain"
									loading="lazy"
									decoding="async"
								/>
							{:else}
								<span
									class="flex items-center gap-1 p-3 text-xs font-black text-brand-soft-fg hover:underline"
								>
									<ExternalLink class="h-3.5 w-3.5" />
									{m.av_open_document()}
								</span>
							{/if}
						</a>
					</div>

					{#if proof.adminNotes}
						<p class="rounded-xl bg-well p-2 text-[11px] font-medium text-ink-soft">
							<strong class="font-black">{m.av_note()}</strong>
							{proof.adminNotes}
						</p>
					{/if}

					{#if proof.status === 'pending'}
						<div class="space-y-2 border-t-2 border-edge-soft pt-3">
							<!-- One note carried into whichever decision is picked, as on the
							     verification queue, so switching buttons keeps what was typed. -->
							<InputComp
								name="note-{proof.id}"
								type="textarea"
								rows={2}
								label={m.av_decision_note()}
								placeholder={m.sp_decision_placeholder()}
								bind:value={notes[proof.id]}
							/>

							<div class="flex flex-wrap justify-end gap-2">
								<form method="POST" action="?/decide" use:enhance={handle(m.sp_rejected_toast())}>
									<input type="hidden" name="id" value={proof.id} />
									<input type="hidden" name="status" value="rejected" />
									<input type="hidden" name="adminNotes" value={notes[proof.id] ?? ''} />
									<button
										type="submit"
										class="rounded-xl border-2 border-edge bg-surface px-3 py-1.5 text-xs font-black text-danger-fg hover:bg-danger-soft"
									>
										{m.av_reject()}
									</button>
								</form>

								<form method="POST" action="?/decide" use:enhance={handle(m.sp_approved_toast())}>
									<input type="hidden" name="id" value={proof.id} />
									<input type="hidden" name="status" value="approved" />
									<input type="hidden" name="adminNotes" value={notes[proof.id] ?? ''} />
									<button
										type="submit"
										class="flex items-center gap-1.5 rounded-xl border-2 border-edge bg-brand px-3 py-1.5 text-xs font-black text-brand-ink shadow-[2px_2px_0px_0px_rgb(var(--bento-shadow))] hover:bg-brand-strong"
									>
										<ShieldCheck class="h-3.5 w-3.5" />
										{m.sp_approve()}
									</button>
								</form>
							</div>
						</div>
					{/if}
				</div>
			{/each}
		</div>

		<PaginationBar result={data.proofs} />
	{/if}
</div>
