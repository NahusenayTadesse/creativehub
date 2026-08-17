<script lang="ts">
	import { superForm } from 'sveltekit-superforms';
	import { toast } from 'svelte-sonner';
	import {
		ShieldCheck,
		MapPin,
		Star,
		Award,
		Check,
		X,
		Heart,
		Share2,
		ArrowLeft,
		CircleCheckBig
	} from '@lucide/svelte';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import VerificationBadge from '$lib/components/verification-badge.svelte';
	import LoadingBtn from '$lib/formComponents/LoadingBtn.svelte';
	import Errors from '$lib/formComponents/Errors.svelte';
	import { formatReach } from '$lib/domain/money';
	import { SCORE_WEIGHTS } from '$lib/domain/score';

	let { data } = $props();

	const creator = $derived(data.creator);

	let scoreOpen = $state(false);
	let bookingOpen = $state(false);
	let selectedPackageId = $state<number | null>(data.creator.packages[0]?.id ?? null);

	const selectedPackage = $derived(
		creator.packages.find((p) => p.id === selectedPackageId) ?? creator.packages[0] ?? null
	);

	const { form, errors, enhance, delayed, allErrors, message } = superForm(data.bookingForm, {
		id: 'direct-booking',
		onUpdated: ({ form: result }) => {
			if (result.valid) bookingOpen = false;
		}
	});

	$effect(() => {
		if ($message?.type === 'error') toast.error($message.text);
	});

	/** Prefills the booking dialog from whichever package was chosen. */
	function openBooking(pkg: (typeof creator.packages)[number] | null) {
		if (pkg) {
			selectedPackageId = pkg.id;
			$form.packageId = pkg.id;
			$form.title = `${pkg.title} — ${creator.fullName}`;
			$form.price = pkg.price;
			$form.currencyCode = pkg.currencyCode as typeof $form.currencyCode;
			$form.deliverables = (pkg.deliverables ?? []).join('\n');
			$form.revisionsAllowed = pkg.revisions;
		} else {
			$form.title = `Custom collaboration — ${creator.fullName}`;
			$form.price = creator.startingPrice;
			$form.currencyCode = creator.currencyCode as typeof $form.currencyCode;
			$form.deliverables = '';
		}
		$form.creatorId = creator.id;
		bookingOpen = true;
	}

	const share = async () => {
		try {
			await navigator.clipboard.writeText(window.location.href);
			toast.success('Profile link copied');
		} catch {
			toast.error('Could not copy the link');
		}
	};

	const avg = (key: 'communication' | 'quality' | 'timeliness' | 'professionalism') => {
		if (!creator.reviews.length) return 0;
		return creator.reviews.reduce((sum, r) => sum + (r[key] ?? r.rating), 0) / creator.reviews.length;
	};
</script>

<svelte:head>
	<title>{creator.fullName} (@{creator.username}) — Creator Network</title>
	<meta name="description" content={creator.bio ?? ''} />
</svelte:head>

