<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Button, buttonVariants } from '$lib/components/ui/button/index.js';
	import InputComp from '$lib/formComponents/InputComp.svelte';
	import LoadingBtn from '$lib/formComponents/LoadingBtn.svelte';
	import { Ban } from '@lucide/svelte';
	import { enhance } from '$app/forms';
	import { toast } from 'svelte-sonner';
	import type { SubmitFunction } from '@sveltejs/kit';
	import * as m from '$lib/paraglide/messages';
	import { BAN_DURATIONS, type BanDuration } from '$lib/bans';

	/**
	 * The "ban" half of the ban control on the users table — the half that needs
	 * to ask something. Lifting a ban asks nothing and is a plain button on the
	 * page; laying one down wants a reason and a length, and wants the operator
	 * to see whose account it is before they commit.
	 *
	 * The form posts to `?/ban` like any other, so it works with scripting off
	 * as far as the dialog allows, and the server is the thing that validates.
	 */
	let {
		userId,
		name
	}: {
		userId: string;
		/** Shown in the title, so an operator can see who this is about. */
		name: string;
	} = $props();

	let open = $state(false);
	let working = $state(false);

	/* Keyed by the same names the schema accepts, so a label and a value cannot
	   come apart — see BAN_DURATIONS in $lib/schemas. */
	const DURATION_LABELS: Record<BanDuration, () => string> = {
		permanent: m.au_ban_duration_permanent,
		'24h': m.au_ban_duration_24h,
		'7d': m.au_ban_duration_7d,
		'30d': m.au_ban_duration_30d
	};

	const durationItems = $derived(
		BAN_DURATIONS.map((value) => ({ value, name: DURATION_LABELS[value]() }))
	);

	const submit: SubmitFunction = () => {
		working = true;
		return async ({ result, update }) => {
			working = false;
			if (result.type === 'failure') {
				toast.error(result.data?.message ?? m.common_refused());
			} else if (result.type === 'success') {
				toast.success(m.au_banned_toast());
				open = false;
			}
			await update();
		};
	};
</script>

<Dialog.Root bind:open>
	<Dialog.Trigger class={buttonVariants({ variant: 'destructive', size: 'sm' })}>
		<Ban class="size-4" />
		{m.au_ban_action()}
	</Dialog.Trigger>

	<Dialog.Content class="w-full">
		<Dialog.Header>
			<Dialog.Title>{m.au_ban_title({ name })}</Dialog.Title>
			<Dialog.Description>{m.au_ban_description()}</Dialog.Description>
		</Dialog.Header>

		<form method="POST" action="?/ban" use:enhance={submit} class="space-y-4">
			<input type="hidden" name="userId" value={userId} />

			<InputComp
				name="reason"
				type="textarea"
				rows={3}
				label={m.au_ban_reason_label()}
				placeholder={m.au_ban_reason_placeholder()}
			/>

			<InputComp
				name="duration"
				type="select"
				label={m.au_ban_duration_label()}
				items={durationItems}
				value="permanent"
			/>

			<div class="flex items-center justify-end gap-3 pt-2">
				<Button variant="outline" type="button" onclick={() => (open = false)}>
					{m.common_cancel()}
				</Button>
				<Button type="submit" variant="destructive" disabled={working}>
					{#if working}
						<LoadingBtn name={m.au_ban_working()} />
					{:else}
						<Ban class="size-4" />
						{m.au_ban_confirm()}
					{/if}
				</Button>
			</div>
		</form>
	</Dialog.Content>
</Dialog.Root>
