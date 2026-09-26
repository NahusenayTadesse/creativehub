<script lang="ts">
	import { untrack } from 'svelte';
	import * as m from '$lib/paraglide/messages';
	import { superForm } from 'sveltekit-superforms';
	import { toast } from 'svelte-sonner';
	import { resolve } from '$app/paths';
	import PageHeader from '$lib/components/page-header.svelte';
	import InputComp from '$lib/formComponents/InputComp.svelte';
	import Errors from '$lib/formComponents/Errors.svelte';
	import LoadingBtn from '$lib/formComponents/LoadingBtn.svelte';
	import {
		ArrowDown,
		ArrowUp,
		ExternalLink,
		GalleryHorizontal,
		Handshake,
		Images,
		Tags
	} from '@lucide/svelte';
	import {
		SECTION_VISIBILITY_FIELD,
		heroHeadline,
		landingSectionMeta,
		type LandingSectionKey
	} from '$lib/domain/landing';

	let { data } = $props();

	const { form, errors, enhance, delayed, allErrors, message } = superForm(
		untrack(() => data.form)
	);

	$effect(() => {
		if (!$message) return;
		if ($message.type === 'error') toast.error($message.text);
		else toast.success($message.text);
	});

	const sectionMeta = $derived(landingSectionMeta());

	/* What the headline will read as, typed text or translated fallback — so the
	   empty fields do not look like an empty headline. */
	const headline = $derived(
		heroHeadline({
			heroTitle: $form.heroTitle,
			heroAccent: $form.heroAccent,
			heroTitleEnd: $form.heroTitleEnd
		})
	);

	/** Swaps a section with its neighbour. The hidden fields below follow. */
	function move(index: number, by: -1 | 1) {
		const order = [...$form.sectionOrder];
		const target = index + by;
		if (target < 0 || target >= order.length) return;
		[order[index], order[target]] = [order[target], order[index]];
		$form.sectionOrder = order;
	}

	const isShown = (key: LandingSectionKey) => Boolean($form[SECTION_VISIBILITY_FIELD[key]]);

	/* The platform's own channels, one URL and one count each. */
	const socials = $derived([
		{ label: 'Instagram', url: 'socialInstagramUrl', followers: 'socialInstagramFollowers' },
		{ label: 'TikTok', url: 'socialTiktokUrl', followers: 'socialTiktokFollowers' },
		{ label: 'Facebook', url: 'socialFacebookUrl', followers: 'socialFacebookFollowers' },
		{ label: 'YouTube', url: 'socialYoutubeUrl', followers: 'socialYoutubeFollowers' }
	] as const);

	const moveButton =
		'grid size-8 place-items-center rounded-xl border-2 border-edge bg-surface text-ink shadow-[2px_2px_0px_0px_rgb(var(--bento-shadow))] transition-colors hover:bg-brand-soft disabled:pointer-events-none disabled:opacity-30 disabled:shadow-none';
</script>

<svelte:head><title>{m.lp_meta_title()}</title></svelte:head>

