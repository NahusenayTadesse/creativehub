<script lang="ts">
	import { untrack } from 'svelte';
	import InputComp from '$lib/formComponents/InputComp.svelte';
	import Errors from '$lib/formComponents/Errors.svelte';
	import LoadingBtn from '$lib/formComponents/LoadingBtn.svelte';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { resolve } from '$app/paths';
	import * as m from '$lib/paraglide/messages';
	import { enhance } from '$app/forms';
	import { superForm } from 'sveltekit-superforms';
	import { toast } from 'svelte-sonner';
	import PageHeader from '$lib/components/page-header.svelte';
	import PaginationBar from '$lib/components/pagination-bar.svelte';
	import SearchInput from '$lib/components/search-input.svelte';
	import {
		ShieldCheck,
		Briefcase,
		Database,
		UserCheck,
		MailPlus,
		X,
		Ban,
		ShieldOff
	} from '@lucide/svelte';
	import UserBanDialog from '$lib/components/user-ban-dialog.svelte';
	import { page } from '$app/state';
	import { getLocale } from '$lib/paraglide/runtime';
	import { withParams } from '$lib/query';

	let { data } = $props();

	const ROLE_ITEMS = $derived([
		{ value: 'creator', name: m.au_role_creator() },
		{ value: 'business', name: m.au_role_brand() },
		{ value: 'encoder', name: m.au_role_encoder() },
		{ value: 'admin', name: m.au_role_operator() }
	]);

	/* Role tab and search both live in the URL; the counts are the database's,
	   over every account rather than the page being shown. */
	const listState = $derived(data.users.state);
	const roleFilter = $derived(listState.values.role ?? 'all');
	const roleLink = (role: string) => withParams(page.url, { role: role === 'all' ? null : role });

	/* Banned is a flag rather than a fifth tab: it cuts across the roles instead
	   of sitting beside them, so it keeps whichever role tab is open. */
	const bannedOnly = $derived(listState.values.banned === '1');
	const bannedLink = $derived(withParams(page.url, { banned: bannedOnly ? null : '1' }));

	const countFor = (role: string) =>
		role === 'all'
			? Object.values(data.roleCounts).reduce((sum, n) => sum + n, 0)
			: (data.roleCounts[role] ?? 0);

	const handler: SubmitFunction = () => {
		return async ({ result, update }) => {
			if (result.type === 'failure') toast.error(result.data?.message ?? m.common_refused());
			else if (result.type === 'success') toast.success(m.au_role_updated());
			await update();
		};
	};

	const tabs = $derived([
		{ key: 'all', label: m.bl_tab_all() },
		{ key: 'creator', label: m.au_tab_creators() },
		{ key: 'business', label: m.au_tab_brands() },
		{ key: 'encoder', label: m.au_tab_encoders() },
		{ key: 'admin', label: m.au_tab_operators() }
	]);

	const roleTone: Record<string, string> = {
		admin: 'border-tint-violet-edge bg-tint-violet text-tint-violet-fg',
		business: 'border-info-edge bg-info-soft text-info-fg',
		encoder: 'border-edge-mid bg-well text-ink-soft',
		creator: 'border-brand-edge bg-brand-soft text-brand-soft-fg'
	};

	/* Only the two roles nobody may claim. Creator and business accounts sign
	   themselves up, so inviting one would be a second, quieter sign-up form. */
	const STAFF_ROLE_ITEMS = $derived([
		{ value: 'encoder', name: m.au_role_encoder() },
		{ value: 'admin', name: m.au_role_operator() }
	]);

	const {
		form: inviteForm,
		errors: inviteErrors,
		enhance: inviteEnhance,
		delayed: inviteDelayed,
		allErrors: inviteAllErrors,
		message: inviteMessage
	} = superForm(
		untrack(() => data.inviteForm),
		{ id: 'invite', resetForm: true }
	);

	$effect(() => {
		if ($inviteMessage?.type === 'error') toast.error($inviteMessage.text);
		else if ($inviteMessage?.type === 'success') toast.success($inviteMessage.text);
	});

	const revokeHandler: SubmitFunction = () => {
		return async ({ result, update }) => {
			if (result.type === 'failure') toast.error(result.data?.message ?? m.common_refused());
			else if (result.type === 'success') toast.success(m.si_revoked());
			await update();
		};
	};

	const unbanHandler: SubmitFunction = () => {
		return async ({ result, update }) => {
			if (result.type === 'failure') toast.error(result.data?.message ?? m.common_refused());
			else if (result.type === 'success') toast.success(m.au_unbanned_toast());
			await update();
		};
	};

	const formatDate = (value: string | Date) =>
		new Date(value).toLocaleDateString(getLocale() === 'am' ? 'am-ET' : 'en-GB', {
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		});
</script>

<svelte:head><title>{m.au_meta_title()}</title></svelte:head>

