<script lang="ts">
	import { resolve } from '$app/paths';
	import * as m from '$lib/paraglide/messages';
	import { ShieldCheck, Heart, MapPin, Sparkles, CircleCheckBig } from '@lucide/svelte';

	let {
		categories = [],
		regions = []
	}: {
		categories?: { name: string; slug: string }[];
		regions?: { name: string; majorCities: string[] }[];
	} = $props();
</script>

<!--
	The footer is a slab: a band that stays dark in both themes. It exists to
	ground the page rather than to stand out on it, and a near-white block at the
	foot of a dark page reads as a lamp. Everything here is drawn from the
	--slab-* tokens, which barely move between themes.
-->
<footer id="main-footer" class="border-t border-slab-edge bg-slab py-12 text-xs text-slab-ink-dim">
	<div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
		<!-- Dual CTA -->
		<div
			class="mb-12 grid grid-cols-1 gap-6 rounded-2xl border border-slab-edge bg-slab-raised p-6 md:grid-cols-2"
		>
			<div class="space-y-2">
				<div class="flex items-center gap-2 font-semibold text-slab-brand">
					<Sparkles class="h-4 w-4" />
					<span>{m.footer_brands_eyebrow()}</span>
				</div>
				<h3 class="text-base font-bold text-slab-ink">{m.footer_brands_title()}</h3>
				<p class="text-xs leading-relaxed text-slab-ink-dim">
					{m.footer_brands_body()}
				</p>
				<a
					href={resolve('/register')}
					class="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-xs font-semibold text-brand-ink transition-colors hover:bg-brand-strong"
				>
					{m.footer_brands_cta()}
				</a>
			</div>

			<div class="space-y-2 md:border-l md:border-slab-edge md:pl-6">
				<div class="flex items-center gap-2 font-semibold text-slab-brand">
					<CircleCheckBig class="h-4 w-4" />
					<span>{m.footer_creators_eyebrow()}</span>
				</div>
				<h3 class="text-base font-bold text-slab-ink">{m.footer_creators_title()}</h3>
				<p class="text-xs leading-relaxed text-slab-ink-dim">
					{m.footer_creators_body()}
				</p>
				<a
					href={resolve('/register')}
					class="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-slab-edge px-4 py-2 text-xs font-semibold text-slab-ink transition-colors hover:bg-slab-raised"
				>
					{m.footer_creators_cta()}
				</a>
			</div>
		</div>

		<!-- Link grid -->
		<div class="mb-12 grid grid-cols-2 gap-8 md:grid-cols-4">
			<div>
				<h4 class="mb-3 text-sm font-semibold text-slab-ink">{m.footer_top_categories()}</h4>
				<ul class="space-y-2">
					{#each categories.slice(0, 5) as category (category.slug)}
						<li>
							<a
								href={resolve(`/discover?category=${category.slug}`)}
								class="transition-colors hover:text-slab-ink"
							>
								{category.name}
							</a>
						</li>
					{/each}
				</ul>
			</div>

			<div>
				<h4 class="mb-3 text-sm font-semibold text-slab-ink">{m.footer_regional_hubs()}</h4>
				<ul class="space-y-2">
					{#each regions.slice(0, 5) as region (region.name)}
						<li class="flex items-center gap-1.5">
							<MapPin class="h-3 w-3 shrink-0 text-slab-brand" />
							<span
								>{region.name}{region.majorCities?.[0] ? ` (${region.majorCities[0]})` : ''}</span
							>
						</li>
					{/each}
				</ul>
			</div>

			<div>
				<h4 class="mb-3 text-sm font-semibold text-slab-ink">{m.footer_campaign_models()}</h4>
				<!-- These four sit on the slab, which is dark in both themes, so their
				     colours are fixed rather than themed. -->
				<ul class="space-y-2">
					<li>
						<span class="font-medium text-slab-brand">{m.footer_model_paid()}</span>
						{m.footer_model_paid_note()}
					</li>
					<li><span class="font-medium text-blue-400">{m.footer_model_event()}</span></li>
					<li><span class="font-medium text-purple-400">{m.footer_model_barter()}</span></li>
					<li><span class="font-medium text-amber-400">{m.footer_model_ngo()}</span></li>
				</ul>
			</div>

			<div>
				<h4 class="mb-3 text-sm font-semibold text-slab-ink">{m.footer_payment_title()}</h4>
				<div class="space-y-2">
					<div class="flex items-center gap-2 text-slab-brand">
						<ShieldCheck class="h-4 w-4" />
						<span class="font-semibold text-slab-ink">{m.footer_payment_label()}</span>
					</div>
					<p class="text-[11px] text-slab-ink-dim">
						{m.footer_payment_body()}
					</p>
				</div>
			</div>
		</div>

		<div
			class="flex flex-col items-center justify-between gap-4 border-t border-slab-edge pt-8 md:flex-row"
		>
			<div class="flex items-center gap-2">
				<div
					class="flex h-6 w-6 items-center justify-center rounded-md bg-brand text-xs font-bold text-brand-ink"
				>
					ET
				</div>
				<span class="font-semibold text-slab-ink">{m.footer_brand_full()}</span>
				<span class="text-slab-ink-dim">|</span>
				<span class="text-slab-ink-dim">{m.footer_location()}</span>
			</div>

			<div class="flex flex-wrap items-center gap-x-4 gap-y-2 text-slab-ink-dim">
				<a href={resolve('/blog')} class="hover:text-slab-brand">{m.nav_blog()}</a>
				<a href={resolve('/terms')} class="hover:text-slab-brand">{m.footer_terms()}</a>
				<a href={resolve('/privacy')} class="hover:text-slab-brand">{m.footer_privacy()}</a>
				<span class="flex items-center gap-1">
					<span>{m.footer_built_for()}</span>
					<Heart class="inline h-3.5 w-3.5 fill-red-500 text-red-500" />
				</span>
			</div>
		</div>
	</div>
</footer>
