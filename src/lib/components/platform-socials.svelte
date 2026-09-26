<script lang="ts">
	import { ArrowUpRight } from '@lucide/svelte';
	import PlatformGlyph from '$lib/components/platform-glyph.svelte';
	import { formatReach } from '$lib/domain/money';
	import * as m from '$lib/paraglide/messages';

	/**
	 * The platform's own channels: Instagram, TikTok, Facebook, YouTube.
	 *
	 * `section` is the band under the hero, inviting a visitor to follow along;
	 * `compact` is the row of marks in the footer. Both read the same settings
	 * an operator fills in on /dashboard/admin/landing, and a platform with no
	 * link is simply left out — the band disappears when all four are empty.
	 *
	 * A follower count is only ever what an operator typed. Blank shows the link
	 * with no number, which is honest; a zero would not be.
	 */
	type Channel = { url: string; followers: number | null };

	let {
		socials,
		variant = 'section'
	}: {
		socials: Record<'instagram' | 'tiktok' | 'facebook' | 'youtube', Channel> | undefined | null;
		variant?: 'section' | 'compact';
	} = $props();

	const channels = $derived(
		(
			[
				{ key: 'instagram', name: 'Instagram' },
				{ key: 'tiktok', name: 'TikTok' },
				{ key: 'facebook', name: 'Facebook' },
				{ key: 'youtube', name: 'YouTube' }
			] as const
		)
			.map((platform) => ({
				...platform,
				...(socials?.[platform.key] ?? { url: '', followers: null })
			}))
			.filter((channel) => channel.url)
	);
</script>

{#if channels.length}
	{#if variant === 'section'}
		<section class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8" aria-labelledby="follow-us-heading">
			<div
				class="flex flex-col gap-5 rounded-3xl border-2 border-edge bg-surface p-5 shadow-[4px_4px_0px_0px_rgb(var(--bento-shadow))] sm:p-6 lg:flex-row lg:items-center lg:justify-between"
			>
				<div class="max-w-md space-y-1">
					<h2 id="follow-us-heading" class="text-lg font-black text-ink sm:text-xl">
						{m.home_follow_title()}
					</h2>
					<p class="text-sm font-medium text-ink-soft">{m.home_follow_body()}</p>
				</div>

				<ul class="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-3">
					{#each channels as channel (channel.key)}
						<li>
							<a
								href={channel.url}
								target="_blank"
								rel="noopener external"
								aria-label={m.home_follow_on({ platform: channel.name })}
								class="group flex items-center gap-2.5 rounded-2xl border-2 border-edge bg-panel px-3.5 py-2.5 shadow-[2px_2px_0px_0px_rgb(var(--bento-shadow))] transition-all hover:-translate-y-0.5 hover:bg-well focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
							>
								<PlatformGlyph name={channel.name} class="size-5 shrink-0" />
								<span class="min-w-0">
									<span class="block text-xs font-black text-ink">{channel.name}</span>
									{#if channel.followers !== null && channel.followers !== undefined}
										<span class="block text-[11px] font-bold text-ink-dim tabular-nums">
											{m.home_follow_count({ count: formatReach(channel.followers) })}
										</span>
									{/if}
								</span>
								<ArrowUpRight
									class="ms-auto h-4 w-4 shrink-0 text-ink-faint transition-colors group-hover:text-brand-fg"
								/>
							</a>
						</li>
					{/each}
				</ul>
			</div>
		</section>
	{:else}
		<ul class="flex flex-wrap items-center gap-2" aria-label={m.footer_follow_label()}>
			{#each channels as channel (channel.key)}
				<li>
					<a
						href={channel.url}
						target="_blank"
						rel="noopener external"
						aria-label={m.home_follow_on({ platform: channel.name })}
						title={channel.name}
						class="grid size-9 place-items-center rounded-xl border-2 border-edge bg-surface transition-colors hover:bg-well focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
					>
						<PlatformGlyph name={channel.name} class="size-4" />
					</a>
				</li>
			{/each}
		</ul>
	{/if}
{/if}
