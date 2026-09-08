<script lang="ts">
	import { untrack } from 'svelte';
	import * as m from '$lib/paraglide/messages';
	import { superForm } from 'sveltekit-superforms';
	import { toast } from 'svelte-sonner';
	import PageHeader from '$lib/components/page-header.svelte';
	import InputComp from '$lib/formComponents/InputComp.svelte';
	import FileUpload from '$lib/formComponents/FileUpload.svelte';
	import Errors from '$lib/formComponents/Errors.svelte';
	import LoadingBtn from '$lib/formComponents/LoadingBtn.svelte';
	import { CircleAlert, RotateCcw } from '@lucide/svelte';
	import { resolveLogos } from '$lib/brand';

	let { data } = $props();

	const { form, errors, enhance, delayed, allErrors, message } = superForm(
		untrack(() => data.form)
	);

	$effect(() => {
		if (!$message) return;
		if ($message.type === 'error') toast.error($message.text);
		else toast.success($message.text);
	});

	/* What the site is drawing right now, uploads and fallbacks both resolved —
	   so the previews below are the marks a reader sees, not the columns. */
	const logos = $derived(resolveLogos(data.settings));

	/**
	 * The four slots, described once.
	 *
	 * `custom` is what decides whether a reset button appears: an empty column
	 * means the shipped mark is in use, and offering to reset that would be a
	 * button with nothing to do.
	 */
	const slots = $derived([
		{
			name: 'logoWordmark' as const,
			label: m.as_logo_wordmark(),
			hint: m.as_logo_wordmark_hint(),
			src: logos.wordmark,
			custom: Boolean(data.settings?.logoWordmark),
			/* Each preview sits on the ground the mark is actually drawn against,
			   because "does this logo work here" is the only question this panel
			   is being asked. */
			plate: 'bg-white'
		},
		{
			name: 'logoWordmarkDark' as const,
			label: m.as_logo_wordmark_dark(),
			hint: m.as_logo_wordmark_dark_hint(),
			src: logos.wordmarkDark,
			custom: Boolean(data.settings?.logoWordmarkDark),
			plate: 'bg-slab'
		},
		{
			name: 'logoMark' as const,
			label: m.as_logo_mark(),
			hint: m.as_logo_mark_hint(),
			src: logos.mark,
			custom: Boolean(data.settings?.logoMark),
			plate: 'bg-well'
		},
		{
			name: 'logoPartners' as const,
			label: m.as_logo_partners(),
			hint: m.as_logo_partners_hint(),
			src: logos.partners,
			custom: Boolean(data.settings?.logoPartners),
			plate: 'bg-white'
		}
	]);
</script>

<svelte:head><title>{m.as_meta_title()}</title></svelte:head>

<div class="mx-auto max-w-2xl space-y-6">
	<PageHeader
		eyebrow={m.dash_platform_operations()}
		title={m.as_title()}
		description={m.as_description()}
	/>

	<div class="bento-card-yellow flex items-start gap-2">
		<CircleAlert class="mt-0.5 h-4 w-4 shrink-0 text-warn-fg" />
		<p class="text-[11px] font-medium text-warn-fg">
			{m.as_fee_warning()}
		</p>
	</div>

	<div class="bento-card bento-card-static">
		<form method="POST" action="?/save" use:enhance enctype="multipart/form-data" class="space-y-2">
			<Errors allErrors={$allErrors} />
			{#if data.settings}
				<input type="hidden" name="id" value={data.settings.id} />
			{/if}

			<InputComp {form} {errors} label={m.as_site_name()} name="siteName" type="text" required />
			<InputComp {form} {errors} label={m.as_tagline()} name="tagline" type="text" />
			<InputComp {form} {errors} label={m.as_hero_title()} name="heroTitle" type="text" />
			<InputComp
				{form}
				{errors}
				label={m.as_hero_subtitle()}
				name="heroSubtitle"
				type="textarea"
				rows={3}
			/>

			<!-- ---------------- the brand marks ---------------- -->
			<div class="mt-6 space-y-4 border-t-2 border-edge pt-5">
				<div>
					<h2 class="text-sm font-black text-ink">{m.as_brand_heading()}</h2>
					<p class="mt-1 text-[11px] leading-relaxed font-medium text-ink-dim">
						{m.as_brand_note()}
					</p>
				</div>

				{#each slots as slot (slot.name)}
					<div class="space-y-2 rounded-2xl border-2 border-edge-soft p-3">
						<div class="flex items-start justify-between gap-3">
							<div class="min-w-0">
								<p class="text-xs font-black text-ink">{slot.label}</p>
								<p class="mt-0.5 text-[11px] leading-relaxed text-ink-dim">{slot.hint}</p>
							</div>
							<span
								class="shrink-0 rounded-full border border-edge px-2 py-0.5 text-[10px] font-black tracking-wider uppercase {slot.custom
									? 'bg-tile-mint text-brand-soft-fg'
									: 'bg-well text-ink-dim'}"
							>
								{slot.custom ? m.as_logo_uploaded() : m.as_logo_default()}
							</span>
						</div>

						<!-- What is drawn today, on the ground it is drawn against. -->
						<div class="flex items-center justify-center rounded-xl p-4 {slot.plate}">
							<img
								src={slot.src}
								alt={slot.label}
								class={slot.name === 'logoMark' ? 'h-16 w-16' : 'h-12 w-auto'}
							/>
						</div>

						<FileUpload {form} name={slot.name} placeholder={m.as_logo_upload_hint()} />

						{#if slot.custom}
							<!--
								Associated with the reset form below by id rather than nested
								inside this one: a form inside a form is not valid HTML, and
								`formaction` on a submit button does not survive the enhanced
								submit that superforms installs on the settings form.
							-->
							<button
								type="submit"
								form="logo-reset"
								name="slot"
								value={slot.name}
								class="flex items-center gap-1.5 text-[11px] font-black text-ink-soft underline underline-offset-2 hover:text-ink"
							>
								<RotateCcw class="h-3 w-3" />
								{m.as_logo_reset()}
							</button>
						{/if}
					</div>
				{/each}
			</div>

			<div class="mt-6 grid grid-cols-1 gap-2 border-t-2 border-edge pt-5 sm:grid-cols-2">
				<InputComp
					{form}
					{errors}
					label={m.as_fee_percent()}
					name="platformFeePercent"
					type="number"
				/>
				<InputComp
					{form}
					{errors}
					label={m.as_dispute_window()}
					name="disputeWindowDays"
					type="number"
					min={0}
					hint={m.as_dispute_window_hint()}
				/>
			</div>

			<div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
				<InputComp {form} {errors} label={m.as_support_email()} name="supportEmail" type="text" />
				<InputComp {form} {errors} label={m.as_support_phone()} name="supportPhone" type="text" />
			</div>

			<button
				type="submit"
				disabled={$delayed}
				class="mt-4 w-full rounded-2xl border-2 border-edge bg-brand py-3 text-xs font-black text-brand-ink shadow-[3px_3px_0px_0px_rgb(var(--bento-shadow))] hover:bg-brand-strong disabled:opacity-60"
			>
				{#if $delayed}
					<LoadingBtn name={m.common_saving()} />
				{:else}
					{m.as_save()}
				{/if}
			</button>
		</form>
	</div>

	<!-- The target of every reset button above. Empty, unenhanced and outside the
	     settings form, so a reset is a plain post that carries only the slot. -->
	<form id="logo-reset" method="POST" action="?/resetLogo" hidden></form>
</div>
