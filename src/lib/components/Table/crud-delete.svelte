<script lang="ts">
	import { untrack } from 'svelte';
	import type { SuperValidated } from 'sveltekit-superforms';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { ScrollArea } from '$lib/components/ui/scroll-area/index.js';
	import { Button, buttonVariants } from '$lib/components/ui/button/index.js';
	import LoadingBtn from '$lib/formComponents/LoadingBtn.svelte';
	import Errors from '$lib/formComponents/Errors.svelte';
	import { Trash } from '@lucide/svelte';
	import { superForm } from 'sveltekit-superforms';
	import { toast } from 'svelte-sonner';
	import * as m from '$lib/paraglide/messages';

	let {
		data,
		action = '?/delete',
		id,
		/** Shown in the confirmation so an admin can see what they are removing. */
		name = ''
	}: {
		data: SuperValidated<Record<string, unknown>>;
		action?: string;
		id: number;
		name?: string;
	} = $props();

	/*
	 * All three reads happen once, and correctly so: `crud-section` renders these
	 * inside `{#each rows as record (record.id)}`, so a given instance is bound
	 * to one row for its whole life. `untrack` says that out loud rather than
	 * leaving the compiler to warn about it.
	 */
	const formId = untrack(() => `del-${id}`);

	const { form, enhance, delayed, message, allErrors } = superForm(
		untrack(() => data),
		{ resetForm: false, id: formId }
	);

	$form.id = untrack(() => id);

	let open = $state(false);

	$effect(() => {
		if (!$message) return;
		if ($message.type === 'error') {
			toast.error($message.text);
		} else {
			toast.success($message.text);
			open = false;
		}
	});
</script>

<Dialog.Root bind:open>
	<Dialog.Trigger class={buttonVariants({ variant: 'destructive', size: 'sm' })}>
		<Trash class="size-4" />
	</Dialog.Trigger>
	<Dialog.Content class="w-full">
		<Dialog.Header>
			<Dialog.Title>{m.common_delete()}</Dialog.Title>
		</Dialog.Header>
		<ScrollArea class="h-auto rounded-md border p-2">
			<h5 class="text-center">
				{name ? m.del_confirm_named({ name }) : m.del_confirm_generic()}
			</h5>
			<div class="flex flex-row items-end justify-center gap-4 pt-4">
				<form method="post" id={formId} {action} use:enhance>
					<Errors allErrors={$allErrors} />
					<input type="hidden" name="id" value={$form.id} />
					<Button type="submit" variant="destructive" form={formId} class="mt-4">
						{#if $delayed}
							<LoadingBtn name={m.common_deleting()} />
						{:else}
							<Trash class="size-4" />
							{m.common_delete()}
						{/if}
					</Button>
				</form>
				<Button variant="outline" onclick={() => (open = false)} class="mt-4"
					>{m.common_cancel()}</Button
				>
			</div>
		</ScrollArea>
	</Dialog.Content>
</Dialog.Root>
