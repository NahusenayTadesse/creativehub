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
			'fixed z-50 flex max-h-[90dvh] flex-col bg-popover p-6 text-sm text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-200 outline-none',
			/*
			 * On a phone: a sheet along the bottom edge, rising into place.
			 *
			 * A centred box that fades in is a desktop idiom, and on a phone it is
			 * the clearest tell that a thing is a web page — every native sheet
			 * comes up from the bottom, against the thumb rather than under it.
			 *
			 * `max-w-full` rather than `max-w-none`: callers set an explicit width
			 * (`crud-dialog` asks for `w-lg!`, which is 32rem and important), and
			 * a max-width caps the used width whatever the width property says.
			 * Without it those dialogs run off the side of a 393px screen.
			 *
			 * The padding carries the home-indicator inset, since the sheet's own
			 * bottom edge is the bottom of the screen.
			 */
			'inset-x-0 bottom-0 w-full max-w-full rounded-t-3xl pb-[calc(1.5rem+env(safe-area-inset-bottom))]',
			'data-open:animate-in data-open:slide-in-from-bottom-16 data-closed:animate-out data-closed:slide-out-to-bottom-16',
			/* From `sm` up, exactly the centred dialog it has always been. */
			'sm:inset-x-auto sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:w-full sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-none sm:pb-6',
			'sm:data-open:fade-in-0 sm:data-open:slide-in-from-bottom-0 sm:data-open:zoom-in-95 sm:data-closed:fade-out-0 sm:data-closed:slide-out-to-bottom-0 sm:data-closed:zoom-out-95',
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
		<!-- The bar every sheet has along its top edge. Decoration, and the reason
		     a sheet reads as a sheet at a glance; gone from `sm` up. -->
		<div
			class="mx-auto mb-2 h-1 w-10 shrink-0 rounded-full bg-foreground/15 sm:hidden"
			aria-hidden="true"
		></div>

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
