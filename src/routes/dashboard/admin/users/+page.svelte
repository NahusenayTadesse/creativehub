<script lang="ts">
	import * as m from '$lib/paraglide/messages';
	import { enhance } from '$app/forms';
	import { toast } from 'svelte-sonner';
	import PageHeader from '$lib/components/page-header.svelte';
	import { Search, ShieldCheck, Briefcase, UserCheck } from '@lucide/svelte';

	let { data } = $props();

	let query = $state('');
	let roleFilter = $state('all');

	const filtered = $derived.by(() => {
		const q = query.trim().toLowerCase();
		return data.users.filter((user) => {
			if (roleFilter !== 'all' && (user.role ?? 'creator') !== roleFilter) return false;
			if (q && !`${user.name} ${user.email}`.toLowerCase().includes(q)) return false;
			return true;
		});
	});

	const countFor = (role: string) =>
		role === 'all'
			? data.users.length
			: data.users.filter((u) => (u.role ?? 'creator') === role).length;

	const handler = () => {
		return async ({ result, update }: any) => {
			if (result.type === 'failure') toast.error(result.data?.message ?? m.common_refused());
			else if (result.type === 'success') toast.success(m.au_role_updated());
			await update();
		};
	};

	const tabs = $derived([
		{ key: 'all', label: m.bl_tab_all() },
		{ key: 'creator', label: m.au_tab_creators() },
		{ key: 'business', label: m.au_tab_brands() },
		{ key: 'admin', label: m.au_tab_operators() }
	]);

	const roleTone: Record<string, string> = {
		admin: 'border-purple-500 bg-purple-100 text-purple-900',
		business: 'border-indigo-500 bg-indigo-100 text-indigo-900',
		creator: 'border-emerald-500 bg-emerald-100 text-emerald-900'
	};
</script>

<svelte:head><title>{m.au_meta_title()}</title></svelte:head>

<div class="space-y-6">
	<PageHeader eyebrow={m.sb_marketplace()} title={m.au_title()} description={m.au_description()} />

	<div class="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
		<div class="flex flex-wrap items-center gap-2">
			{#each tabs as tab (tab.key)}
				<button
					type="button"
					onclick={() => (roleFilter = tab.key)}
					class="cursor-pointer rounded-xl border-2 border-slate-900 px-3 py-1.5 text-xs font-black shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] transition-all {roleFilter ===
					tab.key
						? 'bg-slate-900 text-white'
						: 'bg-white text-slate-800 hover:bg-slate-100'}"
				>
					{m.bl_tab_count({ label: tab.label, count: countFor(tab.key) })}
				</button>
			{/each}
		</div>

		<div class="relative sm:w-64">
			<Search class="absolute top-3 left-3 h-4 w-4 text-slate-500" />
			<input
				type="text"
				bind:value={query}
				placeholder={m.au_search_placeholder()}
				class="w-full rounded-2xl border-2 border-slate-900 bg-white py-2.5 pr-3 pl-9 text-xs font-bold shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] outline-none focus:ring-2 focus:ring-emerald-500"
			/>
		</div>
	</div>

	<div class="bento-card bento-card-static overflow-x-auto p-0!">
		<table class="w-full min-w-[720px] text-sm">
			<thead>
				<tr class="border-b-2 border-slate-900 bg-slate-50">
					<th
						class="px-4 py-3 text-left text-[11px] font-black tracking-wider text-slate-600 uppercase"
					>
						{m.au_col_user()}
					</th>
					<th
						class="px-4 py-3 text-left text-[11px] font-black tracking-wider text-slate-600 uppercase"
					>
						{m.au_col_linked()}
					</th>
					<th
						class="px-4 py-3 text-left text-[11px] font-black tracking-wider text-slate-600 uppercase"
					>
						{m.au_col_role()}
					</th>
					<th
						class="px-4 py-3 text-right text-[11px] font-black tracking-wider text-slate-600 uppercase"
					>
						{m.au_col_change()}
					</th>
				</tr>
			</thead>
			<tbody>
				{#each filtered as user (user.id)}
					<tr class="border-b border-slate-200 last:border-0">
						<td class="px-4 py-3">
							<p class="text-xs font-black text-slate-900">{user.name}</p>
							<p class="text-[11px] font-bold text-slate-500">{user.email}</p>
						</td>
						<td class="px-4 py-3 text-[11px] font-bold text-slate-600">
							{#if user.creatorUsername}
								<a
									href="/creators/{user.creatorUsername}"
									class="hover:text-emerald-700 hover:underline"
								>
									@{user.creatorUsername}
								</a>
							{:else if user.organizationName}
								{user.organizationName}
							{:else}
								<span class="text-slate-400">—</span>
							{/if}
						</td>
						<td class="px-4 py-3">
							<span
								class="inline-flex items-center gap-1 rounded-lg border-2 px-2 py-0.5 text-[10px] font-black tracking-wider uppercase {roleTone[
									user.role ?? 'creator'
								]}"
							>
								{#if user.role === 'admin'}
									<ShieldCheck class="h-3 w-3" />
								{:else if user.role === 'business'}
									<Briefcase class="h-3 w-3" />
								{:else}
									<UserCheck class="h-3 w-3" />
								{/if}
								{user.role === 'admin'
									? m.au_role_operator()
									: user.role === 'business'
										? m.au_role_brand()
										: m.au_role_creator()}
							</span>
						</td>
						<td class="px-4 py-3">
							<form
								method="POST"
								action="?/setRole"
								use:enhance={handler}
								class="flex items-center justify-end gap-2"
							>
								<input type="hidden" name="userId" value={user.id} />
								<select
									name="role"
									value={user.role ?? 'creator'}
									class="rounded-lg border-2 border-slate-900 bg-white px-2 py-1 text-xs font-bold"
								>
									<option value="creator">{m.au_role_creator()}</option>
									<option value="business">{m.au_role_brand()}</option>
									<option value="admin">{m.au_role_operator()}</option>
								</select>
								<button
									type="submit"
									class="rounded-lg border-2 border-slate-900 bg-emerald-600 px-3 py-1 text-xs font-black text-white hover:bg-emerald-700"
								>
									{m.common_save()}
								</button>
							</form>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>
