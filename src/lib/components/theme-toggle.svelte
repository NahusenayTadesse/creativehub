<script lang="ts">
	import { toggleMode } from 'mode-watcher';
	import { Sun, Moon } from '@lucide/svelte';
	import * as m from '$lib/paraglide/messages';

	let { class: className = '' }: { class?: string } = $props();
</script>

<!--
	Which icon shows is decided by CSS, not by state. mode-watcher stamps `.dark`
	on <html> from an inline script before first paint, so the right one is
	already correct in the server's HTML — no flash, and nothing to hydrate.
-->
<button
	type="button"
	onclick={toggleMode}
	title={m.theme_switch()}
	aria-label={m.theme_switch()}
	class="cursor-pointer rounded-lg p-2 text-ink-dim transition-colors hover:bg-well hover:text-ink {className}"
>
	<Sun class="h-4 w-4 dark:hidden" />
	<Moon class="hidden h-4 w-4 dark:block" />
</button>
