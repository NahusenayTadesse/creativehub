<script>
	let { allErrors } = $props();
	import { CircleAlert } from '@lucide/svelte';
	import * as m from '$lib/paraglide/messages';
</script>

{#if allErrors.length}
	<div
		role="alert"
		aria-live="assertive"
		class="mb-4 rounded-md border border-danger-edge bg-danger-soft p-3 text-danger-fg"
	>
		<div class="flex items-center justify-between">
			<strong class="text-sm font-semibold">{m.form_fix_errors()}</strong>
		</div>

		<ul class="mt-2 ml-4 list-inside list-disc space-y-1 text-sm">
			{#each allErrors as error (error.path)}
				<li class="flex items-center gap-2"><CircleAlert /> {error.messages}</li>
			{/each}
		</ul>
	</div>
{/if}
