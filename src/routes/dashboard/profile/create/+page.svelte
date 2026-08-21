<script lang="ts">
	import { untrack } from 'svelte';
	import * as m from '$lib/paraglide/messages';
	import { superForm } from 'sveltekit-superforms';
	import { toast } from 'svelte-sonner';
	import PageHeader from '$lib/components/page-header.svelte';
	import InputComp from '$lib/formComponents/InputComp.svelte';
	import Errors from '$lib/formComponents/Errors.svelte';
	import LoadingBtn from '$lib/formComponents/LoadingBtn.svelte';
	import { ArrowRight } from '@lucide/svelte';

	let { data } = $props();

	const { form, errors, enhance, delayed, allErrors, message } = superForm(
		untrack(() => data.form)
	);

	$effect(() => {
		if ($message?.type === 'error') toast.error($message.text);
	});

	const countryItems = $derived(
		data.reference.countries.map((c) => ({
			value: c.id,
			name: `${c.flag} ${c.name}`
		}))
	);
	const platformItems = $derived(
		data.reference.platforms.map((p) => ({ value: p.id, name: p.name }))
	);
	const currencyItems = ['ETB', 'KES', 'NGN', 'ZAR', 'GHS', 'RWF', 'EGP', 'AED', 'GBP', 'USD'].map(
		(c) => ({ value: c, name: c })
	);
</script>

<svelte:head><title>{m.pc_meta_title()}</title></svelte:head>

<div class="mx-auto max-w-2xl space-y-6">
	<PageHeader eyebrow={m.pc_eyebrow()} title={m.pc_title()} description={m.pc_description()} />

	<div class="bento-card bento-card-static">
		<form method="POST" use:enhance enctype="multipart/form-data" class="space-y-2">
			<Errors allErrors={$allErrors} />

			<div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
				<InputComp
					{form}
					{errors}
					label={m.pf_display_name()}
					name="fullName"
					type="text"
					required
				/>
				<InputComp
					{form}
					{errors}
					label={m.pc_handle()}
					name="username"
					type="text"
					required
					placeholder={m.pc_handle_placeholder()}
				/>
			</div>

			<InputComp
				{form}
				{errors}
				label={m.pf_bio()}
				name="bio"
				type="textarea"
				rows={4}
				required
				placeholder={m.pc_bio_placeholder()}
			/>

			<div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
				<InputComp
					{form}
					{errors}
					label={m.pf_country()}
					name="countryId"
					type="select"
					items={countryItems}
					required
				/>
				<InputComp {form} {errors} label={m.pf_city()} name="city" type="text" required />
			</div>

			<InputComp
				{form}
				{errors}
				label={m.pf_primary_platform()}
				name="primaryPlatformId"
				type="select"
				items={platformItems}
				required
			/>

			<div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
				<InputComp
					{form}
					{errors}
					label={m.pf_starting_price()}
					name="startingPrice"
					type="number"
				/>
				<InputComp
					{form}
					{errors}
					label={m.campaign_currency()}
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
					<LoadingBtn name={m.pc_creating()} />
				{:else}
					{m.pc_submit()}
					<ArrowRight class="h-4 w-4" />
				{/if}
			</button>
		</form>
	</div>
</div>
