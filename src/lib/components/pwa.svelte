<script lang="ts">
	import { onMount } from 'svelte';
	import { dev } from '$app/environment';
	import { toast } from 'svelte-sonner';
	import { Download, X } from '@lucide/svelte';
	import * as m from '$lib/paraglide/messages';

	/**
	 * Registers the service worker and handles the two moments it creates.
	 *
	 * Renders nothing until one of them happens, and nothing at all on the
	 * server. Mounted once, in the root layout.
	 *
	 * **A new version is waiting.** The worker deliberately does not take over
	 * mid-session — see the note in `src/service-worker.ts` — so somebody has to
	 * say when. That is a toast with a button rather than a silent reload: a
	 * reload nobody asked for loses whatever is half-typed in a form.
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
		 * Whether this page was already under a worker when it loaded, read once
		 * and before registering.
		 *
		 * This is what tells an update from a first install, and reading it later
		 * is a race that resolves the wrong way: the worker calls `clients.claim()`
		 * on activation, so on a first visit a controller appears while the
		 * `installed` handler is still queued, and the handler then sees one and
		 * announces a new version to somebody who has only just arrived. Measured
		 * on a cold profile — the toast fired on the very first page load.
		 */
		const wasControlled = Boolean(navigator.serviceWorker?.controller);

		/*
		 * Not registered in dev: the worker would serve the previous build's
		 * hashed assets to a page Vite has just rebuilt, which looks like a broken
		 * app and is really a stale cache.
		 */
		if (!dev && 'serviceWorker' in navigator) {
			navigator.serviceWorker.register('/service-worker.js', { type: 'module' }).then(
				(registration) => {
					const offerReload = (worker: ServiceWorker | null) => {
						if (!worker) return;
						worker.addEventListener('statechange', () => {
							/* `installed` on a page that was already controlled is an update;
							   a first install has nothing to replace and nothing to say. */
							if (worker.state !== 'installed' || !wasControlled) return;
							toast.info(m.pwa_update_title(), {
								duration: Infinity,
								action: {
									label: m.pwa_update_action(),
									onClick: () => {
										worker.postMessage('skip-waiting');
										location.reload();
									}
								}
							});
						});
					};

					if (registration.waiting && wasControlled) offerReload(registration.waiting);
					registration.addEventListener('updatefound', () => offerReload(registration.installing));
				},
				() => {
					/* An unsupported browser, or a refused registration. The site works. */
				}
			);
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
