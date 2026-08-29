<script lang="ts">
	import AppImage from '$lib/components/app-image.svelte';
	import { resolve } from '$app/paths';
	import CrudSection from '$lib/components/crud-section.svelte';
	import VerificationBadge from '$lib/components/verification-badge.svelte';
	import type { CrudField } from '$lib/components/Table/crud-dialog.svelte';
	import { Award, Star, ExternalLink } from '@lucide/svelte';
	import { formatReach } from '$lib/domain/money';
	import * as m from '$lib/paraglide/messages';

	let { data } = $props();

	const fields: CrudField[] = $derived([
		{ name: 'fullName', label: m.ac_full_name(), required: true },
		{ name: 'username', label: m.pc_handle(), required: true },
		{ name: 'bio', label: m.pf_bio(), type: 'textarea', rows: 4 },
		{ name: 'avatar', label: m.ac_avatar(), type: 'file', placeholder: m.ac_avatar_hint() },
		{ name: 'cover', label: m.ac_cover(), type: 'file', placeholder: m.ac_cover_hint() },
		{
			name: 'countryId',
			label: m.pf_country(),
			type: 'select',
			items: data.reference.countries.map((c) => ({ value: c.id, name: `${c.flag} ${c.name}` }))
		},
		{
			name: 'regionId',
			label: m.pf_region(),
			type: 'select',
			items: data.reference.regions.map((r) => ({ value: r.id, name: r.name }))
		},
		{ name: 'city', label: m.pf_city() },
		{
			name: 'primaryPlatformId',
			label: m.pf_primary_platform(),
			type: 'select',
			items: data.reference.platforms.map((p) => ({ value: p.id, name: p.name }))
		},
		{ name: 'totalReach', label: m.pf_total_reach(), type: 'number' },
		{ name: 'startingPrice', label: m.pf_starting_price(), type: 'number' },
		{
			name: 'currencyCode',
			label: m.campaign_currency(),
			type: 'select',
			items: ['ETB', 'KES', 'NGN', 'ZAR', 'GHS', 'RWF', 'EGP', 'AED', 'GBP', 'USD'].map((c) => ({
				value: c,
				name: c
			}))
		},
		{
			name: 'verificationLevel',
			label: m.ac_verification_badge(),
			type: 'select',
			items: [
				{ value: 'unverified', name: m.verif_none_label() },
				{ value: 'social_verified', name: m.verif_social_label() },
				{ value: 'identity_verified', name: m.verif_id_label() },
				{ value: 'cn_verified', name: m.verif_cn_label() }
			]
		},
		{
			name: 'availability',
			label: m.pf_availability(),
			type: 'select',
			items: [
				{ value: 'available', name: m.ac_avail_available() },
				{ value: 'busy', name: m.ac_avail_busy() },
				{ value: 'away', name: m.pf_avail_away() }
			]
		},
		{ name: 'overseasPercentage', label: m.ac_overseas_pct(), type: 'number' },
		{ name: 'topCountries', label: m.ac_top_countries(), type: 'textarea', rows: 3 },
		{
			name: 'isFeatured',
			label: m.ac_featured(),
			type: 'checkboxSingle',
			placeholder: m.ac_featured_note()
		},
		{
			name: 'isTrending',
			label: m.ac_trending(),
			type: 'checkboxSingle',
			placeholder: m.ac_trending_note()
		},
		{
			name: 'isPublished',
			label: m.ac_published(),
			type: 'checkboxSingle',
			placeholder: m.ac_published_note()
		},
		{ name: 'sortOrder', label: m.common_sort_order(), type: 'number' },
		{
			name: 'isActive',
			label: m.common_active(),
			type: 'checkboxSingle',
			placeholder: m.common_account_active()
		}
	]);

	const published = $derived(data.rows.filter((r) => r.isPublished).length);
</script>

<svelte:head><title>{m.ac_meta_title()}</title></svelte:head>

