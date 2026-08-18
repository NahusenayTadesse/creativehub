<script>
	import { Loader } from '@lucide/svelte';
	let { name } = $props();
</script>

<div class="align-self-center flex flex-row items-center gap-2 justify-self-center-safe">
	<Loader class="h-6 w-6 animate-spin" />

	<span class="animate-pulse">{name}...</span>
</div>
