<script lang="ts">
	import { resolve } from '$app/paths';
	import {
		ArrowRight,
		ChartNoAxesColumn,
		BadgeCheck,
		Lock,
		UserCog,
		Percent,
		Gift,
		Banknote,
		ChevronDown
	} from '@lucide/svelte';
	import * as m from '$lib/paraglide/messages';
	import PageMeta from '$lib/components/page-meta.svelte';

	let { data } = $props();

	/* The fee and the contact address are operator settings, so they are read
	   rather than written into the copy — the same two the terms page reads. */
	const fee = $derived(
		data.settings?.commission
			? data.settings.commission.low === data.settings.commission.high
				? `${data.settings.commission.low}%`
				: `${data.settings.commission.low}–${data.settings.commission.high}%`
			: '8–15%'
	);
	const brandFee = $derived(`${data.settings?.commission?.brandServiceFeePercent ?? 5}%`);
	const email = $derived(data.settings?.supportEmail ?? 'support@influencerethiopia.com');

	/* Longer than the landing page's four steps: this is where a reader comes to
	   find out what the homepage only summarises, so it starts at sign-up. */
	const brandSteps = $derived([
		{ n: 1, title: m.hiw_brands_step1_title(), body: m.hiw_brands_step1_body() },
		{ n: 2, title: m.hiw_brands_step2_title(), body: m.hiw_brands_step2_body() },
		{ n: 3, title: m.hiw_brands_step3_title(), body: m.hiw_brands_step3_body() },
		{ n: 4, title: m.hiw_brands_step4_title(), body: m.hiw_brands_step4_body() },
		{ n: 5, title: m.hiw_brands_step5_title(), body: m.hiw_brands_step5_body() }
	]);

	/* Claiming comes first: most creators arrive to a profile that already
	   exists, imported before they signed up. */
	const creatorSteps = $derived([
		{ n: 1, title: m.hiw_creators_step1_title(), body: m.hiw_creators_step1_body() },
		{ n: 2, title: m.hiw_creators_step2_title(), body: m.hiw_creators_step2_body() },
		{ n: 3, title: m.hiw_creators_step3_title(), body: m.hiw_creators_step3_body() },
		{ n: 4, title: m.hiw_creators_step4_title(), body: m.hiw_creators_step4_body() },
		{ n: 5, title: m.hiw_creators_step5_title(), body: m.hiw_creators_step5_body() }
	]);

	/* The deal states in the order the booking machine walks them. Revision is
	   folded into "submitted", since it loops back rather than moving on. */
	const stages = $derived([
		{ key: 'proposed', title: m.hiw_stage_proposed(), body: m.hiw_stage_proposed_body() },
		{ key: 'negotiating', title: m.hiw_stage_negotiating(), body: m.hiw_stage_negotiating_body() },
		{ key: 'booked', title: m.hiw_stage_booked(), body: m.hiw_stage_booked_body() },
		{ key: 'production', title: m.hiw_stage_production(), body: m.hiw_stage_production_body() },
		{ key: 'submitted', title: m.hiw_stage_submitted(), body: m.hiw_stage_submitted_body() },
		{ key: 'approved', title: m.hiw_stage_approved(), body: m.hiw_stage_approved_body() },
		{ key: 'settlement', title: m.hiw_stage_settlement(), body: m.hiw_stage_settlement_body() },
		{ key: 'completed', title: m.hiw_stage_completed(), body: m.hiw_stage_completed_body() }
	]);

	const safeguards = $derived([
		{
			icon: ChartNoAxesColumn,
			title: m.hiw_trust_figures_title(),
			body: m.hiw_trust_figures_body()
		},
		{ icon: BadgeCheck, title: m.hiw_trust_badges_title(), body: m.hiw_trust_badges_body() },
		{ icon: Lock, title: m.hiw_trust_terms_title(), body: m.hiw_trust_terms_body() },
		{ icon: UserCog, title: m.hiw_trust_operators_title(), body: m.hiw_trust_operators_body() }
	]);

	const money = $derived([
		{ icon: Percent, title: m.hiw_money_fee_title({ fee }), body: m.hiw_money_fee_body() },
		{ icon: Gift, title: m.hiw_money_ways_title(), body: m.hiw_money_ways_body() },
		{ icon: Banknote, title: m.hiw_money_deposit_title(), body: m.hiw_money_deposit_body() }
	]);

	const faq = $derived([
		{ q: m.hiw_faq_imported_q(), a: m.hiw_faq_imported_a() },
		{ q: m.hiw_faq_unclaimed_q(), a: m.hiw_faq_unclaimed_a() },
		{ q: m.hiw_faq_cost_q(), a: m.hiw_faq_cost_a({ fee, brandFee }) },
		{ q: m.hiw_faq_dispute_q(), a: m.hiw_faq_dispute_a() },
		{ q: m.hiw_faq_language_q(), a: m.hiw_faq_language_a() }
	]);

	/* Also a schema.org FAQPage, so a search result can show the answers. */
	const faqJsonLd = $derived({
		'@context': 'https://schema.org',
		'@type': 'FAQPage',
		mainEntity: faq.map((item) => ({
			'@type': 'Question',
			name: item.q,
			acceptedAnswer: { '@type': 'Answer', text: item.a }
		}))
	});

	const eyebrow = 'text-xs font-black tracking-widest uppercase';
