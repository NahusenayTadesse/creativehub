<script lang="ts">
	import { superForm } from 'sveltekit-superforms';
	import * as m from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';
	import { toast } from 'svelte-sonner';
	import {
		ArrowLeft,
		Calendar,
		Users,
		Send,
		CircleCheckBig,
		Target,
		Globe,
		Languages
	} from '@lucide/svelte';
	import CompensationBadge from '$lib/components/compensation-badge.svelte';
	import Errors from '$lib/formComponents/Errors.svelte';
	import LoadingBtn from '$lib/formComponents/LoadingBtn.svelte';

	let { data } = $props();

	const campaign = $derived(data.campaign);

	const { form, errors, enhance, delayed, allErrors, message } = superForm(data.form, {
		resetForm: false
	});

	let submitted = $state(Boolean(data.existingApplication));

	$effect(() => {
		if (!$message) return;
		if ($message.type === 'error') {
			toast.error($message.text);
		} else {
			toast.success($message.text);
			submitted = true;
		}
	});

	const formatDate = (value: string | Date | null) => {
		if (!value) return m.campaign_open();
		const date = typeof value === 'string' ? new Date(value) : value;
		return Number.isNaN(date.getTime())
			? String(value)
			: date.toLocaleDateString(getLocale() === 'am' ? 'am-ET' : 'en-GB', {
					day: 'numeric',
					month: 'long',
					year: 'numeric'
				});
	};

	const platformNames = $derived(
		(campaign.platformIds ?? [])
			.map((id: number) => data.reference.platforms.find((p) => p.id === id)?.name)
			.filter(Boolean)
	);
</script>

<svelte:head>
	<title>{m.campaign_meta_title({ title: campaign.title })}</title>
	<meta name="description" content={campaign.description ?? ''} />
</svelte:head>

