<script lang="ts">
	import AppImage from '$lib/components/app-image.svelte';
	import type { CampaignCard } from '$lib/server/queries';
	import { resolve } from '$app/paths';
	import { Calendar, Users, Send, CircleCheckBig } from '@lucide/svelte';
	import * as m from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';
	import CompensationBadge from './compensation-badge.svelte';

	let {
		campaign,
		hasApplied = false,
		canApply = false,
		onApply = undefined
	}: {
		campaign: CampaignCard;
		hasApplied?: boolean;
		canApply?: boolean;
		onApply?: (campaign: CampaignCard) => void;
	} = $props();

	const formatDate = (value: string | Date | null) => {
		if (!value) return m.campaign_open();
		const date = typeof value === 'string' ? new Date(value) : value;
		if (Number.isNaN(date.getTime())) return String(value);
		return date.toLocaleDateString(getLocale() === 'am' ? 'am-ET' : 'en-GB', {
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		});
	};
</script>

<div
	id="campaign-card-{campaign.id}"
	class="flex flex-col justify-between rounded-3xl border-2 border-slate-900 bg-white p-6 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[6px_6px_0px_0px_rgba(15,23,42,1)]"
>
	<div>
		<!-- Brand row -->
		<div class="mb-4 flex items-start justify-between gap-3">
			<div class="flex items-center gap-3">
				<AppImage
					src={campaign.organizationLogo}
					alt={campaign.organizationName}
					kind="logo"
					seed={campaign.organizationName}
					loading="lazy"
					class="h-12 w-12 rounded-2xl border-2 border-slate-900 object-cover shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]"
					decoding="async"
					width="48"
					height="48"
				/>
				<div>
					<div class="flex items-center gap-2">
						<h4 class="text-sm font-black text-slate-900">{campaign.organizationName}</h4>
						<span
							class="rounded-full border border-slate-900 bg-slate-100 px-2 py-0.5 text-[9px] font-black tracking-wider text-slate-800 uppercase"
						>
							{campaign.orgType?.replace('_', ' ')}
						</span>
					</div>
					<p class="text-xs font-bold text-slate-500">
						{m.campaign_card_category({
							name: campaign.categoryName ?? m.campaign_card_general()
						})}
					</p>
				</div>
			</div>
			<CompensationBadge type={campaign.compensationType} />
		</div>

		<a
			href={resolve(`/campaigns/${campaign.slug}`)}
			class="mb-2 block text-lg font-black text-slate-900 transition-colors hover:text-emerald-600"
		>
			{campaign.title}
		</a>

		<p class="mb-3 line-clamp-2 text-xs leading-relaxed font-medium text-slate-600">
			{campaign.description}
		</p>

		<!-- Tags -->
		{#if campaign.tags?.length}
			<div class="mb-4 flex flex-wrap items-center gap-1.5">
				{#each campaign.tags.slice(0, 4) as tag (tag)}
					<span
						class="rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-black text-emerald-900"
					>
						{tag}
					</span>
				{/each}
				{#if campaign.tags.length > 4}
					<span
						class="rounded-md border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500"
					>
						{m.campaign_card_more({ count: campaign.tags.length - 4 })}
					</span>
				{/if}
			</div>
		{/if}

		<!-- Compensation detail box -->
		{#if campaign.compensationType === 'event_pass' && campaign.eventName}
			<div
				class="mb-4 rounded-2xl border-2 border-slate-900 bg-[#e0e7ff] p-3.5 text-xs shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]"
			>
				<div class="mb-1 font-black text-indigo-950">
					🎫 {campaign.eventName} ({formatDate(campaign.eventDate)})
				</div>
				{#if campaign.eventLocation}
					<p class="mb-1 text-[11px] font-bold text-indigo-800">
						{m.campaign_card_location({ location: campaign.eventLocation })}
					</p>
				{/if}
				{#if campaign.passType}
					<p class="text-[11px] font-black text-indigo-900">
						{m.campaign_card_pass_perks({ perks: campaign.passType })}
					</p>
				{/if}
			</div>
		{/if}

		{#if campaign.compensationType === 'barter' && campaign.barterDetails}
			<div
				class="mb-4 rounded-2xl border-2 border-slate-900 bg-[#fef9c3] p-3.5 text-xs shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]"
			>
				<div class="mb-1 font-black text-amber-950">{m.campaign_card_barter_heading()}</div>
				<p class="text-[11px] font-bold text-amber-900">{campaign.barterDetails}</p>
			</div>
		{/if}

		<!-- Meta chips -->
		<div class="mb-4 flex flex-wrap items-center gap-2 text-xs text-slate-700">
			<span
				class="flex items-center gap-1 rounded-xl border-2 border-slate-900 bg-slate-50 px-3 py-1.5 text-xs font-bold"
			>
				<span class="text-sm">{campaign.countryFlag ?? '🌍'}</span>
				<span>{campaign.countryName ?? m.campaign_pan_african()}</span>
			</span>
			<span
				class="flex items-center gap-1 rounded-xl border-2 border-slate-900 bg-slate-50 px-3 py-1.5 text-xs font-bold"
			>
				<Users class="h-3.5 w-3.5 text-emerald-600" />
				<span>{m.campaign_creators_needed({ count: campaign.creatorsNeeded })}</span>
			</span>
			<span
				class="flex items-center gap-1 rounded-xl border-2 border-slate-900 bg-slate-50 px-3 py-1.5 text-xs font-bold"
			>
				<Calendar class="h-3.5 w-3.5 text-emerald-600" />
				<span>{m.campaign_closes({ date: formatDate(campaign.deadline) })}</span>
			</span>
		</div>

		{#if campaign.targetRegions?.length}
			<div class="mb-4 flex flex-wrap items-center gap-1.5">
				<span class="text-[10px] font-black tracking-wider text-slate-500 uppercase">
					{m.campaign_card_target_creators()}
				</span>
				{#each campaign.targetRegions as region (region)}
					<span
						class="rounded-md border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-900"
					>
						{region}
					</span>
				{/each}
			</div>
		{/if}

		{#if campaign.deliverables?.length}
			<div class="mb-4">
				<div class="mb-1.5 text-[10px] font-black tracking-widest text-slate-500 uppercase">
					{m.campaign_card_required_deliverables()}
				</div>
				<div class="flex flex-wrap gap-2">
					{#each campaign.deliverables as item (item)}
						<span
							class="rounded-xl border-2 border-slate-900 bg-[#dcfce7] px-2.5 py-1 text-xs font-bold text-emerald-950 shadow-[1px_1px_0px_0px_rgba(15,23,42,1)]"
						>
							✓ {item}
						</span>
					{/each}
				</div>
			</div>
		{/if}
	</div>

	<!-- Footer -->
	<div class="flex items-center justify-between gap-3 border-t-2 border-slate-900 pt-4">
		<div>
			<span class="block text-[9px] font-black tracking-wider text-slate-500 uppercase">
				{m.campaign_card_budget()}
			</span>
			{#if campaign.compensationType === 'paid'}
				<span class="text-sm font-black text-slate-900">
					{campaign.budgetMin.toLocaleString()} – {campaign.budgetMax.toLocaleString()}
					<span class="text-xs font-black text-emerald-600">{campaign.currencyCode}</span>
				</span>
			{:else if campaign.compensationType === 'event_pass'}
				<span
					class="rounded-md border border-slate-900 bg-[#e0e7ff] px-2 py-0.5 text-xs font-black text-indigo-900"
				>
					{m.campaign_card_event_pass()}
				</span>
			{:else}
				<span
					class="rounded-md border border-slate-900 bg-[#fef9c3] px-2 py-0.5 text-xs font-black text-amber-900"
				>
					{m.campaign_barter_access()}
				</span>
			{/if}
		</div>

		<div>
			{#if hasApplied}
				<span
					class="inline-flex items-center gap-1 rounded-xl border-2 border-slate-900 bg-slate-100 px-3.5 py-2 text-xs font-black text-slate-900"
				>
					<CircleCheckBig class="h-3.5 w-3.5 text-emerald-600" />
					<span>{m.campaign_card_applied()}</span>
				</span>
			{:else if canApply && onApply}
				<button
					type="button"
					onclick={() => onApply?.(campaign)}
					class="flex cursor-pointer items-center gap-1.5 rounded-xl border-2 border-slate-900 bg-emerald-600 px-4 py-2 text-xs font-black text-white shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] transition-colors hover:bg-emerald-700"
				>
					<Send class="h-3.5 w-3.5" />
					<span>{m.apply_now()}</span>
				</button>
			{:else}
				<a
					href={resolve(`/campaigns/${campaign.slug}`)}
					class="flex items-center gap-1.5 rounded-xl border-2 border-slate-900 bg-emerald-600 px-4 py-2 text-xs font-black text-white shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] transition-colors hover:bg-emerald-700"
				>
					<Send class="h-3.5 w-3.5" />
					<span>{m.campaign_card_view_brief()}</span>
				</a>
			{/if}
		</div>
	</div>
</div>
