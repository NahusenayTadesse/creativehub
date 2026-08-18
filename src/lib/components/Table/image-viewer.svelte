<script lang="ts">
	import { Dialog, DialogContent, DialogTrigger } from '$lib/components/ui/dialog';
	import { ImageIcon } from '@lucide/svelte';
	import { assetUrl } from '$lib/assets';
	import * as m from '$lib/paraglide/messages';

	interface Props {
		src: string;
		alt?: string;
	}

	const { src, alt = undefined }: Props = $props();

	const label = $derived(alt ?? m.img_default_alt());

	let isOpen = $state(false);
	let hasError = $state(false);

	const handleError = () => {
		hasError = true;
	};
</script>

<Dialog bind:open={isOpen}>
	<DialogTrigger>
		{#snippet child({ props })}
			<button
				{...props}
				class="group relative size-12 overflow-hidden rounded-md border border-border bg-muted transition-all hover:ring-2 hover:ring-ring hover:ring-offset-2 hover:ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-hidden"
			>
				{#if hasError}
					<div class="flex size-full items-center justify-center">
						<ImageIcon class="size-5 text-muted-foreground" />
					</div>
				{:else}
					<img
						src={assetUrl(src)}
						alt={label}
						class="size-full object-cover transition-transform group-hover:scale-110"
						onerror={handleError}
					/>
				{/if}
			</button>
		{/snippet}
	</DialogTrigger>
	<DialogContent class="max-w-2xl p-2">
		<div class="relative aspect-video w-full overflow-hidden rounded-md bg-muted">
			{#if hasError}
				<div class="flex size-full items-center justify-center">
					<div class="flex flex-col items-center gap-2 text-muted-foreground">
						<ImageIcon class="size-12" />
						<span class="text-sm">{m.img_load_failed()}</span>
					</div>
				</div>
			{:else}
				<img
					src={assetUrl(src)}
					alt={label}
					class="size-full object-contain"
					onerror={handleError}
				/>
			{/if}
		</div>
		{#if alt}
			<p class="mt-2 text-center text-sm text-muted-foreground">{alt}</p>
		{/if}
	</DialogContent>
</Dialog>