<div class="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
	<a
		href="/campaigns"
		class="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 shadow-2xs hover:text-gray-900"
	>
		<ArrowLeft class="h-3.5 w-3.5" />
		{m.campaign_all_campaigns()}
	</a>

	<!-- Header -->
	<div class="bento-card bento-card-static space-y-4">
		<div class="flex flex-wrap items-start justify-between gap-4">
			<div class="flex items-center gap-3">
				<img
					src={campaign.organizationLogo ?? ''}
					alt={campaign.organizationName}
					class="h-14 w-14 rounded-2xl border-2 border-slate-900 object-cover shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]"
				/>
				<div>
					<div class="flex items-center gap-2">
						<h2 class="text-sm font-black text-slate-900">{campaign.organizationName}</h2>
						<span
							class="rounded-full border border-slate-900 bg-slate-100 px-2 py-0.5 text-[9px] font-black tracking-wider text-slate-800 uppercase"
						>
							{campaign.orgType?.replace('_', ' ')}
						</span>
					</div>
					<p class="text-xs font-bold text-slate-500">
						{campaign.categoryName} · {m.campaign_posted()}
						{formatDate(campaign.createdAt)}
					</p>
				</div>
			</div>
			<CompensationBadge type={campaign.compensationType} />
		</div>

		<h1 class="text-2xl font-black text-slate-900 sm:text-3xl">{campaign.title}</h1>

		<div class="flex flex-wrap items-center gap-2 text-xs">
			<span
				class="flex items-center gap-1 rounded-xl border-2 border-slate-900 bg-slate-50 px-3 py-1.5 font-bold"
			>
				<span class="text-sm">{campaign.countryFlag ?? '🌍'}</span>
				<span>{campaign.countryName ?? m.campaign_pan_african()}</span>
			</span>
			<span
				class="flex items-center gap-1 rounded-xl border-2 border-slate-900 bg-slate-50 px-3 py-1.5 font-bold"
			>
				<Users class="h-3.5 w-3.5 text-emerald-600" />
				<span>{m.campaign_creators_needed({ count: campaign.creatorsNeeded })}</span>
			</span>
			<span
				class="flex items-center gap-1 rounded-xl border-2 border-slate-900 bg-slate-50 px-3 py-1.5 font-bold"
			>
				<Calendar class="h-3.5 w-3.5 text-emerald-600" />
				<span>{m.campaign_closes({ date: formatDate(campaign.deadline) })}</span>
			</span>
			<span
				class="flex items-center gap-1 rounded-xl border-2 border-slate-900 bg-slate-50 px-3 py-1.5 font-bold"
			>
				<Languages class="h-3.5 w-3.5 text-emerald-600" />
				<span>{campaign.language}</span>
			</span>
			<span
				class="flex items-center gap-1 rounded-xl border-2 border-slate-900 bg-slate-50 px-3 py-1.5 font-bold"
			>
				<Send class="h-3.5 w-3.5 text-emerald-600" />
				<span>{m.campaign_applications_count({ count: campaign.applicationsCount })}</span>
			</span>
		</div>
	</div>

	<div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
		<!-- Brief -->
		<div class="space-y-6 lg:col-span-2">
			<div class="bento-card bento-card-static space-y-3">
				<h3 class="text-xs font-black tracking-widest text-slate-500 uppercase">
					{m.campaign_the_brief()}
				</h3>
				<p class="text-sm leading-relaxed whitespace-pre-line text-slate-700">
					{campaign.description}
				</p>

				{#if campaign.objective}
					<div class="rounded-2xl border-2 border-slate-900 bg-[#dcfce7] p-4">
						<div class="mb-1 flex items-center gap-1.5 text-xs font-black text-emerald-950">
							<Target class="h-4 w-4" />
							{m.campaign_objective()}
						</div>
						<p class="text-xs font-medium text-emerald-900">{campaign.objective}</p>
					</div>
				{/if}
			</div>

			{#if campaign.compensationType === 'barter' && campaign.barterDetails}
				<div class="bento-card-yellow space-y-2">
					<h3 class="text-xs font-black tracking-widest text-amber-950 uppercase">
						{m.campaign_barter_heading()}
					</h3>
					<p class="text-xs leading-relaxed font-medium text-amber-900">{campaign.barterDetails}</p>
				</div>
			{/if}

			{#if campaign.compensationType === 'event_pass' && campaign.eventName}
				<div class="bento-card-indigo space-y-2">
					<h3 class="text-xs font-black tracking-widest text-indigo-950 uppercase">
						{m.campaign_event_heading()}
					</h3>
					<div class="grid grid-cols-1 gap-2 text-xs font-medium text-indigo-900 sm:grid-cols-2">
						<div>
							<strong class="font-black">{m.campaign_event_label()}</strong>
							{campaign.eventName}
						</div>
						<div>
							<strong class="font-black">{m.campaign_date_label()}</strong>
							{formatDate(campaign.eventDate)}
						</div>
						<div>
							<strong class="font-black">{m.campaign_location_label()}</strong>
							{campaign.eventLocation}
						</div>
						<div>
							<strong class="font-black">{m.campaign_pass_label()}</strong>
							{campaign.passType}
						</div>
					</div>
				</div>
			{/if}

			{#if campaign.deliverables?.length}
				<div class="bento-card bento-card-static space-y-3">
					<h3 class="text-xs font-black tracking-widest text-slate-500 uppercase">
						{m.campaign_required_deliverables()}
					</h3>
					<ul class="space-y-2">
						{#each campaign.deliverables as item (item)}
							<li class="flex items-start gap-2 text-sm font-medium text-slate-700">
								<CircleCheckBig class="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
								<span>{item}</span>
							</li>
						{/each}
					</ul>
				</div>
			{/if}
		</div>

		<!-- Sidebar: terms + apply -->
		<div class="space-y-6">
			<div class="bento-card bento-card-static space-y-4">
				<div>
					<span class="block text-[10px] font-black tracking-wider text-slate-500 uppercase">
						{m.campaign_compensation()}
					</span>
					{#if campaign.compensationType === 'paid'}
						<span class="text-xl font-black text-slate-900">
							{campaign.budgetMin.toLocaleString()} – {campaign.budgetMax.toLocaleString()}
						</span>
						<span class="text-sm font-black text-emerald-600">{campaign.currencyCode}</span>
						<p class="mt-1 text-[11px] font-medium text-slate-500">
							{m.campaign_paid_note()}
						</p>
					{:else if campaign.compensationType === 'event_pass'}
						<span class="text-base font-black text-indigo-900">{m.campaign_event_access()}</span>
						<p class="mt-1 text-[11px] font-medium text-slate-500">
							{m.campaign_event_note()}
						</p>
					{:else}
						<span class="text-base font-black text-amber-900">{m.campaign_barter_access()}</span>
						<p class="mt-1 text-[11px] font-medium text-slate-500">
							{m.campaign_barter_note()}
						</p>
					{/if}
				</div>

				<div class="space-y-2 border-t-2 border-slate-900 pt-3 text-xs">
					<div class="flex justify-between">
						<span class="font-medium text-slate-500">{m.campaign_audience_size()}</span>
						<span class="font-black text-slate-900">
							{campaign.followerMin.toLocaleString()}{campaign.followerMax
								? ` – ${campaign.followerMax.toLocaleString()}`
								: '+'}
						</span>
					</div>
					{#if platformNames.length}
						<div class="flex justify-between gap-2">
							<span class="font-medium text-slate-500">{m.campaign_platforms()}</span>
							<span class="text-right font-black text-slate-900">{platformNames.join(', ')}</span>
						</div>
					{/if}
					{#if campaign.targetRegions?.length}
						<div class="flex justify-between gap-2">
							<span class="flex items-center gap-1 font-medium text-slate-500">
								<Globe class="h-3 w-3" />
								{m.campaign_markets()}
							</span>
							<span class="text-right font-black text-slate-900">
								{campaign.targetRegions.join(', ')}
							</span>
						</div>
					{/if}
				</div>
			</div>

			<!-- Apply -->
			<div class="bento-card bento-card-static space-y-4">
				{#if submitted || data.existingApplication}
					<div class="space-y-2 text-center">
						<CircleCheckBig class="mx-auto h-8 w-8 text-emerald-600" />
						<h3 class="text-sm font-black text-slate-900">{m.campaign_application_sent()}</h3>
						<p class="text-xs font-medium text-slate-600">
							{m.campaign_application_sent_body({ org: campaign.organizationName })}
						</p>
						<a
							href="/dashboard/applications"
							class="mt-2 inline-block rounded-xl border-2 border-slate-900 bg-white px-4 py-2 text-xs font-black text-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] hover:bg-slate-50"
						>
							{m.campaign_track_applications()}
						</a>
					</div>
				{:else if !data.user}
					<div class="space-y-2 text-center">
						<h3 class="text-sm font-black text-slate-900">{m.campaign_sign_in_to_pitch()}</h3>
						<p class="text-xs font-medium text-slate-600">
							{m.campaign_sign_in_body()}
						</p>
						<a
							href="/login?next=/campaigns/{campaign.slug}"
							class="mt-1 inline-block rounded-xl border-2 border-slate-900 bg-emerald-600 px-4 py-2 text-xs font-black text-white shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] hover:bg-emerald-700"
						>
							{m.nav_sign_in()}
						</a>
					</div>
				{:else if !data.creator}
					<div class="space-y-2 text-center">
						<h3 class="text-sm font-black text-slate-900">{m.campaign_creators_only()}</h3>
						<p class="text-xs font-medium text-slate-600">
							{m.campaign_creators_only_body()}
						</p>
					</div>
				{:else}
					<h3 class="text-sm font-black text-slate-900">{m.campaign_pitch_heading()}</h3>

					<form method="POST" action="?/apply" use:enhance class="space-y-3 text-xs">
						<Errors allErrors={$allErrors} />
						<input type="hidden" name="campaignId" value={campaign.id} />

						{#if campaign.compensationType === 'paid'}
							<div class="grid grid-cols-3 gap-2">
								<div class="col-span-2 space-y-1.5">
									<label for="proposedPrice" class="font-black text-slate-900"
										>{m.campaign_your_rate()}</label
									>
									<input
										id="proposedPrice"
										name="proposedPrice"
										type="number"
										min="0"
										bind:value={$form.proposedPrice}
										class="w-full rounded-xl border-2 border-slate-900 bg-white px-3 py-2 font-bold"
									/>
								</div>
								<div class="space-y-1.5">
									<label for="currencyCode" class="font-black text-slate-900"
										>{m.campaign_currency()}</label
									>
									<select
										id="currencyCode"
										name="currencyCode"
										bind:value={$form.currencyCode}
										class="w-full rounded-xl border-2 border-slate-900 bg-white px-2 py-2 font-bold"
									>
										{#each ['ETB', 'KES', 'NGN', 'ZAR', 'GHS', 'RWF', 'EGP', 'AED', 'GBP', 'USD'] as code (code)}
											<option value={code}>{code}</option>
										{/each}
									</select>
								</div>
							</div>
							{#if $errors.proposedPrice}
								<p class="font-bold text-red-600">{$errors.proposedPrice}</p>
							{/if}
						{:else}
							<input type="hidden" name="proposedPrice" value="0" />
							<input type="hidden" name="currencyCode" value={campaign.currencyCode} />
						{/if}

						<div class="space-y-1.5">
							<label for="pitch" class="font-black text-slate-900">{m.campaign_your_pitch()}</label>
							<textarea
								id="pitch"
								name="pitch"
								rows="6"
								bind:value={$form.pitch}
								required
								placeholder={m.campaign_pitch_placeholder()}
								class="w-full rounded-xl border-2 border-slate-900 bg-white px-3 py-2 font-medium"
							></textarea>
							{#if $errors.pitch}<p class="font-bold text-red-600">{$errors.pitch}</p>{/if}
						</div>

						<button
							type="submit"
							disabled={$delayed}
							class="flex w-full items-center justify-center gap-1.5 rounded-2xl border-2 border-slate-900 bg-emerald-600 py-3 font-black text-white shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] hover:bg-emerald-700 disabled:opacity-60"
						>
							{#if $delayed}
								<LoadingBtn name={m.campaign_sending()} />
							{:else}
								<Send class="h-3.5 w-3.5" />
								{m.campaign_submit_pitch()}
							{/if}
						</button>

						<p class="text-center text-[11px] font-medium text-slate-500">
							{m.campaign_pitch_disclaimer()}
						</p>
					</form>
				{/if}
			</div>
		</div>
	</div>
</div>
