<script lang="ts">
	import { untrack } from 'svelte';
	import * as m from '$lib/paraglide/messages';
	import { superForm } from 'sveltekit-superforms';
	import { toast } from 'svelte-sonner';
	import PageHeader from '$lib/components/page-header.svelte';
	import InputComp from '$lib/formComponents/InputComp.svelte';
	import Errors from '$lib/formComponents/Errors.svelte';
	import LoadingBtn from '$lib/formComponents/LoadingBtn.svelte';
	import { resolve } from '$app/paths';
	import { ArrowRight, Hand } from '@lucide/svelte';

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

	<!-- Offered before the form, not after it: a creator we imported who fills
	     this in ends up with a second, empty page and no way back to the one
	     that already carries their audience. -->
	{#if data.candidates.length}
		<div class="bento-card bento-card-static space-y-3 border-warn-edge!">
			<h2 class="text-sm font-black text-ink">{m.cl_suggestions_title()}</h2>
			<ul class="space-y-1">
				{#each data.candidates as candidate (candidate.id)}
					<li class="text-xs font-bold text-ink-soft">
						{candidate.fullName}
						<span class="font-medium text-ink-dim">@{candidate.username}</span>
					</li>
				{/each}
			</ul>
			<a
				href={resolve('/dashboard/profile/claim')}
				class="inline-flex items-center gap-1.5 rounded-xl border-2 border-edge bg-brand px-3 py-1.5 text-xs font-black text-brand-ink shadow-[2px_2px_0px_0px_rgb(var(--bento-shadow))] hover:bg-brand-strong"
			>
				<Hand class="h-3.5 w-3.5" />
				{m.cl_choose()}
			</a>
		</div>
	{/if}

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
				class="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-edge bg-brand py-3 text-xs font-black text-brand-ink shadow-[3px_3px_0px_0px_rgb(var(--bento-shadow))] hover:bg-brand-strong disabled:opacity-60"
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

	<!-- The way out of "that handle is taken": it is usually the creator's own
	     imported page holding it. -->
	<div class="flex justify-center">
		<a
			href={resolve('/dashboard/profile/claim')}
			class="text-xs font-bold text-ink-soft underline hover:text-brand-soft-fg"
		>
			{m.cl_title()}
		</a>
	</div>
</div>
