
<script>

 import  { Loader } from "@lucide/svelte";
  let { name } = $props()
</script>
<div class="flex flex-row gap-2 align-self-center justify-self-center-safe items-center">
<Loader  class="animate-spin w-6 h-6" />

<span class="animate-pulse">{name}...</span>
</div>