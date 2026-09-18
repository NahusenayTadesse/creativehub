<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { Bell, CheckCheck } from '@lucide/svelte';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import * as m from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';

	type Item = {
		id: number;
		title: string;
		body: string | null;
		link: string | null;
		readAt: Date | string | null;
		createdAt: Date | string;
	};

	/**
	 * The header's bell: how many notifications are waiting, and the latest few.
	 *
	 * The count comes with every dashboard page, and is asked for again every
	 * minute while the tab is visible — a deal answered while the reader sits on
	 * one page should not wait for them to click somewhere to show up. The list
	 * is not polled: it is what the page loaded, and opening the bell after new
	 * ones arrive offers "see all" rather than a list that shifts under the cursor.
	 */
	let { unread, items }: { unread: number; items: Item[] } = $props();

	const POLL_MS = 60_000;

	/* The polled count, when it is newer than the one the page loaded. */
	let polled = $state<number | null>(null);
	let open = $state(false);
	const count = $derived(polled ?? unread);

	/* A navigation brings a fresh count with the page; the polled one is stale. */
	$effect(() => {
		void unread;
		untrack(() => (polled = null));
	});

	$effect(() => {
		let stopped = false;
		const ask = async () => {
			if (document.visibilityState !== 'visible') return;
			try {
				const response = await fetch(resolve('/dashboard/notifications/unread'));
				if (!response.ok || stopped) return;
				const body: { unread: number } = await response.json();
				polled = body.unread;
			} catch {
				/* Offline for a moment: the next tick asks again. */
			}
		};
		const timer = setInterval(ask, POLL_MS);
		const onVisible = () => void ask();
		document.addEventListener('visibilitychange', onVisible);
		return () => {
			stopped = true;
			clearInterval(timer);
			document.removeEventListener('visibilitychange', onVisible);
		};
	});

	const relative = (value: Date | string) => {
		/* Never in the future: a browser clock a little behind the server's would
		   otherwise announce that something happened "in 2 minutes". */
		const seconds = Math.min(0, (new Date(value).getTime() - Date.now()) / 1000);
		const format = new Intl.RelativeTimeFormat(getLocale() === 'am' ? 'am' : 'en', {
			numeric: 'auto'
		});
		const steps: [Intl.RelativeTimeFormatUnit, number][] = [
			['year', 31_536_000],
			['month', 2_592_000],
			['day', 86_400],
			['hour', 3_600],
			['minute', 60]
		];
		for (const [unit, size] of steps) {
			if (Math.abs(seconds) >= size) return format.format(Math.round(seconds / size), unit);
		}
		return format.format(0, 'minute');
	};

	const badge = $derived(count > 99 ? '99+' : String(count));
</script>

<Popover.Root bind:open>
	<Popover.Trigger
		class="relative rounded-lg p-2 text-ink-dim transition-colors hover:bg-well hover:text-ink"
		aria-label={count ? m.nb_label_unread({ count }) : m.nb_label()}
	>
		<Bell class="h-4 w-4" />
		{#if count}
			<span
				class="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full border-2 border-surface bg-danger px-1 text-[9px] leading-none font-black text-white"
				aria-hidden="true"
			>
				{badge}
			</span>
		{/if}
	</Popover.Trigger>

	<Popover.Content align="end" class="w-[min(22rem,calc(100vw-2rem))] p-0">
		<div class="flex items-center justify-between gap-2 border-b-2 border-edge px-3 py-2">
			<span class="text-xs font-black text-ink">{m.nb_title()}</span>
			{#if count}
				<form
					method="POST"
					action="{resolve('/dashboard/notifications')}?/readAll"
					use:enhance={() =>
						async ({ update }) => {
							polled = 0;
							await update();
						}}
				>
					<button
						type="submit"
						class="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[10px] font-black text-brand-soft-fg hover:bg-brand-soft"
					>
						<CheckCheck class="h-3 w-3" />
						{m.nb_mark_all_read()}
					</button>
				</form>
			{/if}
		</div>

		{#if items.length}
			<ul class="thin-scroll max-h-96 overflow-y-auto">
				{#each items as item (item.id)}
					<li class="border-b border-edge-soft last:border-b-0">
						<form
							method="POST"
							action="{resolve('/dashboard/notifications')}?/open"
							use:enhance={() => {
								open = false;
							}}
						>
							<input type="hidden" name="id" value={item.id} />
							<button
								type="submit"
								class="flex w-full items-start gap-2 px-3 py-2.5 text-left hover:bg-well {item.readAt
									? ''
									: 'bg-brand-soft/40'}"
							>
								<span
									class="mt-1.5 h-2 w-2 shrink-0 rounded-full {item.readAt
										? 'bg-transparent'
										: 'bg-brand'}"
									aria-hidden="true"
								></span>
								<span class="min-w-0 flex-1">
									<span class="block text-xs text-ink {item.readAt ? 'font-bold' : 'font-black'}">
										{item.title}
									</span>
									{#if item.body}
										<span class="line-clamp-2 block text-[11px] font-medium text-ink-soft">
											{item.body}
										</span>
									{/if}
									<span class="mt-0.5 block text-[10px] font-bold text-ink-faint">
										{relative(item.createdAt)}
										{#if !item.readAt}<span class="sr-only">· {m.nb_unread()}</span>{/if}
									</span>
								</span>
							</button>
						</form>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="px-3 py-8 text-center text-xs font-medium text-ink-dim">{m.nb_empty()}</p>
		{/if}

		<a
			href={resolve('/dashboard/notifications')}
			onclick={() => (open = false)}
			class="block border-t-2 border-edge px-3 py-2 text-center text-[11px] font-black text-brand-soft-fg hover:bg-well"
		>
			{m.nb_see_all()}
		</a>
	</Popover.Content>
</Popover.Root>
