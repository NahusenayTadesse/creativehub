<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { toast } from 'svelte-sonner';
	import { BadgeCheck, Check, Copy, KeyRound, Loader2, PencilLine } from '@lucide/svelte';
	import * as m from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';
	import { isOwnershipProved } from '$lib/domain/ownership';

	/**
	 * One channel's ownership proof, from "prove this is mine" to a badge.
	 *
	 * The creator is given a short code, pastes it into the bio of the profile
	 * they are claiming, and presses Verify; the server reads the profile and
	 * says whether the code is there. What makes this worth a component of its
	 * own is that it has to be equally good at failing: Instagram and TikTok
	 * refuse this server outright, so the path that ends in "type the number in
	 * yourself" is not an edge case, it is the common one, and it has to arrive
	 * as an offer rather than as an error.
	 *
	 * Nothing here can stop a creator finishing their profile.
	 */
	let {
		account
	}: {
		account: {
			id: number;
			platform: string;
			followers: number;
			ownershipStatus: string;
			ownershipCode: string | null;
			ownershipVerifiedAt: string | Date | null;
		};
	} = $props();

	/** Open once the creator asks for a code, and stays open while they go and paste it. */
	let open = $state(false);
	let code = $state<string | null>(null);
	let busy = $state(false);
	let copied = $state(false);

	/** The last verdict, as something to draw. Cleared when a new attempt starts. */
	let verdict = $state<{ tone: 'ok' | 'retry' | 'offer'; text: string } | null>(null);
	/** Shown when the platform would not answer — the way out, not a dead end. */
	let manual = $state(false);
	/* Seeded from the row once and then owned by the input. `untrack` because
	   this is a draft the creator edits, not a mirror of the row: re-seeding it
	   whenever the row reloads would overwrite what they were halfway through
	   typing. The same idiom the proof dialog on this page uses. */
	let manualCount = $state(untrack(() => account.followers) || 0);

	const proved = $derived(isOwnershipProved(account.ownershipStatus));

	/* The code lives on the row once issued, so a creator who pastes it, closes
	   the tab and comes back a day later is shown the same string. */
	const shown = $derived(code ?? account.ownershipCode);

	const formatDate = (value: string | Date | null) =>
		value
			? new Date(value).toLocaleDateString(getLocale() === 'am' ? 'am-ET' : 'en-GB', {
					day: 'numeric',
					month: 'short',
					year: 'numeric'
				})
			: '';

	async function copy() {
		if (!shown) return;
		try {
			await navigator.clipboard.writeText(shown);
			copied = true;
			toast.success(m.own_copied());
			setTimeout(() => (copied = false), 2000);
		} catch {
			/* Clipboard access can be refused outright; the code is on screen and
			   selectable either way, so this is a nicety failing, not the flow. */
			toast.error(m.own_copy_failed());
		}
	}

	/** Every action here shares the same shape: set busy, read one verdict, stop. */
	const run =
		(handle: (data: Record<string, unknown>) => void): SubmitFunction =>
		() => {
			busy = true;
			verdict = null;
			return async ({ result, update }) => {
				busy = false;
				if (result.type === 'failure') {
					toast.error(String(result.data?.message ?? m.common_refused()));
					return;
				}
				if (result.type === 'error') {
					toast.error(m.common_refused());
					return;
				}
				if (result.type === 'success') {
					handle((result.data?.ownership ?? {}) as Record<string, unknown>);
					/* Reloads the row so the badge and the figure beside it agree with
					   what just happened. `reset: false` keeps the other forms on this
					   page as the creator left them. */
					await update({ reset: false });
				}
			};
		};

	const onIssued = run((data) => {
		code = typeof data.code === 'string' ? data.code : null;
		open = true;
		if (data.fetchable === false) {
			manual = true;
			verdict = { tone: 'offer', text: m.own_not_fetchable({ platform: account.platform }) };
		}
	});

	const onVerified = run((data) => {
		switch (data.kind) {
			case 'verified':
				manual = false;
				toast.success(m.own_verified_toast({ platform: account.platform }));
				verdict = { tone: 'ok', text: m.own_remove_code() };
				/* The platform served the profile but hides the count — proved, and
				   still needing a number typed in. */
				if (data.followers === null) {
					manual = true;
					verdict = {
						tone: 'offer',
						text: m.own_followers_hidden({ platform: account.platform })
					};
				}
				break;
			case 'code_not_found':
				verdict = { tone: 'retry', text: m.own_code_not_found({ platform: account.platform }) };
				break;
			case 'taken':
				verdict = { tone: 'retry', text: m.own_taken({ platform: account.platform }) };
				break;
			case 'not_fetchable':
				manual = true;
				verdict = { tone: 'offer', text: m.own_not_fetchable({ platform: account.platform }) };
				break;
			default:
				manual = true;
				verdict = { tone: 'offer', text: m.own_unreachable({ platform: account.platform }) };
		}
	});

	const onManualSaved = run(() => {
		manual = false;
		toast.success(m.own_manual_saved());
	});

	const TONES = {
		ok: 'border-brand-soft bg-brand-soft text-brand-soft-fg',
		retry: 'border-warn-edge bg-warn-soft text-warn-fg',
		offer: 'border-edge-mid bg-well text-ink-soft'
	};