<div class="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
	<a
		href="/discover"
		class="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 shadow-2xs hover:text-gray-900"
	>
		<ArrowLeft class="h-3.5 w-3.5" />
		Back to discovery
	</a>

	<!-- ===== Header card ===== -->
	<div class="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm">
		<div class="relative h-48 bg-gray-100 md:h-64">
			{#if creator.cover}
				<img src={creator.cover} alt="" class="h-full w-full object-cover" />
			{/if}
			<div class="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent"></div>

			<div class="absolute top-4 right-4 flex items-center gap-2">
				<button
					type="button"
					onclick={share}
					aria-label="Copy profile link"
					class="rounded-full bg-black/40 p-2.5 text-white backdrop-blur-md transition-colors hover:bg-black/60"
				>
					<Share2 class="h-4 w-4" />
				</button>
			</div>

			<button
				type="button"
				onclick={() => (scoreOpen = true)}
				class="absolute top-4 left-4 flex items-center gap-1.5 rounded-xl border border-white/20 bg-black/70 px-3 py-1.5 text-xs font-bold text-white backdrop-blur-md transition-colors hover:bg-black/90"
			>
				<Award class="h-4 w-4 text-emerald-400" />
				<span>Creator score: {creator.score}/100</span>
			</button>
		</div>

		<div class="relative px-6 pt-0 pb-8 md:px-8">
			<div class="mb-6 -mt-12 flex flex-col justify-between gap-6 md:-mt-16 md:flex-row md:items-end">
				<div class="flex items-end gap-4">
					<div class="relative">
						<img
							src={creator.avatar ?? ''}
							alt={creator.fullName}
							class="h-24 w-24 rounded-3xl border-4 border-white bg-white object-cover shadow-md md:h-32 md:w-32"
						/>
						<span
							class="absolute right-2 bottom-2 h-4 w-4 rounded-full border-2 border-white {creator.availability ===
							'available'
								? 'bg-emerald-500'
								: 'bg-amber-500'}"
						></span>
					</div>

					<div class="mb-2">
						<div class="flex flex-wrap items-center gap-2">
							<h1 class="text-xl font-extrabold text-gray-900 md:text-2xl">{creator.fullName}</h1>
							<VerificationBadge level={creator.verificationLevel} />
						</div>
						<p class="text-xs font-medium text-gray-500">@{creator.username}</p>
						<div class="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-600">
							<span
								class="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-800"
							>
								<span class="text-sm">{creator.country?.flag ?? '🌍'}</span>
								<span>{creator.country?.name ?? 'Ethiopia'}</span>
							</span>
							{#if creator.city}
								<span class="flex items-center gap-1 font-medium text-slate-700">
									<MapPin class="h-3.5 w-3.5 text-emerald-600" />
									{creator.city}{creator.region ? `, ${creator.region.name}` : ''}
								</span>
							{/if}
							{#if creator.languages.length}
								<span>•</span>
								<span>Languages: {creator.languages.map((l) => l.name).join(', ')}</span>
							{/if}
						</div>
					</div>
				</div>

				<div class="flex items-center gap-3">
					{#if data.canBook}
						<button
							type="button"
							onclick={() => openBooking(selectedPackage)}
							class="flex-1 rounded-2xl bg-emerald-600 px-6 py-3 text-xs font-bold text-white shadow-md shadow-emerald-600/20 transition-colors hover:bg-emerald-700 md:flex-none"
						>
							Book this creator
						</button>
					{:else if data.user}
						<span class="rounded-2xl bg-slate-100 px-4 py-3 text-xs font-bold text-slate-600">
							Brand accounts can book creators
						</span>
					{:else}
						<a
							href="/login?next=/creators/{creator.username}"
							class="rounded-2xl bg-emerald-600 px-6 py-3 text-xs font-bold text-white shadow-md shadow-emerald-600/20 transition-colors hover:bg-emerald-700"
						>
							Sign in to book
						</a>
					{/if}
				</div>
			</div>

			<p class="mb-6 max-w-3xl text-sm leading-relaxed text-gray-700">{creator.bio}</p>

			<div class="mb-8 flex flex-wrap gap-2">
				{#each creator.categories as category (category.id)}
					<span class="rounded-xl bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-800">
						{category.name}
					</span>
				{/each}
			</div>

			<div class="grid grid-cols-2 gap-4 rounded-2xl border border-gray-100 bg-gray-50 p-4 md:grid-cols-4">
				<div>
					<span class="block text-[10px] font-bold tracking-wider text-gray-400 uppercase">
						Total reach
					</span>
					<span class="text-lg font-extrabold text-gray-900">
						{creator.totalReach.toLocaleString()}
					</span>
				</div>
				<div>
					<span class="block text-[10px] font-bold tracking-wider text-gray-400 uppercase">
						Primary channel
					</span>
					<span class="text-lg font-extrabold text-emerald-700">
						{creator.platform?.name ?? '—'}
					</span>
				</div>
				<div>
					<span class="block text-[10px] font-bold tracking-wider text-gray-400 uppercase">
						Average rating
					</span>
					<span class="flex items-center gap-1 text-lg font-extrabold text-gray-900">
						<Star class="h-4 w-4 fill-amber-400 text-amber-400" />
						{creator.averageRating.toFixed(1)} ({creator.reviewsCount})
					</span>
				</div>
				<div>
					<span class="block text-[10px] font-bold tracking-wider text-gray-400 uppercase">
						Completed campaigns
					</span>
					<span class="text-lg font-extrabold text-gray-900">{creator.completedBookings}</span>
				</div>
			</div>
		</div>
	</div>

	<!-- ===== Channels ===== -->
	{#if creator.socialAccounts.length}
		<div class="space-y-3">
			<h2 class="text-base font-black tracking-wider text-slate-900 uppercase">Channels</h2>
			<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{#each creator.socialAccounts as account (account.id)}
					<div class="bento-card bento-card-static p-4">
						<div class="mb-2 flex items-center justify-between">
							<span class="text-sm font-black text-slate-900">{account.platformName}</span>
							{#if account.isVerified}
								<span
									class="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800"
								>
									<CircleCheckBig class="h-3 w-3" />
									Ownership confirmed
								</span>
							{/if}
						</div>
						<p class="text-xs font-bold text-slate-500">{account.handle}</p>
						<div class="mt-3 flex items-center justify-between border-t border-slate-200 pt-3 text-xs">
							<div>
								<span class="block text-[9px] font-black tracking-wider text-slate-500 uppercase">
									Followers
								</span>
								<span class="font-black text-slate-900">{formatReach(account.followers)}</span>
							</div>
							<div class="text-right">
								<span class="block text-[9px] font-black tracking-wider text-slate-500 uppercase">
									Engagement
								</span>
								<span class="font-black text-emerald-700">{account.engagementRate.toFixed(1)}%</span>
							</div>
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<!-- ===== Packages + portfolio ===== -->
	<div class="grid grid-cols-1 gap-8 lg:grid-cols-3">
		<div id="packages" class="space-y-4 lg:col-span-1">
			<h2 class="flex items-center gap-2 text-base font-bold text-gray-900">
				<span>Packages & pricing</span>
				<span class="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
					{creator.packages.length} available
				</span>
			</h2>

			<div class="space-y-4">
				{#each creator.packages as pkg (pkg.id)}
					<button
						type="button"
						onclick={() => (selectedPackageId = pkg.id)}
						class="w-full cursor-pointer rounded-2xl border p-5 text-left transition-all {selectedPackageId ===
						pkg.id
							? 'border-emerald-600 bg-emerald-50/40 shadow-xs ring-2 ring-emerald-600/20'
							: 'border-gray-200 bg-white hover:border-gray-300'}"
					>
						<div class="mb-2 flex items-start justify-between gap-2">
							<h3 class="text-sm font-bold text-gray-900">{pkg.title}</h3>
							{#if pkg.platformName}
								<span
									class="shrink-0 rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700"
								>
									{pkg.platformName}
								</span>
							{/if}
						</div>

						{#if pkg.description}
							<p class="mb-3 text-xs text-gray-600">{pkg.description}</p>
						{/if}

						<div class="mb-4 space-y-1.5 text-xs text-gray-700">
							{#each pkg.deliverables ?? [] as item (item)}
								<div class="flex items-center gap-2">
									<Check class="h-3.5 w-3.5 shrink-0 text-emerald-600" />
									<span>{item}</span>
								</div>
							{/each}
						</div>

						<div class="flex items-center justify-between border-t border-gray-200/60 pt-3">
							<div>
								<span class="block text-[10px] font-medium text-gray-400 uppercase">Turnaround</span>
								<span class="text-xs font-semibold text-gray-800">
									{pkg.deliveryDays} days · {pkg.revisions} revisions
								</span>
							</div>
							<div class="text-right">
								<span class="block text-[10px] font-medium text-gray-400 uppercase">Price</span>
								<span class="text-base font-extrabold text-gray-900">
									{pkg.price.toLocaleString()} {pkg.currencyCode}
								</span>
							</div>
						</div>

						{#if data.canBook}
							<span
								onclick={(e) => {
									e.stopPropagation();
									openBooking(pkg);
								}}
								onkeydown={(e) => {
									if (e.key === 'Enter') {
										e.stopPropagation();
										openBooking(pkg);
									}
								}}
								role="button"
								tabindex="0"
								class="mt-4 block w-full cursor-pointer rounded-xl bg-gray-900 py-2 text-center text-xs font-bold text-white transition-colors hover:bg-emerald-600"
							>
								Book this package
							</span>
						{/if}
					</button>
				{:else}
					<div class="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center">
						<p class="text-xs font-medium text-gray-500">
							This creator has not published packages yet.
						</p>
					</div>
				{/each}
			</div>
		</div>

		<div class="space-y-8 lg:col-span-2">
			{#if creator.portfolio.length}
				<div>
					<h2 class="mb-4 text-base font-black tracking-wider text-slate-900 uppercase">
						Recent work
					</h2>
					<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
						{#each creator.portfolio as item (item.id)}
							<div
								class="group overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-2xs"
							>
								<div class="relative h-44 bg-gray-100">
									<img
										src={item.url}
										alt={item.caption ?? ''}
										loading="lazy"
										class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
									/>
									{#if item.platformName}
										<span
											class="absolute top-2.5 left-2.5 rounded-md bg-black/60 px-2 py-0.5 text-[10px] font-bold text-white uppercase backdrop-blur-md"
										>
											{item.platformName}
										</span>
									{/if}
								</div>
								<div class="p-3">
									<p class="line-clamp-1 text-xs font-semibold text-gray-900">{item.caption}</p>
									<div class="mt-2 flex items-center justify-between text-[11px] text-gray-500">
										<span>👁 {item.views.toLocaleString()} views</span>
										<span>❤️ {item.likes.toLocaleString()} likes</span>
									</div>
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Reviews -->
			<div class="space-y-4">
				<div class="flex items-center justify-between">
					<h2 class="text-base font-black tracking-wider text-slate-900 uppercase">
						Client reviews
					</h2>
					<span
						class="flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-extrabold text-amber-600"
					>
						<Star class="h-4 w-4 fill-amber-400 text-amber-400" />
						<span>{creator.averageRating.toFixed(1)} / 5.0 ({creator.reviewsCount})</span>
					</span>
				</div>

				{#if creator.reviews.length}
					<div class="space-y-3 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 p-4 text-white shadow-md">
						<div class="flex items-center justify-between border-b border-slate-700/60 pb-2">
							<span class="text-xs font-bold text-slate-300">Verified brand ratings</span>
							<span
								class="rounded-full border border-emerald-500/30 bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300"
							>
								From completed bookings only
							</span>
						</div>

						<div class="grid grid-cols-2 gap-3 text-xs">
							{#each [{ label: '💬 Communication', key: 'communication' }, { label: '✨ Content quality', key: 'quality' }, { label: '⏱️ Timeliness', key: 'timeliness' }, { label: '💼 Brief compliance', key: 'professionalism' }] as row (row.key)}
								{@const value = avg(row.key as any)}
								<div>
									<div class="mb-1 flex justify-between text-[11px] font-semibold text-slate-300">
										<span>{row.label}</span>
										<span class="font-bold text-amber-400">{value.toFixed(1)} / 5.0</span>
									</div>
									<div class="h-1.5 w-full overflow-hidden rounded-full bg-slate-700">
										<div class="h-full rounded-full bg-amber-400" style="width: {(value / 5) * 100}%"></div>
									</div>
								</div>
							{/each}
						</div>
					</div>

					<div class="space-y-3">
						{#each creator.reviews as review (review.id)}
							<div
								class="space-y-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-xs transition-colors hover:border-gray-300"
							>
								<div class="flex items-start justify-between gap-2">
									<div>
										<div class="flex items-center gap-2">
											<span class="text-xs font-extrabold text-gray-900">
												{review.organizationName}
											</span>
											<span
												class="flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700"
											>
												<CircleCheckBig class="h-3 w-3 text-emerald-600" />
												Verified client
											</span>
										</div>
										<span class="mt-0.5 block text-[10px] font-medium text-gray-400">
											{new Date(review.createdAt).toLocaleDateString('en-GB', {
												day: 'numeric',
												month: 'long',
												year: 'numeric'
											})}
										</span>
									</div>

									<div
										class="flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-400"
									>
										{#each Array(review.rating) as _, i (i)}
											<Star class="h-3.5 w-3.5 fill-amber-400" />
										{/each}
										<span class="ml-1 font-extrabold text-slate-900">{review.rating}.0</span>
									</div>
								</div>

								<p
									class="rounded-xl border border-gray-100 bg-gray-50 p-3 text-xs leading-relaxed font-medium text-gray-700"
								>
									"{review.body}"
								</p>

								<div class="flex flex-wrap gap-2 pt-1 text-[10px] font-bold text-gray-600">
									<span class="rounded-lg bg-gray-100 px-2.5 py-1">💬 {review.communication}/5</span>
									<span class="rounded-lg bg-gray-100 px-2.5 py-1">✨ {review.quality}/5</span>
									<span class="rounded-lg bg-gray-100 px-2.5 py-1">⏱️ {review.timeliness}/5</span>
									<span class="rounded-lg bg-gray-100 px-2.5 py-1">💼 {review.professionalism}/5</span>
								</div>
							</div>
						{/each}
					</div>
				{:else}
					<div
						class="space-y-2 rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center"
					>
						<Star class="mx-auto h-8 w-8 text-gray-300" />
						<p class="text-xs font-medium text-gray-500">
							No reviews yet. Reviews can only be written after a booking completes.
						</p>
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>

<!-- ===== Score explainer ===== -->
<Dialog.Root bind:open={scoreOpen}>
	<Dialog.Content class="w-lg! max-w-[95vw]!">
		<Dialog.Header>
			<Dialog.Title class="flex items-center gap-2 text-base font-bold">
				<Award class="h-5 w-5 text-emerald-600" />
				How the creator score is calculated
			</Dialog.Title>
		</Dialog.Header>

		<p class="text-xs leading-relaxed text-gray-600">
			The score is derived from evidence the platform already holds. Nothing on a profile lets a
			creator set it directly.
		</p>

		<div class="space-y-2.5 text-xs">
			{#each SCORE_WEIGHTS as weight (weight.label)}
				<div
					class="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 p-3"
				>
					<span>{weight.label}</span>
					<span class="font-bold text-gray-900">{weight.weight}% weight</span>
				</div>
			{/each}
		</div>

		<button
			type="button"
			onclick={() => (scoreOpen = false)}
			class="w-full rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white"
		>
			Got it
		</button>
	</Dialog.Content>
</Dialog.Root>

<!-- ===== Booking dialog ===== -->
<Dialog.Root bind:open={bookingOpen}>
	<Dialog.Content class="w-lg! max-w-[95vw]!">
		<Dialog.Header>
			<Dialog.Title class="text-base font-black">Book {creator.fullName}</Dialog.Title>
			<Dialog.Description class="text-xs font-medium text-slate-600">
				This sends a proposal. Nothing is binding until {creator.fullName.split(' ')[0]} accepts —
				and terms freeze at that moment.
			</Dialog.Description>
		</Dialog.Header>

		<form method="POST" action="?/book" use:enhance class="space-y-3 text-xs">
			<Errors allErrors={$allErrors} />

			<input type="hidden" name="creatorId" value={creator.id} />
			<input type="hidden" name="packageId" value={$form.packageId ?? ''} />
			<input type="hidden" name="compensationType" value={$form.compensationType} />

			<div class="space-y-1.5">
				<label for="title" class="font-black text-slate-900">Booking title</label>
				<input
					id="title"
					name="title"
					bind:value={$form.title}
					required
					class="w-full rounded-xl border-2 border-slate-900 bg-white px-3 py-2 font-bold"
				/>
				{#if $errors.title}<p class="font-bold text-red-600">{$errors.title}</p>{/if}
			</div>

			<div class="grid grid-cols-2 gap-3">
				<div class="space-y-1.5">
					<label for="price" class="font-black text-slate-900">Offer</label>
					<input
						id="price"
						name="price"
						type="number"
						min="0"
						bind:value={$form.price}
						class="w-full rounded-xl border-2 border-slate-900 bg-white px-3 py-2 font-bold"
					/>
					{#if $errors.price}<p class="font-bold text-red-600">{$errors.price}</p>{/if}
				</div>
				<div class="space-y-1.5">
					<label for="currencyCode" class="font-black text-slate-900">Currency</label>
					<select
						id="currencyCode"
						name="currencyCode"
						bind:value={$form.currencyCode}
						class="w-full rounded-xl border-2 border-slate-900 bg-white px-3 py-2 font-bold"
					>
						{#each ['ETB', 'KES', 'NGN', 'ZAR', 'GHS', 'RWF', 'EGP', 'AED', 'GBP', 'USD'] as code (code)}
							<option value={code}>{code}</option>
						{/each}
					</select>
				</div>
			</div>

			<div class="space-y-1.5">
				<label for="deliverables" class="font-black text-slate-900">
					Deliverables <span class="font-medium text-slate-500">(one per line)</span>
				</label>
				<textarea
					id="deliverables"
					name="deliverables"
					rows="4"
					bind:value={$form.deliverables}
					class="w-full rounded-xl border-2 border-slate-900 bg-white px-3 py-2 font-medium"
				></textarea>
			</div>

			<div class="grid grid-cols-2 gap-3">
				<div class="space-y-1.5">
					<label for="deadline" class="font-black text-slate-900">Deadline</label>
					<input
						id="deadline"
						name="deadline"
						type="date"
						bind:value={$form.deadline}
						class="w-full rounded-xl border-2 border-slate-900 bg-white px-3 py-2 font-bold"
					/>
				</div>
				<div class="space-y-1.5">
					<label for="revisionsAllowed" class="font-black text-slate-900">Revisions allowed</label>
					<input
						id="revisionsAllowed"
						name="revisionsAllowed"
						type="number"
						min="0"
						max="10"
						bind:value={$form.revisionsAllowed}
						class="w-full rounded-xl border-2 border-slate-900 bg-white px-3 py-2 font-bold"
					/>
				</div>
			</div>

			<div class="space-y-1.5">
				<label for="note" class="font-black text-slate-900">Note to the creator</label>
				<textarea
					id="note"
					name="note"
					rows="3"
					bind:value={$form.note}
					placeholder="Anything that helps them decide — brand, audience, what good looks like."
					class="w-full rounded-xl border-2 border-slate-900 bg-white px-3 py-2 font-medium"
				></textarea>
			</div>

			<button
				type="submit"
				disabled={$delayed}
				class="w-full rounded-2xl border-2 border-slate-900 bg-emerald-600 py-3 font-black text-white shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] hover:bg-emerald-700 disabled:opacity-60"
			>
				{#if $delayed}
					<LoadingBtn name="Sending proposal" />
				{:else}
					Send booking proposal
				{/if}
			</button>
		</form>
	</Dialog.Content>
</Dialog.Root>
