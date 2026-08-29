<script lang="ts">
	import AppImage from '$lib/components/app-image.svelte';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';
	import { toast } from 'svelte-sonner';
	import PageHeader from '$lib/components/page-header.svelte';
	import PaginationBar from '$lib/components/pagination-bar.svelte';
	import InputComp from '$lib/formComponents/InputComp.svelte';
	import SearchInput from '$lib/components/search-input.svelte';
	import { page } from '$app/state';
	import { withParams } from '$lib/query';
	import { Handshake, Inbox, ExternalLink, PhoneCall, X } from '@lucide/svelte';
	import * as m from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';

	let { data } = $props();

	let notes = $state<Record<number, string>>({});

	/* The queue opens on the open cases, so an absent parameter means "open"
	   here rather than "everything". */
	const statusFilter = $derived(page.url.searchParams.get('introduction') ?? 'open');
	const statusLink = (introduction: string) => withParams(page.url, { introduction });
	const countFor = (status: string) =>
		status === 'open'
			? (data.statusCounts['pending'] ?? 0) + (data.statusCounts['contacted'] ?? 0)
			: status === 'all'
				? Object.values(data.statusCounts).reduce((sum, n) => sum + n, 0)
				: (data.statusCounts[status] ?? 0);

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

	const tabs = $derived([
		{ key: 'open', label: m.ai_tab_open() },
		{ key: 'pending', label: m.ai_tab_pending() },
		{ key: 'contacted', label: m.ai_tab_contacted() },
		{ key: 'connected', label: m.ai_tab_connected() },
		{ key: 'declined', label: m.ai_tab_declined() },
		{ key: 'all', label: m.bl_tab_all() }
	]);

	const statusTone: Record<string, string> = {
		pending: 'border-warn-edge bg-warn-soft text-warn-fg',
		contacted: 'border-info-edge bg-info-soft text-info-fg',
		connected: 'border-brand-edge bg-brand-soft text-brand-soft-fg',
		declined: 'border-danger-edge bg-danger-soft text-danger-fg'
	};
</script>

<svelte:head><title>{m.ai_meta_title()}</title></svelte:head>

