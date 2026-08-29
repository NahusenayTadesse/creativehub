<script lang="ts">
	import AppImage from '$lib/components/app-image.svelte';
	import { untrack } from 'svelte';
	import { resolve } from '$app/paths';
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
	import InputComp from '$lib/formComponents/InputComp.svelte';
	import LoadingBtn from '$lib/formComponents/LoadingBtn.svelte';

	let { data } = $props();

	/** The currencies an application may be denominated in. */
	const CURRENCY_ITEMS = ['ETB', 'KES', 'NGN', 'ZAR', 'GHS', 'RWF', 'EGP', 'AED', 'GBP', 'USD'].map(
		(code) => ({ value: code, name: code })
	);

	const campaign = $derived(data.campaign);

	/*
	 * `untrack`, because a superform is seeded once and then owns its own state:
	 * re-reading `data.form` on every change would fight the store, and a fresh
	 * `SuperValidated` arriving mid-edit would discard a half-written pitch.
	 * Navigating to a different brief is handled explicitly below.
	 */
	const superform = superForm(
		untrack(() => data.form),
		{ resetForm: false }
	);
	const { form, errors, enhance, delayed, allErrors, message } = superform;

	let submitted = $state(untrack(() => Boolean(data.existingApplication)));

	/**
	 * A different brief starts over.
	 *
	 * This component is reused across `/campaigns/a` → `/campaigns/b`, so
	 * without this the second brief opens showing "already applied" from the
	 * first, over a pitch written for the first.
	 */
	let pitchedFor = $state(untrack(() => data.campaign.id));
	$effect(() => {
		if (campaign.id === pitchedFor) return;
		pitchedFor = campaign.id;
		submitted = Boolean(data.existingApplication);
		superform.reset({ data: data.form.data, newState: data.form.data });
	});

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
		href={resolve('/campaigns')}
		class="inline-flex items-center gap-1.5 rounded-lg border border-edge-soft bg-surface px-3 py-1.5 text-xs font-semibold text-ink-soft shadow-2xs hover:text-ink"
	>
		<ArrowLeft class="h-3.5 w-3.5" />
		{m.campaign_all_campaigns()}
	</a>

	<!-- Header -->
	<div class="bento-card bento-card-static space-y-4">
		<div class="flex flex-wrap items-start justify-between gap-4">
			<div class="flex items-center gap-3">
				<AppImage
					src={campaign.organizationLogo}
					alt={campaign.organizationName}
					kind="logo"
					seed={campaign.organizationName}
					class="h-14 w-14 rounded-2xl border-2 border-edge object-cover shadow-[2px_2px_0px_0px_rgb(var(--bento-shadow))]"
					loading="lazy"
					decoding="async"
					width="56"
					height="56"
				/>
				<div>
					<div class="flex items-center gap-2">
						<h2 class="text-sm font-black text-ink">{campaign.organizationName}</h2>
						<span
							class="rounded-full border border-edge bg-well px-2 py-0.5 text-[9px] font-black tracking-wider text-ink uppercase"
						>
							{campaign.orgType?.replace('_', ' ')}
						</span>
					</div>
					<p class="text-xs font-bold text-ink-dim">
						{campaign.categoryName} · {m.campaign_posted()}
						{formatDate(campaign.createdAt)}
					</p>
				</div>
			</div>
			<CompensationBadge type={campaign.compensationType} />
		</div>

		<h1 class="text-2xl font-black text-ink sm:text-3xl">{campaign.title}</h1>

		<div class="flex flex-wrap items-center gap-2 text-xs">
			<span
				class="flex items-center gap-1 rounded-xl border-2 border-edge bg-panel px-3 py-1.5 font-bold"
			>
				<span class="text-sm">{campaign.countryFlag ?? '🌍'}</span>
				<span>{campaign.countryName ?? m.campaign_pan_african()}</span>
			</span>
			<span
				class="flex items-center gap-1 rounded-xl border-2 border-edge bg-panel px-3 py-1.5 font-bold"
			>
				<Users class="h-3.5 w-3.5 text-brand-fg" />
				<span>{m.campaign_creators_needed({ count: campaign.creatorsNeeded })}</span>
			</span>
			<span
				class="flex items-center gap-1 rounded-xl border-2 border-edge bg-panel px-3 py-1.5 font-bold"
			>
				<Calendar class="h-3.5 w-3.5 text-brand-fg" />
				<span>{m.campaign_closes({ date: formatDate(campaign.deadline) })}</span>
			</span>
			<span
				class="flex items-center gap-1 rounded-xl border-2 border-edge bg-panel px-3 py-1.5 font-bold"
			>
				<Languages class="h-3.5 w-3.5 text-brand-fg" />
				<span>{campaign.language}</span>
			</span>
			<span
				class="flex items-center gap-1 rounded-xl border-2 border-edge bg-panel px-3 py-1.5 font-bold"
			>
				<Send class="h-3.5 w-3.5 text-brand-fg" />
				<span>{m.campaign_applications_count({ count: campaign.applicationsCount })}</span>
			</span>
		</div>
	</div>

	<div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
		<!-- Brief -->
		<div class="space-y-6 lg:col-span-2">
			<div class="bento-card bento-card-static space-y-3">
				<h3 class="text-xs font-black tracking-widest text-ink-dim uppercase">
					{m.campaign_the_brief()}
				</h3>
				<p class="text-sm leading-relaxed whitespace-pre-line text-ink-soft">
					{campaign.description}
				</p>

				{#if campaign.objective}
					<div class="rounded-2xl border-2 border-edge bg-tile-mint p-4">
						<div class="mb-1 flex items-center gap-1.5 text-xs font-black text-brand-soft-fg">
							<Target class="h-4 w-4" />
							{m.campaign_objective()}
						</div>
						<p class="text-xs font-medium text-brand-soft-fg">{campaign.objective}</p>
					</div>
				{/if}
			</div>

			{#if campaign.compensationType === 'barter' && campaign.barterDetails}
				<div class="bento-card-yellow space-y-2">
					<h3 class="text-xs font-black tracking-widest text-warn-fg uppercase">
						{m.campaign_barter_heading()}
					</h3>
					<p class="text-xs leading-relaxed font-medium text-warn-fg">{campaign.barterDetails}</p>
				</div>
			{/if}

			{#if campaign.compensationType === 'event_pass' && campaign.eventName}
				<div class="bento-card-indigo space-y-2">
					<h3 class="text-xs font-black tracking-widest text-info-fg uppercase">
						{m.campaign_event_heading()}
					</h3>
					<div class="grid grid-cols-1 gap-2 text-xs font-medium text-info-fg sm:grid-cols-2">
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
					<h3 class="text-xs font-black tracking-widest text-ink-dim uppercase">
						{m.campaign_required_deliverables()}
					</h3>
					<ul class="space-y-2">
						{#each campaign.deliverables as item (item)}
							<li class="flex items-start gap-2 text-sm font-medium text-ink-soft">
								<CircleCheckBig class="mt-0.5 h-4 w-4 shrink-0 text-brand-fg" />
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
					<span class="block text-[10px] font-black tracking-wider text-ink-dim uppercase">
						{m.campaign_compensation()}
					</span>
					{#if campaign.compensationType === 'paid'}
						<span class="text-xl font-black text-ink">
							{campaign.budgetMin.toLocaleString()} – {campaign.budgetMax.toLocaleString()}
						</span>
						<span class="text-sm font-black text-brand-fg">{campaign.currencyCode}</span>
						<p class="mt-1 text-[11px] font-medium text-ink-dim">
							{m.campaign_paid_note()}
						</p>
					{:else if campaign.compensationType === 'event_pass'}
						<span class="text-base font-black text-info-fg">{m.campaign_event_access()}</span>
						<p class="mt-1 text-[11px] font-medium text-ink-dim">
							{m.campaign_event_note()}
						</p>
					{:else}
						<span class="text-base font-black text-warn-fg">{m.campaign_barter_access()}</span>
						<p class="mt-1 text-[11px] font-medium text-ink-dim">
							{m.campaign_barter_note()}
						</p>
					{/if}
				</div>

				<div class="space-y-2 border-t-2 border-edge pt-3 text-xs">
					<div class="flex justify-between">
						<span class="font-medium text-ink-dim">{m.campaign_audience_size()}</span>
						<span class="font-black text-ink">
							{campaign.followerMin.toLocaleString()}{campaign.followerMax
								? ` – ${campaign.followerMax.toLocaleString()}`
								: '+'}
						</span>
					</div>
					{#if platformNames.length}
						<div class="flex justify-between gap-2">
							<span class="font-medium text-ink-dim">{m.campaign_platforms()}</span>
							<span class="text-right font-black text-ink">{platformNames.join(', ')}</span>
						</div>
					{/if}
					{#if campaign.targetRegions?.length}
						<div class="flex justify-between gap-2">
							<span class="flex items-center gap-1 font-medium text-ink-dim">
								<Globe class="h-3 w-3" />
								{m.campaign_markets()}
							</span>
							<span class="text-right font-black text-ink">
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
						<CircleCheckBig class="mx-auto h-8 w-8 text-brand-fg" />
						<h3 class="text-sm font-black text-ink">{m.campaign_application_sent()}</h3>
						<p class="text-xs font-medium text-ink-soft">
							{m.campaign_application_sent_body({ org: campaign.organizationName })}
						</p>
						<a
							href={resolve('/dashboard/applications')}
							class="mt-2 inline-block rounded-xl border-2 border-edge bg-surface px-4 py-2 text-xs font-black text-ink shadow-[2px_2px_0px_0px_rgb(var(--bento-shadow))] hover:bg-panel"
						>
							{m.campaign_track_applications()}
						</a>
					</div>
				{:else if !data.user}
					<div class="space-y-2 text-center">
						<h3 class="text-sm font-black text-ink">{m.campaign_sign_in_to_pitch()}</h3>
						<p class="text-xs font-medium text-ink-soft">
							{m.campaign_sign_in_body()}
						</p>
						<a
							href={resolve(`/login?next=/campaigns/${campaign.slug}`)}
							class="mt-1 inline-block rounded-xl border-2 border-edge bg-brand px-4 py-2 text-xs font-black text-brand-ink shadow-[2px_2px_0px_0px_rgb(var(--bento-shadow))] hover:bg-brand-strong"
						>
							{m.nav_sign_in()}
						</a>
					</div>
				{:else if !data.creator}
					<div class="space-y-2 text-center">
						<h3 class="text-sm font-black text-ink">{m.campaign_creators_only()}</h3>
						<p class="text-xs font-medium text-ink-soft">
							{m.campaign_creators_only_body()}
						</p>
					</div>
				{:else}
					<h3 class="text-sm font-black text-ink">{m.campaign_pitch_heading()}</h3>

					<form method="POST" action="?/apply" use:enhance class="space-y-3 text-xs">
						<Errors allErrors={$allErrors} />
						<input type="hidden" name="campaignId" value={campaign.id} />

						{#if campaign.compensationType === 'paid'}
							<div class="grid grid-cols-3 gap-2">
								<div class="col-span-2">
									<InputComp
										{form}
										{errors}
										name="proposedPrice"
										type="number"
										min="0"
										label={m.campaign_your_rate()}
									/>
								</div>
								<InputComp
									{form}
									{errors}
									name="currencyCode"
									type="select"
									label={m.campaign_currency()}
									items={CURRENCY_ITEMS}
								/>
							</div>
						{:else}
							<input type="hidden" name="proposedPrice" value="0" />
							<input type="hidden" name="currencyCode" value={campaign.currencyCode} />
						{/if}

						<InputComp
							{form}
							{errors}
							name="pitch"
							type="textarea"
							rows={6}
							label={m.campaign_your_pitch()}
							placeholder={m.campaign_pitch_placeholder()}
							required
						/>

						<button
							type="submit"
							disabled={$delayed}
							class="flex w-full items-center justify-center gap-1.5 rounded-2xl border-2 border-edge bg-brand py-3 font-black text-brand-ink shadow-[3px_3px_0px_0px_rgb(var(--bento-shadow))] hover:bg-brand-strong disabled:opacity-60"
						>
							{#if $delayed}
								<LoadingBtn name={m.campaign_sending()} />
							{:else}
								<Send class="h-3.5 w-3.5" />
								{m.campaign_submit_pitch()}
							{/if}
						</button>

						<p class="text-center text-[11px] font-medium text-ink-dim">
							{m.campaign_pitch_disclaimer()}
						</p>
					</form>
				{/if}
			</div>
		</div>
	</div>
</div>
