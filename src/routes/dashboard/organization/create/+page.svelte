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

	const orgTypes = $derived([
		{ value: 'company', name: m.og_type_company() },
		{ value: 'startup', name: m.og_type_startup() },
		{ value: 'agency', name: m.og_type_agency() },
		{ value: 'ngo', name: m.og_type_ngo() },
		{ value: 'government', name: m.og_type_government() },
		{ value: 'event_organizer', name: m.og_type_event() }
	]);
</script>

<svelte:head><title>{m.ogc_meta_title()}</title></svelte:head>

<div class="mx-auto max-w-2xl space-y-6">
	<PageHeader eyebrow={m.ogc_eyebrow()} title={m.ogc_title()} description={m.ogc_description()} />

	<div class="bento-card bento-card-static">
		<form method="POST" use:enhance enctype="multipart/form-data" class="space-y-2">
			<Errors allErrors={$allErrors} />

			<InputComp {form} {errors} label={m.og_name()} name="name" type="text" required />

			<InputComp
				{form}
				{errors}
				label={m.og_type()}
				name="orgType"
				type="select"
				items={orgTypes}
				required
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
				<InputComp {form} {errors} label={m.pf_city()} name="city" type="text" />
			</div>

			<InputComp
				{form}
				{errors}
				label={m.og_website()}
				name="website"
				type="text"
				placeholder="https://…"
			/>

			<InputComp
				{form}
				{errors}
				label={m.ogc_about_label()}
				name="bio"
				type="textarea"
				rows={4}
				placeholder={m.ogc_about_placeholder()}
			/>

			<button
				type="submit"
				disabled={$delayed}
				class="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-edge bg-brand py-3 text-xs font-black text-brand-ink shadow-[3px_3px_0px_0px_rgb(var(--bento-shadow))] hover:bg-brand-strong disabled:opacity-60"
			>
				{#if $delayed}
					<LoadingBtn name={m.ogc_creating()} />
				{:else}
					{m.ogc_submit()}
					<ArrowRight class="h-4 w-4" />
				{/if}
			</button>
		</form>
	</div>
</div>
