<script lang="ts">
	import { untrack } from 'svelte';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { resolve } from '$app/paths';
	import * as m from '$lib/paraglide/messages';
	import { superForm } from 'sveltekit-superforms';
	import { enhance } from '$app/forms';
	import { toast } from 'svelte-sonner';
	import PageHeader from '$lib/components/page-header.svelte';
	import InputComp from '$lib/formComponents/InputComp.svelte';
	import ChipSelect from '$lib/formComponents/ChipSelect.svelte';
	import Errors from '$lib/formComponents/Errors.svelte';
	import LoadingBtn from '$lib/formComponents/LoadingBtn.svelte';
	import VerificationBadge from '$lib/components/verification-badge.svelte';
	import { Eye, EyeOff, ExternalLink, Award, CircleCheckBig, CircleAlert } from '@lucide/svelte';
	import { formatReach } from '$lib/domain/money';

	let { data } = $props();

	const {
		form,
		errors,
		enhance: formEnhance,
		delayed,
		allErrors,
		message
	} = superForm(untrack(() => data.form));

	$effect(() => {
		if (!$message) return;
		if ($message.type === 'error') toast.error($message.text);
		else toast.success($message.text);
	});

	const creator = $derived(data.creator);

	const countryItems = $derived(
		data.reference.countries.map((c) => ({
			value: c.id,
			name: `${c.flag} ${c.name}`
		}))
	);
	const regionItems = $derived(
		data.reference.regions
			.filter((r) => !$form.countryId || r.countryId === $form.countryId)
			.map((r) => ({ value: r.id, name: r.name }))
	);
	const platformItems = $derived(
		data.reference.platforms.map((p) => ({ value: p.id, name: p.name }))
	);
	const categoryItems = $derived(
		data.reference.categories.map((c) => ({ value: c.id, name: c.name }))
	);
	const languageItems = $derived(
		data.reference.languages.map((l) => ({ value: l.id, name: l.name }))
	);
	const currencyItems = ['ETB', 'KES', 'NGN', 'ZAR', 'GHS', 'RWF', 'EGP', 'AED', 'GBP', 'USD'].map(
		(c) => ({ value: c, name: c })
	);
	const availabilityItems = $derived([
		{ value: 'available', name: m.pf_avail_available() },
		{ value: 'busy', name: m.pf_avail_busy() },
		{ value: 'away', name: m.pf_avail_away() }
	]);

	/* CheckboxComp works in strings; the schema coerces back to numbers. */

	const blockers = $derived.by(() => {
		const list: string[] = [];
		if (!creator.bio || creator.bio.length < 20) list.push(m.pf_blocker_bio());
		if (data.readiness.channels === 0) list.push(m.pf_blocker_channels());
		if (data.readiness.packages === 0) list.push(m.pf_blocker_packages());
		return list;
	});

	const publishHandler: SubmitFunction = () => {
		return async ({ result, update }) => {
			if (result.type === 'failure') toast.error(result.data?.message ?? m.pf_could_not_publish());
			else if (result.type === 'success') {
				toast.success(creator.isPublished ? m.pf_hidden_toast() : m.pf_live_toast());
			}
			await update();
		};
	};
</script>

<svelte:head><title>{m.pf_meta_title()}</title></svelte:head>

