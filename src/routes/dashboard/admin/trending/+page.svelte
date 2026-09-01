<script lang="ts">
	import { untrack } from 'svelte';
	import InputComp from '$lib/formComponents/InputComp.svelte';
	import type { TrendingPreview } from './+page.server';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { resolve } from '$app/paths';
	import * as m from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';
	import { superForm } from 'sveltekit-superforms';
	import { enhance } from '$app/forms';
	import { toast } from 'svelte-sonner';
	import PageHeader from '$lib/components/page-header.svelte';
	import Errors from '$lib/formComponents/Errors.svelte';
	import LoadingBtn from '$lib/formComponents/LoadingBtn.svelte';
	import {
		LANE_LIMIT_COLUMN,
		TRENDING_LANE_KINDS,
		TRENDING_SIGNALS,
		WEIGHT_COLUMN,
		trendingLaneKindMeta,
		trendingPresets,
		trendingSignalMeta,
		type TrendingSignal
	} from '$lib/domain/trending';
	import {
		Flame,
		Lock,
		LockOpen,
		Pin,
		Ban,
		Rocket,
		RefreshCw,
		Eye,
		Trash2,
		TimerReset,
		Sparkles,
		SlidersHorizontal,
		Filter,
		Shuffle,
		Clock,
		History,
		Inbox,
		MapPin,
		Rows3
	} from '@lucide/svelte';

	let { data } = $props();

	/** The dry run returned by `?/preview`. Cleared whenever the form is saved. */
	let preview = $state<TrendingPreview | null>(null);
	let openBreakdown = $state<number | null>(null);

	const {
		form,
		errors,
		enhance: configEnhance,
		delayed,
		allErrors,
		message
	} = superForm(
		untrack(() => data.form),
		{
			onUpdate({ result }) {
				preview =
					result.type === 'success' ? ((result.data?.preview as TrendingPreview) ?? null) : null;
			}
		}
	);

	const overrideSuper = superForm(
		untrack(() => data.overrideForm),
		{ id: 'override' }
	);
	const overrideForm = overrideSuper.form;
	const overrideErrors = overrideSuper.errors;

	const overrideKindItems = $derived([
		{ value: 'pin', name: m.at_kind_pin() },
		{ value: 'boost', name: m.at_kind_boost() },
		{ value: 'block', name: m.at_kind_block() }
	]);

	$effect(() => {
		if (!$message) return;
		if ($message.type === 'error') toast.error($message.text);
		else toast.success($message.text);
	});

	const signals = $derived(trendingSignalMeta());
	const presets = $derived(trendingPresets());

	const weightOf = (key: TrendingSignal) => Number($form[WEIGHT_COLUMN[key]] ?? 0);
	const totalWeight = $derived(TRENDING_SIGNALS.reduce((sum, key) => sum + weightOf(key), 0));
	const shareOf = (key: TrendingSignal) =>
		totalWeight > 0 ? Math.round((weightOf(key) / totalWeight) * 100) : 0;

	function applyPreset(weights: Record<string, number>) {
		for (const key of TRENDING_SIGNALS) {
			$form[WEIGHT_COLUMN[key]] = weights[key] ?? 0;
		}
		toast.success(m.at_preset_applied());
	}

	const locale = $derived(getLocale() === 'am' ? 'am-ET' : 'en-GB');
	const compact = (value: number) =>
		new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(value);
	const stamp = (value: Date | string | null) =>
		value
			? new Date(value).toLocaleString(locale, {
					day: 'numeric',
					month: 'short',
					hour: '2-digit',
					minute: '2-digit'
				})
			: m.at_status_never();
	const day = (value: Date | string | null) =>
		value ? new Date(value).toLocaleDateString(locale, { day: 'numeric', month: 'short' }) : '';

	const modes = $derived([
		{
			key: 'hybrid' as const,
			label: m.at_mode_hybrid(),
			help: m.at_mode_hybrid_help(),
			icon: Sparkles
		},
		{
			key: 'automatic' as const,
			label: m.at_mode_automatic(),
			help: m.at_mode_automatic_help(),
			icon: Flame
		},
		{ key: 'manual' as const, label: m.at_mode_manual(), help: m.at_mode_manual_help(), icon: Pin }
	]);

	/* `{ value, name }` because that is the shape every form control here takes. */
	const verificationItems = $derived([
		{ value: 'unverified', name: m.discover_verif_unverified() },
		{ value: 'social_verified', name: m.discover_verif_social() },
		{ value: 'identity_verified', name: m.discover_verif_identity() },
		{ value: 'cn_verified', name: m.discover_verif_cn() }
	]);

	const normalizationItems = $derived([
		{ value: 'percentile', name: m.at_norm_percentile() },
		{ value: 'minmax', name: m.at_norm_minmax() }
	]);

	/* 0 rather than an empty string: the field is a number everywhere else, and
	   the schema coerces what the select posts. */
	const marketItems = $derived([
		{ value: 0, name: m.at_market_all() },
		...data.reference.countries.map((country) => ({
			value: country.id,
			name: `${country.flag} ${country.name}`
		}))
	]);

	const localRankingItems = $derived([
		{ value: 'off', name: m.at_local_off() },
		{ value: 'boost', name: m.at_local_boost_mode() },
		{ value: 'first', name: m.at_local_first_mode() }
	]);

	const localMatchItems = $derived([
		{ value: 'country', name: m.at_local_match_country() },
		{ value: 'region', name: m.at_local_match_region() },
		{ value: 'city', name: m.at_local_match_city() }
	]);

	const localRankingHelp = $derived(
		$form.localRanking === 'first'
			? m.at_local_first_help()
			: $form.localRanking === 'boost'
				? m.at_local_boost_help()
				: m.at_local_off_help()
	);

	const reasonLabel = (key: string) =>
		({
			outside_market: m.at_reason_outside_market(),
			min_score: m.at_reason_min_score(),
			min_reach: m.at_reason_min_reach(),
			min_rating: m.at_reason_min_rating(),
			min_verification: m.at_reason_min_verification(),
			no_channel: m.at_reason_no_channel(),
			unavailable: m.at_reason_unavailable(),
			no_activity: m.at_reason_no_activity(),
			blocked: m.at_reason_blocked(),
			resting: m.at_reason_resting(),
			category_cap: m.at_reason_category_cap(),
			country_cap: m.at_reason_country_cap()
		})[key] ?? key;

	const sourceLabel = (key: string) =>
		key === 'pinned'
			? m.at_source_pinned()
			: key === 'manual'
				? m.at_source_manual()
				: m.at_source_algorithm();

	const kindLabel = (kind: string) =>
		kind === 'pin' ? m.at_kind_pin() : kind === 'block' ? m.at_kind_block() : m.at_kind_boost();

	const signalLabel = (key: string) => signals.find((signal) => signal.key === key)?.label ?? key;

	const laneKinds = $derived(trendingLaneKindMeta());
	const laneKindLabel = (key: string) => laneKinds.find((kind) => kind.key === key)?.label ?? key;
	/** How many lanes of each kind the current settings would publish. */
	const laneTotal = $derived(
		TRENDING_LANE_KINDS.reduce((sum, kind) => sum + Number($form[LANE_LIMIT_COLUMN[kind]] ?? 0), 0)
	);

	/** The two or three signals that actually put a creator where they are. */
	const topContributors = (components: { key: string; contribution: number }[]) =>
		[...(components ?? [])].sort((a, b) => b.contribution - a.contribution).slice(0, 3);

	const nextRunAt = $derived.by(() => {
		if (!data.config.autoRefresh || !data.config.lastRunAt) return null;
		return new Date(
			new Date(data.config.lastRunAt).getTime() + data.config.refreshIntervalMinutes * 60_000
		);
	});

	const creatorItems = $derived(
		data.creators.map((creator) => ({
			value: creator.id,
			name: creator.isPublished ? creator.fullName : `${creator.fullName} · ${m.at_unpublished()}`
		}))
	);

	const handle =
		(text: string): SubmitFunction =>
		() => {
			return async ({ result, update }) => {
				if (result.type === 'failure') toast.error(result.data?.message ?? m.common_refused());
				else if (result.type === 'success') toast.success(text);
				await update();
			};
		};

	/* The knobs the two field snippets below can bind to, split by input kind so
	   the binding stays typed rather than falling back to `any`. */
	type NumberField =
		| 'slots'
		| 'windowDays'
		| 'halfLifeDays'
		| 'minScore'
		| 'minFollowers'
		| 'minRating'
		| 'maxPerCategory'
		| 'maxPerCountry'
		| 'maxTenureDays'
		| 'cooldownDays'
		| 'localBoost'
		| 'laneSlots'
		| 'laneMinSize'
		| 'lanePoolSize'
		| 'maxCategoryLanes'
		| 'maxCountryLanes'
		| 'maxRegionLanes'
		| 'maxCityLanes'
		| 'maxPlatformLanes'
		| 'maxLanguageLanes'
		| 'refreshIntervalMinutes';
	type ToggleFieldName =
		| 'requireChannel'
		| 'requireAvailable'
		| 'requireActivity'
		| 'pinnedFirst'
		| 'laneLocalFirst'
		| 'autoRefresh'
		| 'isFrozen';

	const sectionTitle = 'flex items-center gap-2 text-sm font-black text-ink';
