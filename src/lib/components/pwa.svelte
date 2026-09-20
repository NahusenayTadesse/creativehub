<script lang="ts">
	import { onMount } from 'svelte';
	import { dev } from '$app/environment';
	import { Download, X } from '@lucide/svelte';
	import * as m from '$lib/paraglide/messages';

	/**
	 * Registers the service worker, and offers to install the app.
	 *
	 * Renders nothing until the browser offers, and nothing at all on the
	 * server. Mounted once, in the root layout.
	 *
	 * **There is deliberately no "a new version is ready" prompt.** There was
	 * one, and it was wrong twice over. The worker now takes over the moment it
	 * installs — safe because it serves no versioned asset from cache, see
	 * `src/service-worker.ts` — so there is no waiting worker to announce. And
	 * the prompt it replaced announced the *same build* on every load, because a
	 * duplicate worker parked itself in `waiting` and its Reload button could
	 * never clear it: the button posted `skip-waiting` and reloaded in the same
	 * breath, so the page died before the worker could act on the message, and
	 * the next load found the same waiting worker and said the same thing again.
	 *
	 * **The browser is willing to install.** Chromium fires
	 * `beforeinstallprompt`, which can be held and fired later from a button of
	 * our own. iOS fires nothing and has no API — Safari's own Share → Add to
	 * Home Screen is the only route there — so this bar simply never appears on
	 * an iPhone rather than pretending to offer something it cannot.
	 */

	/** The part of `beforeinstallprompt` this uses. Not in lib.dom yet. */
	type InstallPrompt = Event & { prompt: () => Promise<void> };

	let installEvent = $state<InstallPrompt | null>(null);
	let dismissed = $state(true);

	/** Remembers a "not now" so the bar does not greet them on every page. */
	const DISMISS_KEY = 'pwa-install-dismissed';

	function dismiss() {
		dismissed = true;
		try {
			localStorage.setItem(DISMISS_KEY, String(Date.now()));
		} catch {
			/* Private mode, or storage refused. Dismissing for this page is enough. */
		}
	}

	async function install() {
		const event = installEvent;
		if (!event) return;
		/* Single-use: the browser will not let the same event prompt twice. */
		installEvent = null;
		try {
			await event.prompt();
		} catch {
			/* Dismissed, or already installed in another tab. */
		}
	}

	onMount(() => {
		try {
			dismissed = localStorage.getItem(DISMISS_KEY) !== null;
		} catch {
			dismissed = false;
		}

		const onPrompt = (event: Event) => {
			/* Held rather than let through, so the bar decides when to ask. */
			event.preventDefault();
			installEvent = event as InstallPrompt;
		};
		window.addEventListener('beforeinstallprompt', onPrompt);

		/*
		 * Not registered in dev: the worker would serve the previous build's
		 * hashed assets to a page Vite has just rebuilt, which looks like a broken
		 * app and is really a stale cache.
		 *
		 * Nothing is done with the registration. It installs, claims the page and
		 * replaces itself on the next deploy without anybody being told.
		 */
		if (!dev && 'serviceWorker' in navigator) {
			navigator.serviceWorker.register('/service-worker.js', { type: 'module' }).catch(() => {
				/* An unsupported browser, or a refused registration. The site works. */
			});
		}

		return () => window.removeEventListener('beforeinstallprompt', onPrompt);
	});
</script>

{#if installEvent && !dismissed}
	<!--
		Above the bottom bar on a phone, and out of the way of the toaster. Only
		ever drawn when the browser has actually offered, so it cannot become a
		bar that asks for something nothing will honour.
	-->
	<div
		class="fixed inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-50 flex items-center gap-3 rounded-2xl border-2 border-edge bg-surface p-3 shadow-[4px_4px_0px_0px_rgb(var(--bento-shadow))] md:inset-x-auto md:right-4 md:bottom-4 md:max-w-sm"
	>
		<img src="/icons/icon-192.png" alt="" width="40" height="40" class="h-10 w-10 shrink-0" />
		<div class="min-w-0 flex-1">
			<p class="text-xs font-black text-ink">{m.pwa_install_title()}</p>
			<p class="text-[11px] font-medium text-ink-soft">{m.pwa_install_body()}</p>
		</div>
		<button
			type="button"
			onclick={install}
			class="inline-flex shrink-0 items-center gap-1 rounded-lg border-2 border-edge bg-brand px-3 py-1.5 text-[11px] font-black text-brand-ink hover:bg-brand-strong"
		>
			<Download class="h-3.5 w-3.5" />
			{m.pwa_install_action()}
		</button>
		<button
			type="button"
			onclick={dismiss}
			aria-label={m.pwa_install_dismiss()}
			class="shrink-0 rounded-lg p-1 text-ink-dim hover:bg-well hover:text-ink"
		>
			<X class="h-4 w-4" />
		</button>
	</div>
{/if}
