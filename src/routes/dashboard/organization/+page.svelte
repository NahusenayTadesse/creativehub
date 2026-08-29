<script lang="ts">
	import { untrack } from 'svelte';
	import * as m from '$lib/paraglide/messages';
	import { superForm } from 'sveltekit-superforms';
	import { toast } from 'svelte-sonner';
	import PageHeader from '$lib/components/page-header.svelte';
	import InputComp from '$lib/formComponents/InputComp.svelte';
	import Errors from '$lib/formComponents/Errors.svelte';
	import LoadingBtn from '$lib/formComponents/LoadingBtn.svelte';
	import VerificationBadge from '$lib/components/verification-badge.svelte';
	import { Users } from '@lucide/svelte';

	let { data } = $props();

	const { form, errors, enhance, delayed, allErrors, message } = superForm(
		untrack(() => data.form)
	);

	$effect(() => {
		if (!$message) return;
		if ($message.type === 'error') toast.error($message.text);
		else toast.success($message.text);
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

<svelte:head><title>{m.og_meta_title()}</title></svelte:head>

<div class="mx-auto max-w-3xl space-y-6">
	<PageHeader eyebrow={m.dashb_eyebrow()} title={m.og_title()} description={m.og_description()} />

	<div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
		<div class="bento-card bento-card-static">
			<span class="mb-1 block text-[10px] font-black tracking-widest text-ink-soft uppercase">
				{m.pf_verification()}
			</span>
			<VerificationBadge level={data.organization.verificationLevel} />
		</div>
		<div class="bento-card-mint">
			<span class="block text-[10px] font-black tracking-widest text-ink-soft uppercase">
				{m.og_team_members()}
			</span>
			<span class="text-lg font-black text-ink">{data.members.length}</span>
		</div>
		<div class="bento-card-yellow">
			<span class="block text-[10px] font-black tracking-widest text-ink-soft uppercase">
				{m.og_monthly_cap()}
			</span>
			<span class="text-lg font-black text-ink">
				{data.organization.monthlyBudgetCap
					? data.organization.monthlyBudgetCap.toLocaleString()
					: m.og_none_set()}
			</span>
		</div>
	</div>

	<div class="bento-card bento-card-static">
		<form method="POST" use:enhance enctype="multipart/form-data" class="space-y-2">
			<Errors allErrors={$allErrors} />
			<input type="hidden" name="id" value={data.organization.id} />

			<InputComp {form} {errors} label={m.og_name()} name="name" type="text" required />
			<InputComp
				{form}
				{errors}
				label={m.og_type()}
				name="orgType"
				type="select"
				items={orgTypes}
			/>

			<div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
				<InputComp
					{form}
					{errors}
					label={m.pf_country()}
					name="countryId"
					type="select"
					items={countryItems}
				/>
				<InputComp {form} {errors} label={m.pf_city()} name="city" type="text" />
			</div>

			<div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
				<InputComp {form} {errors} label={m.og_website()} name="website" type="text" />
				<InputComp {form} {errors} label={m.og_logo_url()} name="logo" type="text" />
			</div>

			<InputComp {form} {errors} label={m.og_about()} name="bio" type="textarea" rows={4} />

			<InputComp
				{form}
				{errors}
				label={m.og_budget_cap()}
				name="monthlyBudgetCap"
				type="number"
				placeholder={m.og_budget_cap_placeholder()}
			/>

			<button
				type="submit"
				disabled={$delayed}
				class="mt-4 w-full rounded-2xl border-2 border-edge bg-brand py-3 text-xs font-black text-brand-ink shadow-[3px_3px_0px_0px_rgb(var(--bento-shadow))] hover:bg-brand-strong disabled:opacity-60"
			>
				{#if $delayed}
					<LoadingBtn name={m.common_saving()} />
				{:else}
					{m.og_save()}
				{/if}
			</button>
		</form>
	</div>

	<div class="bento-card bento-card-static space-y-3">
		<h2 class="flex items-center gap-1.5 border-b-2 border-edge pb-3 text-sm font-black text-ink">
			<Users class="h-4 w-4 text-brand-fg" />
			{m.og_team()}
		</h2>
		{#each data.members as member (member.id)}
			<div
				class="flex items-center justify-between rounded-xl border-2 border-edge-soft bg-panel p-3"
			>
				<div>
					<p class="text-xs font-black text-ink">{member.name}</p>
					<p class="text-[11px] font-bold text-ink-dim">{member.email}</p>
				</div>
				<span
					class="rounded-md border border-edge bg-surface px-2 py-0.5 text-[10px] font-black tracking-wider text-ink uppercase"
				>
					{member.role}
				</span>
			</div>
		{/each}
	</div>
</div>
