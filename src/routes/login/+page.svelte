<script lang="ts">
	import { untrack } from 'svelte';
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
