<script lang="ts">
	import { untrack } from 'svelte';
	import * as m from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';
	import { superForm } from 'sveltekit-superforms';
	import { enhance as plainEnhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { withParams } from '$lib/query';
	import { toast } from 'svelte-sonner';
	import AppImage from '$lib/components/app-image.svelte';
	import PageHeader from '$lib/components/page-header.svelte';
	import InputComp from '$lib/formComponents/InputComp.svelte';
	import Errors from '$lib/formComponents/Errors.svelte';
	import LoadingBtn from '$lib/formComponents/LoadingBtn.svelte';
	import { formatReach } from '$lib/domain/money';
	import { ArrowLeft, Clock, Hand, SearchX, UserPlus, X } from '@lucide/svelte';

	let { data } = $props();

	const { form, errors, enhance, delayed, allErrors, message } = superForm(
		untrack(() => data.form)
	);

	$effect(() => {
		if ($message?.type === 'error') toast.error($message.text);
		else if ($message?.type === 'success') toast.success($message.text);
	});

	const formatDate = (value: string | Date) =>
		new Date(value).toLocaleDateString(getLocale() === 'am' ? 'am-ET' : 'en-GB', {
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		});

	/* Picking a profile is a link, not client state — the server re-reads the
	   row anyway, so there is nothing worth holding on this side. */
	const pickLink = (username: string) => withParams(page.url, { username });
	const clearLink = $derived(withParams(page.url, { username: null }));

	const withdrew: SubmitFunction =
		() =>
		async ({ result, update }) => {
			if (result.type === 'failure') toast.error(result.data?.message ?? m.common_refused());
			else if (result.type === 'success') toast.success(m.cl_withdrawn_toast());
			await update();
		};
</script>

<svelte:head><title>{m.cl_meta_title()}</title></svelte:head>

<div class="mx-auto max-w-2xl space-y-6">
	<PageHeader eyebrow={m.cl_eyebrow()} title={m.cl_title()} description={m.cl_description()} />

	{#if data.open}
		<!-- A claim is already with an operator. Nothing to do but wait, or take
		     it back — offering the form again here would only create a second. -->
		<div class="bento-card bento-card-static space-y-4">
			<div class="flex items-start gap-3">
				<Clock class="mt-0.5 h-5 w-5 shrink-0 text-warn" />
				<div class="space-y-1">
					<h2 class="text-sm font-black text-ink">{m.cl_pending_title()}</h2>
					<p class="text-xs font-medium text-ink-soft">
						{m.cl_pending_body({
							name: data.open.creatorName,
							date: formatDate(data.open.createdAt)
						})}
					</p>
				</div>
			</div>

			<div class="flex items-center gap-3 rounded-2xl border-2 border-edge-soft bg-panel p-3">
				<AppImage
					src={data.open.creatorAvatar}
					alt=""
					kind="avatar"
					seed={data.open.creatorUsername}
					label={data.open.creatorName}
					class="h-10 w-10 shrink-0 rounded-2xl border-2 border-edge object-cover"
					loading="lazy"
					decoding="async"
					width="40"
					height="40"
				/>
				<div>
					<p class="text-sm font-black text-ink">{data.open.creatorName}</p>
					<p class="text-[11px] font-bold text-ink-dim">@{data.open.creatorUsername}</p>
				</div>
			</div>

			<form method="POST" action="?/withdraw" use:plainEnhance={withdrew} class="flex justify-end">
				<input type="hidden" name="id" value={data.open.id} />
				<button
					type="submit"
					class="flex items-center gap-1.5 rounded-xl border-2 border-edge bg-surface px-3 py-1.5 text-xs font-black text-danger-fg hover:bg-danger-soft"
				>
					<X class="h-3.5 w-3.5" />
					{m.cl_withdraw()}
				</button>
			</form>
		</div>
	{:else if data.target}
		<div class="bento-card bento-card-static space-y-4">
			<div class="flex items-center justify-between gap-3">
				<span class="text-[9px] font-black tracking-wider text-ink-dim uppercase">
					{m.cl_claiming()}
				</span>
				<a
					href={clearLink}
					data-sveltekit-noscroll
					class="inline-flex items-center gap-1 text-[11px] font-black text-ink-soft hover:text-brand-soft-fg"
				>
					<ArrowLeft class="h-3.5 w-3.5" />
					{m.cl_change()}
				</a>
			</div>

			<div class="flex items-center gap-3 rounded-2xl border-2 border-edge bg-panel p-3">
				<AppImage
					src={data.target.avatar}
					alt=""
					kind="avatar"
					seed={data.target.username}
					label={data.target.fullName}
					class="h-12 w-12 shrink-0 rounded-2xl border-2 border-edge object-cover"
					loading="lazy"
					decoding="async"
					width="48"
					height="48"
				/>
				<div>
					<p class="text-sm font-black text-ink">{data.target.fullName}</p>
					<p class="text-[11px] font-bold text-ink-dim">
						@{data.target.username}
						{#if data.target.countryName}
							· {data.target.countryFlag ?? '🌍'}
							{data.target.countryName}{data.target.city ? `, ${data.target.city}` : ''}
						{/if}
					</p>
					<p class="text-[11px] font-bold text-brand-soft-fg">
						{m.ap_reach_suffix({ reach: formatReach(data.target.totalReach) })}
						{#if data.target.platformName}
							· {data.target.platformName}
						{/if}
					</p>
				</div>
			</div>

			<form method="POST" action="?/claim" use:enhance class="space-y-3">
				<Errors allErrors={$allErrors} />
				<input type="hidden" name="creatorId" value={data.target.id} />

				<InputComp
					{form}
					{errors}
					name="evidence"
					type="textarea"
					rows={4}
					label={m.cl_evidence_label()}
					placeholder={m.cl_evidence_placeholder()}
					required
				/>
				<p class="text-[11px] font-medium text-ink-dim">{m.cl_evidence_help()}</p>

				<InputComp {form} {errors} name="proofUrl" type="text" label={m.cl_proof_label()} />

				<div class="flex justify-end">
					<button
						type="submit"
						disabled={$delayed}
						class="flex items-center justify-center gap-2 rounded-2xl border-2 border-edge bg-brand px-4 py-2 text-xs font-black text-brand-ink shadow-[3px_3px_0px_0px_rgb(var(--bento-shadow))] hover:bg-brand-strong disabled:opacity-60"
					>
						{#if $delayed}
							<LoadingBtn name={m.cl_submit()} />
						{:else}
							<Hand class="h-4 w-4" />
							{m.cl_submit()}
						{/if}
					</button>
				</div>
			</form>
		</div>
	{:else}
		{#if data.lastRejected}
			<div class="bento-card bento-card-static space-y-1 border-danger-edge!">
				<h2 class="text-sm font-black text-ink">{m.cl_rejected_title()}</h2>
				<p class="text-xs font-medium text-ink-soft">
					{m.cl_rejected_body({ name: data.lastRejected.creatorName })}
				</p>
				{#if data.lastRejected.adminNotes}
					<p class="rounded-xl bg-well p-2 text-[11px] font-medium text-ink-soft">
						{data.lastRejected.adminNotes}
					</p>
				{/if}
				<p class="text-[11px] font-medium text-ink-dim">{m.cl_rejected_retry()}</p>
			</div>
		{/if}

		{#if data.candidates.length}
			<div class="space-y-3">
				<h2 class="text-sm font-black text-ink">{m.cl_suggestions_title()}</h2>
				{#each data.candidates as candidate (candidate.id)}
					<div
						class="bento-card bento-card-static flex flex-wrap items-center justify-between gap-3"
					>
						<div class="flex items-center gap-3">
							<AppImage
								src={candidate.avatar}
								alt=""
								kind="avatar"
								seed={candidate.username}
								label={candidate.fullName}
								class="h-11 w-11 shrink-0 rounded-2xl border-2 border-edge object-cover"
								loading="lazy"
								decoding="async"
								width="44"
								height="44"
							/>
							<div>
								<a
									href={resolve(`/creators/${candidate.username}`)}
									target="_blank"
									class="text-sm font-black text-ink hover:text-brand-fg"
								>
									{candidate.fullName}
								</a>
								<p class="text-[11px] font-bold text-ink-dim">
									@{candidate.username}
									{#if candidate.countryName}
										· {candidate.countryFlag ?? '🌍'}
										{candidate.countryName}{candidate.city ? `, ${candidate.city}` : ''}
									{/if}
								</p>
								<p class="text-[11px] font-bold text-brand-soft-fg">
									{m.ap_reach_suffix({ reach: formatReach(candidate.totalReach) })}
									{#if candidate.platformName}
										· {candidate.platformName}
									{/if}
								</p>
							</div>
						</div>

						<a
							href={pickLink(candidate.username)}
							data-sveltekit-noscroll
							class="rounded-xl border-2 border-edge bg-brand px-3 py-1.5 text-xs font-black text-brand-ink shadow-[2px_2px_0px_0px_rgb(var(--bento-shadow))] hover:bg-brand-strong"
						>
							{m.cl_choose()}
						</a>
					</div>
				{/each}
			</div>
		{:else}
			<div class="bento-card bento-card-static space-y-3 py-16 text-center">
				<SearchX class="mx-auto h-10 w-10 text-ink-faint" />
				<h3 class="text-base font-black text-ink">{m.cl_none_title()}</h3>
				<p class="mx-auto max-w-md text-xs font-medium text-ink-soft">{m.cl_none_body()}</p>
			</div>
		{/if}

		<div class="flex justify-center">
			<a
				href={resolve('/dashboard/profile/create')}
				class="inline-flex items-center gap-1.5 rounded-xl border-2 border-edge bg-surface px-4 py-2 text-xs font-black text-ink shadow-[2px_2px_0px_0px_rgb(var(--bento-shadow))] hover:bg-well"
			>
				<UserPlus class="h-3.5 w-3.5" />
				{m.cl_create_instead()}
			</a>
		</div>
	{/if}
</div>
