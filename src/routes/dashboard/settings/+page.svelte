<script lang="ts">
	import { untrack } from 'svelte';
	import * as m from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';
	import { superForm } from 'sveltekit-superforms';
	import { enhance as plainEnhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { toast } from 'svelte-sonner';
	import PageHeader from '$lib/components/page-header.svelte';
	import ThemeChoice from '$lib/components/theme-choice.svelte';
	import InputComp from '$lib/formComponents/InputComp.svelte';
	import Errors from '$lib/formComponents/Errors.svelte';
	import LoadingBtn from '$lib/formComponents/LoadingBtn.svelte';
	import {
		BadgeCheck,
		Bell,
		KeyRound,
		Laptop,
		LogOut,
		Mail,
		Palette,
		TriangleAlert,
		UserRound
	} from '@lucide/svelte';

	let { data } = $props();

	const {
		form: detailsData,
		errors: detailsErrors,
		enhance: detailsEnhance,
		delayed: detailsDelayed,
		allErrors: detailsAllErrors,
		message: detailsMessage
	} = superForm(
		untrack(() => data.detailsForm),
		{ id: 'details' }
	);

	const {
		form: pwData,
		errors: pwErrors,
		enhance: pwEnhance,
		delayed: pwDelayed,
		allErrors: pwAllErrors,
		message: pwMessage
	} = superForm(
		untrack(() => data.passwordForm),
		{ id: 'password' }
	);

	const {
		form: notifyData,
		errors: notifyErrors,
		enhance: notifyEnhance
	} = superForm(
		untrack(() => data.notifyForm),
		{
			id: 'notify',
			onUpdated: ({ form }) => {
				if (form.valid) toast.success(m.set_saved());
			}
		}
	);

	const {
		form: closeData,
		errors: closeErrors,
		enhance: closeEnhance,
		delayed: closeDelayed,
		allErrors: closeAllErrors,
		message: closeMessage
	} = superForm(
		untrack(() => data.closureForm),
		{ id: 'closure' }
	);

	/* Every form on the page reports the same way. */
	const report = (msg: { type?: string; text?: string } | undefined) => {
		if (msg?.type === 'error') toast.error(msg.text ?? m.common_refused());
		else if (msg?.type === 'success') toast.success(msg.text ?? m.set_saved());
	};
	$effect(() => report($detailsMessage));
	$effect(() => report($pwMessage));
	$effect(() => report($closeMessage));

	const formatDate = (value: string | Date) =>
		new Date(value).toLocaleString(getLocale() === 'am' ? 'am-ET' : 'en-GB', {
			day: 'numeric',
			month: 'short',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});

	/**
	 * A user agent is not a device name, and pretending otherwise invents
	 * certainty. This picks out the two parts a person can actually recognise,
	 * and falls back to the raw string when it recognises neither.
	 */
	const describeAgent = (agent: string | null) => {
		if (!agent) return m.set_sessions_unknown();
		const browser = /Edg\//.test(agent)
			? 'Edge'
			: /OPR\//.test(agent)
				? 'Opera'
				: /Firefox\//.test(agent)
					? 'Firefox'
					: /Chrome\//.test(agent)
						? 'Chrome'
						: /Safari\//.test(agent)
							? 'Safari'
							: null;
		const os = /Android/.test(agent)
			? 'Android'
			: /iPhone|iPad|iOS/.test(agent)
				? 'iOS'
				: /Windows/.test(agent)
					? 'Windows'
					: /Mac OS X/.test(agent)
						? 'macOS'
						: /Linux/.test(agent)
							? 'Linux'
							: null;
		if (!browser && !os) return agent.slice(0, 60);
		return [browser, os].filter(Boolean).join(' \u00b7 ');
	};

	const revoked: SubmitFunction =
		() =>
		async ({ result, update }) => {
			if (result.type === 'failure') toast.error(result.data?.message ?? m.common_refused());
			else if (result.type === 'success') toast.success(m.set_sessions_revoked());
			await update();
		};

	const closureCancelled: SubmitFunction =
		() =>
		async ({ result, update }) => {
			if (result.type === 'success') toast.success(m.set_close_cancelled());
			await update();
		};

	/* Labels live here rather than in domain/notify.ts so the message calls stay
	   lazy — the locale is decided per request. */
	const notifyRows = $derived([
		{
			label: m.set_notify_deals(),
			help: m.set_notify_deals_help(),
			email: 'dealsEmail',
			app: 'dealsApp'
		},
		{
			label: m.set_notify_messages(),
			help: m.set_notify_messages_help(),
			email: 'messagesEmail',
			app: 'messagesApp'
		},
		{
			label: m.set_notify_account(),
			help: m.set_notify_account_help(),
			email: 'accountEmail',
			app: null
		},
		{
			label: m.set_notify_product(),
			help: m.set_notify_product_help(),
			email: 'productEmail',
			app: null
		}
	]);
</script>

<svelte:head><title>{m.set_meta_title()}</title></svelte:head>

<div class="mx-auto max-w-3xl space-y-6">
	<PageHeader eyebrow={m.set_eyebrow()} title={m.set_title()} description={m.set_description()} />

	<!-- ---------- account details ---------- -->
	<div class="bento-card bento-card-static space-y-4">
		<div class="flex items-center gap-2">
			<UserRound class="h-4 w-4 text-brand-fg" />
			<h2 class="text-sm font-black text-ink">{m.set_details_title()}</h2>
		</div>

		<div class="rounded-2xl border-2 border-edge-soft bg-panel p-3">
			<span class="block text-[9px] font-black tracking-wider text-ink-dim uppercase">
				{m.set_email_label()}
			</span>
			<div class="mt-1 flex flex-wrap items-center gap-2">
				<span class="text-sm font-black text-ink">{data.email}</span>
				{#if data.emailVerified}
					<span
						class="inline-flex items-center gap-1 rounded-md bg-brand-soft px-2 py-0.5 text-[10px] font-black text-brand-soft-fg"
					>
						<BadgeCheck class="h-3 w-3" />
						{m.set_email_verified()}
					</span>
				{:else}
					<span
						class="inline-flex items-center gap-1 rounded-md bg-warn-soft px-2 py-0.5 text-[10px] font-black text-warn-fg"
					>
						<Mail class="h-3 w-3" />
						{m.set_email_unverified()}
					</span>
				{/if}
			</div>
			<p class="mt-1 text-[11px] font-medium text-ink-dim">{m.set_email_change_note()}</p>
		</div>

		<form method="POST" action="?/details" use:detailsEnhance class="space-y-3">
			<Errors allErrors={$detailsAllErrors} />
			<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
				<InputComp
					form={detailsData}
					errors={detailsErrors}
					name="name"
					type="text"
					label={m.set_name_label()}
					required
				/>
				<InputComp
					form={detailsData}
					errors={detailsErrors}
					name="phone"
					type="text"
					label={m.set_phone_label()}
					placeholder="+251…"
				/>
			</div>
			<div class="flex justify-end">
				<button
					type="submit"
					disabled={$detailsDelayed}
					class="rounded-xl border-2 border-edge bg-brand px-4 py-2 text-xs font-black text-brand-ink shadow-[2px_2px_0px_0px_rgb(var(--bento-shadow))] hover:bg-brand-strong disabled:opacity-60"
				>
					{#if $detailsDelayed}
						<LoadingBtn name={m.set_save()} />
					{:else}
						{m.set_save()}
					{/if}
				</button>
			</div>
		</form>
	</div>

	<!-- ---------- password ---------- -->
	<div class="bento-card bento-card-static space-y-4">
		<div class="flex items-center gap-2">
			<KeyRound class="h-4 w-4 text-brand-fg" />
			<h2 class="text-sm font-black text-ink">{m.set_pw_title()}</h2>
		</div>

		{#if !data.hasPassword}
			<!-- Nothing to change: this account signs in through Google. -->
			<p
				class="rounded-xl border-2 border-edge-soft bg-panel p-3 text-xs font-medium text-ink-soft"
			>
				{m.set_pw_google_only()}
			</p>
		{:else}
			<form method="POST" action="?/password" use:pwEnhance class="space-y-3">
				<Errors allErrors={$pwAllErrors} />
				<InputComp
					form={pwData}
					errors={pwErrors}
					name="currentPassword"
					type="password"
					label={m.set_pw_current()}
					autocomplete="current-password"
					required
				/>
				<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
					<InputComp
						form={pwData}
						errors={pwErrors}
						name="newPassword"
						type="password"
						label={m.set_pw_new()}
						autocomplete="new-password"
						required
					/>
					<InputComp
						form={pwData}
						errors={pwErrors}
						name="confirm"
						type="password"
						label={m.set_pw_confirm()}
						autocomplete="new-password"
						required
					/>
				</div>
				<InputComp
					form={pwData}
					errors={pwErrors}
					name="signOutOthers"
					type="checkboxSingle"
					label={m.set_pw_signout_others()}
					placeholder={m.set_pw_signout_others()}
				/>
				<div class="flex justify-end">
					<button
						type="submit"
						disabled={$pwDelayed}
						class="rounded-xl border-2 border-edge bg-brand px-4 py-2 text-xs font-black text-brand-ink shadow-[2px_2px_0px_0px_rgb(var(--bento-shadow))] hover:bg-brand-strong disabled:opacity-60"
					>
						{#if $pwDelayed}
							<LoadingBtn name={m.set_pw_submit()} />
						{:else}
							{m.set_pw_submit()}
						{/if}
					</button>
				</div>
			</form>
		{/if}
	</div>

	<!-- ---------- appearance ---------- -->
	<div class="bento-card bento-card-static space-y-4">
		<div class="flex items-center gap-2">
			<Palette class="h-4 w-4 text-brand-fg" />
			<h2 class="text-sm font-black text-ink">{m.theme_appearance()}</h2>
		</div>
		<p class="text-[11px] font-medium text-ink-dim">{m.theme_appearance_note()}</p>

		<!--
			This one saves nothing to the server. The choice lives in the browser,
			which is what makes it apply before the first paint on the next visit —
			a round trip would mean a flash of the wrong theme on every page.
		-->
		<ThemeChoice />
	</div>

	<!-- ---------- notifications ---------- -->
	<div class="bento-card bento-card-static space-y-4">
		<div class="flex items-center gap-2">
			<Bell class="h-4 w-4 text-brand-fg" />
			<h2 class="text-sm font-black text-ink">{m.set_notify_title()}</h2>
		</div>
		<p class="text-[11px] font-medium text-ink-dim">{m.set_notify_mail_pending()}</p>

		<form method="POST" action="?/notifications" use:notifyEnhance class="space-y-3">
			<div class="grid grid-cols-[1fr_auto_auto] items-center gap-x-4 gap-y-3">
				<span></span>
				<span class="text-[9px] font-black tracking-wider text-ink-dim uppercase"
					>{m.set_notify_email()}</span
				>
				<span class="text-[9px] font-black tracking-wider text-ink-dim uppercase"
					>{m.set_notify_inapp()}</span
				>

				{#each notifyRows as row (row.email)}
					<div>
						<p class="text-xs font-black text-ink">{row.label}</p>
						<p class="text-[11px] font-medium text-ink-dim">{row.help}</p>
					</div>
					<!-- The grid header names the column; the checkbox itself still needs
					     an accessible name of its own, so it carries a hidden one. -->
					<InputComp
						form={notifyData}
						errors={notifyErrors}
						name={row.email}
						type="checkboxSingle"
						label={m.set_notify_aria({ what: row.label, channel: m.set_notify_email() })}
						labelHidden
					/>
					{#if row.app}
						<InputComp
							form={notifyData}
							errors={notifyErrors}
							name={row.app}
							type="checkboxSingle"
							label={m.set_notify_aria({ what: row.label, channel: m.set_notify_inapp() })}
							labelHidden
						/>
					{:else}
						<span class="text-center text-[11px] font-bold text-ink-faint">—</span>
					{/if}
				{/each}
			</div>

			<p class="rounded-xl bg-well p-2 text-[11px] font-medium text-ink-soft">
				{m.set_notify_security_note()}
			</p>

			<div class="flex justify-end">
				<button
					type="submit"
					class="rounded-xl border-2 border-edge bg-brand px-4 py-2 text-xs font-black text-brand-ink shadow-[2px_2px_0px_0px_rgb(var(--bento-shadow))] hover:bg-brand-strong"
				>
					{m.set_save()}
				</button>
			</div>
		</form>
	</div>

	<!-- ---------- sessions ---------- -->
	<div class="bento-card bento-card-static space-y-4">
		<div class="flex items-center gap-2">
			<Laptop class="h-4 w-4 text-brand-fg" />
			<h2 class="text-sm font-black text-ink">{m.set_sessions_title()}</h2>
		</div>
		<p class="text-[11px] font-medium text-ink-dim">{m.set_sessions_help()}</p>

		<ul class="space-y-2">
			{#each data.sessions as s (s.id)}
				<li
					class="flex flex-wrap items-center justify-between gap-2 rounded-2xl border-2 border-edge-soft bg-panel p-3"
				>
					<div>
						<p class="text-xs font-black text-ink">
							{describeAgent(s.userAgent)}
							{#if s.id === data.currentSessionId}
								<span
									class="ml-1 rounded-md bg-brand-soft px-2 py-0.5 text-[10px] font-black text-brand-soft-fg"
								>
									{m.set_sessions_this_one()}
								</span>
							{/if}
						</p>
						<p class="text-[11px] font-medium text-ink-dim">
							{s.ipAddress ?? m.set_sessions_unknown()} · {m.set_sessions_last_used({
								when: formatDate(s.updatedAt)
							})}
						</p>
					</div>
				</li>
			{/each}
		</ul>

		{#if data.sessions.length > 1}
			<form
				method="POST"
				action="?/revokeOthers"
				use:plainEnhance={revoked}
				class="flex justify-end"
			>
				<button
					type="submit"
					class="flex items-center gap-1.5 rounded-xl border-2 border-edge bg-surface px-3 py-1.5 text-xs font-black text-ink hover:bg-well"
				>
					<LogOut class="h-3.5 w-3.5" />
					{m.set_sessions_revoke_others()}
				</button>
			</form>
		{/if}
	</div>

	<!-- ---------- danger zone ---------- -->
	<div class="bento-card bento-card-static space-y-4 border-danger-edge!">
		<div class="flex items-center gap-2">
			<TriangleAlert class="h-4 w-4 text-danger" />
			<h2 class="text-sm font-black text-ink">{m.set_close_title()}</h2>
		</div>

		{#if data.closureRequestedAt}
			<p class="rounded-xl border-2 border-warn-edge bg-warn-soft p-3 text-xs font-medium text-ink">
				{m.set_close_pending({ when: formatDate(data.closureRequestedAt) })}
			</p>
			<form
				method="POST"
				action="?/cancelClosure"
				use:plainEnhance={closureCancelled}
				class="flex justify-end"
			>
				<button
					type="submit"
					class="rounded-xl border-2 border-edge bg-surface px-3 py-1.5 text-xs font-black text-ink hover:bg-well"
				>
					{m.set_close_cancel()}
				</button>
			</form>
		{:else}
			<p class="text-xs font-medium text-ink-soft">{m.set_close_body()}</p>
			<p class="rounded-xl bg-well p-2 text-[11px] font-medium text-ink-soft">
				{m.set_close_records_note()}
			</p>

			<form method="POST" action="?/requestClosure" use:closeEnhance class="space-y-3">
				<Errors allErrors={$closeAllErrors} />
				<InputComp
					form={closeData}
					errors={closeErrors}
					name="reason"
					type="textarea"
					rows={2}
					label={m.set_close_reason()}
					placeholder={m.set_close_reason_placeholder()}
				/>
				<InputComp
					form={closeData}
					errors={closeErrors}
					name="confirmEmail"
					type="text"
					label={m.set_close_confirm({ email: data.email })}
					required
				/>
				<div class="flex justify-end">
					<button
						type="submit"
						disabled={$closeDelayed}
						class="rounded-xl border-2 border-edge bg-danger px-4 py-2 text-xs font-black text-danger-ink shadow-[2px_2px_0px_0px_rgb(var(--bento-shadow))] hover:bg-danger disabled:opacity-60"
					>
						{#if $closeDelayed}
							<LoadingBtn name={m.set_close_submit()} />
						{:else}
							{m.set_close_submit()}
						{/if}
					</button>
				</div>
			</form>
		{/if}
	</div>
</div>
