<script lang="ts">
	import { Dialog as DialogPrimitive } from 'bits-ui';
	import XIcon from '@lucide/svelte/icons/x';
	import { Button } from '$lib/components/ui/button/index.js';
	import { cn, type WithoutChildrenOrChild } from '$lib/utils.js';
	import * as Dialog from './index.js';
	import DialogPortal from './dialog-portal.svelte';
	import type { Snippet } from 'svelte';
	import type { ComponentProps } from 'svelte';

	let {
		ref = $bindable(null),
		class: className,
		portalProps,
		children,
		showCloseButton = true,
		...restProps
	}: WithoutChildrenOrChild<DialogPrimitive.ContentProps> & {
		portalProps?: WithoutChildrenOrChild<ComponentProps<typeof DialogPortal>>;
		children: Snippet;
		showCloseButton?: boolean;
	} = $props();
</script>

<DialogPortal {...portalProps}>
	<Dialog.Overlay />
	<DialogPrimitive.Content
		bind:ref
		data-slot="dialog-content"
		class={cn(
			'fixed top-1/2 left-1/2 z-50 flex max-h-[90dvh] w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-none bg-popover p-6 text-sm text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 outline-none sm:max-w-md data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95',
			className
		)}
		{...restProps}
	>
		<!--
			The height cap belongs here rather than on each dialog.

			Centred at its natural height with no cap, a dialog taller than the
			viewport hangs off both ends — and being `fixed`, nothing can scroll to
			what is cut off. The booking form on a creator profile stood 1014px tall
			on an 844px phone, which put its submit button somewhere no finger could
			reach; two other dialogs were within about 40px of the same fate.

			The scroll goes on this inner wrapper, not on the content box, so the
			close button below stays pinned against a box that never moves. Scrolling
			the content box itself carries the button up and out of sight with it.
		-->
		<div class="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto overscroll-contain">
			{@render children?.()}
		</div>
		{#if showCloseButton}
			<DialogPrimitive.Close data-slot="dialog-close">
				{#snippet child({ props })}
					<Button
						variant="ghost"
						class="absolute top-5 right-5 bg-secondary"
						size="icon-sm"
						{...props}
					>
						<XIcon />
						<span class="sr-only">Close</span>
					</Button>
				{/snippet}
			</DialogPrimitive.Close>
		{/if}
	</DialogPrimitive.Content>
</DialogPortal>
