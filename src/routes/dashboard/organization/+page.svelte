<script lang="ts">
	import { superForm } from 'sveltekit-superforms';
	import { toast } from 'svelte-sonner';
	import PageHeader from '$lib/components/page-header.svelte';
	import InputComp from '$lib/formComponents/InputComp.svelte';
	import Errors from '$lib/formComponents/Errors.svelte';
	import LoadingBtn from '$lib/formComponents/LoadingBtn.svelte';
	import VerificationBadge from '$lib/components/verification-badge.svelte';
	import { Users } from '@lucide/svelte';

	let { data } = $props();

	const { form, errors, enhance, delayed, allErrors, message } = superForm(data.form);

	$effect(() => {
		if (!$message) return;
		if ($message.type === 'error') toast.error($message.text);
		else toast.success($message.text);
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

<svelte:head><title>Organisation — Creator Network</title></svelte:head>

<div class="mx-auto max-w-3xl space-y-6">
	<PageHeader
		eyebrow="Brand operations"
		title="Organisation settings"
		description="Campaigns, bookings and shortlists all belong to this organisation rather than to any one person."
	/>

	<div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
		<div class="bento-card bento-card-static">
			<span class="mb-1 block text-[10px] font-black tracking-widest text-slate-600 uppercase">
				Verification
			</span>
			<VerificationBadge level={data.organization.verificationLevel} />
		</div>
		<div class="bento-card-mint">
			<span class="block text-[10px] font-black tracking-widest text-slate-600 uppercase">
				Team members
			</span>
			<span class="text-lg font-black text-slate-900">{data.members.length}</span>
		</div>
		<div class="bento-card-yellow">
			<span class="block text-[10px] font-black tracking-widest text-slate-600 uppercase">
				Monthly cap
			</span>
			<span class="text-lg font-black text-slate-900">
				{data.organization.monthlyBudgetCap
					? data.organization.monthlyBudgetCap.toLocaleString()
					: 'None set'}
			</span>
		</div>
	</div>

	<div class="bento-card bento-card-static">
		<form method="POST" use:enhance enctype="multipart/form-data" class="space-y-2">
			<Errors allErrors={$allErrors} />
			<input type="hidden" name="id" value={data.organization.id} />

			<InputComp {form} {errors} label="Organisation name" name="name" type="text" required />
			<InputComp {form} {errors} label="Type" name="orgType" type="select" items={orgTypes} />

			<div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
				<InputComp
					{form}
					{errors}
					label="Country"
					name="countryId"
					type="select"
					items={countryItems}
				/>
				<InputComp {form} {errors} label="City" name="city" type="text" />
			</div>

			<div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
				<InputComp {form} {errors} label="Website" name="website" type="text" />
				<InputComp {form} {errors} label="Logo URL" name="logo" type="text" />
			</div>

			<InputComp {form} {errors} label="About" name="bio" type="textarea" rows={4} />

			<InputComp
				{form}
				{errors}
				label="Monthly budget cap (optional)"
				name="monthlyBudgetCap"
				type="number"
				placeholder="A guardrail your team can see when opening bookings"
			/>

			<button
				type="submit"
				disabled={$delayed}
				class="mt-4 w-full rounded-2xl border-2 border-slate-900 bg-emerald-600 py-3 text-xs font-black text-white shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] hover:bg-emerald-700 disabled:opacity-60"
			>
				{#if $delayed}
					<LoadingBtn name="Saving" />
				{:else}
					Save organisation
				{/if}
			</button>
		</form>
	</div>

	<div class="bento-card bento-card-static space-y-3">
		<h2 class="flex items-center gap-1.5 border-b-2 border-slate-900 pb-3 text-sm font-black text-slate-900">
			<Users class="h-4 w-4 text-emerald-600" />
			Team
		</h2>
		{#each data.members as member (member.id)}
			<div class="flex items-center justify-between rounded-xl border-2 border-slate-200 bg-slate-50 p-3">
				<div>
					<p class="text-xs font-black text-slate-900">{member.name}</p>
					<p class="text-[11px] font-bold text-slate-500">{member.email}</p>
				</div>
				<span
					class="rounded-md border border-slate-900 bg-white px-2 py-0.5 text-[10px] font-black tracking-wider text-slate-800 uppercase"
				>
					{member.role}
				</span>
			</div>
		{/each}
	</div>
</div>
