<script lang="ts">
	import { untrack } from 'svelte';
	import { resolve } from '$app/paths';
	import * as m from '$lib/paraglide/messages';
	import { superForm } from 'sveltekit-superforms';
	import { toast } from 'svelte-sonner';
	import { MailCheck } from '@lucide/svelte';
	import Errors from '$lib/formComponents/Errors.svelte';
	import InputComp from '$lib/formComponents/InputComp.svelte';
	import LoadingBtn from '$lib/formComponents/LoadingBtn.svelte';

	let { data, form: actionData } = $props();

	const { form, errors, enhance, delayed, allErrors, message } = superForm(
		untrack(() => data.form)
	);

	$effect(() => {
		if ($message?.type === 'error') toast.error($message.text);
	});

	/* Whether the address was on file is not something this page knows, and the
	   confirmation is worded so that it does not have to. */
	const sent = $derived(Boolean(actionData?.sent));
</script>

<svelte:head><title>{m.fp_meta_title()}</title></svelte:head>

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
			{#if sent}
				<div class="space-y-3 text-center">
					<div
						class="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border-2 border-edge bg-brand-soft"
					>
						<MailCheck class="h-5 w-5 text-brand-soft-fg" />
					</div>
					<h1 class="text-2xl font-black text-ink">{m.fp_sent_title()}</h1>
					<p class="text-xs font-medium text-ink-soft">
						{m.fp_sent_body({ email: actionData?.email ?? '' })}
					</p>
				</div>
			{:else}
				<div class="border-b-2 border-edge pb-4">
					<span class="text-xs font-black tracking-widest text-ink-dim uppercase"
						>{m.fp_eyebrow()}</span
					>
					<h1 class="text-2xl font-black text-ink">{m.fp_title()}</h1>
					<p class="mt-1 text-xs font-medium text-ink-soft">{m.fp_subtitle()}</p>
				</div>

				<form method="POST" use:enhance class="space-y-4">
					<Errors allErrors={$allErrors} />

					<InputComp
						{form}
						{errors}
						name="email"
						type="email"
						label={m.fp_email()}
						placeholder={m.login_email_placeholder()}
						autocomplete="email"
						required
					/>

					<button
						type="submit"
						disabled={$delayed}
						class="w-full rounded-2xl border-2 border-edge bg-brand py-3 text-xs font-black text-brand-ink shadow-[3px_3px_0px_0px_rgb(var(--bento-shadow))] transition-colors hover:bg-brand-strong disabled:opacity-60"
					>
						{#if $delayed}
							<LoadingBtn name={m.fp_sending()} />
						{:else}
							{m.fp_submit()}
						{/if}
					</button>
				</form>
			{/if}

			<p class="text-center text-xs font-medium text-ink-soft">
				<a href={resolve('/login')} class="font-black text-brand-soft-fg hover:underline"
					>{m.fp_back()}</a
				>
			</p>
		</div>
	</div>
</div>