<CrudSection
	eyebrow={m.sb_marketplace()}
	title={m.ac_title()}
	description={m.ac_description()}
	label={m.ac_label()}
	rows={data.rows}
	list={data.list}
	{fields}
	addForm={data.addForm}
	editForm={data.editForm}
	deleteForm={data.deleteForm}
	fileFields={['avatar', 'cover']}
	nameKey="fullName"
	emptyMessage={m.ac_empty()}
>
	{#snippet extraActions()}
		<span
			class="rounded-2xl border-2 border-edge bg-tile-mint px-4 py-2.5 text-xs font-black text-ink shadow-[3px_3px_0px_0px_rgb(var(--bento-shadow))]"
		>
			{m.ac_published_count({ published, total: data.rows.length })}
		</span>
	{/snippet}

	{#snippet row(creator)}
		<div class="space-y-3">
			<div class="flex items-start justify-between gap-2">
				<div class="flex min-w-0 items-center gap-3">
					<AppImage
						src={creator.avatar}
						alt=""
						kind="avatar"
						seed={creator.username}
						label={creator.fullName}
						class="h-10 w-10 shrink-0 rounded-2xl border-2 border-edge object-cover"
						loading="lazy"
						decoding="async"
						width="40"
						height="40"
					/>
					<div class="min-w-0">
						<h3 class="truncate text-sm font-black text-ink">{creator.fullName}</h3>
						<p class="truncate text-[11px] font-bold text-ink-dim">@{creator.username}</p>
					</div>
				</div>
				<div class="flex shrink-0 flex-col items-end gap-1">
					{#if creator.isPublished}
						<a
							href={resolve(`/creators/${creator.username}`)}
							target="_blank"
							class="inline-flex items-center gap-1 text-[10px] font-black text-brand-soft-fg hover:underline"
						>
							<ExternalLink class="h-3 w-3" />
							{m.ac_live()}
						</a>
					{:else}
						<span
							class="rounded-md border border-warn-edge bg-warn-soft px-2 py-0.5 text-[10px] font-black tracking-wider text-warn-fg uppercase"
						>
							{m.ac_unpublished()}
						</span>
					{/if}
				</div>
			</div>

			<div class="flex flex-wrap items-center gap-1.5">
				<VerificationBadge level={creator.verificationLevel} />
				{#if creator.isFeatured}
					<span
						class="rounded-md border border-edge bg-tile-indigo px-2 py-0.5 text-[10px] font-black tracking-wider text-info-fg uppercase"
					>
						{m.ac_featured()}
					</span>
				{/if}
				{#if creator.isTrending}
					<span
						class="rounded-md border border-edge bg-tile-yellow px-2 py-0.5 text-[10px] font-black tracking-wider text-warn-fg uppercase"
					>
						{m.ac_trending()}
					</span>
				{/if}
			</div>

			<div class="grid grid-cols-3 gap-2 rounded-xl bg-panel p-2 text-center text-xs">
				<div>
					<div class="text-[9px] font-black tracking-wider text-ink-dim uppercase">
						{m.card_reach()}
					</div>
					<div class="font-black text-ink">{formatReach(creator.totalReach)}</div>
				</div>
				<div>
					<div class="text-[9px] font-black tracking-wider text-ink-dim uppercase">
						{m.home_score()}
					</div>
					<div class="flex items-center justify-center gap-0.5 font-black text-ink">
						<Award class="h-3 w-3 text-brand-fg" />
						{creator.score}
					</div>
				</div>
				<div>
					<div class="text-[9px] font-black tracking-wider text-ink-dim uppercase">
						{m.card_rating()}
					</div>
					<div class="flex items-center justify-center gap-0.5 font-black text-ink">
						<Star class="h-3 w-3 fill-warn text-ink" />
						{creator.averageRating.toFixed(1)}
					</div>
				</div>
			</div>
		</div>
	{/snippet}
</CrudSection>
