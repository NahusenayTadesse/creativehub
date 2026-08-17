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

	const orgTypes = [
		{ value: 'company', name: 'Company' },
		{ value: 'startup', name: 'Startup' },
		{ value: 'agency', name: 'Agency' },
		{ value: 'ngo', name: 'NGO / non-profit' },
		{ value: 'government', name: 'Government / public sector' },
		{ value: 'event_organizer', name: 'Event organiser' }
	];
</script>

<svelte:head><title>Register your organisation — Creator Network</title></svelte:head>

<div class="mx-auto max-w-2xl space-y-6">
	<PageHeader
		eyebrow="Getting started"
		title="Register your organisation"
		description="Campaigns, bookings and shortlists all belong to an organisation rather than to you personally, so team members can be added later without moving anything."
	/>

	<div class="bento-card bento-card-static">
		<form method="POST" use:enhance enctype="multipart/form-data" class="space-y-2">
			<Errors allErrors={$allErrors} />

			<InputComp {form} {errors} label="Organisation name" name="name" type="text" required />

			<InputComp
				{form}
				{errors}
				label="Type"
				name="orgType"
				type="select"
				items={orgTypes}
				required
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
				<InputComp {form} {errors} label="City" name="city" type="text" />
			</div>

			<InputComp {form} {errors} label="Website" name="website" type="text" placeholder="https://…" />

			<InputComp
				{form}
				{errors}
				label="About the organisation"
				name="bio"
				type="textarea"
				rows={4}
				placeholder="What you do and what kind of creators you work with."
			/>

			<button
				type="submit"
				disabled={$delayed}
				class="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-slate-900 bg-emerald-600 py-3 text-xs font-black text-white shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] hover:bg-emerald-700 disabled:opacity-60"
			>
				{#if $delayed}
					<LoadingBtn name="Creating organisation" />
				{:else}
					Create and post a brief
					<ArrowRight class="h-4 w-4" />
				{/if}
			</button>
		</form>
	</div>
</div>
