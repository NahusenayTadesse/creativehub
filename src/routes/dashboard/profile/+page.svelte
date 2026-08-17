<script lang="ts">
	import { superForm } from 'sveltekit-superforms';
	import { enhance } from '$app/forms';
	import { toast } from 'svelte-sonner';
	import PageHeader from '$lib/components/page-header.svelte';
	import InputComp from '$lib/formComponents/InputComp.svelte';
	import Errors from '$lib/formComponents/Errors.svelte';
	import LoadingBtn from '$lib/formComponents/LoadingBtn.svelte';
	import VerificationBadge from '$lib/components/verification-badge.svelte';
	import { Eye, EyeOff, ExternalLink, Award, CircleCheckBig, CircleAlert } from '@lucide/svelte';
	import { formatReach } from '$lib/domain/money';

	let { data } = $props();

	const { form, errors, enhance: formEnhance, delayed, allErrors, message } = superForm(data.form);

	$effect(() => {
		if (!$message) return;
		if ($message.type === 'error') toast.error($message.text);
		else toast.success($message.text);
	});

	const creator = $derived(data.creator);

	const countryItems = data.reference.countries.map((c) => ({
		value: c.id,
		name: `${c.flag} ${c.name}`
	}));
	const regionItems = $derived(
		data.reference.regions
			.filter((r) => !$form.countryId || r.countryId === $form.countryId)
			.map((r) => ({ value: r.id, name: r.name }))
	);
	const platformItems = data.reference.platforms.map((p) => ({ value: p.id, name: p.name }));
	const categoryItems = data.reference.categories.map((c) => ({ value: c.id, name: c.name }));
	const languageItems = data.reference.languages.map((l) => ({ value: l.id, name: l.name }));
	const currencyItems = ['ETB', 'KES', 'NGN', 'ZAR', 'GHS', 'RWF', 'EGP', 'AED', 'GBP', 'USD'].map(
		(c) => ({ value: c, name: c })
	);
	const availabilityItems = [
		{ value: 'available', name: 'Available for work' },
		{ value: 'busy', name: 'Currently busy' },
		{ value: 'away', name: 'Away' }
	];

	/* CheckboxComp works in strings; the schema coerces back to numbers. */
	const categoryStrings = $derived(($form.categoryIds ?? []).map(String));
	const languageStrings = $derived(($form.languageIds ?? []).map(String));

	const blockers = $derived.by(() => {
		const list: string[] = [];
		if (!creator.bio || creator.bio.length < 20) list.push('a bio of at least a sentence or two');
		if (data.readiness.channels === 0) list.push('at least one linked channel');
		if (data.readiness.packages === 0) list.push('at least one package');
		return list;
	});

	const publishHandler = () => {
		return async ({ result, update }: any) => {
			if (result.type === 'failure') toast.error(result.data?.message ?? 'Could not publish.');
			else if (result.type === 'success') {
				toast.success(creator.isPublished ? 'Profile hidden' : 'Profile is now live');
			}
			await update();
		};
	};
</script>

<svelte:head><title>Profile — Creator Network</title></svelte:head>