<div class="space-y-6">
	<PageHeader eyebrow={m.sb_marketplace()} title={m.au_title()} description={m.au_description()} />

	<!-- Staff are invited, never registered. The form below writes no account:
	     it sends one link, and the person who opens it chooses the name and the
	     password the account will have. -->
	<div class="bento-card bento-card-static space-y-4">
		<div class="flex items-start gap-3 border-b-2 border-edge pb-4">
			<div
				class="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border-2 border-edge bg-brand-soft"
			>
				<MailPlus class="h-4 w-4 text-brand-soft-fg" />
			</div>
			<div>
				<h2 class="text-lg font-black text-ink">{m.si_title()}</h2>
				<p class="mt-0.5 text-xs font-medium text-ink-soft">{m.si_description()}</p>
			</div>
		</div>

		<form method="POST" action="?/invite" use:inviteEnhance class="space-y-4">
			<Errors allErrors={$inviteAllErrors} />

			<div class="grid gap-4 sm:grid-cols-[2fr_1fr_auto] sm:items-end">
				<InputComp
					form={inviteForm}
					errors={inviteErrors}
					name="email"
					type="email"
					label={m.si_email_label()}
					placeholder={m.si_email_placeholder()}
					autocomplete="off"
					required
				/>

				<InputComp
					form={inviteForm}
					errors={inviteErrors}
					name="role"
					type="select"
					label={m.si_role_label()}
					items={STAFF_ROLE_ITEMS}
				/>

				<button
					type="submit"
					disabled={$inviteDelayed}
					class="h-10 rounded-2xl border-2 border-edge bg-brand px-5 text-xs font-black text-brand-ink shadow-[3px_3px_0px_0px_rgb(var(--bento-shadow))] transition-colors hover:bg-brand-strong disabled:opacity-60"
				>
					{#if $inviteDelayed}
						<LoadingBtn name={m.si_sending()} />
					{:else}
						{m.si_submit()}
					{/if}
				</button>
			</div>
		</form>

		{#if data.invites.length}
			<div class="space-y-2 border-t-2 border-edge pt-4">
				<p class="text-[11px] font-black tracking-wider text-ink-dim uppercase">
					{m.si_pending_heading({ count: data.invites.length })}
				</p>

				<ul class="space-y-2">
					{#each data.invites as invite (invite.id)}
						<li
							class="flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-edge bg-well px-4 py-2.5"
						>
							<div class="min-w-0">
								<p class="truncate text-xs font-black text-ink">{invite.email}</p>
								<p class="text-[11px] font-bold text-ink-dim">
									{m.si_expires({ date: formatDate(invite.expiresAt) })}
								</p>
							</div>

							<div class="flex items-center gap-2">
								<span
									class="inline-flex items-center gap-1 rounded-lg border-2 px-2 py-0.5 text-[10px] font-black tracking-wider uppercase {roleTone[
										invite.role
									]}"
								>
									{#if invite.role === 'admin'}
										<ShieldCheck class="h-3 w-3" />
									{:else}
										<Database class="h-3 w-3" />
									{/if}
									{invite.role === 'admin' ? m.au_role_operator() : m.au_role_encoder()}
								</span>

								<form method="POST" action="?/revokeInvite" use:enhance={revokeHandler}>
									<input type="hidden" name="inviteId" value={invite.id} />
									<button
										type="submit"
										title={m.si_revoke()}
										class="inline-flex items-center gap-1 rounded-lg border-2 border-edge bg-surface px-2.5 py-1 text-[11px] font-black text-ink-soft transition-colors hover:bg-danger-soft hover:text-danger-fg"
									>
										<X class="h-3 w-3" />
										{m.si_revoke()}
									</button>
								</form>
							</div>
						</li>
					{/each}
				</ul>
			</div>
		{/if}
	</div>

	<div class="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
		<div class="flex flex-wrap items-center gap-2">
			{#each tabs as tab (tab.key)}
				<a
					href={roleLink(tab.key)}
					data-sveltekit-noscroll
					class="cursor-pointer rounded-xl border-2 border-edge px-3 py-1.5 text-xs font-black shadow-[2px_2px_0px_0px_rgb(var(--bento-shadow))] transition-all {roleFilter ===
					tab.key
						? 'bg-inverse text-inverse-ink'
						: 'bg-surface text-ink hover:bg-well'}"
				>
					{m.bl_tab_count({ label: tab.label, count: countFor(tab.key) })}
				</a>
			{/each}

			<!-- Cuts across the role tabs rather than replacing them: an operator
			     looking for a banned brand keeps the brand tab open. -->
			<a
				href={bannedLink}
				data-sveltekit-noscroll
				class="inline-flex cursor-pointer items-center gap-1 rounded-xl border-2 border-edge px-3 py-1.5 text-xs font-black shadow-[2px_2px_0px_0px_rgb(var(--bento-shadow))] transition-all {bannedOnly
					? 'bg-danger-soft text-danger-fg'
					: 'bg-surface text-ink hover:bg-well'}"
			>
				<Ban class="h-3 w-3" />
				{m.au_tab_banned()}
			</a>
		</div>

		<SearchInput value={listState.search} placeholder={m.au_search_placeholder()} class="sm:w-64" />
	</div>

	<div class="bento-card bento-card-static overflow-x-auto p-0!">
		<table class="w-full min-w-[900px] text-sm">
			<thead>
				<tr class="border-b-2 border-edge bg-panel">
					<th
						class="px-4 py-3 text-left text-[11px] font-black tracking-wider text-ink-soft uppercase"
					>
						{m.au_col_user()}
					</th>
					<th
						class="px-4 py-3 text-left text-[11px] font-black tracking-wider text-ink-soft uppercase"
					>
						{m.au_col_linked()}
					</th>
					<th
						class="px-4 py-3 text-left text-[11px] font-black tracking-wider text-ink-soft uppercase"
					>
						{m.au_col_role()}
					</th>
					<th
						class="px-4 py-3 text-left text-[11px] font-black tracking-wider text-ink-soft uppercase"
					>
						{m.au_col_status()}
					</th>
					<th
						class="px-4 py-3 text-right text-[11px] font-black tracking-wider text-ink-soft uppercase"
					>
						{m.au_col_change()}
					</th>
				</tr>
			</thead>
			<tbody>
				{#each data.users.rows as user (user.id)}
					<tr class="border-b border-edge-soft last:border-0">
						<td class="px-4 py-3">
							<p class="text-xs font-black text-ink">{user.name}</p>
							<p class="text-[11px] font-bold text-ink-dim">{user.email}</p>
						</td>
						<td class="px-4 py-3 text-[11px] font-bold text-ink-soft">
							{#if user.creatorUsername}
								<a
									href={resolve(`/creators/${user.creatorUsername}`)}
									class="hover:text-brand-soft-fg hover:underline"
								>
									@{user.creatorUsername}
								</a>
							{:else if user.organizationName}
								{user.organizationName}
							{:else}
								<span class="text-ink-faint">—</span>
							{/if}
						</td>
						<td class="px-4 py-3">
							<span
								class="inline-flex items-center gap-1 rounded-lg border-2 px-2 py-0.5 text-[10px] font-black tracking-wider uppercase {roleTone[
									user.role ?? 'creator'
								]}"
							>
								{#if user.role === 'admin'}
									<ShieldCheck class="h-3 w-3" />
								{:else if user.role === 'business'}
									<Briefcase class="h-3 w-3" />
								{:else if user.role === 'encoder'}
									<Database class="h-3 w-3" />
								{:else}
									<UserCheck class="h-3 w-3" />
								{/if}
								{user.role === 'admin'
									? m.au_role_operator()
									: user.role === 'business'
										? m.au_role_brand()
										: user.role === 'encoder'
											? m.au_role_encoder()
											: m.au_role_creator()}
							</span>
						</td>
						<td class="px-4 py-3">
							{#if user.banned}
								<span
									class="inline-flex items-center gap-1 rounded-lg border-2 border-danger-edge bg-danger-soft px-2 py-0.5 text-[10px] font-black tracking-wider text-danger-fg uppercase"
								>
									<Ban class="h-3 w-3" />
									{m.au_status_banned()}
								</span>
								<!-- The reason is what makes a ban liftable six months later, so
								     it is shown rather than filed. -->
								{#if user.banReason}
									<p class="mt-1 max-w-[16rem] text-[11px] font-bold text-ink-dim">
										{user.banReason}
									</p>
								{/if}
								<p class="mt-0.5 text-[11px] font-bold text-ink-faint">
									{user.banExpires
										? m.au_ban_until({ date: formatDate(user.banExpires) })
										: m.au_ban_no_end()}
								</p>
							{:else}
								<span class="text-[11px] font-bold text-ink-soft">{m.au_status_active()}</span>
							{/if}
						</td>
						<td class="px-4 py-3">
							<div class="flex flex-col items-end gap-2">
								<form
									method="POST"
									action="?/setRole"
									use:enhance={handler}
									class="flex items-center gap-2"
								>
									<input type="hidden" name="userId" value={user.id} />
									<div class="w-40">
										<InputComp
											name="role"
											type="select"
											label={m.au_role_label()}
											labelHidden
											items={ROLE_ITEMS}
											value={user.role ?? 'creator'}
										/>
									</div>
									<button
										type="submit"
										class="rounded-lg border-2 border-edge bg-brand px-3 py-1 text-xs font-black text-brand-ink hover:bg-brand-strong"
									>
										{m.common_save()}
									</button>
								</form>

								<!-- Nothing to ban yourself with: the action refuses it, and so
								     does better-auth behind it. -->
								{#if user.id !== data.user?.id}
									{#if user.banned}
										<form method="POST" action="?/unban" use:enhance={unbanHandler}>
											<input type="hidden" name="userId" value={user.id} />
											<button
												type="submit"
												class="inline-flex items-center gap-1 rounded-lg border-2 border-edge bg-surface px-2.5 py-1 text-[11px] font-black text-ink-soft transition-colors hover:bg-well"
											>
												<ShieldOff class="h-3 w-3" />
												{m.au_ban_lift()}
											</button>
										</form>
									{:else}
										<UserBanDialog userId={user.id} name={user.name} />
									{/if}
								{/if}
							</div>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	<PaginationBar result={data.users} />
</div>
