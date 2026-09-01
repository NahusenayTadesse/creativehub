<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import AppImage from '$lib/components/app-image.svelte';
	import * as m from '$lib/paraglide/messages';
	import { ChevronLeft, ChevronRight } from '@lucide/svelte';

	/**
	 * The pictures that go with an article.
	 *
	 * A grid that opens one at a time, rather than a carousel: a gallery under a
	 * piece of writing is browsed deliberately, and a strip that advances on its
	 * own competes with the text above it for the reader's attention.
	 */
	type Image = {
		id: number;
		image: string;
		caption: string | null;
		alt: string | null;
	};

	let { images }: { images: Image[] } = $props();

	let open = $state(false);
	let index = $state(0);

	const current = $derived(images[index]);

	const show = (at: number) => {
		index = at;
		open = true;
	};

	/* Wraps at both ends, so the last picture's "next" is the first one — a
	   dead arrow in a four-image gallery reads as a broken button. */
	const step = (by: number) => {
		if (!images.length) return;
		index = (index + by + images.length) % images.length;
	};
</script>

<svelte:window
	onkeydown={(event) => {
		if (!open) return;
		if (event.key === 'ArrowRight') step(1);
		if (event.key === 'ArrowLeft') step(-1);
	}}
/>

{#if images.length}
	<section class="space-y-4" aria-label={m.bi_title()}>
		<h2 class="bento-eyebrow">{m.bi_title()}</h2>

		<div class="grid grid-cols-2 gap-4 sm:grid-cols-3">
			{#each images as image, at (image.id)}
				<figure class="space-y-2">
					<button
						type="button"
						onclick={() => show(at)}
						class="block w-full overflow-hidden rounded-2xl border-2 border-edge bg-well shadow-[3px_3px_0px_0px_rgb(var(--bento-shadow))] transition-all hover:shadow-[5px_5px_0px_0px_rgb(var(--bento-shadow))]"
						aria-label={image.alt || image.caption || m.bi_open_image({ index: at + 1 })}
					>
						<div class="aspect-[4/3] w-full">
							<AppImage
								src={image.image}
								alt={image.alt ?? image.caption ?? ''}
								kind="media"
								seed={String(image.id)}
								class="h-full w-full object-cover"
								loading="lazy"
								decoding="async"
							/>
						</div>
					</button>
					{#if image.caption}
						<figcaption class="text-[11px] font-bold text-ink-dim">{image.caption}</figcaption>
					{/if}
				</figure>
			{/each}
		</div>
	</section>

	<Dialog.Root bind:open>
		<Dialog.Content class="max-w-3xl">
			<Dialog.Header>
				<Dialog.Title class="text-sm font-black">
					{current?.caption || m.bi_open_image({ index: index + 1 })}
				</Dialog.Title>
			</Dialog.Header>

			<div class="relative">
				<div class="overflow-hidden rounded-2xl border-2 border-edge bg-well">
					<AppImage
						src={current?.image}
						alt={current?.alt ?? current?.caption ?? ''}
						kind="media"
						seed={String(current?.id ?? '')}
						class="max-h-[70vh] w-full object-contain"
						decoding="async"
					/>
				</div>

				{#if images.length > 1}
					<button
						type="button"
						onclick={() => step(-1)}
						aria-label={m.tbl_previous()}
						class="absolute inset-y-0 start-2 my-auto flex size-10 items-center justify-center rounded-xl border-2 border-edge bg-surface/90 text-ink shadow-[2px_2px_0px_0px_rgb(var(--bento-shadow))] backdrop-blur transition-colors hover:bg-surface"
					>
						<ChevronLeft class="h-5 w-5" />
					</button>
					<button
						type="button"
						onclick={() => step(1)}
						aria-label={m.tbl_next()}
						class="absolute inset-y-0 end-2 my-auto flex size-10 items-center justify-center rounded-xl border-2 border-edge bg-surface/90 text-ink shadow-[2px_2px_0px_0px_rgb(var(--bento-shadow))] backdrop-blur transition-colors hover:bg-surface"
					>
						<ChevronRight class="h-5 w-5" />
					</button>
				{/if}
			</div>

			{#if images.length > 1}
				<p class="text-center text-[11px] font-bold text-ink-dim">
					{m.bi_counter({ index: index + 1, total: images.length })}
				</p>
			{/if}
		</Dialog.Content>
	</Dialog.Root>
{/if}
