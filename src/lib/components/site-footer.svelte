<script lang="ts">
	import { ShieldCheck, Heart, MapPin, Sparkles, CircleCheckBig } from '@lucide/svelte';

	let {
		categories = [],
		regions = []
	}: {
		categories?: { name: string; slug: string }[];
		regions?: { name: string; majorCities: string[] }[];
	} = $props();
</script>

<footer id="main-footer" class="border-t border-gray-800 bg-gray-950 py-12 text-xs text-gray-400">
	<div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
		<!-- Dual CTA -->
		<div class="mb-12 grid grid-cols-1 gap-6 rounded-2xl border border-gray-800 bg-gray-900 p-6 md:grid-cols-2">
			<div class="space-y-2">
				<div class="flex items-center gap-2 font-semibold text-emerald-400">
					<Sparkles class="h-4 w-4" />
					<span>For brands, NGOs and event organisers</span>
				</div>
				<h3 class="text-base font-bold text-white">Hire verified creators with terms on record</h3>
				<p class="text-xs leading-relaxed text-gray-400">
					Post a brief or book a creator directly. Terms are frozen when both sides agree, and
					delivery is tracked through to completion.
				</p>
				<a
					href="/register"
					class="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-700"
				>
					Create a brand account
				</a>
			</div>

			<div class="space-y-2 md:border-l md:border-gray-800 md:pl-6">
				<div class="flex items-center gap-2 font-semibold text-emerald-400">
					<CircleCheckBig class="h-4 w-4" />
					<span>For content creators</span>
				</div>
				<h3 class="text-base font-bold text-white">Build a rate card brands can book</h3>
				<p class="text-xs leading-relaxed text-gray-400">
					Publish your packages, get discovered by Ethiopian and international brands, and keep a
					verified record of every campaign you complete.
				</p>
				<a
					href="/register"
					class="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-gray-700 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-gray-800"
				>
					Join as a creator
				</a>
			</div>
		</div>

		<!-- Link grid -->
		<div class="mb-12 grid grid-cols-2 gap-8 md:grid-cols-4">
			<div>
				<h4 class="mb-3 text-sm font-semibold text-white">Top categories</h4>
				<ul class="space-y-2">
					{#each categories.slice(0, 5) as category (category.slug)}
						<li>
							<a
								href="/discover?category={category.slug}"
								class="transition-colors hover:text-white"
							>
								{category.name}
							</a>
						</li>
					{/each}
				</ul>
			</div>

			<div>
				<h4 class="mb-3 text-sm font-semibold text-white">Regional hubs</h4>
				<ul class="space-y-2">
					{#each regions.slice(0, 5) as region (region.name)}
						<li class="flex items-center gap-1.5">
							<MapPin class="h-3 w-3 shrink-0 text-emerald-500" />
							<span>{region.name}{region.majorCities?.[0] ? ` (${region.majorCities[0]})` : ''}</span>
						</li>
					{/each}
				</ul>
			</div>

			<div>
				<h4 class="mb-3 text-sm font-semibold text-white">Campaign models</h4>
				<ul class="space-y-2">
					<li><span class="font-medium text-emerald-400">Paid campaigns</span> (cash budget)</li>
					<li><span class="font-medium text-blue-400">Event access passes</span></li>
					<li><span class="font-medium text-purple-400">Barter / product exchange</span></li>
					<li><span class="font-medium text-amber-400">NGO & public-sector campaigns</span></li>
				</ul>
			</div>

			<div>
				<h4 class="mb-3 text-sm font-semibold text-white">How payment works</h4>
				<div class="space-y-2">
					<div class="flex items-center gap-2 text-emerald-400">
						<ShieldCheck class="h-4 w-4" />
						<span class="font-semibold text-white">Recorded compensation</span>
					</div>
					<p class="text-[11px] text-gray-500">
						Every booking records what was agreed, what was delivered, and whether compensation has
						been fulfilled. Settlement is confirmed against that record before a booking can
						complete.
					</p>
				</div>
			</div>
		</div>

		<div
			class="flex flex-col items-center justify-between gap-4 border-t border-gray-900 pt-8 md:flex-row"
		>
			<div class="flex items-center gap-2">
				<div
					class="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-600 text-xs font-bold text-white"
				>
					ET
				</div>
				<span class="font-semibold text-white">Creator Network ET</span>
				<span class="text-gray-600">|</span>
				<span class="text-gray-500">Addis Ababa, Ethiopia</span>
			</div>

			<div class="flex items-center gap-1 text-gray-500">
				<span>Built for Ethiopia's creator economy</span>
				<Heart class="inline h-3.5 w-3.5 fill-red-500 text-red-500" />
			</div>
		</div>
	</div>
</footer>
