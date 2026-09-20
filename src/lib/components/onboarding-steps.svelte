<script lang="ts">
	import { resolve } from '$app/paths';
	import * as m from '$lib/paraglide/messages';
	import { CircleCheckBig, ArrowRight } from '@lucide/svelte';

	/**
	 * Where a creator is in the three steps that end with a published page.
	 *
	 * `/dashboard/profile/create` announced "Step 1 of 3" and promised channels
	 * and packages next — and then said nothing again. The pages it sent them to
	 * carried no step, no count and no way on, so the thread the first screen
	 * started was dropped at the second, and the third step existed only in the
	 * sidebar.
	 *
	 * Drawn only while the profile is unpublished: once the page is live this is
	 * finished business, and `/dashboard/profile` is where visibility is
	 * discussed from then on.
	 */
	let { step }: { step: 2 | 3 } = $props();

	const labels = $derived([m.ob_step_profile(), m.ob_step_channels(), m.ob_step_packages()]);

	const next = $derived(
		step === 2
			? { href: resolve('/dashboard/packages'), label: m.ob_next_packages() }
			: { href: resolve('/dashboard/profile'), label: m.ob_next_publish() }
	);
</script>

<div class="bento-card-yellow flex flex-wrap items-center justify-between gap-3">
	<div class="min-w-0 space-y-1">
		<div class="flex flex-wrap items-center gap-x-2 gap-y-1">
			<span class="text-[10px] font-black tracking-widest text-ink-soft uppercase">
				{m.ob_steps_label({ step })}
			</span>
			{#each labels as label, index (label)}
				{@const done = index + 1 < step}
				<span
					class="flex items-center gap-1 text-xs {index + 1 === step
						? 'font-black text-ink'
						: 'font-bold text-ink-soft'}"
				>
					{#if done}
						<CircleCheckBig class="h-3.5 w-3.5 text-brand-fg" />
					{/if}
					{label}
					{#if index < labels.length - 1}
						<span class="text-ink-faint">·</span>
					{/if}
				</span>
			{/each}
		</div>
		<p class="text-xs font-medium text-warn-fg">{m.ob_steps_note()}</p>
	</div>

	<a
		href={next.href}
		class="flex shrink-0 items-center gap-1.5 rounded-xl border-2 border-edge bg-surface px-4 py-2 text-xs font-black text-ink shadow-[2px_2px_0px_0px_rgb(var(--bento-shadow))] hover:bg-panel"
	>
		{next.label}
		<ArrowRight class="h-3.5 w-3.5 text-brand-fg" />
	</a>
</div>
