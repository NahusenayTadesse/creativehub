<script lang="ts">
	import { untrack } from 'svelte';
	import { resolve } from '$app/paths';
	import * as m from '$lib/paraglide/messages';
	import { superForm } from 'sveltekit-superforms';
	import { toast } from 'svelte-sonner';
	import { TriangleAlert } from '@lucide/svelte';
	import Errors from '$lib/formComponents/Errors.svelte';
	import InputComp from '$lib/formComponents/InputComp.svelte';
	import LoadingBtn from '$lib/formComponents/LoadingBtn.svelte';

	let { data } = $props();

	const { form, errors, enhance, delayed, allErrors, message } = superForm(
		untrack(() => data.form)
	);

	$effect(() => {
		if ($message?.type === 'error') toast.error($message.text);
	});
</script>

<svelte:head><title>{m.rp_meta_title()}</title></svelte:head>

<div class="flex min-h-screen items-center justify-center px-4 py-12">
	<div class="w-full max-w-md space-y-6">
		<a href={resolve('/')} class="flex items-center justify-center gap-3">
			<div
				class="flex h-11 w-11 items-center justify-center rounded-2xl border-2 border-edge bg-inverse text-xl font-black text-inverse-ink shadow-[3px_3px_0px_0px_rgb(var(--bento-shadow-accent))]"
			>
				ET
			</div>
			<span class="text-xl font-black tracking-tight text-ink">{m.brand_name()}</span>
		</a>

		<div class="bento-card bento-card-static space-y-5">
			{#if data.hasToken}
				<div class="border-b-2 border-edge pb-4">
					<span class="text-xs font-black tracking-widest text-ink-dim uppercase"
						>{m.rp_eyebrow()}</span
					>
					<h1 class="text-2xl font-black text-ink">{m.rp_title()}</h1>
					<p class="mt-1 text-xs font-medium text-ink-soft">{m.rp_subtitle()}</p>
				</div>

				<form method="POST" use:enhance class="space-y-4">
					<Errors allErrors={$allErrors} />

					<!-- Carried in the form rather than re-read from the URL at submit,
					     so a restored tab still posts the token it arrived with. -->
					<input type="hidden" name="token" value={$form.token} />

					<InputComp
						{form}
						{errors}
						name="password"
						type="password"
						label={m.rp_password()}
						autocomplete="new-password"
						required
					/>

					<InputComp
						{form}
						{errors}
						name="confirm"
						type="password"
						label={m.rp_confirm()}
						autocomplete="new-password"
						required
					/>

					<button
						type="submit"
						disabled={$delayed}
						class="w-full rounded-2xl border-2 border-edge bg-brand py-3 text-xs font-black text-brand-ink shadow-[3px_3px_0px_0px_rgb(var(--bento-shadow))] transition-colors hover:bg-brand-strong disabled:opacity-60"
					>
						{#if $delayed}
							<LoadingBtn name={m.rp_saving()} />
						{:else}
							{m.rp_submit()}
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
					<h1 class="text-2xl font-black text-ink">{m.rp_invalid_title()}</h1>
					<p class="text-xs font-medium text-ink-soft">{m.rp_invalid_body()}</p>
					<a
						href={resolve('/forgot-password')}
						class="inline-block rounded-2xl border-2 border-edge bg-brand px-5 py-2.5 text-xs font-black text-brand-ink shadow-[3px_3px_0px_0px_rgb(var(--bento-shadow))] transition-colors hover:bg-brand-strong"
						>{m.rp_request_new()}</a
					>
				</div>
			{/if}

			<p class="text-center text-xs font-medium text-ink-soft">
				<a href={resolve('/login')} class="font-black text-brand-soft-fg hover:underline"
					>{m.fp_back()}</a
				>
			</p>
		</div>
	</div>
</div>