</script>

<PageMeta
	title={m.hiw_meta_title()}
	description={m.hiw_meta_description()}
	path="/how-it-works"
	jsonLd={faqJsonLd}
/>

<div class="mx-auto max-w-7xl space-y-12 px-4 py-10 sm:space-y-16 sm:px-6 sm:py-14 lg:px-8">
	<!-- ================= INTRO ================= -->
	<header class="max-w-3xl space-y-4">
		<span class="{eyebrow} text-brand-soft-fg">{m.hiw_eyebrow()}</span>
		<h1 class="text-3xl font-black text-ink sm:text-4xl">{m.hiw_title()}</h1>
		<p class="text-sm leading-relaxed font-medium text-ink-soft sm:text-base">{m.hiw_intro()}</p>

		<div class="flex flex-wrap gap-3 pt-2">
			<a
				href="#brands"
				class="rounded-2xl border-2 border-edge bg-inverse px-5 py-3 text-xs font-black text-inverse-ink shadow-[2px_2px_0px_0px_rgb(var(--bento-shadow))] transition-all hover:bg-inverse-hover"
			>
				{m.hiw_jump_brands()}
			</a>
			<a
				href="#creators"
				class="rounded-2xl border-2 border-edge bg-brand px-5 py-3 text-xs font-black text-brand-ink-deep shadow-[2px_2px_0px_0px_rgb(var(--bento-shadow))] transition-all hover:bg-brand-strong"
			>
				{m.hiw_jump_creators()}
			</a>
		</div>
	</header>

	<!-- ================= THE TWO SIDES ================= -->
	<!-- Side by side and equal: neither side is the other's customer. -->
	<section class="grid grid-cols-1 gap-8 lg:grid-cols-2">
		<div id="brands" class="bento-card-dark scroll-mt-24 space-y-6 sm:scroll-mt-28">
			<span
				class="{eyebrow} inline-block rounded-full border border-edge-mid bg-inverse-hover px-3 py-1 text-inverse-brand"
			>
				{m.hiw_brands_eyebrow()}
			</span>
			<h2 class="text-2xl font-black text-inverse-ink sm:text-3xl">{m.hiw_brands_title()}</h2>

			<ol class="space-y-5">
				{#each brandSteps as step (step.n)}
					<li class="flex gap-4">
						<span
							class="flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl border border-inverse-ink bg-brand text-xs font-black text-brand-ink-deep"
						>
							{step.n}
						</span>
						<div>
							<h3 class="text-sm font-black text-inverse-ink">{step.title}</h3>
							<p class="mt-1 text-xs leading-relaxed text-inverse-ink-dim">{step.body}</p>
						</div>
					</li>
				{/each}
			</ol>

			<a
				href={resolve('/register?role=business')}
				class="block w-full rounded-2xl border-2 border-edge bg-brand py-3.5 text-center text-xs font-black text-brand-ink-deep shadow-[2px_2px_0px_0px_rgba(255,255,255,1)] transition-all hover:bg-brand-strong"
			>
				{m.hiw_brands_cta()}
			</a>
		</div>

		<div id="creators" class="bento-card-mint scroll-mt-24 space-y-6 sm:scroll-mt-28">
			<span
				class="{eyebrow} inline-block rounded-full border border-edge bg-surface px-3 py-1 text-brand-soft-fg"
			>
				{m.hiw_creators_eyebrow()}
			</span>
			<h2 class="text-2xl font-black text-ink sm:text-3xl">{m.hiw_creators_title()}</h2>

			<ol class="space-y-5">
				{#each creatorSteps as step (step.n)}
					<li class="flex gap-4">
						<span
							class="flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl border border-edge bg-inverse text-xs font-black text-inverse-ink"
						>
							{step.n}
						</span>
						<div>
							<h3 class="text-sm font-black text-ink">{step.title}</h3>
							<p class="mt-1 text-xs leading-relaxed font-medium text-ink">{step.body}</p>
						</div>
					</li>
				{/each}
			</ol>

			<a
				href={resolve('/register?role=creator')}
				class="block w-full rounded-2xl border-2 border-edge bg-inverse py-3.5 text-center text-xs font-black text-inverse-ink shadow-[2px_2px_0px_0px_rgb(var(--bento-shadow))] transition-all hover:bg-inverse-hover"
			>
				{m.hiw_creators_cta()}
			</a>
		</div>
	</section>

	<!-- ================= THE LIFE OF A DEAL ================= -->
	<section class="space-y-6">
		<div class="max-w-3xl space-y-2">
			<span class="{eyebrow} text-brand-soft-fg">{m.hiw_deal_eyebrow()}</span>
			<h2 class="text-2xl font-black text-ink sm:text-3xl">{m.hiw_deal_title()}</h2>
			<p class="text-sm leading-relaxed font-medium text-ink-soft">{m.hiw_deal_body()}</p>
		</div>

		<ol class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
			{#each stages as stage, index (stage.key)}
				<li class="bento-card bento-card-static flex gap-3 p-4!">
					<span
						class="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border-2 border-edge text-[11px] font-black {index ===
						stages.length - 1
							? 'bg-brand text-brand-ink-deep'
							: 'bg-panel text-ink'}"
					>
						{index + 1}
					</span>
					<div>
						<h3 class="text-sm font-black text-ink">{stage.title}</h3>
						<p class="mt-0.5 text-xs leading-relaxed font-medium text-ink-soft">{stage.body}</p>
					</div>
				</li>
			{/each}
		</ol>
	</section>

	<!-- ================= WHAT KEEPS IT HONEST ================= -->
	<section class="space-y-6">
		<div class="max-w-3xl space-y-2">
			<span class="{eyebrow} text-brand-soft-fg">{m.hiw_trust_eyebrow()}</span>
			<h2 class="text-2xl font-black text-ink sm:text-3xl">{m.hiw_trust_title()}</h2>
		</div>

		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
			{#each safeguards as item (item.title)}
				<div class="bento-card bento-card-static space-y-2">
					<item.icon class="h-6 w-6 text-brand-strong" />
					<h3 class="text-base font-black text-ink">{item.title}</h3>
					<p class="text-sm leading-relaxed font-medium text-ink-soft">{item.body}</p>
				</div>
			{/each}
		</div>
	</section>

	<!-- ================= MONEY ================= -->
	<section class="space-y-6">
		<div class="max-w-3xl space-y-2">
			<span class="{eyebrow} text-brand-soft-fg">{m.hiw_money_eyebrow()}</span>
			<h2 class="text-2xl font-black text-ink sm:text-3xl">{m.hiw_money_title()}</h2>
		</div>

		<div class="grid grid-cols-1 gap-4 md:grid-cols-3">
			{#each money as item (item.title)}
				<div class="bento-card-yellow space-y-2">
					<item.icon class="h-6 w-6 text-ink" />
					<h3 class="text-base font-black text-ink">{item.title}</h3>
					<p class="text-sm leading-relaxed font-medium text-ink">{item.body}</p>
				</div>
			{/each}
		</div>
	</section>

	<!-- ================= FAQ ================= -->
	<section class="max-w-3xl space-y-6">
		<h2 class="text-2xl font-black text-ink sm:text-3xl">{m.hiw_faq_title()}</h2>

		<div class="space-y-3">
			{#each faq as item (item.q)}
				<details class="group rounded-2xl border-2 border-edge bg-surface">
					<summary
						class="flex cursor-pointer list-none items-center justify-between gap-4 p-4 text-sm font-black text-ink [&::-webkit-details-marker]:hidden"
					>
						{item.q}
						<ChevronDown
							class="h-4 w-4 shrink-0 text-ink-dim transition-transform group-open:rotate-180"
						/>
					</summary>
					<p class="px-4 pb-4 text-sm leading-relaxed font-medium text-ink-soft">{item.a}</p>
				</details>
			{/each}
		</div>

		<p class="text-xs font-bold text-ink-dim">{m.hiw_faq_more({ email })}</p>
	</section>

	<!-- ================= CTA ================= -->
	<section
		class="bento-card-dark flex flex-col gap-6 md:flex-row md:items-center md:justify-between"
	>
		<div class="space-y-2">
			<h2 class="text-2xl font-black text-inverse-ink">{m.hiw_cta_title()}</h2>
			<p class="text-sm font-medium text-inverse-ink-dim">{m.hiw_cta_body()}</p>
		</div>
		<div class="flex flex-wrap gap-3">
			<a
				href={resolve('/discover')}
				class="flex items-center gap-2 rounded-2xl border-2 border-edge bg-brand px-5 py-3 text-xs font-black text-brand-ink-deep transition-all hover:bg-brand-strong"
			>
				{m.hiw_cta_discover()}
				<ArrowRight class="h-4 w-4" />
			</a>
			<a
				href={resolve('/campaigns')}
				class="flex items-center gap-2 rounded-2xl border-2 border-inverse-ink px-5 py-3 text-xs font-black text-inverse-ink transition-all hover:bg-inverse-hover"
			>
				{m.hiw_cta_campaigns()}
			</a>
		</div>
	</section>
</div>
