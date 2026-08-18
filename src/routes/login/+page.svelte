<script lang="ts">
	import * as m from '$lib/paraglide/messages';
	import { superForm } from 'sveltekit-superforms';
	import { toast } from 'svelte-sonner';
	import { Eye, EyeOff } from '@lucide/svelte';
	import Errors from '$lib/formComponents/Errors.svelte';
	import LoadingBtn from '$lib/formComponents/LoadingBtn.svelte';

	let { data } = $props();

	const { form, errors, enhance, delayed, allErrors, message } = superForm(data.form);

	let showPassword = $state(false);

	$effect(() => {
		if ($message?.type === 'error') toast.error($message.text);
	});
</script>

<svelte:head><title>{m.login_meta_title()}</title></svelte:head>

<div class="flex min-h-screen items-center justify-center px-4 py-12">
	<div class="w-full max-w-md space-y-6">
		<a href="/" class="flex items-center justify-center gap-3">
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

				<div class="space-y-1.5">
					<label for="email" class="text-xs font-black text-slate-900">{m.login_email()}</label>
					<input
						id="email"
						name="email"
						type="email"
						autocomplete="email"
						bind:value={$form.email}
						required
						placeholder={m.login_email_placeholder()}
						class="w-full rounded-xl border-2 border-slate-900 bg-white px-3 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500"
					/>
					{#if $errors.email}<p class="text-xs font-bold text-red-600">{$errors.email}</p>{/if}
				</div>

				<div class="space-y-1.5">
					<label for="password" class="text-xs font-black text-slate-900"
						>{m.login_password()}</label
					>
					<div class="relative">
						<input
							id="password"
							name="password"
							type={showPassword ? 'text' : 'password'}
							autocomplete="current-password"
							bind:value={$form.password}
							required
							class="w-full rounded-xl border-2 border-slate-900 bg-white px-3 py-2.5 pr-10 text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500"
						/>
						<button
							type="button"
							onclick={() => (showPassword = !showPassword)}
							aria-label={showPassword ? m.login_hide_password() : m.login_show_password()}
							class="absolute top-1/2 right-3 -translate-y-1/2 text-slate-500 hover:text-slate-900"
						>
							{#if showPassword}
								<EyeOff class="h-4 w-4" />
							{:else}
								<Eye class="h-4 w-4" />
							{/if}
						</button>
					</div>
					{#if $errors.password}<p class="text-xs font-bold text-red-600">
							{$errors.password}
						</p>{/if}
				</div>

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
				<a href="/register" class="font-black text-emerald-700 hover:underline"
					>{m.login_create_one()}</a
				>
			</p>
		</div>

		<p class="text-center text-[11px] font-medium text-slate-500">
			{m.login_disclaimer()}
		</p>
	</div>
</div>
