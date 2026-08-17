<script lang="ts">
	import * as Collapsible from '$lib/components/ui/collapsible/index.js';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { scale } from 'svelte/transition';
	import { cn } from '$lib/utils';

	let {
		sections,
		closeSidebar
	}: {
		sections: {
			section: string | null;
			items: {
				title: string;
				url: string;
				icon?: any;
				counter?: number;
				isActive?: boolean;
				items?: { title: string; url: string }[];
			}[];
		}[];
		closeSidebar: () => void;
	} = $props();

	function isActive(url: string): boolean {
		const p = page.url.pathname;
		if (url === '/dashboard') return p === '/dashboard';
		return p.startsWith(url) && p !== '/dashboard';
	}

	function isExact(url: string): boolean {
		return page.url.pathname === url;
	}

	const formatCount = (count: number): string => (count > 99 ? '99+' : String(count));
</script>

<nav class="px-2">
	{#each sections as { section, items } (section)}
		<div class="mb-1">
			{#if section}
				<div
					class="px-3 pt-3 pb-1 text-[9px] font-medium tracking-widest text-muted-foreground/70 uppercase"
				>
					{section}
				</div>
			{/if}

			{#each items as item (item.title)}
				{#if item.items}
					<!-- Collapsible group -->
					<Collapsible.Root open={isActive(item.url)} class="group/collapsible">
						{#snippet child({ props })}
							<div {...props}>
								<!-- Parent trigger -->
								<button
									onclick={() => {
										goto(item.url);
										closeSidebar();
									}}
									class={cn(
										'relative flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-[13px] transition-colors duration-150',
										isActive(item.url)
											? 'bg-background font-medium text-foreground shadow-[inset_2px_0_0_hsl(var(--foreground))]'
											: 'text-muted-foreground hover:bg-accent hover:text-foreground'
									)}
								>
									{#if item.icon}
										<item.icon class="h-3.75 w-3.75 shrink-0 opacity-70" />
									{/if}
									<span class="flex-1 text-left">{item.title}</span>

									{#if (item.counter ?? 0) > 0}
										<span
											class="flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-accent px-1.5 text-[10px] font-semibold"
											in:scale={{ duration: 200 }}
										>
											{formatCount(item.counter ?? 0)}
										</span>
									{/if}

									<Collapsible.Trigger {...props}>
										{#snippet child({ props })}
											<span
												{...props}
												onclick={(e) => e.stopPropagation()}
												class="ml-0.5 rounded p-0.5 opacity-40 hover:opacity-70"
											>
												<svg
													class="h-3 w-3 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90"
													viewBox="0 0 12 12"
													fill="none"
													stroke="currentColor"
													stroke-width="1.5"
													stroke-linecap="round"
													stroke-linejoin="round"
												>
													<path d="M4 2l4 4-4 4" />
												</svg>
											</span>
										{/snippet}
									</Collapsible.Trigger>
								</button>

								<!-- Sub-items -->
								<Collapsible.Content>
									<div class="mt-0.5 ml-[26px] border-l border-border/60 pb-1 pl-2.5">
										{#each item.items ?? [] as sub (sub.title)}
											<a
												href={sub.url}
												onclick={closeSidebar}
												class={cn(
													'flex items-center gap-2 rounded-md px-2 py-[5px] text-[12px] no-underline transition-colors duration-150',
													isExact(sub.url)
														? 'bg-accent font-medium text-foreground'
														: 'text-muted-foreground hover:bg-accent hover:text-foreground'
												)}
											>
												<span
													class={cn(
														'h-1 w-1 shrink-0 rounded-full transition-colors',
														isExact(sub.url) ? 'bg-foreground' : 'bg-muted-foreground/50'
													)}
												></span>
												{sub.title}
											</a>
										{/each}
									</div>
								</Collapsible.Content>
							</div>
						{/snippet}
					</Collapsible.Root>
				{:else}
					<!-- Plain link -->
					<div class="relative">
						<a
							href={item.url}
							onclick={closeSidebar}
							class={cn(
								'flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] no-underline transition-colors duration-150',
								isActive(item.url)
									? 'bg-background font-medium text-foreground shadow-[inset_2px_0_0_hsl(var(--foreground))]'
									: 'text-muted-foreground hover:bg-accent hover:text-foreground'
							)}
						>
							{#if item.icon}
								<item.icon class="h-[15px] w-[15px] shrink-0 opacity-70" />
							{/if}
							<span class="flex-1">{item.title}</span>

							{#if (item.counter ?? 0) > 0}
								<span
									class="flex h-4.5 min-w-4.5 items-center justify-center rounded-full px-1.5 text-[10px] font-semibold"
									in:scale={{ duration: 200 }}
								>
									{formatCount(item.counter ?? 0)}
								</span>
							{/if}
						</a>
					</div>
				{/if}
			{/each}
		</div>
	{/each}
</nav>
