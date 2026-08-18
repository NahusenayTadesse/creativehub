<script>
	import { enhance } from '$app/forms';
	import { Button, buttonVariants } from '$lib/components/ui/button/index.js';
	import { Trash } from '@lucide/svelte';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { ScrollArea } from '$lib/components/ui/scroll-area/index.js';
	import LoadingBtn from '$lib/formComponents/LoadingBtn.svelte';
	import { goto } from '$app/navigation';
	let isOpen = $state(false);

	let { redirect = '/dashboard' } = $props();

	let deleting = $state(false);
	import { updateFlash } from 'sveltekit-flash-message';
	import { page } from '$app/state';
	import * as m from '$lib/paraglide/messages';
</script>

<Dialog.Root bind:open={isOpen}>
	<Dialog.Trigger class={buttonVariants({ variant: 'destructive' })}>
		<Trash />
		{m.common_delete()}
	</Dialog.Trigger>
	<Dialog.Content class="w-full">
		<Dialog.Header>
			<Dialog.Title>{m.common_delete()}</Dialog.Title>
		</Dialog.Header>
		<ScrollArea class="h-auto rounded-md border p-2">
			<h5 class="text-center">{m.del_confirm_irreversible()}</h5>
			<div class="flex flex-row items-center justify-center gap-4 pt-4">
				<form
					method="post"
					action="?/delete"
					use:enhance={() => {
						deleting = true; // 1. start spinner

						return async ({ result, update }) => {
							await update(); // 2. apply action result to page
							deleting = false; // 3. stop spinner
							updateFlash(page);
							if (result.type === 'success') {
								await goto(redirect);

								// 4. navigate on success
							}
						};
					}}
				>
					<Button type="submit" disabled={deleting} variant="destructive" size="lg">
						{#if deleting}
							<LoadingBtn name={m.common_deleting()} />
						{:else}
							<Trash />
							{m.common_delete()}
						{/if}
					</Button>
				</form>

				<Button onclick={() => (isOpen = false)} size="lg">{m.common_cancel()}</Button>
			</div>
		</ScrollArea>
	</Dialog.Content>
</Dialog.Root>