<div class="space-y-6">
	<PageHeader
		eyebrow={m.dash_platform_operations()}
		title={m.ai_title()}
		description={m.ai_description()}
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

		<SearchInput value={data.cases.state.search} class="sm:w-64" />
	</div>

	{#if data.cases.rows.length === 0}
		<div class="bento-card bento-card-static space-y-3 py-16 text-center">
			<Inbox class="mx-auto h-10 w-10 text-ink-faint" />
			<h3 class="text-base font-black text-ink">{m.ai_empty_title()}</h3>
			<p class="text-xs font-medium text-ink-soft">{m.ai_empty_body()}</p>
		</div>
	{:else}
		<div class="space-y-4">
			{#each data.cases.rows as row (row.id)}
				{@const open =
					row.introductionStatus === 'pending' || row.introductionStatus === 'contacted'}
				<div class="bento-card bento-card-static space-y-4">
					<div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
						<div class="flex items-start gap-3">
							<AppImage
								src={row.creatorAvatar}
								alt=""
								kind="avatar"
								seed={row.creatorUsername}
								label={row.creatorName}
								class="h-11 w-11 shrink-0 rounded-2xl border-2 border-edge object-cover"
								loading="lazy"
								decoding="async"
								width="44"
								height="44"
							/>
							<div>
								<div class="mb-1 flex flex-wrap items-center gap-2">
									<span
										class="rounded-md border-2 px-2 py-0.5 text-[10px] font-black tracking-wider uppercase {statusTone[
											row.introductionStatus
										]}"
									>
										{row.introductionStatus}
									</span>
									{#if row.creatorIsClaimed}
										<!-- The creator signed up after this case opened. Chasing them
										     is done; the deal can be handed back to the normal flow. -->
										<span
											class="rounded-md border border-brand-edge bg-brand-soft px-2 py-0.5 text-[10px] font-black tracking-wider text-brand-soft-fg uppercase"
										>
											{m.ai_now_claimed()}
										</span>
									{/if}
								</div>

								<a
									href={resolve(`/creators/${row.creatorUsername}`)}
									target="_blank"
									class="text-sm font-black text-ink hover:text-brand-fg"
								>
									{row.creatorName}
								</a>
								<p class="text-[11px] font-bold text-ink-dim">
									@{row.creatorUsername}
									{#if row.countryName}
										· {row.countryFlag ?? '🌍'}
										{row.countryName}{row.creatorCity ? `, ${row.creatorCity}` : ''}
									{/if}
									{#if row.platformName}
										· {row.platformName}
									{/if}
								</p>
							</div>
						</div>

						<div class="shrink-0 text-right">
							<span class="block text-[9px] font-black tracking-wider text-ink-dim uppercase">
								{m.ai_waiting_since()}
							</span>
							<span class="mt-1 block text-xs font-black text-ink">
								{formatDate(row.createdAt)}
							</span>
						</div>
					</div>

					<!-- The deal on the table, so an operator knows what they are offering -->
					<div class="space-y-2 rounded-2xl border-2 border-edge-soft bg-panel p-3">
						<div class="flex flex-wrap items-center justify-between gap-2">
							<a
								href={resolve(`/dashboard/bookings/${row.id}`)}
								class="inline-flex items-center gap-1 text-xs font-black text-brand-soft-fg hover:underline"
							>
								<ExternalLink class="h-3.5 w-3.5" />
								{row.reference}
							</a>
							<span class="text-xs font-black text-ink">
								{row.price.toLocaleString()}
								<span class="text-brand-fg">{row.currencyCode}</span>
							</span>
						</div>
						<p class="text-xs font-bold text-ink">{row.title}</p>
						<p class="text-[11px] font-medium text-ink-soft">
							{m.ai_from_organisation({ organisation: row.organizationName })}
						</p>
					</div>

					{#if row.introductionNote}
						<p class="rounded-xl bg-well p-2 text-[11px] font-medium text-ink-soft">
							<strong class="font-black">{m.av_note()}</strong>
							{row.introductionNote}
						</p>
					{/if}

					{#if open}
						<div class="space-y-2 border-t-2 border-edge-soft pt-3">
							<!-- One note carried into whichever outcome is picked, as a hidden
							     field, so switching between them keeps what was typed. -->
							<InputComp
								name="note-{row.id}"
								type="textarea"
								rows={2}
								label={m.ai_decision_note()}
								placeholder={m.ai_decision_placeholder()}
								bind:value={notes[row.id]}
							/>

							<div class="flex flex-wrap justify-end gap-2">
								{#if row.introductionStatus === 'pending'}
									<form
										method="POST"
										action="?/decide"
										use:enhance={handle(m.ai_contacted_toast())}
									>
										<input type="hidden" name="id" value={row.id} />
										<input type="hidden" name="status" value="contacted" />
										<input type="hidden" name="introductionNote" value={notes[row.id] ?? ''} />
										<button
											type="submit"
											class="flex items-center gap-1.5 rounded-xl border-2 border-edge bg-surface px-3 py-1.5 text-xs font-black text-ink hover:bg-info-soft"
										>
											<PhoneCall class="h-3.5 w-3.5" />
											{m.ai_mark_contacted()}
										</button>
									</form>
								{/if}

								<form method="POST" action="?/decide" use:enhance={handle(m.ai_declined_toast())}>
									<input type="hidden" name="id" value={row.id} />
									<input type="hidden" name="status" value="declined" />
									<input type="hidden" name="introductionNote" value={notes[row.id] ?? ''} />
									<button
										type="submit"
										class="flex items-center gap-1.5 rounded-xl border-2 border-edge bg-surface px-3 py-1.5 text-xs font-black text-danger-fg hover:bg-danger-soft"
									>
										<X class="h-3.5 w-3.5" />
										{m.ai_mark_declined()}
									</button>
								</form>

								{#if row.introductionStatus === 'contacted'}
									<form
										method="POST"
										action="?/decide"
										use:enhance={handle(m.ai_connected_toast())}
									>
										<input type="hidden" name="id" value={row.id} />
										<input type="hidden" name="status" value="connected" />
										<input type="hidden" name="introductionNote" value={notes[row.id] ?? ''} />
										<button
											type="submit"
											class="flex items-center gap-1.5 rounded-xl border-2 border-edge bg-brand px-3 py-1.5 text-xs font-black text-brand-ink shadow-[2px_2px_0px_0px_rgb(var(--bento-shadow))] hover:bg-brand-strong"
										>
											<Handshake class="h-3.5 w-3.5" />
											{m.ai_mark_connected()}
										</button>
									</form>
								{/if}
							</div>
						</div>
					{/if}
				</div>
			{/each}
		</div>

		<PaginationBar result={data.cases} />
	{/if}
</div>
