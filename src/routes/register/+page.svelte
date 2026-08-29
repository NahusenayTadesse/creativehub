<script lang="ts">
	import { untrack } from 'svelte';
	import { resolve } from '$app/paths';
	import * as m from '$lib/paraglide/messages';
	import { superForm } from 'sveltekit-superforms';
	import { toast } from 'svelte-sonner';
	import { UserCheck, Briefcase } from '@lucide/svelte';
	import Errors from '$lib/formComponents/Errors.svelte';
	import InputComp from '$lib/formComponents/InputComp.svelte';
	import RadioCards from '$lib/formComponents/RadioCards.svelte';
	import LoadingBtn from '$lib/formComponents/LoadingBtn.svelte';

	let { data } = $props();

	const { form, errors, enhance, delayed, allErrors, message } = superForm(
		untrack(() => data.form)
	);

	$effect(() => {
		if ($message?.type === 'error') toast.error($message.text);
	});

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
		<a href={resolve('/')} class="flex items-center justify-center gap-3">
			<div
				class="flex h-11 w-11 items-center justify-center rounded-2xl border-2 border-edge bg-inverse text-xl font-black text-inverse-ink shadow-[3px_3px_0px_0px_rgb(var(--bento-shadow-accent))]"
			>
				ET
			</div>
			<span class="text-xl font-black tracking-tight text-ink">{m.brand_name()}</span>
		</a>

		<div class="bento-card bento-card-static space-y-5">
			<div class="border-b-2 border-edge pb-4">
				<span class="text-xs font-black tracking-widest text-ink-dim uppercase"
					>{m.register_eyebrow()}</span
				>
				<h1 class="text-2xl font-black text-ink">{m.register_title()}</h1>
			</div>

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
