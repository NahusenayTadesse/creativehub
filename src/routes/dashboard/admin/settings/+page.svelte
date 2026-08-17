<script lang="ts">
	import { superForm } from 'sveltekit-superforms';
	import { toast } from 'svelte-sonner';
	import PageHeader from '$lib/components/page-header.svelte';
	import InputComp from '$lib/formComponents/InputComp.svelte';
	import Errors from '$lib/formComponents/Errors.svelte';
	import LoadingBtn from '$lib/formComponents/LoadingBtn.svelte';
	import { CircleAlert } from '@lucide/svelte';

	let { data } = $props();

	const { form, errors, enhance, delayed, allErrors, message } = superForm(data.form);

	$effect(() => {
		if (!$message) return;
		if ($message.type === 'error') toast.error($message.text);
		else toast.success($message.text);
	});
</script>

<svelte:head><title>Site settings — Creator Network</title></svelte:head>

<div class="mx-auto max-w-2xl space-y-6">
	<PageHeader
		eyebrow="Platform operations"
		title="Site settings"
		description="Copy on the public homepage, and the marketplace fee applied when a new booking is created."
	/>

	<div class="bento-card-yellow flex items-start gap-2">
		<CircleAlert class="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
		<p class="text-[11px] font-medium text-amber-900">
			Changing the fee affects bookings created from now on. Bookings that already froze their terms
			keep the fee they were agreed at — that is the point of the snapshot.
		</p>
	</div>

	<div class="bento-card bento-card-static">
		<form method="POST" use:enhance enctype="multipart/form-data" class="space-y-2">
			<Errors allErrors={$allErrors} />
			{#if data.settings}
				<input type="hidden" name="id" value={data.settings.id} />
			{/if}

			<InputComp {form} {errors} label="Site name" name="siteName" type="text" required />
			<InputComp {form} {errors} label="Tagline" name="tagline" type="text" />
			<InputComp {form} {errors} label="Homepage headline" name="heroTitle" type="text" />
			<InputComp
				{form}
				{errors}
				label="Homepage subheading"
				name="heroSubtitle"
				type="textarea"
				rows={3}
			/>

			<InputComp
				{form}
				{errors}
				label="Marketplace fee (%)"
				name="platformFeePercent"
				type="number"
			/>

			<div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
				<InputComp {form} {errors} label="Support email" name="supportEmail" type="text" />
				<InputComp {form} {errors} label="Support phone" name="supportPhone" type="text" />
			</div>

			<button
				type="submit"
				disabled={$delayed}
				class="mt-4 w-full rounded-2xl border-2 border-slate-900 bg-emerald-600 py-3 text-xs font-black text-white shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] hover:bg-emerald-700 disabled:opacity-60"
			>
				{#if $delayed}
					<LoadingBtn name="Saving" />
				{:else}
					Save settings
				{/if}
			</button>
		</form>
	</div>
</div>
