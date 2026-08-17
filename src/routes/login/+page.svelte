<script lang="ts">
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

<svelte:head><title>Sign in — Creator Network</title></svelte:head>

<div class="flex min-h-screen items-center justify-center px-4 py-12">
	<div class="w-full max-w-md space-y-6">
		<a href="/" class="flex items-center justify-center gap-3">
			<div
				class="flex h-11 w-11 items-center justify-center rounded-2xl border-2 border-slate-900 bg-slate-900 text-xl font-black text-white shadow-[3px_3px_0px_0px_rgba(16,185,129,1)]"
			>
				ET
			</div>
			<span class="text-xl font-black tracking-tight text-slate-900">Creator Network</span>
		</a>

		<div class="bento-card bento-card-static space-y-5">
			<div class="border-b-2 border-slate-900 pb-4">
				<span class="text-xs font-black tracking-widest text-slate-500 uppercase">Welcome back</span>
				<h1 class="text-2xl font-black text-slate-900">Sign in</h1>
				<p class="mt-1 text-xs font-medium text-slate-600">
					Creators, brands and operators all sign in here.
				</p>
			</div>

			<form method="POST" action="?/login" use:enhance class="space-y-4">
				<Errors allErrors={$allErrors} />

				<div class="space-y-1.5">
					<label for="email" class="text-xs font-black text-slate-900">Email</label>
					<input
						id="email"
						name="email"
						type="email"
						autocomplete="email"
						bind:value={$form.email}
						required
						placeholder="you@example.com"
						class="w-full rounded-xl border-2 border-slate-900 bg-white px-3 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500"
					/>
					{#if $errors.email}<p class="text-xs font-bold text-red-600">{$errors.email}</p>{/if}
				</div>

				<div class="space-y-1.5">
					<label for="password" class="text-xs font-black text-slate-900">Password</label>
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
							aria-label={showPassword ? 'Hide password' : 'Show password'}
							class="absolute top-1/2 right-3 -translate-y-1/2 text-slate-500 hover:text-slate-900"
						>
							{#if showPassword}
								<EyeOff class="h-4 w-4" />
							{:else}
								<Eye class="h-4 w-4" />
							{/if}
						</button>
					</div>
					{#if $errors.password}<p class="text-xs font-bold text-red-600">{$errors.password}</p>{/if}
				</div>

				<button
					type="submit"
					disabled={$delayed}
					class="w-full rounded-2xl border-2 border-slate-900 bg-emerald-600 py-3 text-xs font-black text-white shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] transition-colors hover:bg-emerald-700 disabled:opacity-60"
				>
					{#if $delayed}
						<LoadingBtn name="Signing in" />
					{:else}
						Sign in
					{/if}
				</button>
			</form>

			<p class="text-center text-xs font-medium text-slate-600">
				No account yet?
				<a href="/register" class="font-black text-emerald-700 hover:underline">Create one</a>
			</p>
		</div>

		<p class="text-center text-[11px] font-medium text-slate-500">
			By signing in you agree to keep negotiations and compensation on the platform, so the agreed
			terms and delivery record stay attached to every booking.
		</p>
	</div>
</div>