</script>

{#snippet numberField(name: NumberField, label: string, help: string, min: number, max: number)}
	<InputComp {form} {errors} {name} {label} {min} {max} type="number" hint={help} step={1} />
{/snippet}

{#snippet toggleField(name: ToggleFieldName, label: string, help: string)}
	<div class="bento-card-static rounded-2xl border-2 border-edge bg-surface p-2">
		<InputComp {form} {errors} {name} {label} type="checkboxSingle" hint={help} />
	</div>
{/snippet}

<svelte:head><title>{m.at_meta_title()}</title></svelte:head>

<div class="space-y-6">
	<PageHeader
		eyebrow={m.dash_platform_operations()}
		title={m.at_title()}
		description={m.at_description()}
	>
		{#snippet actions()}
			<form method="POST" action="?/freeze" use:enhance={handle(m.at_freeze_toggled())}>
				<button
					type="submit"
					class="flex items-center gap-2 rounded-2xl border-2 border-edge px-3 py-2 text-xs font-black shadow-[3px_3px_0px_0px_rgb(var(--bento-shadow))] {data
						.config.isFrozen
						? 'bg-warn text-ink'
						: 'bg-surface text-ink hover:bg-well'}"
				>
					{#if data.config.isFrozen}
						<LockOpen class="h-3.5 w-3.5" />{m.at_unfreeze()}
					{:else}
						<Lock class="h-3.5 w-3.5" />{m.at_freeze()}
					{/if}
				</button>
			</form>

			<form method="POST" action="?/run" use:enhance={handle(m.at_recomputed())}>
				<button
					type="submit"
					disabled={data.config.isFrozen}
					class="flex items-center gap-2 rounded-2xl border-2 border-edge bg-brand px-3 py-2 text-xs font-black text-brand-ink shadow-[3px_3px_0px_0px_rgb(var(--bento-shadow))] hover:bg-brand-strong disabled:opacity-50"
				>
					<RefreshCw class="h-3.5 w-3.5" />
					{m.at_recompute()}
				</button>
			</form>
		{/snippet}
	</PageHeader>

	<!-- ================= STATUS ================= -->
	<div class="grid grid-cols-2 gap-3 lg:grid-cols-5">
		<div class="bento-card bento-card-static">
			<span class="text-[10px] font-black tracking-widest text-ink-dim uppercase">
				{m.at_status_mode()}
			</span>
			<p class="text-base font-black text-ink">
				{modes.find((mode) => mode.key === data.config.mode)?.label}
			</p>
		</div>
		<div class="bento-card bento-card-static">
			<span class="text-[10px] font-black tracking-widest text-ink-dim uppercase">
				{m.at_status_slots()}
			</span>
			<p class="text-base font-black text-ink">
				{data.board.length} / {data.config.slots}
			</p>
		</div>
		<div class="bento-card bento-card-static">
			<span class="text-[10px] font-black tracking-widest text-ink-dim uppercase">
				{m.at_status_last_run()}
			</span>
			<p class="text-sm font-black text-ink">{stamp(data.config.lastRunAt)}</p>
		</div>
		<div class="bento-card bento-card-static">
			<span class="text-[10px] font-black tracking-widest text-ink-dim uppercase">
				{m.at_status_next_run()}
			</span>
			<p class="text-sm font-black text-ink">
				{nextRunAt ? stamp(nextRunAt) : m.at_status_auto_off()}
			</p>
		</div>
		<div class={data.config.isFrozen ? 'bento-card-yellow' : 'bento-card bento-card-static'}>
			<span class="text-[10px] font-black tracking-widest text-ink-dim uppercase">
				{m.at_status_state()}
			</span>
			<p class="text-base font-black text-ink">
				{data.config.isFrozen ? m.at_status_frozen() : m.at_status_live()}
			</p>
		</div>
	</div>

	{#if data.config.isFrozen}
		<div class="bento-card-yellow flex items-start gap-2">
			<Lock class="mt-0.5 h-4 w-4 shrink-0 text-warn-fg" />
			<p class="text-[11px] font-medium text-warn-fg">{m.at_frozen_warning()}</p>
		</div>
	{/if}

	<!-- ================= LIVE BOARD ================= -->
	<div class="bento-card bento-card-static space-y-4">
		<div class="flex items-center justify-between">
			<h2 class={sectionTitle}>
				<Flame class="h-4 w-4 text-brand-fg" />
				{m.at_board_title()}
			</h2>
			<a
				href={resolve('/')}
				class="text-[11px] font-black text-brand-soft-fg hover:text-brand-soft-fg"
			>
				{m.at_board_view_site()}
			</a>
		</div>

		{#if !data.board.length}
			<div class="space-y-2 py-10 text-center">
				<Inbox class="mx-auto h-8 w-8 text-ink-faint" />
				<p class="text-sm font-black text-ink">{m.at_board_empty()}</p>
				<p class="text-xs font-medium text-ink-soft">{m.at_board_empty_body()}</p>
			</div>
		{:else}
			<div class="overflow-x-auto">
				<table class="w-full min-w-[720px] text-left">
					<thead>
						<tr
							class="border-b-2 border-edge text-[10px] font-black tracking-widest text-ink-dim uppercase"
						>
							<th class="pb-2">{m.at_col_rank()}</th>
							<th class="pb-2">{m.at_col_creator()}</th>
							<th class="pb-2">{m.at_col_score()}</th>
							<th class="pb-2">{m.at_col_source()}</th>
							<th class="pb-2">{m.at_col_why()}</th>
							<th class="pb-2">{m.at_col_since()}</th>
						</tr>
					</thead>
					<tbody>
						{#each data.board as entry (entry.creatorId)}
							<tr class="border-b border-edge-soft align-top text-xs font-medium text-ink-soft">
								<td class="py-2 font-black text-ink">#{entry.rank}</td>
								<td class="py-2">
									<a
										href={resolve(`/creators/${entry.username}`)}
										class="font-black text-ink hover:text-brand-soft-fg"
									>
										{entry.fullName}
									</a>
									<span class="block text-[10px] text-ink-dim">
										{entry.countryFlag ?? ''}
										{[entry.city, entry.countryName].filter(Boolean).join(', ')} · {compact(
											entry.totalReach
										)}
									</span>
								</td>
								<td class="py-2 font-black text-ink">{entry.trendingScore.toFixed(1)}</td>
								<td class="py-2">
									<span
										class="rounded-md border-2 px-2 py-0.5 text-[10px] font-black tracking-wider uppercase {entry.source ===
										'pinned'
											? 'border-info-edge bg-info-soft text-info-fg'
											: entry.source === 'manual'
												? 'border-edge-mid bg-well text-ink'
												: 'border-brand-edge bg-brand-soft text-brand-soft-fg'}"
									>
										{sourceLabel(entry.source)}
									</span>
								</td>
								<td class="py-2">
									{#if entry.breakdown?.components?.length}
										<div class="flex flex-wrap gap-1">
											{#each topContributors(entry.breakdown.components) as component (component.key)}
												<span
													class="rounded-md border border-edge-mid bg-panel px-1.5 py-0.5 text-[10px] font-bold text-ink-soft"
												>
													{signalLabel(component.key)} +{component.contribution.toFixed(1)}
												</span>
											{/each}
											{#if entry.breakdown.multiplier !== 1}
												<span
													class="rounded-md border border-warn-edge bg-warn-soft px-1.5 py-0.5 text-[10px] font-black text-warn-fg"
												>
													×{entry.breakdown.multiplier}
												</span>
											{/if}
										</div>
									{:else}
										<span class="text-[10px] text-ink-faint">{m.at_no_breakdown()}</span>
									{/if}
								</td>
								<td class="py-2 text-[10px] text-ink-dim">{day(entry.firstRankedAt)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}

		<!-- The lanes that same board was cut into. Chips rather than a second
		     table: what an operator checks here is that the cuts exist and are
		     the right size, not who is in each one. -->
		{#if data.lanes.length}
			<div class="space-y-2 border-t-2 border-edge pt-4">
				<h3 class="text-[10px] font-black tracking-widest text-ink-dim uppercase">
					{m.at_board_lanes({ count: data.lanes.length })}
				</h3>
				<div class="flex flex-wrap gap-2">
					{#each data.lanes as lane (lane.id)}
						<span
							class="flex items-center gap-1.5 rounded-xl border-2 border-edge bg-surface px-2.5 py-1 text-[10px] font-black text-ink"
							title={lane.entries.map((entry) => entry.fullName).join(', ')}
						>
							<span class="text-ink-dim">{laneKindLabel(lane.kind)}</span>
							<span>{lane.label}</span>
							<span class="rounded-md bg-well px-1.5 text-ink-soft">{lane.entries.length}</span>
						</span>
					{/each}
				</div>
			</div>
		{/if}
	</div>

	<!-- ================= ALGORITHM ================= -->
	<form method="POST" action="?/save" use:configEnhance class="space-y-6">
		<Errors allErrors={$allErrors} />
		<input type="hidden" name="mode" value={$form.mode} />

		<!-- Mode -->
		<div class="bento-card bento-card-static space-y-3">
			<h2 class={sectionTitle}>
				<Shuffle class="h-4 w-4 text-brand-fg" />
				{m.at_mode_title()}
			</h2>
			<div class="grid gap-3 sm:grid-cols-3">
				{#each modes as mode (mode.key)}
					{@const Icon = mode.icon}
					<button
						type="button"
						onclick={() => ($form.mode = mode.key)}
						class="rounded-2xl border-2 border-edge p-3 text-left shadow-[3px_3px_0px_0px_rgb(var(--bento-shadow))] transition-colors {$form.mode ===
						mode.key
							? 'bg-inverse text-inverse-ink'
							: 'bg-surface text-ink hover:bg-well'}"
					>
						<Icon class="mb-2 h-4 w-4" />
						<span class="block text-xs font-black">{mode.label}</span>
						<span
							class="mt-1 block text-[10px] font-medium {$form.mode === mode.key
								? 'text-ink-faint'
								: 'text-ink-dim'}"
						>
							{mode.help}
						</span>
					</button>
				{/each}
			</div>
		</div>

		<!-- Weights -->
		<div
			class="bento-card bento-card-static space-y-4 {$form.mode === 'manual' ? 'opacity-50' : ''}"
		>
			<div class="flex flex-wrap items-center justify-between gap-2">
				<h2 class={sectionTitle}>
					<SlidersHorizontal class="h-4 w-4 text-brand-fg" />
					{m.at_signals_title()}
				</h2>
				<span class="text-[10px] font-black text-ink-dim">
					{m.at_weights_total({ total: totalWeight })}
				</span>
			</div>
			<p class="text-[11px] font-medium text-ink-soft">{m.at_signals_help()}</p>

			<div class="flex flex-wrap gap-2">
				{#each presets as preset (preset.key)}
					<button
						type="button"
						title={preset.description}
						onclick={() => applyPreset(preset.weights)}
						class="rounded-xl border-2 border-edge bg-surface px-2.5 py-1.5 text-[10px] font-black text-ink shadow-[2px_2px_0px_0px_rgb(var(--bento-shadow))] hover:bg-brand-soft"
					>
						{preset.label}
					</button>
				{/each}
			</div>

			<div class="grid gap-4 md:grid-cols-2">
				{#each signals as signal (signal.key)}
					<InputComp
						{form}
						{errors}
						name={WEIGHT_COLUMN[signal.key]}
						type="range"
						label={signal.label}
						min={0}
						max={100}
						step={1}
						hint={signal.help}
						formatValue={(weight) =>
							`${weight} · ${m.at_weight_share({ percent: shareOf(signal.key) })}`}
						className="h-2 appearance-none rounded-full border-2 border-edge bg-well"
					/>
				{/each}
			</div>
		</div>

		<!-- Basis -->
		<div class="grid gap-4 lg:grid-cols-2">
			<div class="bento-card bento-card-static space-y-4">
				<h2 class={sectionTitle}>
					<Clock class="h-4 w-4 text-brand-fg" />
					{m.at_basis_title()}
				</h2>
				<div class="grid gap-3 sm:grid-cols-2">
					{@render numberField('slots', m.at_slots(), m.at_slots_help(), 1, 48)}
					{@render numberField('windowDays', m.at_window_days(), m.at_window_help(), 1, 365)}
					{@render numberField('halfLifeDays', m.at_half_life(), m.at_half_life_help(), 0, 180)}
					<InputComp
						{form}
						{errors}
						name="normalization"
						type="select"
						label={m.at_normalization()}
						items={normalizationItems}
						hint={$form.normalization === 'percentile'
							? m.at_norm_percentile_help()
							: m.at_norm_minmax_help()}
					/>
				</div>
			</div>

			<div class="bento-card bento-card-static space-y-4">
				<h2 class={sectionTitle}>
					<Filter class="h-4 w-4 text-brand-fg" />
					{m.at_eligibility_title()}
				</h2>
				<div class="grid gap-3 sm:grid-cols-2">
					{@render numberField('minScore', m.at_min_score(), m.at_min_score_help(), 0, 100)}
					{@render numberField(
						'minFollowers',
						m.at_min_followers(),
						m.at_min_followers_help(),
						0,
						100000000
					)}
					{@render numberField('minRating', m.at_min_rating(), m.at_min_rating_help(), 0, 5)}
					<InputComp
						{form}
						{errors}
						name="minVerification"
						type="select"
						label={m.at_min_verification()}
						items={verificationItems}
						hint={m.at_min_verification_help()}
					/>
				</div>
				<div class="grid gap-2 sm:grid-cols-3">
					{@render toggleField(
						'requireChannel',
						m.at_require_channel(),
						m.at_require_channel_help()
					)}
					{@render toggleField(
						'requireAvailable',
						m.at_require_available(),
						m.at_require_available_help()
					)}
					{@render toggleField(
						'requireActivity',
						m.at_require_activity(),
						m.at_require_activity_help()
					)}
				</div>
			</div>
		</div>

		<!-- Location -->
		<div class="bento-card bento-card-static space-y-4">
			<h2 class={sectionTitle}>
				<MapPin class="h-4 w-4 text-brand-fg" />
				{m.at_location_title()}
			</h2>
			<p class="text-[11px] font-medium text-ink-soft">{m.at_location_help()}</p>

			<div class="grid gap-3 lg:grid-cols-3">
				<InputComp
					{form}
					{errors}
					name="countryId"
					type="select"
					label={m.at_market()}
					items={marketItems}
					hint={m.at_market_help()}
				/>
				<InputComp
					{form}
					{errors}
					name="localRanking"
					type="select"
					label={m.at_local_ranking()}
					items={localRankingItems}
					hint={localRankingHelp}
				/>
				<InputComp
					{form}
					{errors}
					name="localMatch"
					type="select"
					label={m.at_local_match()}
					items={localMatchItems}
					disabled={$form.localRanking === 'off'}
					hint={m.at_local_match_help()}
				/>
			</div>

			<!-- Only `boost` reads the points, so the slider says so rather than
			     sitting there looking live. -->
			<div class={$form.localRanking === 'boost' ? '' : 'opacity-50'}>
				<InputComp
					{form}
					{errors}
					name="localBoost"
					type="range"
					label={m.at_local_boost()}
					min={0}
					max={100}
					step={1}
					disabled={$form.localRanking !== 'boost'}
					hint={$form.localRanking === 'boost'
						? m.at_local_boost_field_help()
						: m.at_local_boost_inactive()}
					formatValue={(points) => m.at_local_boost_value({ points })}
					className="h-2 appearance-none rounded-full border-2 border-edge bg-well"
				/>
			</div>
		</div>

		<!-- Lanes -->
		<div class="bento-card bento-card-static space-y-4">
			<div class="flex flex-wrap items-center justify-between gap-2">
				<h2 class={sectionTitle}>
					<Rows3 class="h-4 w-4 text-brand-fg" />
					{m.at_lanes_title()}
				</h2>
				<span class="text-[10px] font-black text-ink-dim">
					{m.at_lanes_total({ count: laneTotal })}
				</span>
			</div>
			<p class="text-[11px] font-medium text-ink-soft">{m.at_lanes_help()}</p>

			<div class="grid gap-3 sm:grid-cols-3">
				{@render numberField('laneSlots', m.at_lane_slots(), m.at_lane_slots_help(), 1, 24)}
				{@render numberField('laneMinSize', m.at_lane_min(), m.at_lane_min_help(), 1, 24)}
				{@render numberField('lanePoolSize', m.at_lane_pool(), m.at_lane_pool_help(), 0, 1000)}
			</div>

			<!-- One field per kind, all reading the same "0 switches it off". A
			     multi-select would have hidden how many lanes each kind may take. -->
			<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
				{@render numberField(
					'maxCategoryLanes',
					m.at_lane_kind_category(),
					m.at_lane_count_help(),
					0,
					12
				)}
				{@render numberField(
					'maxCountryLanes',
					m.at_lane_kind_country(),
					m.at_lane_count_help(),
					0,
					12
				)}
				{@render numberField(
					'maxRegionLanes',
					m.at_lane_kind_region(),
					m.at_lane_count_help(),
					0,
					12
				)}
				{@render numberField('maxCityLanes', m.at_lane_kind_city(), m.at_lane_count_help(), 0, 12)}
				{@render numberField(
					'maxPlatformLanes',
					m.at_lane_kind_platform(),
					m.at_lane_count_help(),
					0,
					12
				)}
				{@render numberField(
					'maxLanguageLanes',
					m.at_lane_kind_language(),
					m.at_lane_count_help(),
					0,
					12
				)}
			</div>

			{@render toggleField('laneLocalFirst', m.at_lane_local_first(), m.at_lane_local_first_help())}
		</div>

		<!-- Fairness + automation -->
		<div class="grid gap-4 lg:grid-cols-2">
			<div class="bento-card bento-card-static space-y-4">
				<h2 class={sectionTitle}>
					<Shuffle class="h-4 w-4 text-brand-fg" />
					{m.at_fairness_title()}
				</h2>
				<p class="text-[11px] font-medium text-ink-soft">{m.at_fairness_help()}</p>
				<div class="grid gap-3 sm:grid-cols-2">
					{@render numberField('maxPerCategory', m.at_max_per_category(), m.at_cap_help(), 0, 48)}
					{@render numberField('maxPerCountry', m.at_max_per_country(), m.at_cap_help(), 0, 48)}
					{@render numberField('maxTenureDays', m.at_max_tenure(), m.at_max_tenure_help(), 0, 365)}
					{@render numberField('cooldownDays', m.at_cooldown(), m.at_cooldown_help(), 0, 365)}
				</div>
				{@render toggleField('pinnedFirst', m.at_pinned_first(), m.at_pinned_first_help())}
			</div>

			<div class="bento-card bento-card-static space-y-4">
				<h2 class={sectionTitle}>
					<RefreshCw class="h-4 w-4 text-brand-fg" />
					{m.at_automation_title()}
				</h2>
				<div class="grid gap-3 sm:grid-cols-2">
					{@render numberField(
						'refreshIntervalMinutes',
						m.at_refresh_interval(),
						m.at_refresh_interval_help(),
						15,
						10080
					)}
				</div>
				<div class="grid gap-2 sm:grid-cols-2">
					{@render toggleField('autoRefresh', m.at_auto_refresh(), m.at_auto_refresh_help())}
					{@render toggleField('isFrozen', m.at_frozen_label(), m.at_frozen_help())}
				</div>
			</div>
		</div>

		<div class="flex flex-col gap-2 sm:flex-row">
			<button
				type="submit"
				formaction="?/preview"
				class="flex flex-1 items-center justify-center gap-2 rounded-2xl border-2 border-edge bg-surface py-3 text-xs font-black text-ink shadow-[3px_3px_0px_0px_rgb(var(--bento-shadow))] hover:bg-well"
			>
				<Eye class="h-4 w-4" />
				{m.at_preview()}
			</button>
			<button
				type="submit"
				disabled={$delayed}
				class="flex flex-1 items-center justify-center gap-2 rounded-2xl border-2 border-edge bg-brand py-3 text-xs font-black text-brand-ink shadow-[3px_3px_0px_0px_rgb(var(--bento-shadow))] hover:bg-brand-strong disabled:opacity-60"
			>
				{#if $delayed}
					<LoadingBtn name={m.common_saving()} />
				{:else}
					{m.at_save()}
				{/if}
			</button>
		</div>
	</form>

	<!-- ================= PREVIEW ================= -->
	{#if preview}
		<div class="bento-card bento-card-static space-y-4">
			<h2 class={sectionTitle}>
				<Eye class="h-4 w-4 text-brand-fg" />
				{m.at_preview_title()}
			</h2>
			<p class="text-[11px] font-medium text-ink-soft">{m.at_preview_hint()}</p>

			<div class="flex flex-wrap gap-2 text-[10px] font-black">
				<span class="rounded-md border-2 border-edge bg-surface px-2 py-1">
					{m.at_preview_eligible({
						eligible: preview.stats.eligible,
						total: preview.stats.creators
					})}
				</span>
				{#each Object.entries(preview.stats.exclusions) as [reason, count] (reason)}
					<span class="rounded-md border border-edge-mid bg-panel px-2 py-1 text-ink-soft">
						{reasonLabel(reason)}: {count}
					</span>
				{/each}
			</div>

			{#if preview.entering.length || preview.leaving.length}
				<div class="grid gap-3 sm:grid-cols-2">
					<div class="rounded-2xl border-2 border-brand-edge bg-brand-soft p-3">
						<span class="text-[10px] font-black tracking-widest text-brand-soft-fg uppercase">
							{m.at_preview_entering()}
						</span>
						<p class="text-[11px] font-bold text-brand-soft-fg">
							{preview.entering.length ? preview.entering.join(', ') : m.at_preview_none()}
						</p>
					</div>
					<div class="rounded-2xl border-2 border-danger-edge bg-danger-soft p-3">
						<span class="text-[10px] font-black tracking-widest text-danger-fg uppercase">
							{m.at_preview_leaving()}
						</span>
						<p class="text-[11px] font-bold text-danger-fg">
							{preview.leaving.length ? preview.leaving.join(', ') : m.at_preview_none()}
						</p>
					</div>
				</div>
			{/if}

			<div class="space-y-1">
				<span class="text-[10px] font-black tracking-widest text-ink-dim uppercase">
					{m.at_preview_lanes({ count: preview.lanes.length })}
				</span>
				<div class="flex flex-wrap gap-2">
					{#each preview.lanes as lane (lane.kind + lane.label)}
						<span
							class="flex items-center gap-1.5 rounded-xl border-2 border-edge bg-surface px-2.5 py-1 text-[10px] font-black text-ink"
						>
							<span class="text-ink-dim">{laneKindLabel(lane.kind)}</span>
							<span>{lane.label}</span>
							<span class="rounded-md bg-well px-1.5 text-ink-soft">{lane.size}</span>
						</span>
					{:else}
						<span class="text-[11px] font-medium text-ink-soft">{m.at_preview_no_lanes()}</span>
					{/each}
				</div>
			</div>

			<div class="space-y-2">
				{#each preview.rows as row (row.creatorId)}
					<div
						class="rounded-2xl border-2 p-3 {row.rank
							? 'border-edge bg-surface'
							: 'border-dashed border-edge-mid bg-panel'}"
					>
						<button
							type="button"
							class="flex w-full items-center justify-between gap-3 text-left"
							onclick={() =>
								(openBreakdown = openBreakdown === row.creatorId ? null : row.creatorId)}
						>
							<span class="flex items-center gap-3">
								<span class="w-8 text-sm font-black text-ink">
									{row.rank ? `#${row.rank}` : '—'}
								</span>
								<span>
									<span class="block text-xs font-black text-ink">{row.fullName}</span>
									<span class="block text-[10px] font-medium text-ink-dim">
										{[row.city, row.countryName].filter(Boolean).join(', ')} · {compact(
											row.followers
										)} · {sourceLabel(row.source)}
									</span>
								</span>
							</span>
							<span class="text-right">
								<span class="block text-sm font-black text-ink">{row.score.toFixed(1)}</span>
								{#if row.multiplier !== 1}
									<span class="text-[10px] font-black text-warn-fg">×{row.multiplier}</span>
								{/if}
							</span>
						</button>

						{#if openBreakdown === row.creatorId}
							<div class="mt-3 space-y-1 border-t border-edge-soft pt-3">
								{#each row.components as component (component.key)}
									<div class="flex items-center gap-2">
										<span class="w-32 shrink-0 text-[10px] font-black text-ink-soft">
											{signalLabel(component.key)}
										</span>
										<span class="h-2 flex-1 overflow-hidden rounded-full bg-well">
											<span
												class="block h-full rounded-full bg-brand"
												style="width: {Math.round(component.normalized * 100)}%"
											></span>
										</span>
										<span class="w-28 shrink-0 text-right text-[10px] font-medium text-ink-dim">
											{m.at_component_detail({
												raw: Number(component.raw).toFixed(1),
												points: component.contribution.toFixed(1)
											})}
										</span>
									</div>
								{/each}
								{#if row.note}
									<p class="pt-1 text-[10px] font-medium text-ink-dim">{row.note}</p>
								{/if}
							</div>
						{/if}
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<!-- ================= OVERRIDES ================= -->
	<div class="bento-card bento-card-static space-y-4">
		<h2 class={sectionTitle}>
			<Pin class="h-4 w-4 text-brand-fg" />
			{m.at_overrides_title()}
		</h2>
		<p class="text-[11px] font-medium text-ink-soft">{m.at_overrides_help()}</p>

		<form
			method="POST"
			action="?/addOverride"
			use:overrideSuper.enhance
			class="grid gap-3 rounded-2xl border-2 border-edge bg-panel p-3 md:grid-cols-6"
		>
			<div class="md:col-span-2">
				<InputComp
					form={overrideForm}
					errors={overrideErrors}
					name="creatorId"
					type="combo"
					label={m.at_override_creator()}
					items={creatorItems}
				/>
			</div>

			<InputComp
				form={overrideForm}
				errors={overrideErrors}
				name="kind"
				type="select"
				label={m.at_override_kind()}
				items={overrideKindItems}
			/>

			{#if $overrideForm.kind === 'pin'}
				<InputComp
					form={overrideForm}
					errors={overrideErrors}
					name="position"
					type="number"
					min={0}
					max={48}
					step={1}
					label={m.at_override_position()}
				/>
			{:else if $overrideForm.kind === 'boost'}
				<InputComp
					form={overrideForm}
					errors={overrideErrors}
					name="multiplier"
					type="number"
					min={0.1}
					max={5}
					step={0.1}
					label={m.at_override_multiplier()}
				/>
			{:else}
				<div class="space-y-1">
					<span class="block text-[11px] font-black text-ink">{m.at_override_effect()}</span>
					<p class="text-[10px] font-medium text-ink-dim">{m.at_kind_block_help()}</p>
				</div>
			{/if}

			<InputComp
				form={overrideForm}
				errors={overrideErrors}
				name="expiresAt"
				type="date"
				label={m.at_override_expires()}
				futureDays
			/>

			<div class="md:col-span-5">
				<InputComp
					form={overrideForm}
					errors={overrideErrors}
					name="note"
					label={m.at_override_note()}
					placeholder={m.at_override_note_placeholder()}
					max={300}
				/>
			</div>

			<div class="flex items-end">
				<button
					type="submit"
					class="w-full rounded-2xl border-2 border-edge bg-inverse py-2.5 text-xs font-black text-inverse-ink shadow-[3px_3px_0px_0px_rgb(var(--bento-shadow))] hover:bg-inverse-hover"
				>
					{m.at_override_add()}
				</button>
			</div>
		</form>

		{#if !data.overrides.length}
			<p class="py-4 text-center text-xs font-medium text-ink-dim">{m.at_override_none()}</p>
		{:else}
			<div class="space-y-2">
				{#each data.overrides as override (override.id)}
					{@const expired = override.expiresAt && new Date(override.expiresAt) < new Date()}
					<div
						class="flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-edge bg-surface p-3 {expired
							? 'opacity-50'
							: ''}"
					>
						<div class="flex items-center gap-3">
							<span
								class="flex h-8 w-8 items-center justify-center rounded-xl border-2 border-edge {override.kind ===
								'block'
									? 'bg-danger-soft text-danger-fg'
									: override.kind === 'boost'
										? 'bg-warn-soft text-warn-fg'
										: 'bg-info-soft text-info-fg'}"
							>
								{#if override.kind === 'block'}
									<Ban class="h-4 w-4" />
								{:else if override.kind === 'boost'}
									<Rocket class="h-4 w-4" />
								{:else}
									<Pin class="h-4 w-4" />
								{/if}
							</span>
							<div>
								<span class="block text-xs font-black text-ink">
									{override.fullName}
									<span class="text-[10px] font-bold text-ink-dim">
										· {kindLabel(override.kind)}
										{#if override.kind === 'pin' && override.position}
											· #{override.position}
										{:else if override.kind === 'boost'}
											· ×{override.multiplier}
										{/if}
									</span>
								</span>
								<span class="block text-[10px] font-medium text-ink-dim">
									{override.note ?? ''}
									{#if override.expiresAt}
										· {expired
											? m.at_override_expired()
											: m.at_override_until({ date: day(override.expiresAt) })}
									{/if}
								</span>
							</div>
						</div>

						<form
							method="POST"
							action="?/removeOverride"
							use:enhance={handle(m.at_override_removed())}
						>
							<input type="hidden" name="id" value={override.id} />
							<button
								type="submit"
								class="flex items-center gap-1 rounded-xl border-2 border-edge bg-surface px-2.5 py-1.5 text-[10px] font-black text-ink hover:bg-danger-soft"
							>
								<Trash2 class="h-3 w-3" />
								{m.at_override_remove()}
							</button>
						</form>
					</div>
				{/each}
			</div>
		{/if}
	</div>

	<!-- ================= RESTING ================= -->
	{#if data.cooldowns.length}
		<div class="bento-card bento-card-static space-y-3">
			<h2 class={sectionTitle}>
				<TimerReset class="h-4 w-4 text-brand-fg" />
				{m.at_resting_title()}
			</h2>
			<p class="text-[11px] font-medium text-ink-soft">{m.at_resting_help()}</p>
			<div class="space-y-2">
				{#each data.cooldowns as rest (rest.creatorId)}
					<div
						class="flex items-center justify-between gap-3 rounded-2xl border-2 border-edge bg-surface p-3"
					>
						<span class="text-xs font-black text-ink">
							{rest.fullName}
							<span class="text-[10px] font-medium text-ink-dim">
								· {m.at_resting_until({ date: stamp(rest.restingUntil) })}
							</span>
						</span>
						<form
							method="POST"
							action="?/clearCooldown"
							use:enhance={handle(m.at_resting_cleared())}
						>
							<input type="hidden" name="id" value={rest.creatorId} />
							<button
								type="submit"
								class="rounded-xl border-2 border-edge bg-surface px-2.5 py-1.5 text-[10px] font-black text-ink hover:bg-brand-soft"
							>
								{m.at_resting_clear()}
							</button>
						</form>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<!-- ================= HISTORY ================= -->
	<div class="bento-card bento-card-static space-y-3">
		<h2 class={sectionTitle}>
			<History class="h-4 w-4 text-brand-fg" />
			{m.at_runs_title()}
		</h2>

		{#if !data.runs.length}
			<p class="py-4 text-center text-xs font-medium text-ink-dim">{m.at_runs_empty()}</p>
		{:else}
			<div class="overflow-x-auto">
				<table class="w-full min-w-[640px] text-left">
					<thead>
						<tr
							class="border-b-2 border-edge text-[10px] font-black tracking-widest text-ink-dim uppercase"
						>
							<th class="pb-2">{m.at_run_when()}</th>
							<th class="pb-2">{m.at_run_trigger()}</th>
							<th class="pb-2">{m.at_run_mode()}</th>
							<th class="pb-2">{m.at_run_entries()}</th>
							<th class="pb-2">{m.at_run_changed()}</th>
							<th class="pb-2">{m.at_run_by()}</th>
						</tr>
					</thead>
					<tbody>
						{#each data.runs as run (run.id)}
							<tr class="border-b border-edge-soft text-xs font-medium text-ink-soft">
								<td class="py-2 font-black text-ink">{stamp(run.createdAt)}</td>
								<td class="py-2">
									{run.trigger === 'auto'
										? m.at_trigger_auto()
										: run.trigger === 'settings'
											? m.at_trigger_settings()
											: m.at_trigger_manual()}
								</td>
								<td class="py-2">{modes.find((mode) => mode.key === run.mode)?.label}</td>
								<td class="py-2">{run.entryCount} / {run.candidateCount}</td>
								<td class="py-2">{run.changedCount}</td>
								<td class="py-2 text-[10px] text-ink-dim">{run.actorLabel ?? '—'}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</div>
</div>
