<script lang="ts">
	import { goto } from '$app/navigation';
	import {
		Search,
		ArrowRight,
		ShieldCheck,
		TrendingUp,
		Briefcase,
		Gift,
		Ticket,
		Star
	} from '@lucide/svelte';
	import CreatorCard from '$lib/components/creator-card.svelte';
	import DynamicIcon from '$lib/components/dynamic-icon.svelte';
	import { formatReach } from '$lib/domain/money';
	import * as m from '$lib/paraglide/messages';

	let { data } = $props();

	let query = $state('');

	const hero = $derived(data.featured[0] ?? data.trending[0] ?? null);

	const search = () => goto(`/discover${query ? `?q=${encodeURIComponent(query)}` : ''}`);
</script>

<svelte:head>
	<title>Creator Network — Ethiopia's creator marketplace</title>
	<meta
		name="description"
		content="Discover verified Ethiopian and Pan-African creators, agree terms that are recorded, and track delivery through to completion."
	/>
</svelte:head>

<div id="landing-page-view" class="space-y-16 pb-16">
	<!-- ================= HERO ================= -->
	<section class="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
		<div class="grid grid-cols-1 gap-6 lg:grid-cols-12">
			<div
				class="relative flex min-h-[460px] flex-col justify-between overflow-hidden rounded-3xl border-2 border-slate-900 bg-slate-900 p-8 text-white shadow-[6px_6px_0px_0px_rgba(15,23,42,1)] sm:p-10 lg:col-span-8"
			>
				<div class="relative z-10 space-y-6">
					<div
						class="inline-flex items-center gap-2 rounded-full border-2 border-slate-900 bg-[#dcfce7] px-4 py-1.5 text-xs font-black tracking-wider text-slate-900 uppercase shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]"
					>
						<ShieldCheck class="h-4 w-4 text-emerald-700" />
						<span>Ethiopia's managed creator marketplace</span>
					</div>

					<h1 class="text-3xl leading-[1.1] font-black tracking-tight sm:text-5xl">
						{m.hero_title()} <br />
						<span class="text-emerald-400">{m.hero_title_accent()}</span>
					</h1>

					<p class="max-w-xl text-sm leading-relaxed font-medium text-slate-300 sm:text-base">
						{data.settings?.heroSubtitle ?? m.hero_subtitle()}
					</p>

					<form
						onsubmit={(e) => {
							e.preventDefault();
							search();
						}}
						class="flex flex-col items-center gap-2 rounded-2xl border-2 border-slate-900 bg-white p-2 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] sm:flex-row"
					>
						<div class="flex w-full items-center gap-2 px-3 py-2 text-slate-900">
							<Search class="h-5 w-5 shrink-0 text-emerald-600" />
							<input
								type="text"
								bind:value={query}
								placeholder={m.search_placeholder()}
								class="w-full bg-transparent text-sm font-bold text-slate-900 placeholder-slate-400 focus:outline-none"
							/>
						</div>
						<button
							type="submit"
							class="w-full shrink-0 rounded-xl border-2 border-slate-900 bg-emerald-600 px-6 py-3 text-xs font-black text-white shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] transition-colors hover:bg-emerald-700 sm:w-auto"
						>
							{m.nav_discover()}
						</button>
					</form>

					<div class="flex flex-wrap items-center gap-3 pt-2">
						<a
							href="/campaigns"
							class="flex items-center gap-1.5 rounded-xl border-2 border-slate-900 bg-white px-5 py-2.5 text-xs font-black text-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] transition-all hover:bg-slate-100"
						>
							<span>View live campaign briefs</span>
							<ArrowRight class="h-4 w-4" />
						</a>
						<a
							href="/register"
							class="flex items-center gap-2 rounded-xl border-2 border-slate-900 bg-[#fef9c3] px-5 py-2.5 text-xs font-black text-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] transition-all hover:shadow-[3px_3px_0px_0px_rgba(15,23,42,1)]"
						>
							<span>Create an account</span>
						</a>
					</div>
				</div>

				<!-- Live figures, read from the database rather than written into the page -->
				<div class="relative z-10 mt-6 grid grid-cols-3 gap-4 border-t-2 border-slate-800 pt-6 text-xs">
					<div>
						<div class="text-xl font-black text-white sm:text-2xl">{data.stats.creators}</div>
						<div class="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
							Published creators
						</div>
					</div>
					<div>
						<div class="text-xl font-black text-emerald-400 sm:text-2xl">
							{formatReach(data.stats.totalReach)}
						</div>
						<div class="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
							Combined reach
						</div>
					</div>
					<div>
						<div class="text-xl font-black text-white sm:text-2xl">{data.stats.campaigns}</div>
						<div class="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
							Live campaigns
						</div>
					</div>
				</div>
			</div>

			<!-- Right column -->
			<div class="flex flex-col gap-6 lg:col-span-4">
				<div class="bento-card-mint flex flex-1 flex-col justify-between space-y-4">
					<div class="flex items-center justify-between">
						<span
							class="rounded-full border border-slate-900 bg-slate-900 px-2.5 py-1 text-[10px] font-black tracking-widest text-white uppercase"
						>
							Featured creator
						</span>
						{#if hero}
							<span
								class="flex items-center gap-1 rounded-full border border-slate-900 bg-white px-2 py-0.5 text-xs font-black text-slate-900"
							>
								<Star class="h-3 w-3 fill-amber-400 text-amber-500" />
								{hero.averageRating.toFixed(1)}
							</span>
						{/if}
					</div>

					{#if hero}
						<div class="flex items-center gap-3">
							<img
								src={hero.avatar ?? ''}
								alt={hero.fullName}
								class="h-14 w-14 rounded-2xl border-2 border-slate-900 object-cover shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]"
							/>
							<div class="min-w-0">
								<h3 class="text-base font-black text-slate-900">{hero.fullName}</h3>
								<p class="text-xs font-bold text-slate-700">@{hero.username}</p>
								{#if hero.categories?.[0]}
									<span
										class="mt-1 inline-block rounded border border-slate-900 bg-white px-2 py-0.5 text-[10px] font-black tracking-wider text-emerald-900 uppercase"
									>
										{hero.categories[0]}
									</span>
								{/if}
							</div>
						</div>

						<p class="line-clamp-2 text-xs leading-relaxed font-medium text-slate-800">
							"{hero.bio}"
						</p>

						<div
							class="flex items-center justify-between rounded-2xl border-2 border-slate-900 bg-white p-3 text-xs shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]"
						>
							<div>
								<span class="block text-[9px] font-black tracking-wider text-slate-500 uppercase">
									Reach
								</span>
								<span class="font-black text-slate-900">{formatReach(hero.totalReach)}</span>
							</div>
							<div>
								<span class="block text-[9px] font-black tracking-wider text-slate-500 uppercase">
									Score
								</span>
								<span class="font-black text-emerald-700">{hero.score}/100</span>
							</div>
							<a
								href="/creators/{hero.username}"
								class="rounded-xl border border-slate-900 bg-slate-900 px-3.5 py-1.5 text-xs font-black text-white shadow-[1px_1px_0px_0px_rgba(15,23,42,1)] hover:bg-slate-800"
							>
								View
							</a>
						</div>
					{/if}
				</div>

				<div class="bento-card-yellow space-y-2">
					<span class="block text-[10px] font-black tracking-widest text-slate-800 uppercase">
						How agreements work
					</span>
					<h4 class="text-base font-black text-slate-900">Terms are frozen when both sides agree</h4>
					<p class="text-xs font-medium text-slate-700">
						Scope, price, deadline and revision allowance are copied into an unchangeable record at
						the moment of agreement. Later edits to a profile or brief never rewrite a live deal.
					</p>
				</div>
			</div>
		</div>
	</section>

	<!-- ================= TRENDING ================= -->
	{#if data.trending.length}
		<section class="mx-auto max-w-7xl space-y-6 px-4 sm:px-6 lg:px-8">
			<div class="flex items-center justify-between">
				<div>
					<div class="flex items-center gap-2 text-xs font-bold tracking-wider text-emerald-600 uppercase">
						<TrendingUp class="h-4 w-4" />
						<span>Verified creator supply</span>
					</div>
					<h2 class="mt-1 text-xl font-extrabold text-gray-900 sm:text-2xl">Trending creators</h2>
				</div>

				<a
					href="/discover"
					class="flex items-center gap-1 text-xs font-bold text-emerald-700 hover:text-emerald-800"
				>
					<span>View all ({data.stats.creators})</span>
					<ArrowRight class="h-3.5 w-3.5" />
				</a>
			</div>

			<div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
				{#each data.trending.slice(0, 4) as creator (creator.id)}
					<CreatorCard {creator} />
				{/each}
			</div>
		</section>
	{/if}

	<!-- ================= CATEGORIES ================= -->
	<section class="mx-auto max-w-7xl space-y-6 px-4 sm:px-6 lg:px-8">
		<div class="mx-auto max-w-2xl space-y-2 text-center">
			<span class="text-xs font-black tracking-widest text-slate-500 uppercase">
				Targeted discovery
			</span>
			<h2 class="text-xl font-black text-slate-900 sm:text-3xl">Browse creators by category</h2>
			<p class="text-xs font-medium text-slate-600">
				Pick a category to narrow discovery to creators who already make this kind of work.
			</p>
		</div>

		<div class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
			{#each data.reference.categories as category (category.id)}
				<a
					href="/discover?category={category.slug}"
					class="bento-card group flex flex-col justify-between"
				>
					<div>
						<div
							class="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl border-2 border-slate-900 bg-slate-900 text-white shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] transition-colors group-hover:bg-emerald-600"
						>
							<DynamicIcon name={category.icon} class="h-5 w-5" />
						</div>
						<h3 class="text-sm font-black text-slate-900 transition-colors group-hover:text-emerald-600">
							{category.name}
						</h3>
						<p class="mt-1 line-clamp-2 text-[11px] leading-relaxed font-medium text-slate-600">
							{category.description}
						</p>
					</div>
				</a>
			{/each}
		</div>
	</section>

	<!-- ================= COMPENSATION MODELS ================= -->
	<section class="py-12">
		<div class="mx-auto max-w-7xl space-y-8 px-4 sm:px-6 lg:px-8">
			<div class="mx-auto max-w-2xl space-y-2 text-center">
				<span
					class="inline-block rounded-full border border-slate-900 bg-[#dcfce7] px-3 py-1 text-xs font-black tracking-widest text-emerald-700 uppercase"
				>
					Flexible compensation
				</span>
				<h2 class="text-xl font-black text-slate-900 sm:text-3xl">Three ways to pay a creator</h2>
				<p class="text-xs font-medium text-slate-600">
					Whether you hold a cash budget, a hotel with rooms to fill, or an event with passes to
					give — each model is tracked to fulfilment.
				</p>
			</div>

			<div class="grid grid-cols-1 gap-6 md:grid-cols-3">
				<div class="bento-card-mint space-y-3">
					<div
						class="flex h-12 w-12 items-center justify-center rounded-2xl border-2 border-slate-900 bg-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]"
					>
						<Briefcase class="h-6 w-6 text-emerald-400" />
					</div>
					<h3 class="text-lg font-black text-slate-900">1. Paid campaigns</h3>
					<p class="text-xs leading-relaxed font-medium text-slate-800">
						Agree a cash fee in any supported currency. The platform records the amount, the fee
						split and the settlement state separately from the delivery state.
					</p>
					<span
						class="inline-block rounded-lg border border-slate-900 bg-white px-2.5 py-1 text-[11px] font-black text-emerald-900"
					>
						15% marketplace fee
					</span>
				</div>

				<div class="bento-card-indigo space-y-3">
					<div
						class="flex h-12 w-12 items-center justify-center rounded-2xl border-2 border-slate-900 bg-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]"
					>
						<Ticket class="h-6 w-6 text-indigo-300" />
					</div>
					<h3 class="text-lg font-black text-slate-900">2. Event access</h3>
					<p class="text-xs leading-relaxed font-medium text-slate-800">
						Conferences, summits and festivals offer passes and access in exchange for agreed
						pre-event and live coverage. The pass itself is the compensation, and it is tracked.
					</p>
					<span
						class="inline-block rounded-lg border border-slate-900 bg-white px-2.5 py-1 text-[11px] font-black text-indigo-950"
					>
						Organiser-managed
					</span>
				</div>

				<div class="bento-card-yellow space-y-3">
					<div
						class="flex h-12 w-12 items-center justify-center rounded-2xl border-2 border-slate-900 bg-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]"
					>
						<Gift class="h-6 w-6 text-amber-300" />
					</div>
					<h3 class="text-lg font-black text-slate-900">3. Barter & product</h3>
					<p class="text-xs leading-relaxed font-medium text-slate-800">
						Hotels, resorts and product brands exchange stays or goods for coverage. What was
						promised and what proves it was delivered are both recorded.
					</p>
					<span
						class="inline-block rounded-lg border border-slate-900 bg-white px-2.5 py-1 text-[11px] font-black text-amber-950"
					>
						Micro & nano creator growth
					</span>
				</div>
			</div>
		</div>
	</section>

	<!-- ================= HOW IT WORKS ================= -->
	<section class="mx-auto max-w-7xl space-y-8 px-4 sm:px-6 lg:px-8">
		<div class="grid grid-cols-1 gap-8 lg:grid-cols-2">
			<div class="bento-card-dark space-y-6">
				<span
					class="inline-block rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-xs font-black tracking-widest text-emerald-400 uppercase"
				>
					For brands & organisations
				</span>
				<h2 class="text-2xl font-black text-white sm:text-3xl">Hire a creator in four steps</h2>

				<div class="space-y-4 text-xs">
					{#each [{ n: 1, title: 'Post a brief or book directly', body: 'Set the deliverables, the compensation model and the deadline. Or skip the brief and book a package straight from a profile.' }, { n: 2, title: 'Review pitches and negotiate', body: 'Shortlist applicants, counter on price or scope, and keep the whole exchange on one thread.' }, { n: 3, title: 'Agree terms — they freeze', body: 'When both sides confirm, the agreed scope, price, deadline and revision allowance are locked into the booking.' }, { n: 4, title: 'Approve the work, then settle', body: 'Request a revision with a reason, or approve. Compensation is marked fulfilled and both sides can review.' }] as step (step.n)}
						<div class="flex gap-4">
							<span
								class="flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl border border-white bg-emerald-500 font-black text-slate-950"
							>
								{step.n}
							</span>
							<div>
								<h4 class="text-sm font-black text-white">{step.title}</h4>
								<p class="mt-0.5 text-slate-300">{step.body}</p>
							</div>
						</div>
					{/each}
				</div>

				<a
					href="/register?role=business"
					class="block w-full rounded-2xl border-2 border-slate-900 bg-emerald-500 py-3.5 text-center text-xs font-black text-slate-950 shadow-[2px_2px_0px_0px_rgba(255,255,255,1)] transition-all hover:bg-emerald-400"
				>
					Post a campaign as a brand
				</a>
			</div>

			<div class="bento-card-mint space-y-6">
				<span
					class="inline-block rounded-full border border-slate-900 bg-white px-3 py-1 text-xs font-black tracking-widest text-emerald-950 uppercase"
				>
					For content creators
				</span>
				<h2 class="text-2xl font-black text-slate-900 sm:text-3xl">How creators get booked</h2>

				<div class="space-y-4 text-xs">
					{#each [{ n: 1, title: 'Build your media kit', body: 'Link your channels, publish your packages and set your rates in the currency you actually get paid in.' }, { n: 2, title: 'Get verified', body: 'Submit evidence once. Your badge names what was checked, so brands know exactly what it means.' }, { n: 3, title: 'Apply or accept direct bookings', body: 'Pitch on live briefs, or take direct package orders from brands who found you in discovery.' }, { n: 4, title: 'Deliver and get paid', body: 'Submit your link, respond to any revision request, and the completed campaign joins your public record.' }] as step (step.n)}
						<div class="flex gap-4">
							<span
								class="flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl border border-slate-900 bg-slate-900 font-black text-white"
							>
								{step.n}
							</span>
							<div>
								<h4 class="text-sm font-black text-slate-900">{step.title}</h4>
								<p class="mt-0.5 font-medium text-slate-800">{step.body}</p>
							</div>
						</div>
					{/each}
				</div>

				<a
					href="/register?role=creator"
					class="block w-full rounded-2xl border-2 border-slate-900 bg-slate-900 py-3.5 text-center text-xs font-black text-white shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] transition-all hover:bg-slate-800"
				>
					Join as a creator
				</a>
			</div>
		</div>
	</section>
</div>
