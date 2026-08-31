<script lang="ts">
	import AppImage from '$lib/components/app-image.svelte';
	import { untrack } from 'svelte';
	import { resolve } from '$app/paths';
	import { superForm } from 'sveltekit-superforms';
	import * as m from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';
	import { toast } from 'svelte-sonner';
	import {
		MapPin,
		Star,
		Award,
		Check,
		Share2,
		ArrowLeft,
		CircleCheckBig,
		Hand,
		Loader
	} from '@lucide/svelte';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import VerificationBadge from '$lib/components/verification-badge.svelte';
	import RepresentationBadge from '$lib/components/representation-badge.svelte';
	import LoadingBtn from '$lib/formComponents/LoadingBtn.svelte';
	import Errors from '$lib/formComponents/Errors.svelte';
	import InputComp from '$lib/formComponents/InputComp.svelte';
	import { formatReach } from '$lib/domain/money';
	import { scoreWeights } from '$lib/domain/score';

	let { data } = $props();

	/** The currencies a direct booking may be denominated in. */
	const CURRENCY_ITEMS = ['ETB', 'KES', 'NGN', 'ZAR', 'GHS', 'RWF', 'EGP', 'AED', 'GBP', 'USD'].map(
		(code) => ({ value: code, name: code })
	);

	const creator = $derived(data.creator);

	let scoreOpen = $state(false);
	let bookingOpen = $state(false);
	let selectedPackageId = $state<number | null>(
		untrack(() => data.creator.packages[0]?.id ?? null)
	);

	const selectedPackage = $derived(
		creator.packages.find((p) => p.id === selectedPackageId) ?? creator.packages[0] ?? null
	);

	/*
	 * `untrack`, because a superform is seeded once and then owns its own state:
	 * re-reading `data.bookingForm` on every change would fight the store, and a
	 * fresh `SuperValidated` arriving mid-edit would discard what is being typed.
	 * A *navigation* to a different profile is the one case where re-seeding is
	 * right, and the effect below does it explicitly.
	 */
	const superform = superForm(
		untrack(() => data.bookingForm),
		{
			id: 'direct-booking',
			onUpdated: ({ form: result }) => {
				if (result.valid) bookingOpen = false;
			}
		}
	);
	const { form, errors, enhance, delayed, allErrors, message } = superform;

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
			$form.title = m.profile_custom_collaboration({ name: creator.fullName });
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
			toast.success(m.profile_link_copied());
		} catch {
			toast.error(m.profile_link_copy_failed());
		}
	};

	const dateLocale = $derived(getLocale() === 'am' ? 'am-ET' : 'en-GB');

	/* Averaged server-side over every review, not over the page on screen, so
	   the bars hold still as more reviews load. */
	const ratingRows = $derived([
		{ label: m.profile_rating_communication(), value: creator.ratingBreakdown.communication },
		{ label: m.profile_rating_quality(), value: creator.ratingBreakdown.quality },
		{ label: m.profile_rating_timeliness(), value: creator.ratingBreakdown.timeliness },
		{ label: m.profile_rating_compliance(), value: creator.ratingBreakdown.professionalism }
	]);

	/* The profile ships the first page of reviews; the rest are fetched only
	   when the reader asks for them. */
	type ProfileReview = Omit<(typeof data.creator.reviews)[number], 'createdAt'> & {
		createdAt: string | Date;
	};

	let extraReviews = $state<ProfileReview[]>([]);
	let loadingReviews = $state(false);

	/**
	 * Everything that has to forget when the reader moves to another profile.
	 *
	 * SvelteKit reuses this component across `/creators/a` → `/creators/b`: the
	 * props change, but a store created in `<script>` and a `$state` seeded from
	 * the first render do not. Without this, the second profile shows the first
	 * one's loaded reviews, the first one's chosen package, and a booking form
	 * still addressed to the first creator.
	 */
	let listedProfile = $state(untrack(() => data.creator.id));
	$effect(() => {
		if (creator.id === listedProfile) return;
		listedProfile = creator.id;
		extraReviews = [];
		selectedPackageId = creator.packages[0]?.id ?? null;
		bookingOpen = false;
		superform.reset({ data: data.bookingForm.data, newState: data.bookingForm.data });
	});

	const reviews: ProfileReview[] = $derived([...creator.reviews, ...extraReviews]);
	const hasMoreReviews = $derived(reviews.length < creator.reviewsCount);

	async function loadMoreReviews() {
		if (loadingReviews) return;
		loadingReviews = true;
		try {
			const response = await fetch(
				`/creators/${creator.username}/reviews?offset=${reviews.length}`
			);
			if (!response.ok) throw new Error(String(response.status));
			const page: { reviews: ProfileReview[] } = await response.json();
			extraReviews = [...extraReviews, ...page.reviews];
		} catch {
			toast.error(m.profile_reviews_load_failed());
		} finally {
			loadingReviews = false;
		}
	}
