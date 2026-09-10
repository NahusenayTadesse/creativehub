<script lang="ts">
	import { untrack } from 'svelte';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import * as m from '$lib/paraglide/messages';
	import SiteLogo from '$lib/components/site-logo.svelte';
	import { resolveLogos } from '$lib/brand';
	import { superForm } from 'sveltekit-superforms';
	import { toast } from 'svelte-sonner';
	import { TriangleAlert, ShieldCheck, Database } from '@lucide/svelte';
	import Errors from '$lib/formComponents/Errors.svelte';
	import InputComp from '$lib/formComponents/InputComp.svelte';
	import LoadingBtn from '$lib/formComponents/LoadingBtn.svelte';

	let { data } = $props();

	const logos = $derived(resolveLogos(page.data.settings));

	const invite = $derived(data.invite);

	const { form, errors, enhance, delayed, allErrors, message } = superForm(
		untrack(() => data.form)
	);

	$effect(() => {
		if ($message?.type === 'error') toast.error($message.text);
	});
</script>

<svelte:head><title>{m.iv_meta_title()}</title></svelte:head>

<div class="flex min-h-screen items-center justify-center px-4 py-12">
	<div class="w-full max-w-md space-y-6">
		<a href={resolve('/')} class="flex items-center justify-center">
			<SiteLogo {logos} variant="wordmark" heightClass="h-12" />
		</a>

		<div class="bento-card bento-card-static space-y-5">
			{#if invite}
				<div class="border-b-2 border-edge pb-4">
					<span class="text-xs font-black tracking-widest text-ink-dim uppercase">
						{m.iv_eyebrow()}
					</span>
					<h1 class="text-2xl font-black text-ink">{m.iv_title()}</h1>
					<p class="mt-1 text-xs font-medium text-ink-soft">{m.iv_subtitle()}</p>
				</div>

				<!-- What the link is worth, said before anything is typed: the address
				     it was sent to and the access it grants are both fixed, and neither
				     is a field on the form. -->
				<div class="space-y-2 rounded-2xl border-2 border-edge bg-well p-4">
					<div class="flex items-center justify-between gap-3">
						<span class="text-[11px] font-black tracking-wider text-ink-dim uppercase">
							{m.iv_for()}
						</span>
						<span class="truncate text-xs font-black text-ink">{invite.email}</span>
					</div>
					<div class="flex items-center justify-between gap-3">
						<span class="text-[11px] font-black tracking-wider text-ink-dim uppercase">
							{m.iv_role()}
						</span>
						<span
							class="inline-flex items-center gap-1 rounded-lg border-2 px-2 py-0.5 text-[10px] font-black tracking-wider uppercase {invite.role ===
							'admin'
								? 'border-tint-violet-edge bg-tint-violet text-tint-violet-fg'
								: 'border-edge-mid bg-surface text-ink-soft'}"
						>
							{#if invite.role === 'admin'}
								<ShieldCheck class="h-3 w-3" />
							{:else}
								<Database class="h-3 w-3" />
							{/if}
							{invite.roleLabel}
						</span>
					</div>
				</div>

				<form method="POST" use:enhance class="space-y-4">
					<Errors allErrors={$allErrors} />

					<InputComp
						{form}
						{errors}
						name="name"
						label={m.iv_name()}
						autocomplete="name"
						placeholder={m.iv_name_placeholder()}
						required
					/>

					<InputComp
						{form}
						{errors}
						name="password"
						type="password"
						label={m.iv_password()}
						autocomplete="new-password"
						required
					/>

					<InputComp
						{form}
						{errors}
						name="confirm"
						type="password"
						label={m.iv_confirm()}
						autocomplete="new-password"
						required
					/>

					<button
						type="submit"
						disabled={$delayed}
						class="w-full rounded-2xl border-2 border-edge bg-brand py-3 text-xs font-black text-brand-ink shadow-[3px_3px_0px_0px_rgb(var(--bento-shadow))] transition-colors hover:bg-brand-strong disabled:opacity-60"
					>
						{#if $delayed}
							<LoadingBtn name={m.iv_creating()} />
						{:else}
							{m.iv_submit()}
						{/if}
					</button>
				</form>
			{:else}
				<div class="space-y-3 text-center">
					<div
						class="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border-2 border-edge bg-well"
					>
						<TriangleAlert class="h-5 w-5 text-ink-soft" />
					</div>
					<h1 class="text-2xl font-black text-ink">{m.iv_invalid_title()}</h1>
					<p class="text-xs font-medium text-ink-soft">{m.iv_invalid_body()}</p>
				</div>
			{/if}

			<p class="text-center text-xs font-medium text-ink-soft">
				<a href={resolve('/login')} class="font-black text-brand-soft-fg hover:underline">
					{m.fp_back()}
				</a>
			</p>
		</div>
	</div>
</div>
