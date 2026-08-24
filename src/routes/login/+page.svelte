<script lang="ts">
	import { untrack } from 'svelte';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import * as m from '$lib/paraglide/messages';
	import { superForm } from 'sveltekit-superforms';
	import { toast } from 'svelte-sonner';
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

	/* A failed Google handshake comes back as `?error=`, which the server has
	   already turned into a sentence. Read once per navigation, not per render:
	   `data` is reactive and re-toasting on every update would stack duplicates. */
	$effect(() => {
		const text = data.oauthError;
		if (text) untrack(() => toast.error(text));
	});

	/* The Google button posts to this page's action, carrying `?next=` so the
	   round trip through Google lands where the password form would have. */
	const next = $derived(page.url.searchParams.get('next'));
	const googleAction = $derived(next ? `?/google&next=${encodeURIComponent(next)}` : '?/google');
</script>

<svelte:head><title>{m.login_meta_title()}</title></svelte:head>

<div class="flex min-h-screen items-center justify-center px-4 py-12">
	<div class="w-full max-w-md space-y-6">
		<a href={resolve('/')} class="flex items-center justify-center gap-3">
			<div
				class="flex h-11 w-11 items-center justify-center rounded-2xl border-2 border-slate-900 bg-slate-900 text-xl font-black text-white shadow-[3px_3px_0px_0px_rgba(16,185,129,1)]"
			>
				ET
			</div>
			<span class="text-xl font-black tracking-tight text-slate-900">{m.brand_name()}</span>
		</a>

		<div class="bento-card bento-card-static space-y-5">
			<div class="border-b-2 border-slate-900 pb-4">
				<span class="text-xs font-black tracking-widest text-slate-500 uppercase"
					>{m.login_eyebrow()}</span
				>
				<h1 class="text-2xl font-black text-slate-900">{m.login_title()}</h1>
				<p class="mt-1 text-xs font-medium text-slate-600">
					{m.login_subtitle()}
				</p>
			</div>

			<form method="POST" action="?/login" use:enhance class="space-y-4">
				<Errors allErrors={$allErrors} />

				<InputComp
					{form}
					{errors}
					name="email"
					type="email"
					label={m.login_email()}
					placeholder={m.login_email_placeholder()}
					autocomplete="email"
					required
				/>

				<InputComp
					{form}
					{errors}
					name="password"
					type="password"
					label={m.login_password()}
					autocomplete="current-password"
					required
				/>

				<button
					type="submit"
					disabled={$delayed}
					class="w-full rounded-2xl border-2 border-slate-900 bg-emerald-600 py-3 text-xs font-black text-white shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] transition-colors hover:bg-emerald-700 disabled:opacity-60"
				>
					{#if $delayed}
						<LoadingBtn name={m.login_signing_in()} />
					{:else}
						{m.login_title()}
					{/if}
				</button>
			</form>

			{#if data.google}
				<div class="flex items-center gap-3">
					<span class="h-0.5 flex-1 bg-slate-200"></span>
					<span class="text-[11px] font-black tracking-widest text-slate-500 uppercase"
						>{m.login_or()}</span
					>
					<span class="h-0.5 flex-1 bg-slate-200"></span>
				</div>

				<!-- A real form post, so this works with scripting off like the one above.
				     `?next=` is carried across so Google returns the reader to where they
				     were headed. -->
				<form method="POST" action={googleAction}>
					<button
						type="submit"
						class="flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-slate-900 bg-white py-3 text-xs font-black text-slate-900 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] transition-colors hover:bg-slate-50"
					>
						<svg class="h-4 w-4" viewBox="0 0 18 18" aria-hidden="true">
							<path
								fill="#4285F4"
								d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
							/>
							<path
								fill="#34A853"
								d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
							/>
							<path
								fill="#FBBC05"
								d="M3.97 10.72a5.41 5.41 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z"
							/>
							<path
								fill="#EA4335"
								d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
							/>
						</svg>
						{m.login_with_google()}
					</button>
				</form>
			{/if}

			<p class="text-center text-xs font-medium text-slate-600">
				{m.login_no_account()}
				<a href={resolve('/register')} class="font-black text-emerald-700 hover:underline"
					>{m.login_create_one()}</a
				>
			</p>
		</div>

		<p class="text-center text-[11px] font-medium text-slate-500">
			{m.login_disclaimer()}
		</p>
	</div>
</div>
