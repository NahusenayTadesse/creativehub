<script lang="ts">
	import { untrack } from 'svelte';
	import * as m from '$lib/paraglide/messages';
	import { superForm } from 'sveltekit-superforms';
	import { toast } from 'svelte-sonner';
	import PageHeader from '$lib/components/page-header.svelte';
	import InputComp from '$lib/formComponents/InputComp.svelte';
	import Errors from '$lib/formComponents/Errors.svelte';
	import LoadingBtn from '$lib/formComponents/LoadingBtn.svelte';
	import { CircleAlert } from '@lucide/svelte';

	let { data } = $props();

	const { form, errors, enhance, delayed, allErrors, message } = superForm(
		untrack(() => data.form)
	);

	$effect(() => {
		if (!$message) return;
		if ($message.type === 'error') toast.error($message.text);
		else toast.success($message.text);
	});
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
		<form method="POST" use:enhance enctype="multipart/form-data" class="space-y-2">
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

			<InputComp
				{form}
				{errors}
				label={m.as_fee_percent()}
				name="platformFeePercent"
				type="number"
			/>

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
</div>
