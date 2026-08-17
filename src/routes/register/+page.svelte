<script lang="ts">
	import { superForm } from 'sveltekit-superforms';
	import { toast } from 'svelte-sonner';
	import { UserCheck, Briefcase } from '@lucide/svelte';
	import Errors from '$lib/formComponents/Errors.svelte';
	import LoadingBtn from '$lib/formComponents/LoadingBtn.svelte';

	let { data } = $props();

	const { form, errors, enhance, delayed, allErrors, message } = superForm(data.form);

	$effect(() => {
		if ($message?.type === 'error') toast.error($message.text);
	});
</script>

<svelte:head><title>Create an account — Creator Network</title></svelte:head>

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
				<span class="text-xs font-black tracking-widest text-slate-500 uppercase">Get started</span>
				<h1 class="text-2xl font-black text-slate-900">Create your account</h1>
			</div>

			<form method="POST" action="?/register" use:enhance class="space-y-4">
				<Errors allErrors={$allErrors} />

				<!-- Role picker -->
				<fieldset class="space-y-2">
					<legend class="text-xs font-black text-slate-900">I am joining as</legend>
					<div class="grid grid-cols-2 gap-3">
						<label
							class="flex cursor-pointer flex-col gap-1 rounded-2xl border-2 p-3 transition-all {$form.role ===
							'creator'
								? 'border-slate-900 bg-[#dcfce7] shadow-[3px_3px_0px_0px_rgba(15,23,42,1)]'
								: 'border-slate-300 bg-white hover:border-slate-900'}"
						>
							<input type="radio" name="role" value="creator" bind:group={$form.role} class="sr-only" />
							<UserCheck class="h-5 w-5 text-emerald-700" />
							<span class="text-sm font-black text-slate-900">A creator</span>
							<span class="text-[11px] font-medium text-slate-600">
								Publish packages and take bookings
							</span>
						</label>

						<label
							class="flex cursor-pointer flex-col gap-1 rounded-2xl border-2 p-3 transition-all {$form.role ===
							'business'
								? 'border-slate-900 bg-[#e0e7ff] shadow-[3px_3px_0px_0px_rgba(15,23,42,1)]'
								: 'border-slate-300 bg-white hover:border-slate-900'}"
						>
							<input type="radio" name="role" value="business" bind:group={$form.role} class="sr-only" />
							<Briefcase class="h-5 w-5 text-indigo-700" />
							<span class="text-sm font-black text-slate-900">A brand</span>
							<span class="text-[11px] font-medium text-slate-600">
								Post briefs and book creators
							</span>
						</label>
					</div>
				</fieldset>

				<div class="space-y-1.5">
					<label for="name" class="text-xs font-black text-slate-900">Your name</label>
					<input
						id="name"
						name="name"
						type="text"
						autocomplete="name"
						bind:value={$form.name}
						required
						class="w-full rounded-xl border-2 border-slate-900 bg-white px-3 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500"
					/>
					{#if $errors.name}<p class="text-xs font-bold text-red-600">{$errors.name}</p>{/if}
				</div>

				<div class="space-y-1.5">
					<label for="email" class="text-xs font-black text-slate-900">Email</label>
					<input
						id="email"
						name="email"
						type="email"
						autocomplete="email"
						bind:value={$form.email}
						required
						class="w-full rounded-xl border-2 border-slate-900 bg-white px-3 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500"
					/>
					{#if $errors.email}<p class="text-xs font-bold text-red-600">{$errors.email}</p>{/if}
				</div>

				<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<div class="space-y-1.5">
						<label for="password" class="text-xs font-black text-slate-900">Password</label>
						<input
							id="password"
							name="password"
							type="password"
							autocomplete="new-password"
							bind:value={$form.password}
							required
							class="w-full rounded-xl border-2 border-slate-900 bg-white px-3 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500"
						/>
						{#if $errors.password}<p class="text-xs font-bold text-red-600">{$errors.password}</p>{/if}
					</div>

					<div class="space-y-1.5">
						<label for="confirm" class="text-xs font-black text-slate-900">Confirm</label>
						<input
							id="confirm"
							name="confirm"
							type="password"
							autocomplete="new-password"
							bind:value={$form.confirm}
							required
							class="w-full rounded-xl border-2 border-slate-900 bg-white px-3 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500"
						/>
						{#if $errors.confirm}<p class="text-xs font-bold text-red-600">{$errors.confirm}</p>{/if}
					</div>
				</div>

				<button
					type="submit"
					disabled={$delayed}
					class="w-full rounded-2xl border-2 border-slate-900 bg-emerald-600 py-3 text-xs font-black text-white shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] transition-colors hover:bg-emerald-700 disabled:opacity-60"
				>
					{#if $delayed}
						<LoadingBtn name="Creating account" />
					{:else}
						Create account
					{/if}
				</button>
			</form>

			<p class="text-center text-xs font-medium text-slate-600">
				Already registered?
				<a href="/login" class="font-black text-emerald-700 hover:underline">Sign in</a>
			</p>
		</div>
	</div>
</div>