</script>

<svelte:head>
	<title>{m.profile_meta_title({ name: creator.fullName, username: creator.username })}</title>
	<meta name="description" content={creator.bio ?? ''} />
</svelte:head>

<div class="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
	<a
		href={resolve('/discover')}
		class="inline-flex items-center gap-1.5 rounded-lg border border-edge-soft bg-surface px-3 py-1.5 text-xs font-semibold text-ink-soft shadow-2xs hover:text-ink"
	>
		<ArrowLeft class="h-3.5 w-3.5" />
		{m.profile_back_to_discovery()}
	</a>

	<!-- ===== Header card ===== -->
	<div class="overflow-hidden rounded-3xl border border-edge-soft bg-surface shadow-sm">
		<div class="relative h-48 bg-well md:h-64">
			<AppImage
				src={creator.cover}
				alt=""
				kind="cover"
				seed={creator.username}
				class="h-full w-full object-cover"
				loading="lazy"
				decoding="async"
			/>
			<div class="absolute inset-0 bg-linear-to-t from-black/70 via-black/20 to-transparent"></div>

			<div class="absolute top-4 right-4 flex items-center gap-2">
				<button
					type="button"
					onclick={share}
					aria-label={m.profile_copy_link()}
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
				<span>{m.profile_creator_score({ score: creator.score })}</span>
			</button>
		</div>

		<div class="relative px-4 pt-0 pb-6 sm:px-6 md:px-8 md:pb-8">
			<div
				class="-mt-12 mb-6 flex flex-col justify-between gap-4 lg:-mt-16 lg:flex-row lg:items-end lg:gap-6"
			>
				<!--
					Stacked until `lg`, side by side above it.
					Sharing a row at 390px left the name about 150px to live in, and
					pushed it up onto the cover image — which is the only reason white
					type on it was ever legible. A creator with less to say under their
					name would have had it land on the card instead, white on white.
				-->
				<div class="flex flex-col items-start gap-3 lg:flex-row lg:items-end lg:gap-4">
					<div class="relative">
						<AppImage
							src={creator.avatar}
							alt={creator.fullName}
							kind="avatar"
							seed={creator.username}
							label={creator.fullName}
							class="h-24 w-24 rounded-3xl border-4 border-surface bg-surface object-cover shadow-md lg:h-32 lg:w-32"
							loading="lazy"
							decoding="async"
							width="96"
							height="96"
						/>
						<span
							class="absolute right-2 bottom-2 h-4 w-4 rounded-full border-2 border-surface {creator.availability ===
							'available'
								? 'bg-brand'
								: 'bg-warn'}"
						></span>
					</div>

					<div class="min-w-0 lg:mb-2">
						<div class="mb-2 flex flex-wrap items-center gap-2 lg:mb-4">
							<!-- White only where it sits on the cover: from `lg` the row rides
							     up onto the image, below it does not. -->
							<h1 class="text-xl font-extrabold text-ink lg:text-2xl lg:text-white">
								{creator.fullName}
							</h1>
							<VerificationBadge level={creator.verificationLevel} />
							<RepresentationBadge claimed={creator.isClaimed} />
						</div>
						<p class="text-xs font-medium text-ink-dim">@{creator.username}</p>
						<!-- The way the person this page describes takes it over. Hidden from
						     brands, who are the one audience it is certainly not for. -->
						{#if !creator.isClaimed && !data.canBook}
							<a
								href={resolve(`/dashboard/profile/claim?username=${creator.username}`)}
								class="mt-1 inline-flex items-center gap-1 rounded-lg border border-warn-edge bg-warn-soft px-2 py-0.5 text-[11px] font-bold text-warn-fg hover:bg-warn-soft"
							>
								<Hand class="h-3 w-3" />
								{m.profile_claim_cta()}
							</a>
						{/if}
						<div class="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-soft">
							<span
								class="inline-flex items-center gap-1 rounded-lg border border-edge-mid bg-well px-2 py-0.5 text-xs font-bold text-ink"
							>
								<span class="text-sm">{creator.country?.flag ?? '🌍'}</span>
								<span>{creator.country?.name ?? 'Ethiopia'}</span>
							</span>
							{#if creator.city}
								<span class="flex items-center gap-1 font-medium text-ink-soft">
									<MapPin class="h-3.5 w-3.5 text-brand-fg" />
									{creator.city}{creator.region ? `, ${creator.region.name}` : ''}
								</span>
							{/if}
							{#if creator.languages.length}
								<span>•</span>
								<span
									>{m.profile_languages({
										list: creator.languages.map((l) => l.name).join(', ')
									})}</span
								>
							{/if}
						</div>
					</div>
				</div>

				<!-- One full-width action on a phone, whichever of the three it is. -->
				<div class="flex w-full items-center gap-3 lg:w-auto">
					{#if data.canBook}
						<button
							type="button"
							onclick={() => openBooking(selectedPackage)}
							class="flex-1 rounded-2xl bg-brand px-6 py-3.5 text-xs font-bold text-brand-ink shadow-md shadow-brand/20 transition-colors hover:bg-brand-strong lg:flex-none lg:py-3"
						>
							{m.profile_book_creator()}
						</button>
					{:else if data.user}
						<span
							class="flex-1 rounded-2xl bg-well px-4 py-3.5 text-center text-xs font-bold text-ink-soft lg:flex-none lg:py-3"
						>
							{m.profile_brand_accounts_only()}
						</span>
					{:else}
						<a
							href={resolve(`/login?next=/creators/${creator.username}`)}
							class="flex-1 rounded-2xl bg-brand px-6 py-3.5 text-center text-xs font-bold text-brand-ink shadow-md shadow-brand/20 transition-colors hover:bg-brand-strong lg:flex-none lg:py-3"
						>
							{m.profile_sign_in_to_book()}
						</a>
					{/if}
				</div>
			</div>

			<p class="mb-6 max-w-3xl text-sm leading-relaxed text-ink-soft">{creator.bio}</p>

			<div class="mb-8 flex flex-wrap gap-2">
				{#each creator.categories as category (category.id)}
					<span class="rounded-xl bg-well px-3 py-1 text-xs font-semibold text-ink">
						{category.name}
					</span>
				{/each}
			</div>

			<div
				class="grid grid-cols-2 gap-4 rounded-2xl border border-edge-soft bg-panel p-4 md:grid-cols-4"
			>
				<div>
					<span class="block text-[10px] font-bold tracking-wider text-ink-faint uppercase">
						{m.profile_total_reach()}
					</span>
					<span class="text-lg font-extrabold text-ink">
						{creator.totalReach.toLocaleString()}
					</span>
				</div>
				<div>
					<span class="block text-[10px] font-bold tracking-wider text-ink-faint uppercase">
						{m.profile_primary_channel()}
					</span>
					<span class="text-lg font-extrabold text-brand-soft-fg">
						{creator.platform?.name ?? '—'}
					</span>
				</div>
				<div>
					<span class="block text-[10px] font-bold tracking-wider text-ink-faint uppercase">
						{m.profile_average_rating()}
					</span>
					<span class="flex items-center gap-1 text-lg font-extrabold text-ink">
						<Star class="h-4 w-4 fill-warn text-warn" />
						{creator.averageRating.toFixed(1)} ({creator.reviewsCount})
					</span>
				</div>
				<div>
					<span class="block text-[10px] font-bold tracking-wider text-ink-faint uppercase">
						{m.profile_completed_campaigns()}
					</span>
					<span class="text-lg font-extrabold text-ink">{creator.completedBookings}</span>
				</div>
			</div>
		</div>
	</div>

	<!-- ===== Channels ===== -->
	{#if creator.socialAccounts.length}
		<div class="space-y-3">
			<h2 class="text-base font-black tracking-wider text-ink uppercase">
				{m.profile_channels()}
			</h2>
			<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{#each creator.socialAccounts as account (account.id)}
					<div class="bento-card bento-card-static p-4">
						<div class="mb-2 flex items-center justify-between">
							<span class="text-sm font-black text-ink">{account.platformName}</span>
							{#if account.isVerified}
								<span
									class="inline-flex items-center gap-1 rounded-md bg-brand-soft px-2 py-0.5 text-[10px] font-bold text-brand-soft-fg"
								>
									<CircleCheckBig class="h-3 w-3" />
									{m.profile_ownership_confirmed()}
								</span>
							{/if}
						</div>
						<p class="text-xs font-bold text-ink-dim">{account.handle}</p>
						<div
							class="mt-3 flex items-center justify-between border-t border-edge-soft pt-3 text-xs"
						>
							<div>
								<span class="block text-[9px] font-black tracking-wider text-ink-dim uppercase">
									{m.profile_followers()}
								</span>
								<span class="font-black text-ink">{formatReach(account.followers)}</span>
							</div>
							<div class="text-right">
								<span class="block text-[9px] font-black tracking-wider text-ink-dim uppercase">
									{m.profile_engagement()}
								</span>
								<span class="font-black text-brand-soft-fg"
									>{account.engagementRate.toFixed(1)}%</span
								>
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
			<h2 class="flex items-center gap-2 text-base font-bold text-ink">
				<span>{m.profile_packages_pricing()}</span>
				<span
					class="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-semibold text-brand-soft-fg"
				>
					{m.profile_packages_available({ count: creator.packages.length })}
				</span>
			</h2>

			<div class="space-y-4">
				{#each creator.packages as pkg (pkg.id)}
					<!--
						Two controls, not one inside the other. Choosing a package and
						booking it used to be a `role="button"` span nested in a real
						`<button>` — invalid, and only kept apart by `stopPropagation`
						on a tap that a finger can land on either of.
					-->
					<div
						class="rounded-2xl border p-5 transition-all {selectedPackageId === pkg.id
							? 'border-brand-edge bg-brand-soft/40 shadow-xs ring-2 ring-brand/20'
							: 'border-edge-soft bg-surface hover:border-edge-mid'}"
					>
						<button
							type="button"
							onclick={() => (selectedPackageId = pkg.id)}
							aria-pressed={selectedPackageId === pkg.id}
							class="w-full cursor-pointer text-left"
						>
							<div class="mb-2 flex items-start justify-between gap-2">
								<h3 class="text-sm font-bold text-ink">{pkg.title}</h3>
								{#if pkg.platformName}
									<span
										class="shrink-0 rounded-md bg-brand-soft px-2 py-0.5 text-xs font-bold text-brand-soft-fg"
									>
										{pkg.platformName}
									</span>
								{/if}
							</div>

							{#if pkg.description}
								<p class="mb-3 text-xs text-ink-soft">{pkg.description}</p>
							{/if}

							<div class="mb-4 space-y-1.5 text-xs text-ink-soft">
								{#each pkg.deliverables ?? [] as item (item)}
									<div class="flex items-center gap-2">
										<Check class="h-3.5 w-3.5 shrink-0 text-brand-fg" />
										<span>{item}</span>
									</div>
								{/each}
							</div>

							<div class="flex items-center justify-between border-t border-edge-soft pt-3">
								<div>
									<span class="block text-[10px] font-medium text-ink-faint uppercase"
										>{m.profile_turnaround()}</span
									>
									<span class="text-xs font-semibold text-ink">
										{m.profile_turnaround_value({
											days: pkg.deliveryDays,
											revisions: pkg.revisions
										})}
									</span>
								</div>
								<div class="text-right">
									<span class="block text-[10px] font-medium text-ink-faint uppercase"
										>{m.profile_price()}</span
									>
									<span class="text-base font-extrabold text-ink">
										{pkg.price.toLocaleString()}
										{pkg.currencyCode}
									</span>
								</div>
							</div>
						</button>

						{#if data.canBook}
							<button
								type="button"
								onclick={() => openBooking(pkg)}
								class="mt-4 block w-full cursor-pointer rounded-xl bg-inverse py-3 text-center text-xs font-bold text-inverse-ink transition-colors hover:bg-brand"
							>
								{m.profile_book_package()}
							</button>
						{/if}
					</div>
				{:else}
					<div class="rounded-2xl border border-dashed border-edge-soft bg-panel p-6 text-center">
						<p class="text-xs font-medium text-ink-dim">
							{m.profile_no_packages()}
						</p>
					</div>
				{/each}
			</div>
		</div>

		<div class="space-y-8 lg:col-span-2">
			{#if creator.portfolio.length}
				<div>
					<h2 class="mb-4 text-base font-black tracking-wider text-ink uppercase">
						{m.profile_recent_work()}
					</h2>
					<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
						{#each creator.portfolio as item (item.id)}
							<div
								class="group overflow-hidden rounded-2xl border border-edge-soft bg-surface shadow-2xs"
							>
								<div class="relative h-44 bg-well">
									<AppImage
										src={item.url}
										alt={item.caption ?? ''}
										kind="media"
										seed={`${creator.username}-${item.id}`}
										loading="lazy"
										class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
										decoding="async"
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
									<p class="line-clamp-1 text-xs font-semibold text-ink">{item.caption}</p>
									<div class="mt-2 flex items-center justify-between text-[11px] text-ink-dim">
										<span>👁 {item.views.toLocaleString()} {m.profile_views()}</span>
										<span>❤️ {item.likes.toLocaleString()} {m.profile_likes()}</span>
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
					<h2 class="text-base font-black tracking-wider text-ink uppercase">
						{m.profile_client_reviews()}
					</h2>
					<span
						class="flex items-center gap-1.5 rounded-xl border border-warn-edge bg-warn-soft px-3 py-1 text-xs font-extrabold text-warn"
					>
						<Star class="h-4 w-4 fill-warn text-warn" />
						<span>{creator.averageRating.toFixed(1)} / 5.0 ({creator.reviewsCount})</span>
					</span>
				</div>

				{#if reviews.length}
					<div
						class="space-y-3 rounded-2xl bg-gradient-to-br from-slab to-slab-raised p-4 text-slab-ink shadow-md"
					>
						<div class="flex items-center justify-between border-b border-slab-edge pb-2">
							<span class="text-xs font-bold text-slab-ink-dim"
								>{m.profile_verified_brand_ratings()}</span
							>
							<span
								class="rounded-full border border-slab-brand/30 bg-slab-brand/20 px-2 py-0.5 text-[10px] font-bold text-slab-brand"
							>
								{m.profile_completed_bookings_only()}
							</span>
						</div>

						<!-- One column on a phone: at two, the label and its score each wrapped. -->
						<div class="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
							{#each ratingRows as row (row.label)}
								<div>
									<div
										class="mb-1 flex justify-between text-[11px] font-semibold text-slab-ink-dim"
									>
										<span>{row.label}</span>
										<span class="font-bold text-warn">{row.value.toFixed(1)} / 5.0</span>
									</div>
									<div class="h-1.5 w-full overflow-hidden rounded-full bg-slab-edge">
										<div
											class="h-full rounded-full bg-warn"
											style="width: {(row.value / 5) * 100}%"
										></div>
									</div>
								</div>
							{/each}
						</div>
					</div>

					<div class="space-y-3">
						{#each reviews as review (review.id)}
							<div
								class="space-y-3 rounded-2xl border border-edge-soft bg-surface p-4 shadow-xs transition-colors hover:border-edge-mid"
							>
								<div class="flex flex-wrap items-start justify-between gap-2">
									<div>
										<div class="flex flex-wrap items-center gap-2">
											<span class="text-xs font-extrabold text-ink">
												{review.organizationName}
											</span>
											<span
												class="flex items-center gap-1 rounded-md bg-brand-soft px-2 py-0.5 text-[10px] font-bold text-brand-soft-fg"
											>
												<CircleCheckBig class="h-3 w-3 text-brand-fg" />
												{m.profile_verified_client()}
											</span>
										</div>
										<span class="mt-0.5 block text-[10px] font-medium text-ink-faint">
											{new Date(review.createdAt).toLocaleDateString(dateLocale, {
												day: 'numeric',
												month: 'long',
												year: 'numeric'
											})}
										</span>
									</div>

									<div
										class="flex items-center gap-1 rounded-lg border border-warn-edge bg-warn-soft px-2 py-1 text-xs text-warn"
									>
										{#each Array(review.rating) as _, i (i)}
											<Star class="h-3.5 w-3.5 fill-warn" />
										{/each}
										<span class="ml-1 font-extrabold text-ink">{review.rating}.0</span>
									</div>
								</div>

								<p
									class="rounded-xl border border-edge-soft bg-panel p-3 text-xs leading-relaxed font-medium text-ink-soft"
								>
									"{review.body}"
								</p>

								<div class="flex flex-wrap gap-2 pt-1 text-[10px] font-bold text-ink-soft">
									<span class="rounded-lg bg-well px-2.5 py-1">💬 {review.communication}/5</span>
									<span class="rounded-lg bg-well px-2.5 py-1">✨ {review.quality}/5</span>
									<span class="rounded-lg bg-well px-2.5 py-1">⏱️ {review.timeliness}/5</span>
									<span class="rounded-lg bg-well px-2.5 py-1">💼 {review.professionalism}/5</span>
								</div>
							</div>
						{/each}
					</div>

					{#if hasMoreReviews}
						<div class="space-y-2 text-center">
							<button
								type="button"
								onclick={loadMoreReviews}
								disabled={loadingReviews}
								class="flex w-full items-center justify-center gap-2 rounded-2xl border border-edge-soft bg-surface py-3 text-xs font-bold text-ink shadow-xs transition-colors hover:border-edge-mid hover:bg-panel disabled:cursor-not-allowed disabled:opacity-60"
							>
								{#if loadingReviews}
									<Loader class="h-4 w-4 animate-spin" />
									<span class="animate-pulse">{m.profile_loading_reviews()}…</span>
								{:else}
									{m.profile_load_more_reviews()}
								{/if}
							</button>
							<p class="text-[10px] font-medium text-ink-faint">
								{m.profile_reviews_showing({
									shown: reviews.length,
									total: creator.reviewsCount
								})}
							</p>
						</div>
					{/if}
				{:else}
					<div
						class="space-y-2 rounded-2xl border border-dashed border-edge-soft bg-panel p-6 text-center"
					>
						<Star class="mx-auto h-8 w-8 text-ink-faint" />
						<p class="text-xs font-medium text-ink-dim">
							{m.profile_no_reviews()}
						</p>
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>

<!--
	The booking action, kept within reach.

	This page runs to about five thousand pixels on a phone, and every reason to
	book — the packages, the recent work, fifteen reviews — is below the one
	button that does it. Scrolling back to the top to act on what you have just
	read is the whole friction this removes. Desktop keeps the header button:
	there the page is shorter and the header is closer.
-->
{#if data.canBook || !data.user}
	<div
		class="sticky bottom-0 z-30 border-t-2 border-edge bg-surface/95 px-4 py-3 shadow-[0_-4px_12px_-6px_rgb(var(--bento-shadow)/0.4)] backdrop-blur-sm lg:hidden"
	>
		<div class="flex items-center gap-3">
			<div class="min-w-0">
				<span class="block text-[9px] font-black tracking-wider text-ink-dim uppercase">
					{m.starting_from()}
				</span>
				<span class="text-sm font-black whitespace-nowrap text-ink">
					{creator.startingPrice.toLocaleString()}
					<span class="text-xs text-brand-fg">{creator.currencyCode}</span>
				</span>
			</div>

			{#if data.canBook}
				<button
					type="button"
					onclick={() => openBooking(selectedPackage)}
					class="flex-1 rounded-2xl border-2 border-edge bg-brand px-4 py-3 text-xs font-black text-brand-ink shadow-[2px_2px_0px_0px_rgb(var(--bento-shadow))]"
				>
					{m.profile_book_creator()}
				</button>
			{:else}
				<a
					href={resolve(`/login?next=/creators/${creator.username}`)}
					class="flex-1 rounded-2xl border-2 border-edge bg-brand px-4 py-3 text-center text-xs font-black text-brand-ink shadow-[2px_2px_0px_0px_rgb(var(--bento-shadow))]"
				>
					{m.profile_sign_in_to_book()}
				</a>
			{/if}
		</div>
	</div>
{/if}

<!-- ===== Score explainer ===== -->
<Dialog.Root bind:open={scoreOpen}>
	<!--
		Capped and scrollable. Centred at its natural height, this dialog stood
		1014px tall in an 844px viewport and overflowed off both ends — and
		being `fixed`, nothing could scroll to what was cut off. On a phone the
		submit button was simply not reachable.
	-->
	<Dialog.Content class="max-h-[90dvh] w-lg! max-w-[95vw]! overflow-y-auto">
		<Dialog.Header>
			<Dialog.Title class="flex items-center gap-2 text-base font-bold">
				<Award class="h-5 w-5 text-brand-fg" />
				{m.profile_score_dialog_title()}
			</Dialog.Title>
		</Dialog.Header>

		<p class="text-xs leading-relaxed text-ink-soft">
			{m.profile_score_dialog_body()}
		</p>

		<div class="space-y-2.5 text-xs">
			{#each scoreWeights() as weight (weight.label)}
				<div
					class="flex items-center justify-between rounded-xl border border-edge-soft bg-panel p-3"
				>
					<span>{weight.label}</span>
					<span class="font-bold text-ink">{m.profile_score_weight({ weight: weight.weight })}</span
					>
				</div>
			{/each}
		</div>

		<button
			type="button"
			onclick={() => (scoreOpen = false)}
			class="w-full rounded-xl bg-brand py-2.5 text-xs font-bold text-brand-ink"
		>
			{m.profile_got_it()}
		</button>
	</Dialog.Content>
</Dialog.Root>

<!-- ===== Booking dialog ===== -->
<Dialog.Root bind:open={bookingOpen}>
	<Dialog.Content class="max-h-[90dvh] w-lg! max-w-[95vw]! overflow-y-auto">
		<Dialog.Header>
			<Dialog.Title class="text-base font-black"
				>{m.profile_book_dialog_title({ name: creator.fullName })}</Dialog.Title
			>
			<Dialog.Description class="text-xs font-medium text-ink-soft">
				{m.profile_book_dialog_body({ firstName: creator.fullName.split(' ')[0] })}
			</Dialog.Description>
		</Dialog.Header>

		<!-- Said before the offer is written, not after: what the brand is about
		     to open against an unclaimed profile is a lead, not a negotiation. -->
		{#if !creator.isClaimed}
			<p
				class="rounded-xl border-2 border-warn-edge bg-warn-soft p-3 text-[11px] font-medium text-ink"
			>
				{m.profile_book_intro_notice({ firstName: creator.fullName.split(' ')[0] })}
			</p>
		{/if}

		<form method="POST" action="?/book" use:enhance class="space-y-3 text-xs">
			<Errors allErrors={$allErrors} />

			<input type="hidden" name="creatorId" value={creator.id} />
			<input type="hidden" name="packageId" value={$form.packageId ?? ''} />
			<input type="hidden" name="compensationType" value={$form.compensationType} />

			<InputComp {form} {errors} name="title" label={m.profile_booking_title()} required />

			<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
				<InputComp {form} {errors} name="price" type="number" min="0" label={m.profile_offer()} />
				<InputComp
					{form}
					{errors}
					name="currencyCode"
					type="select"
					label={m.campaign_currency()}
					items={CURRENCY_ITEMS}
				/>
			</div>

			<InputComp
				{form}
				{errors}
				name="deliverables"
				type="textarea"
				rows={4}
				label={m.profile_deliverables_label()}
				hint={m.profile_one_per_line()}
			/>

			<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
				<InputComp
					{form}
					{errors}
					name="deadline"
					type="date"
					label={m.profile_deadline()}
					futureDays
				/>
				<InputComp
					{form}
					{errors}
					name="revisionsAllowed"
					type="number"
					min="0"
					max="10"
					label={m.profile_revisions_allowed()}
				/>
			</div>

			<InputComp
				{form}
				{errors}
				name="note"
				type="textarea"
				rows={3}
				label={m.profile_note_to_creator()}
				placeholder={m.profile_note_placeholder()}
			/>

			<button
				type="submit"
				disabled={$delayed}
				class="w-full rounded-2xl border-2 border-edge bg-brand py-3 font-black text-brand-ink shadow-[3px_3px_0px_0px_rgb(var(--bento-shadow))] hover:bg-brand-strong disabled:opacity-60"
			>
				{#if $delayed}
					<LoadingBtn name={m.profile_sending_proposal()} />
				{:else}
					{m.profile_send_proposal()}
				{/if}
			</button>
		</form>
	</Dialog.Content>
</Dialog.Root>
