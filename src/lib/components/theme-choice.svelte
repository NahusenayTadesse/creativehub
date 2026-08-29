<script lang="ts">
	import { onMount } from 'svelte';
	import { resetMode, setMode, userPrefersMode } from 'mode-watcher';
	import { Monitor, Sun, Moon } from '@lucide/svelte';
	import * as m from '$lib/paraglide/messages';

	/**
	 * Which of the three someone has chosen lives in their browser's storage, so
	 * the server cannot know it. Marking one active during SSR would show the
	 * wrong one to everybody who has chosen, so nothing is marked until the
	 * component has hydrated — a moment later, and correct rather than confident.
	 */
	let hydrated = $state(false);
	onMount(() => {
		hydrated = true;
	});

	const chosen = $derived(hydrated ? (userPrefersMode.current ?? 'system') : null);

	const options = [
		{ id: 'system', icon: Monitor, label: () => m.theme_system(), apply: () => resetMode() },
		{ id: 'light', icon: Sun, label: () => m.theme_light(), apply: () => setMode('light') },
		{ id: 'dark', icon: Moon, label: () => m.theme_dark(), apply: () => setMode('dark') }
	];
</script>

<div role="radiogroup" aria-label={m.theme_appearance()} class="flex flex-wrap gap-2">
	{#each options as option (option.id)}
		{@const Icon = option.icon}
		<button
			type="button"
			role="radio"
			aria-checked={chosen === option.id}
			onclick={option.apply}
			class="bento-btn flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-black whitespace-nowrap {chosen ===
			option.id
				? 'bg-inverse text-inverse-ink'
				: 'bg-surface text-ink hover:bg-well'}"
		>
			<Icon class="h-3.5 w-3.5" />
			{option.label()}
		</button>
	{/each}
</div>