</script>

<div class="space-y-2 rounded-xl border-2 border-edge-soft bg-panel p-3">
	{#if proved}
		<p class="inline-flex items-center gap-1.5 text-[11px] font-black text-brand-soft-fg">
			<BadgeCheck class="h-3.5 w-3.5" />
			{m.own_proved_on({ date: formatDate(account.ownershipVerifiedAt) })}
		</p>
		{#if account.ownershipCode}
			<p class="text-[11px] font-medium text-ink-soft">{m.own_remove_code()}</p>
		{/if}
	{:else if !open && !account.ownershipCode}
		<p class="text-[11px] font-medium text-ink-soft">{m.own_hint()}</p>
		<form method="POST" action="?/ownershipCode" use:enhance={onIssued}>
			<input type="hidden" name="socialAccountId" value={account.id} />
			<button
				type="submit"
				disabled={busy}
				class="inline-flex items-center gap-1 rounded-lg border-2 border-edge bg-surface px-2.5 py-1 text-[11px] font-black text-ink hover:bg-well disabled:opacity-60"
			>
				{#if busy}
					<Loader2 class="h-3.5 w-3.5 animate-spin" />
				{:else}
					<KeyRound class="h-3.5 w-3.5" />
				{/if}
				{m.own_prove_button()}
			</button>
		</form>
	{:else}
		<p class="text-[11px] font-medium text-ink-soft">
			{m.own_step_paste({ platform: account.platform })}
		</p>

		<div class="flex items-center gap-2">
			<code
				class="flex-1 rounded-lg border-2 border-edge bg-surface px-2.5 py-1.5 text-center text-sm font-black tracking-[0.2em] text-ink select-all"
			>
				{shown}
			</code>
			<button
				type="button"
				onclick={copy}
				aria-label={m.own_copy()}
				class="inline-flex items-center gap-1 rounded-lg border-2 border-edge bg-surface px-2.5 py-1.5 text-[11px] font-black text-ink hover:bg-well"
			>
				{#if copied}
					<Check class="h-3.5 w-3.5" />
				{:else}
					<Copy class="h-3.5 w-3.5" />
				{/if}
				{copied ? m.own_copied_short() : m.own_copy()}
			</button>
		</div>

		<form method="POST" action="?/ownershipVerify" use:enhance={onVerified}>
			<input type="hidden" name="socialAccountId" value={account.id} />
			<button
				type="submit"
				disabled={busy}
				class="inline-flex items-center gap-1 rounded-lg border-2 border-edge bg-brand px-2.5 py-1 text-[11px] font-black text-brand-ink hover:bg-brand-strong disabled:opacity-60"
			>
				{#if busy}
					<Loader2 class="h-3.5 w-3.5 animate-spin" />
					{m.own_verifying()}
				{:else}
					<BadgeCheck class="h-3.5 w-3.5" />
					{m.own_verify()}
				{/if}
			</button>
		</form>
	{/if}

	{#if verdict}
		<p class="rounded-lg border p-2 text-[11px] font-bold {TONES[verdict.tone]}">{verdict.text}</p>
	{/if}

	{#if manual && !proved}
		<!--
			The way out when the platform will not talk to us. Deliberately offered
			rather than demanded: the number is stored as self-reported, which is
			weaker than every other source and says so on the creator's own profile.
		-->
		<form
			method="POST"
			action="?/ownershipManual"
			use:enhance={onManualSaved}
			class="flex items-end gap-2"
		>
			<input type="hidden" name="socialAccountId" value={account.id} />
			<label class="flex-1">
				<span class="block text-[9px] font-black tracking-wider text-ink-dim uppercase">
					{m.own_manual_label()}
				</span>
				<input
					type="number"
					name="followers"
					min="0"
					step="1"
					required
					bind:value={manualCount}
					class="w-full rounded-lg border-2 border-edge bg-surface px-2 py-1 text-xs font-bold text-ink"
				/>
			</label>
			<button
				type="submit"
				disabled={busy}
				class="inline-flex items-center gap-1 rounded-lg border-2 border-edge bg-surface px-2.5 py-1.5 text-[11px] font-black text-ink hover:bg-well disabled:opacity-60"
			>
				<PencilLine class="h-3.5 w-3.5" />
				{m.own_manual_save()}
			</button>
		</form>
	{/if}
</div>