<div class="space-y-6">
	<PageHeader eyebrow={m.dashc_eyebrow()} title={m.pf_title()} description={m.pf_description()}>
		{#snippet actions()}
			{#if creator.isPublished}
				<a
					href={resolve(`/creators/${creator.username}`)}
					target="_blank"
					class="flex items-center gap-1.5 rounded-2xl border-2 border-slate-900 bg-white px-4 py-2.5 text-xs font-black text-slate-900 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] hover:bg-slate-50"
				>
					<ExternalLink class="h-4 w-4 text-emerald-600" />
					{m.pf_view_public()}
				</a>
			{/if}
			<form method="POST" action="?/togglePublish" use:enhance={publishHandler}>
				<button
					type="submit"
					class="flex items-center gap-1.5 rounded-2xl border-2 border-slate-900 px-4 py-2.5 text-xs font-black shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] {creator.isPublished
						? 'bg-white text-slate-900 hover:bg-slate-50'
						: 'bg-emerald-600 text-white hover:bg-emerald-700'}"
				>
					{#if creator.isPublished}
						<EyeOff class="h-4 w-4" />
						{m.pf_hide()}
					{:else}
						<Eye class="h-4 w-4" />
						{m.pf_publish()}
					{/if}
				</button>
			</form>
		{/snippet}
	</PageHeader>

	<!-- Status strip -->
	<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
		<div class="bento-card-mint">
			<span class="block text-[10px] font-black tracking-widest text-slate-600 uppercase">
				{m.pf_visibility()}
			</span>
			<span class="text-lg font-black text-slate-900">
				{creator.isPublished ? m.pf_live_in_discovery() : m.pf_not_published()}
			</span>
		</div>
		<div class="bento-card bento-card-static">
			<span class="block text-[10px] font-black tracking-widest text-slate-600 uppercase">
				{m.pf_creator_score()}
			</span>
			<span class="flex items-center gap-1.5 text-lg font-black text-slate-900">
				<Award class="h-4 w-4 text-emerald-600" />
				{creator.score}/100
			</span>
		</div>
		<div class="bento-card bento-card-static">
			<span class="block text-[10px] font-black tracking-widest text-slate-600 uppercase">
				{m.pf_total_reach()}
			</span>
			<span class="text-lg font-black text-slate-900">{formatReach(creator.totalReach)}</span>
		</div>
		<div class="bento-card bento-card-static">
			<span class="mb-1 block text-[10px] font-black tracking-widest text-slate-600 uppercase">
				{m.pf_verification()}
			</span>
			<VerificationBadge level={creator.verificationLevel} />
		</div>
	</div>

	<!-- Publish readiness -->
	{#if !creator.isPublished}
		<div class="bento-card-yellow space-y-2">
			<h3 class="flex items-center gap-1.5 text-sm font-black text-slate-900">
				{#if blockers.length}
					<CircleAlert class="h-4 w-4 text-amber-700" />
					{m.pf_before_publish()}
				{:else}
					<CircleCheckBig class="h-4 w-4 text-emerald-700" />
					{m.pf_ready()}
				{/if}
			</h3>
			{#if blockers.length}
				<ul class="space-y-1">
					{#each blockers as item (item)}
						<li class="text-xs font-medium text-amber-900">{m.pf_blocker_line({ item })}</li>
					{/each}
				</ul>
			{:else}
				<p class="text-xs font-medium text-amber-900">
					{m.pf_ready_body()}
				</p>
			{/if}
		</div>
	{/if}

	<!-- Edit form -->
	<div class="bento-card bento-card-static">
		<form
			method="POST"
			action="?/save"
			use:formEnhance
			enctype="multipart/form-data"
			class="space-y-2"
		>
			<Errors allErrors={$allErrors} />
			<input type="hidden" name="id" value={creator.id} />

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
					label={m.pf_availability()}
					name="availability"
					type="select"
					items={availabilityItems}
				/>
			</div>

			<InputComp {form} {errors} label={m.pf_bio()} name="bio" type="textarea" rows={4} />

			<div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
				<InputComp {form} {errors} label={m.pf_avatar_url()} name="avatar" type="text" />
				<InputComp {form} {errors} label={m.pf_cover_url()} name="cover" type="text" />
			</div>

			<div class="grid grid-cols-1 gap-2 sm:grid-cols-3">
				<InputComp
					{form}
					{errors}
					label={m.pf_country()}
					name="countryId"
					type="select"
					items={countryItems}
				/>
				<InputComp
					{form}
					{errors}
					label={m.pf_region()}
					name="regionId"
					type="select"
					items={regionItems}
				/>
				<InputComp {form} {errors} label={m.pf_city()} name="city" type="text" />
			</div>

			<div class="grid grid-cols-1 gap-2 sm:grid-cols-3">
				<InputComp
					{form}
					{errors}
					label={m.pf_primary_platform()}
					name="primaryPlatformId"
					type="select"
					items={platformItems}
				/>
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

			<ChipSelect
				{form}
				{errors}
				name="categoryIds"
				label={m.pf_categories()}
				hint={m.pf_categories_note()}
				items={categoryItems}
			/>

			<ChipSelect
				{form}
				{errors}
				name="languageIds"
				label={m.pf_working_languages()}
				items={languageItems}
				selectedClass="bg-[#e0e7ff]"
			/>

			<button
				type="submit"
				disabled={$delayed}
				class="mt-4 w-full rounded-2xl border-2 border-slate-900 bg-emerald-600 py-3 text-xs font-black text-white shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] hover:bg-emerald-700 disabled:opacity-60"
			>
				{#if $delayed}
					<LoadingBtn name={m.common_saving()} />
				{:else}
					{m.pf_save()}
				{/if}
			</button>
		</form>
	</div>
</div>
