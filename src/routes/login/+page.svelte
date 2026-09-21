<script lang="ts">
	import GoogleButton from '$lib/components/google-button.svelte';
	import { untrack } from 'svelte';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import * as m from '$lib/paraglide/messages';
	import SiteLogo from '$lib/components/site-logo.svelte';
	import { resolveLogos } from '$lib/brand';
	import { superForm } from 'sveltekit-superforms';
	import { toast } from 'svelte-sonner';
	import Errors from '$lib/formComponents/Errors.svelte';
	import InputComp from '$lib/formComponents/InputComp.svelte';
	import LoadingBtn from '$lib/formComponents/LoadingBtn.svelte';

	let { data } = $props();

	const logos = $derived(resolveLogos(page.data.settings));

	const { form, errors, enhance, delayed, allErrors, message } = superForm(
		untrack(() => data.form)
	);

	$effect(() => {
		if ($message?.type === 'error') toast.error($message.text);
	});

	/* `?reset=1` is set by the reset page, which signs nobody in on purpose.
	   Read once per navigation for the same reason as the OAuth error below. */
	$effect(() => {
		if (page.url.searchParams.get('reset')) untrack(() => toast.success(m.login_reset_done()));
	});

	/* A failed Google handshake comes back as `?error=`, which the server has
	   already turned into a sentence. Read once per navigation, not per render:
	   `data` is reactive and re-toasting on every update would stack duplicates. */
	$effect(() => {
		const text = data.oauthError;
		if (text) untrack(() => toast.error(text));
	});

	/*
	 * Both buttons post to this page's actions carrying `?next=`.
	 *
	 * A form action is a whole query string, not an addition to one, so a bare
	 * `?/login` throws away the `next` the page was opened with and the server
	 * reads nothing — which is how every "sign in to carry on here" link on the
	 * site quietly landed on /dashboard instead. Both actions rebuild it.
	 */
	const next = $derived(page.url.searchParams.get('next'));
	const withNext = (action: string) =>
		next ? `${action}&next=${encodeURIComponent(next)}` : action;
	const loginAction = $derived(withNext('?/login'));
	const googleAction = $derived(withNext('?/google'));
</script>

<svelte:head><title>{m.login_meta_title()}</title></svelte:head>

<div class="flex min-h-screen items-center justify-center px-4 py-12">
	<div class="w-full max-w-md space-y-6">
		<!-- The auth pages sit outside the app shell, so the logo comes from
		     `page.data` — the root layout's settings, which every route carries. -->
		<a href={resolve('/')} class="flex items-center justify-center">
			<SiteLogo {logos} variant="wordmark" heightClass="h-16" />
		</a>

		<div class="bento-card bento-card-static space-y-5">
			<div class="border-b-2 border-edge pb-4">
				<span class="text-xs font-black tracking-widest text-ink-dim uppercase"
					>{m.login_eyebrow()}</span
				>
				<h1 class="text-2xl font-black text-ink">{m.login_title()}</h1>
				<p class="mt-1 text-xs font-medium text-ink-soft">
					{m.login_subtitle()}
				</p>
			</div>

			<form method="POST" action={loginAction} use:enhance class="space-y-4">
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

				<p class="text-right">
					<a
						href={resolve('/forgot-password')}
						class="text-[11px] font-black text-brand-soft-fg hover:underline">{m.login_forgot()}</a
					>
				</p>

				<button
					type="submit"
					disabled={$delayed}
					class="w-full rounded-2xl border-2 border-edge bg-brand py-3 text-xs font-black text-brand-ink shadow-[3px_3px_0px_0px_rgb(var(--bento-shadow))] transition-colors hover:bg-brand-strong disabled:opacity-60"
				>
					{#if $delayed}
						<LoadingBtn name={m.login_signing_in()} />
					{:else}
						{m.login_title()}
					{/if}
				</button>
			</form>

			{#if data.google}
				<!-- `?next=` is carried across so Google returns the reader to where they
				     were headed. -->
				<GoogleButton action={googleAction} />
			{/if}

			<p class="text-center text-xs font-medium text-ink-soft">
				{m.login_no_account()}
				<a href={resolve('/register')} class="font-black text-brand-soft-fg hover:underline"
					>{m.login_create_one()}</a
				>
			</p>
		</div>

		<p class="text-center text-[11px] font-medium text-ink-dim">
			{m.login_disclaimer()}
		</p>
	</div>
</div>
