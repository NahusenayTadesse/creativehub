<script lang="ts">
	import { superForm } from 'sveltekit-superforms';
	import { toast } from 'svelte-sonner';
	import PageHeader from '$lib/components/page-header.svelte';
	import InputComp from '$lib/formComponents/InputComp.svelte';
	import Errors from '$lib/formComponents/Errors.svelte';
	import LoadingBtn from '$lib/formComponents/LoadingBtn.svelte';
	import { ArrowRight } from '@lucide/svelte';

	let { data } = $props();

	const { form, errors, enhance, delayed, allErrors, message } = superForm(data.form);

	$effect(() => {
		if ($message?.type === 'error') toast.error($message.text);
	});

	const countryItems = data.reference.countries.map((c) => ({
		value: c.id,
		name: `${c.flag} ${c.name}`
	}));
	const platformItems = data.reference.platforms.map((p) => ({ value: p.id, name: p.name }));
	const currencyItems = ['ETB', 'KES', 'NGN', 'ZAR', 'GHS', 'RWF', 'EGP', 'AED', 'GBP', 'USD'].map(
		(c) => ({ value: c, name: c })
	);
</script>

<svelte:head><title>Create your profile — Creator Network</title></svelte:head>

<div class="mx-auto max-w-2xl space-y-6">
	<PageHeader
		eyebrow="Step 1 of 3"
		title="Create your creator profile"
		description="The essentials brands search on. You will add channels and packages next — your profile goes live once you have both."
	/>

	<div class="bento-card bento-card-static">
		<form method="POST" use:enhance enctype="multipart/form-data" class="space-y-2">
			<Errors allErrors={$allErrors} />

			<div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
				<InputComp {form} {errors} label="Display name" name="fullName" type="text" required />
				<InputComp
					{form}
					{errors}
					label="Handle"
					name="username"
					type="text"
					required
					placeholder="joel_tech_ethiopia"
				/>
			</div>

			<InputComp
				{form}
				{errors}
				label="Bio"
				name="bio"
				type="textarea"
				rows={4}
				required
				placeholder="What you make, who watches it, and what a brand gets from working with you."
			/>

			<div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
				<InputComp
					{form}
					{errors}
					label="Country"
					name="countryId"
					type="select"
					items={countryItems}
					required
				/>
				<InputComp {form} {errors} label="City" name="city" type="text" required />
			</div>

			<InputComp
				{form}
				{errors}
				label="Primary platform"
				name="primaryPlatformId"
				type="select"
				items={platformItems}
				required
			/>

			<div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
				<InputComp {form} {errors} label="Starting price" name="startingPrice" type="number" />
				<InputComp
					{form}
					{errors}
					label="Currency"
					name="currencyCode"
					type="select"
					items={currencyItems}
				/>
			</div>

			<button
				type="submit"
				disabled={$delayed}
				class="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-slate-900 bg-emerald-600 py-3 text-xs font-black text-white shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] hover:bg-emerald-700 disabled:opacity-60"
			>
				{#if $delayed}
					<LoadingBtn name="Creating profile" />
				{:else}
					Continue to channels
					<ArrowRight class="h-4 w-4" />
				{/if}
			</button>
		</form>
	</div>
</div>
