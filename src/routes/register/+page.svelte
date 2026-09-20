<script lang="ts">
	import { untrack } from 'svelte';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import * as m from '$lib/paraglide/messages';
	import SiteLogo from '$lib/components/site-logo.svelte';
	import { resolveLogos } from '$lib/brand';
	import { superForm } from 'sveltekit-superforms';
	import { toast } from 'svelte-sonner';
	import { UserCheck, Briefcase, LogIn, Hand, AlertCircle } from '@lucide/svelte';
	import Errors from '$lib/formComponents/Errors.svelte';
	import InputComp from '$lib/formComponents/InputComp.svelte';
	import RadioCards from '$lib/formComponents/RadioCards.svelte';
	import LoadingBtn from '$lib/formComponents/LoadingBtn.svelte';

	let { data } = $props();

	const logos = $derived(resolveLogos(page.data.settings));

	const { form, errors, enhance, delayed, allErrors, message } = superForm(
		untrack(() => data.form)
	);

	/*
	 * The address is already registered.
	 *
	 * This is the one sign-up failure the person can act on, so it is answered
	 * in the page rather than in a toast that disappears: the account may be
	 * theirs to sign into, or their creator profile may have been imported here
	 * before they arrived, in which case signing in is only the first half and
	 * the claim queue is the second. Both doors are drawn below; the toast is
	 * skipped for this code so the same sentence is not said twice.
	 */
	const emailTaken = $derived($message?.code === 'email_in_use');

	$effect(() => {
		if ($message?.type === 'error' && $message?.code !== 'email_in_use') toast.error($message.text);
	});

	/*
	 * Both doors go through /login — claiming a profile is something an operator
	 * decides on a named account, so there is nothing to claim until the person
	 * is signed in, and `?next=` carries them straight on to the claim page once
	 * they are. `next=/dashboard` is where /login lands anybody anyway, so the
	 * sign-in door names it only to keep the query well formed.
	 *
	 * The refused address rides along so it is not typed a second time; the
	 * login page validates it before filling anything with it.
	 */
	const emailParam = $derived(
		emailTaken && $form.email.trim() ? `&email=${encodeURIComponent($form.email.trim())}` : ''
	);

	const signInHref = $derived(resolve(`/login?next=/dashboard${emailParam}`));
	const claimHref = $derived(resolve(`/login?next=/dashboard/profile/claim${emailParam}`));

	const roleOptions = $derived([
		{
			value: 'creator',
			title: m.register_as_creator(),
			description: m.register_as_creator_note(),
			icon: UserCheck,
			selectedClass: 'bg-tile-mint',
			iconClass: 'text-brand-soft-fg'
		},
		{
			value: 'business',
			title: m.register_as_brand(),
			description: m.register_as_brand_note(),
			icon: Briefcase,
			selectedClass: 'bg-tile-indigo',
			iconClass: 'text-info-fg'
		}
	]);
</script>

<svelte:head><title>{m.register_meta_title()}</title></svelte:head>

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
					>{m.register_eyebrow()}</span
				>
				<h1 class="text-2xl font-black text-ink">{m.register_title()}</h1>
			</div>

			{#if emailTaken}
				<div class="space-y-3 rounded-2xl border-2 border-warn-edge bg-warn-soft p-4">
					<div class="flex items-start gap-2.5">
						<AlertCircle class="mt-0.5 h-4 w-4 shrink-0 text-warn-fg" />
						<div class="space-y-1">
							<h2 class="text-sm font-black text-warn-fg">{m.register_exists_title()}</h2>
							<p class="text-xs font-medium text-warn-fg">{m.register_exists_body()}</p>
						</div>
					</div>

					<div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
						<a
							href={signInHref}
							class="flex items-center justify-center gap-1.5 rounded-xl border-2 border-edge bg-brand px-3 py-2 text-xs font-black text-brand-ink hover:bg-brand-strong"
						>
							<LogIn class="h-3.5 w-3.5" />
							{m.login_title()}
						</a>
						<a
							href={claimHref}
							class="flex items-center justify-center gap-1.5 rounded-xl border-2 border-edge bg-surface px-3 py-2 text-xs font-black text-ink hover:bg-panel"
						>
							<Hand class="h-3.5 w-3.5" />
							{m.register_exists_claim()}
						</a>
					</div>
				</div>
			{/if}

			<form method="POST" action="?/register" use:enhance class="space-y-4">
				<Errors allErrors={$allErrors} />

				<RadioCards
					{form}
					{errors}
					name="role"
					legend={m.register_joining_as()}
					options={roleOptions}
				/>

				<InputComp
					{form}
					{errors}
					name="name"
					label={m.register_your_name()}
					autocomplete="name"
					required
				/>

				<InputComp
					{form}
					{errors}
					name="email"
					type="email"
					label={m.login_email()}
					autocomplete="email"
					required
				/>

				<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<InputComp
						{form}
						{errors}
						name="password"
						type="password"
						label={m.login_password()}
						autocomplete="new-password"
						required
					/>

					<InputComp
						{form}
						{errors}
						name="confirm"
						type="password"
						label={m.register_confirm()}
						autocomplete="new-password"
						required
					/>
				</div>

				<button
					type="submit"
					disabled={$delayed}
					class="w-full rounded-2xl border-2 border-edge bg-brand py-3 text-xs font-black text-brand-ink shadow-[3px_3px_0px_0px_rgb(var(--bento-shadow))] transition-colors hover:bg-brand-strong disabled:opacity-60"
				>
					{#if $delayed}
						<LoadingBtn name={m.register_creating()} />
					{:else}
						{m.register_create_account()}
					{/if}
				</button>
			</form>

			<p class="text-center text-xs font-medium text-ink-soft">
				{m.register_already()}
				<a href={resolve('/login')} class="font-black text-brand-soft-fg hover:underline"
					>{m.login_title()}</a
				>
			</p>
		</div>
	</div>
</div>