<div class="space-y-6">
	<PageHeader
		eyebrow="Creator studio"
		title="Your profile"
		description="What a brand sees before deciding whether to book you."
	>
		{#snippet actions()}
			{#if creator.isPublished}
				<a
					href="/creators/{creator.username}"
					target="_blank"
					class="flex items-center gap-1.5 rounded-2xl border-2 border-slate-900 bg-white px-4 py-2.5 text-xs font-black text-slate-900 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] hover:bg-slate-50"
				>
					<ExternalLink class="h-4 w-4 text-emerald-600" />
					View public profile
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
						Hide from discovery
					{:else}
						<Eye class="h-4 w-4" />
						Publish profile
					{/if}
				</button>
			</form>
		{/snippet}
	</PageHeader>

	<!-- Status strip -->
	<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
		<div class="bento-card-mint">
			<span class="block text-[10px] font-black tracking-widest text-slate-600 uppercase">
				Visibility
			</span>
			<span class="text-lg font-black text-slate-900">
				{creator.isPublished ? 'Live in discovery' : 'Not published'}
			</span>
		</div>
		<div class="bento-card bento-card-static">
			<span class="block text-[10px] font-black tracking-widest text-slate-600 uppercase">
				Creator score
			</span>
			<span class="flex items-center gap-1.5 text-lg font-black text-slate-900">
				<Award class="h-4 w-4 text-emerald-600" />
				{creator.score}/100
			</span>
		</div>
		<div class="bento-card bento-card-static">
			<span class="block text-[10px] font-black tracking-widest text-slate-600 uppercase">
				Total reach
			</span>
			<span class="text-lg font-black text-slate-900">{formatReach(creator.totalReach)}</span>
		</div>
		<div class="bento-card bento-card-static">
			<span class="mb-1 block text-[10px] font-black tracking-widest text-slate-600 uppercase">
				Verification
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
					Before you can publish
				{:else}
					<CircleCheckBig class="h-4 w-4 text-emerald-700" />
					Ready to publish
				{/if}
			</h3>
			{#if blockers.length}
				<ul class="space-y-1">
					{#each blockers as item (item)}
						<li class="text-xs font-medium text-amber-900">· You still need {item}.</li>
					{/each}
				</ul>
			{:else}
				<p class="text-xs font-medium text-amber-900">
					Everything a brand needs is in place. Publish when you are ready to be found.
				</p>
			{/if}
		</div>
	{/if}

	<!-- Edit form -->
	<div class="bento-card bento-card-static">
		<form method="POST" action="?/save" use:formEnhance enctype="multipart/form-data" class="space-y-2">
			<Errors allErrors={$allErrors} />
			<input type="hidden" name="id" value={creator.id} />

			<div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
				<InputComp {form} {errors} label="Display name" name="fullName" type="text" required />
				<InputComp
					{form}
					{errors}
					label="Availability"
					name="availability"
					type="select"
					items={availabilityItems}
				/>
			</div>

			<InputComp {form} {errors} label="Bio" name="bio" type="textarea" rows={4} />

			<div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
				<InputComp {form} {errors} label="Avatar URL" name="avatar" type="text" />
				<InputComp {form} {errors} label="Cover image URL" name="cover" type="text" />
			</div>

			<div class="grid grid-cols-1 gap-2 sm:grid-cols-3">
				<InputComp
					{form}
					{errors}
					label="Country"
					name="countryId"
					type="select"
					items={countryItems}
				/>
				<InputComp {form} {errors} label="Region" name="regionId" type="select" items={regionItems} />
				<InputComp {form} {errors} label="City" name="city" type="text" />
			</div>

			<div class="grid grid-cols-1 gap-2 sm:grid-cols-3">
				<InputComp
					{form}
					{errors}
					label="Primary platform"
					name="primaryPlatformId"
					type="select"
					items={platformItems}
				/>
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

			<div class="space-y-1 pt-2">
				<span class="text-xs font-black text-slate-900">Categories</span>
				<p class="text-[11px] font-medium text-slate-500">
					Brands filter discovery by these, so pick the ones you genuinely make work in.
				</p>
				<div class="flex flex-wrap gap-2 pt-1">
					{#each categoryItems as item (item.value)}
						{@const selected = categoryStrings.includes(String(item.value))}
						<label
							class="cursor-pointer rounded-xl border-2 px-3 py-1.5 text-xs font-black transition-all {selected
								? 'border-slate-900 bg-[#dcfce7] text-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]'
								: 'border-slate-300 bg-white text-slate-600 hover:border-slate-900'}"
						>
							<input
								type="checkbox"
								name="categoryIds"
								value={item.value}
								checked={selected}
								onchange={(e) => {
									const id = Number(item.value);
									$form.categoryIds = e.currentTarget.checked
										? [...($form.categoryIds ?? []), id]
										: ($form.categoryIds ?? []).filter((v) => v !== id);
								}}
								class="sr-only"
							/>
							{item.name}
						</label>
					{/each}
				</div>
			</div>

			<div class="space-y-1 pt-2">
				<span class="text-xs font-black text-slate-900">Working languages</span>
				<div class="flex flex-wrap gap-2 pt-1">
					{#each languageItems as item (item.value)}
						{@const selected = languageStrings.includes(String(item.value))}
						<label
							class="cursor-pointer rounded-xl border-2 px-3 py-1.5 text-xs font-black transition-all {selected
								? 'border-slate-900 bg-[#e0e7ff] text-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]'
								: 'border-slate-300 bg-white text-slate-600 hover:border-slate-900'}"
						>
							<input
								type="checkbox"
								name="languageIds"
								value={item.value}
								checked={selected}
								onchange={(e) => {
									const id = Number(item.value);
									$form.languageIds = e.currentTarget.checked
										? [...($form.languageIds ?? []), id]
										: ($form.languageIds ?? []).filter((v) => v !== id);
								}}
								class="sr-only"
							/>
							{item.name}
						</label>
					{/each}
				</div>
			</div>

			<button
				type="submit"
				disabled={$delayed}
				class="mt-4 w-full rounded-2xl border-2 border-slate-900 bg-emerald-600 py-3 text-xs font-black text-white shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] hover:bg-emerald-700 disabled:opacity-60"
			>
				{#if $delayed}
					<LoadingBtn name="Saving" />
				{:else}
					Save profile
				{/if}
			</button>
		</form>
	</div>
</div>
