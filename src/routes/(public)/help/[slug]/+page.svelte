<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { ChevronRight, Info, ArrowLeft, Mail } from '@lucide/svelte';
	import * as m from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';
	import PageMeta from '$lib/components/page-meta.svelte';
	import HelpArticleCard from '$lib/components/help-article-card.svelte';
	import { helpCategoryTitle } from '$lib/domain/help';

	let { data } = $props();

	const article = $derived(data.article);
	const email = $derived(page.data.settings?.supportEmail ?? 'support@influencerethiopia.com');
	const category = $derived(helpCategoryTitle(article.category));

	/* Back to the reader's own side of the help centre where the article has
	   one, so the trail returns them to the list they came from. The route
	   itself is resolved at the link, which is where the router checks it. */
	const categorySuffix = $derived(
		article.audience === 'everyone'
			? `#${article.category}`
			: `?for=${article.audience}#${article.category}`
	);

	const sideLabel = $derived(
		article.audience === 'brands'
			? m.help_badge_brands()
			: article.audience === 'creators'
				? m.help_badge_creators()
				: m.help_badge_everyone()
	);

	const absolute = (path: string) => new URL(path, page.url.origin).href;

	const jsonLd = $derived({
		'@context': 'https://schema.org',
		'@graph': [
			{
				'@type': 'BreadcrumbList',
				itemListElement: [
					{ '@type': 'ListItem', position: 1, name: 'Influencer Ethiopia', item: absolute('/') },
					{ '@type': 'ListItem', position: 2, name: m.help_title(), item: absolute('/help') },
					{
						'@type': 'ListItem',
						position: 3,
						name: article.title,
						item: absolute(`/help/${article.slug}`)
					}
				]
			},
			{
				'@type': 'TechArticle',
				headline: article.title,
				description: article.summary,
				articleSection: category,
				inLanguage: getLocale(),
				mainEntityOfPage: absolute(`/help/${article.slug}`)
			}
		]
	});
</script>

<PageMeta
	title="{article.title} — {m.help_title()}"
	description={article.summary}
	path="/help/{article.slug}"
	type="article"
	{jsonLd}
/>

<div class="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
	<div class="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_16rem]">
		<article class="max-w-3xl min-w-0">
			<!-- Where the reader is. A real trail, not a back button: an article
			     reached from a search engine has no history to go back to. -->
			<nav aria-label={m.help_breadcrumb()} class="mb-6">
				<ol class="flex flex-wrap items-center gap-1 text-xs font-bold text-ink-dim">
					<li>
						<a href={resolve('/help')} class="hover:text-ink hover:underline"
							>{m.help_breadcrumb()}</a
						>
					</li>
					<li aria-hidden="true"><ChevronRight class="h-3.5 w-3.5 rtl:rotate-180" /></li>
					<li>
						<a href="{resolve('/help')}{categorySuffix}" class="hover:text-ink hover:underline"
							>{category}</a
						>
					</li>
				</ol>
			</nav>

			<header class="space-y-3">
				<span
					class="inline-block rounded-full border border-edge-soft bg-panel px-3 py-1 text-[11px] font-black tracking-widest text-ink-soft uppercase"
				>
					{sideLabel}
				</span>
				<h1 class="text-3xl font-black text-ink sm:text-4xl">{article.title}</h1>
				<p class="text-base leading-relaxed font-medium text-ink-soft">{article.summary}</p>
			</header>

			<div class="mt-8 space-y-6">
				{#each article.blocks as block, index (index)}
					{#if block.kind === 'p'}
						<p class="text-base leading-relaxed font-medium text-ink-soft">{block.text}</p>
					{:else if block.kind === 'steps'}
						<ol class="space-y-3">
							{#each block.items as item, step (step)}
								<li class="flex gap-4">
									<span
										class="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border-2 border-edge bg-panel text-[11px] font-black text-ink"
									>
										{step + 1}
									</span>
									<span class="pt-0.5 text-base leading-relaxed font-medium text-ink">{item}</span>
								</li>
							{/each}
						</ol>
					{:else}
						<p
							class="flex items-start gap-3 rounded-2xl border-2 border-edge-soft bg-panel p-4 text-sm leading-relaxed font-medium text-ink-soft"
						>
							<Info class="mt-0.5 h-4 w-4 shrink-0 text-ink-dim" />
							<span>{block.text}</span>
						</p>
					{/if}
				{/each}
			</div>

			<!-- ================= SUPPORT ================= -->
			<div class="mt-10 rounded-2xl border-2 border-edge bg-well p-5">
				<h2 class="text-base font-black text-ink">{m.help_contact_title()}</h2>
				<p class="mt-1 text-sm leading-relaxed font-medium text-ink-soft">
					{m.help_contact_body({ email })}
				</p>
				<a
					href="mailto:{email}"
					class="mt-3 inline-flex items-center gap-2 rounded-2xl border-2 border-edge bg-surface px-4 py-2.5 text-xs font-black text-ink transition-all hover:bg-brand-soft"
				>
					<Mail class="h-4 w-4" />
					{m.help_contact_cta()}
				</a>
			</div>

			{#if data.siblings.length}
				<!-- ================= MORE IN THIS TOPIC ================= -->
				<!-- The phone's copy of the side rail, which is hidden at this
				     width. Two lists of the same articles on one page is a reader
				     wondering which of them is the complete one. -->
				<section class="mt-12 space-y-4 lg:hidden">
					<h2 class="text-xl font-black text-ink">{m.help_related_title()}</h2>
					<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
						{#each data.siblings as sibling (sibling.slug)}
							<HelpArticleCard article={sibling} />
						{/each}
					</div>
				</section>
			{/if}
		</article>

		<!-- ================= SIDE RAIL ================= -->
		<aside class="hidden lg:sticky lg:top-24 lg:block lg:self-start">
			<div class="space-y-1 rounded-2xl border-2 border-edge bg-surface p-4">
				<p class="px-2 pb-1 text-xs font-black tracking-widest text-ink-dim uppercase">
					{m.help_in_category({ category })}
				</p>
				{#each data.siblings as sibling (sibling.slug)}
					<a
						href={resolve(`/help/${sibling.slug}`)}
						class="block rounded-xl px-2 py-2 text-sm font-bold text-ink-soft transition-colors hover:bg-panel hover:text-ink"
					>
						{sibling.title}
					</a>
				{/each}
				<a
					href={resolve('/help')}
					class="mt-2 flex items-center gap-2 border-t-2 border-edge-soft px-2 pt-3 text-xs font-black text-ink-soft hover:text-ink"
				>
					<ArrowLeft class="h-3.5 w-3.5 rtl:rotate-180" />
					{m.help_back_to_help()}
				</a>
			</div>
		</aside>
	</div>
</div>