<div class="mx-auto max-w-2xl space-y-6">
	<PageHeader
		eyebrow={m.dash_platform_operations()}
		title={m.lp_title()}
		description={m.lp_description()}
	/>

	<a
		href={resolve('/')}
		target="_blank"
		rel="noopener"
		class="inline-flex items-center gap-1.5 text-xs font-black text-brand-soft-fg underline underline-offset-2"
	>
		<ExternalLink class="h-3.5 w-3.5" />
		{m.lp_view_page()}
	</a>

	<form method="POST" action="?/save" use:enhance class="space-y-6">
		<Errors allErrors={$allErrors} />

		<!-- ---------------- Hero ---------------- -->
		<div class="bento-card bento-card-static space-y-3">
			<div>
				<h2 class="text-sm font-black text-ink">{m.lp_hero_heading()}</h2>
				<p class="mt-1 text-[11px] leading-relaxed font-medium text-ink-dim">
					{m.lp_hero_note()}
				</p>
			</div>

			<InputComp
				{form}
				{errors}
				label={m.lp_hero_title()}
				name="heroTitle"
				type="text"
				placeholder={m.hero_title()}
			/>
			<InputComp
				{form}
				{errors}
				label={m.lp_hero_accent()}
				name="heroAccent"
				type="text"
				placeholder={m.hero_title_accent()}
				hint={m.lp_hero_accent_hint()}
			/>
			<InputComp
				{form}
				{errors}
				label={m.lp_hero_title_end()}
				name="heroTitleEnd"
				type="text"
				hint={m.lp_hero_title_end_hint()}
			/>
			<InputComp
				{form}
				{errors}
				label={m.lp_hero_subtitle()}
				name="heroSubtitle"
				type="textarea"
				rows={3}
				placeholder={m.hero_subtitle()}
			/>

			<!-- The headline as a visitor will read it — on the same slab and with the
			     same accent the hero itself uses, so the preview cannot quietly drift
			     into showing colours the page never renders. -->
			<div
				class="relative overflow-hidden rounded-2xl border-2 border-edge bg-slab-raised p-4 shadow-[3px_3px_0px_0px_rgb(var(--bento-shadow))]"
			>
				<p class="relative text-[10px] font-black tracking-widest text-slab-ink-dim uppercase">
					{m.lp_preview()}
				</p>
				<p class="relative mt-1 text-lg leading-tight font-black text-slab-ink">
					{headline.title}
					{#if headline.accent}
						<span class="text-brand-gradient-slab">
							{headline.accent}
						</span>
					{/if}
					{headline.end}
				</p>
			</div>
		</div>

		<!-- ---------------- Hero photographs ---------------- -->
		<div class="bento-card bento-card-static space-y-4">
			<div>
				<h2 class="text-sm font-black text-ink">{m.lp_hero_photos_heading()}</h2>
				<p class="mt-1 text-[11px] leading-relaxed font-medium text-ink-dim">
					{m.lp_hero_photos_note()}
				</p>
			</div>

			<InputComp
				{form}
				{errors}
				label={m.lp_hero_interval()}
				name="heroIntervalSeconds"
				type="range"
				min={0}
				max={30}
				step={1}
				hint={m.lp_hero_interval_hint()}
				formatValue={(seconds) =>
					seconds ? m.lp_gallery_interval_value({ seconds }) : m.lp_gallery_interval_off()}
				className="h-2 appearance-none rounded-full border-2 border-edge bg-well"
			/>

			<a
				href={resolve('/dashboard/admin/hero')}
				class="flex items-center gap-3 rounded-2xl border-2 border-edge bg-surface p-3 shadow-[2px_2px_0px_0px_rgb(var(--bento-shadow))] transition-colors hover:bg-well"
			>
				<Images class="h-5 w-5 shrink-0 text-brand-fg" />
				<span class="min-w-0">
					<span class="block text-xs font-black text-ink">{m.lp_manage_hero_photos()}</span>
					<span class="block text-[11px] text-ink-dim">
						{data.heroSlideCount
							? m.lp_hero_photo_count({ count: data.heroSlideCount })
							: m.lp_hero_photo_default()}
					</span>
				</span>
			</a>
		</div>

		<!-- ---------------- The platform's own channels ---------------- -->
		<div class="bento-card bento-card-static space-y-4">
			<div>
				<h2 class="text-sm font-black text-ink">{m.lp_social_heading()}</h2>
				<p class="mt-1 text-[11px] leading-relaxed font-medium text-ink-dim">
					{m.lp_social_note()}
				</p>
			</div>

			{#each socials as social (social.url)}
				<div class="grid gap-3 sm:grid-cols-[1fr_10rem]">
					<InputComp
						{form}
						{errors}
						label={m.lp_social_url({ platform: social.label })}
						name={social.url}
						type="url"
						placeholder="https://"
					/>
					<InputComp
						{form}
						{errors}
						label={m.lp_social_followers()}
						name={social.followers}
						type="number"
						min={0}
						hint={m.lp_social_followers_hint()}
					/>
				</div>
			{/each}
		</div>

		<!-- ---------------- Sections ---------------- -->
		<div class="bento-card bento-card-static space-y-3">
			<div>
				<h2 class="text-sm font-black text-ink">{m.lp_sections_heading()}</h2>
				<p class="mt-1 text-[11px] leading-relaxed font-medium text-ink-dim">
					{m.lp_sections_note()}
				</p>
			</div>

			<ol class="space-y-2">
				{#each $form.sectionOrder as key, index (key)}
					{@const meta = sectionMeta[key]}
					<li
						class="flex items-center gap-3 rounded-2xl border-2 border-edge p-3 transition-opacity {isShown(
							key
						)
							? 'bg-surface'
							: 'bg-well opacity-70'}"
					>
						<!-- The order travels as one hidden field per section, top to bottom. -->
						<input type="hidden" name="sectionOrder" value={key} />

						<span
							class="grid size-7 shrink-0 place-items-center rounded-full border-2 border-edge bg-inverse text-[11px] font-black text-inverse-ink"
						>
							{index + 1}
						</span>

						<div class="min-w-0 flex-1">
							<p class="text-xs font-black text-ink">{meta.label}</p>
							<p class="text-[11px] leading-snug text-ink-dim">{meta.help}</p>
							<div class="mt-1 -ml-3">
								<InputComp
									{form}
									{errors}
									label={meta.label}
									labelHidden
									name={SECTION_VISIBILITY_FIELD[key]}
									type="checkboxSingle"
									placeholder={m.lp_section_shown()}
								/>
							</div>
						</div>

						<div class="flex shrink-0 flex-col gap-1.5">
							<button
								type="button"
								class={moveButton}
								onclick={() => move(index, -1)}
								disabled={index === 0}
								aria-label={m.lp_move_up({ section: meta.label })}
							>
								<ArrowUp class="h-4 w-4" />
							</button>
							<button
								type="button"
								class={moveButton}
								onclick={() => move(index, 1)}
								disabled={index === $form.sectionOrder.length - 1}
								aria-label={m.lp_move_down({ section: meta.label })}
							>
								<ArrowDown class="h-4 w-4" />
							</button>
						</div>
					</li>
				{/each}
			</ol>
		</div>

		<!-- ---------------- Gallery and tiles ---------------- -->
		<div class="bento-card bento-card-static space-y-4">
			<div>
				<h2 class="text-sm font-black text-ink">{m.lp_pictures_heading()}</h2>
				<p class="mt-1 text-[11px] leading-relaxed font-medium text-ink-dim">
					{m.lp_pictures_note()}
				</p>
			</div>

			<InputComp
				{form}
				{errors}
				label={m.lp_gallery_interval()}
				name="galleryIntervalSeconds"
				type="range"
				min={0}
				max={30}
				step={1}
				hint={m.lp_gallery_interval_hint()}
				formatValue={(seconds) =>
					seconds ? m.lp_gallery_interval_value({ seconds }) : m.lp_gallery_interval_off()}
				className="h-2 appearance-none rounded-full border-2 border-edge bg-well"
			/>

			<div class="grid gap-2 sm:grid-cols-2">
				<a
					href={resolve('/dashboard/admin/gallery')}
					class="flex items-center gap-3 rounded-2xl border-2 border-edge bg-surface p-3 shadow-[2px_2px_0px_0px_rgb(var(--bento-shadow))] transition-colors hover:bg-well"
				>
					<GalleryHorizontal class="h-5 w-5 shrink-0 text-brand-fg" />
					<span class="min-w-0">
						<span class="block text-xs font-black text-ink">{m.lp_manage_gallery()}</span>
						<span class="block text-[11px] text-ink-dim">
							{m.lp_slide_count({ count: data.slideCount })}
						</span>
					</span>
				</a>
				<a
					href={resolve('/dashboard/admin/categories')}
					class="flex items-center gap-3 rounded-2xl border-2 border-edge bg-surface p-3 shadow-[2px_2px_0px_0px_rgb(var(--bento-shadow))] transition-colors hover:bg-well"
				>
					<Tags class="h-5 w-5 shrink-0 text-brand-fg" />
					<span class="min-w-0">
						<span class="block text-xs font-black text-ink">{m.lp_manage_categories()}</span>
						<span class="block text-[11px] text-ink-dim">{m.lp_manage_categories_hint()}</span>
					</span>
				</a>
				<a
					href={resolve('/dashboard/admin/partners')}
					class="flex items-center gap-3 rounded-2xl border-2 border-edge bg-surface p-3 shadow-[2px_2px_0px_0px_rgb(var(--bento-shadow))] transition-colors hover:bg-well sm:col-span-2"
				>
					<Handshake class="h-5 w-5 shrink-0 text-brand-fg" />
					<span class="min-w-0">
						<span class="block text-xs font-black text-ink">{m.lp_manage_partners()}</span>
						<span class="block text-[11px] text-ink-dim">{m.lp_manage_partners_hint()}</span>
					</span>
				</a>
			</div>
		</div>

		<button
			type="submit"
			disabled={$delayed}
			class="w-full rounded-2xl border-2 border-edge bg-brand py-3 text-xs font-black text-brand-ink shadow-[3px_3px_0px_0px_rgb(var(--bento-shadow))] hover:bg-brand-strong disabled:opacity-60"
		>
			{#if $delayed}
				<LoadingBtn name={m.common_saving()} />
			{:else}
				{m.lp_save()}
			{/if}
		</button>
	</form>
</div>
