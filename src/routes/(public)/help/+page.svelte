<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { Search, X, ArrowRight, LifeBuoy, Mail, Phone } from '@lucide/svelte';
	import * as m from '$lib/paraglide/messages';
	import PageMeta from '$lib/components/page-meta.svelte';
	import HelpArticleCard from '$lib/components/help-article-card.svelte';
	import {
		HELP_CATEGORIES,
		HELP_QUICK_LINKS,
		filterByAudience,
		helpArticles,
		helpAudience,
		helpCategoryBlurb,
		helpCategoryTitle,
		searchHelp,
		type HelpCategoryKey
	} from '$lib/domain/help';

	const email = $derived(page.data.settings?.supportEmail ?? 'support@influencerethiopia.com');
	const phone = $derived(page.data.settings?.supportPhone ?? '');

	/* ---------------- What the reader asked for ----------------
	   Both filters live in the URL, so a search or a side is a link somebody
	   can send, a crawler can follow, and the server renders without any
	   Javascript having run. */

	const urlQuery = $derived(page.url.searchParams.get('q')?.trim() ?? '');
	const audience = $derived(helpAudience(page.url.searchParams.get('for')));

	/* Typing filters the page as you go; submitting the form puts the same
	   query in the URL. Writable rather than plain state, so that the box
	   follows the URL when that changes underneath it — a "clear search" link,
	   or the browser's back button — without an effect to copy it across. */
	let typed = $derived(urlQuery);

	const query = $derived(typed.trim());

	const all = $derived(helpArticles());
	const forAudience = $derived(filterByAudience(all, audience));
	const results = $derived(searchHelp(forAudience, query));

	/* The starting six, narrowed to the side the reader picked: offering a
	   brand "post a campaign" to somebody who asked for the creator help is
	   how a filter stops being believed. */
	const quickLinks = $derived(
		HELP_QUICK_LINKS.map((slug) => forAudience.find((article) => article.slug === slug)).filter(
			(article) => article !== undefined
		)
	);

	const byCategory = $derived(
		HELP_CATEGORIES.map((key) => ({
			key,
			articles: forAudience.filter((article) => article.category === key)
		})).filter((group) => group.articles.length > 0)
	);

	/**
	 * The query string for this page with one parameter changed, the other kept.
	 *
	 * Built by hand rather than through `URLSearchParams`, which is a mutable
	 * class Svelte cannot track, and assembled next to `resolve('/help')` at
	 * every use so the route stays one the router has checked.
	 */
	function search(next: { side?: string | null; q?: string | null }) {
		const side = next.side === undefined ? audience : next.side;
		const text = next.q === undefined ? query : next.q;
		const parts = [side ? `for=${side}` : '', text ? `q=${encodeURIComponent(text)}` : ''].filter(
			Boolean
		);
		return parts.length ? `?${parts.join('&')}` : '';
	}

	const audiences: { key: 'brands' | 'creators' | null; label: string }[] = $derived([
		{ key: null, label: m.help_filter_all() },
		{ key: 'brands', label: m.help_filter_brands() },
		{ key: 'creators', label: m.help_filter_creators() }
	]);

	/* ---------------- What a search engine sees ----------------
	   The index is a list of the articles, so a crawler that never runs the
	   filter still finds every page from here. A search result is noindexed
	   instead: it is the same articles in another order. */

	const absolute = (path: string) => new URL(path, page.url.origin).href;

	const jsonLd = $derived({
		'@context': 'https://schema.org',
		'@graph': [
			{
				'@type': 'BreadcrumbList',
				itemListElement: [
					{ '@type': 'ListItem', position: 1, name: 'Influencer Ethiopia', item: absolute('/') },
					{ '@type': 'ListItem', position: 2, name: m.help_title(), item: absolute('/help') }
				]
			},
			{
				'@type': 'ItemList',
				name: m.help_title(),
				itemListElement: all.map((article, index) => ({
					'@type': 'ListItem',
					position: index + 1,
					name: article.title,
					item: absolute(`/help/${article.slug}`)
				}))
			}
		]
	});

	const chip =
		'rounded-full border-2 border-edge px-4 py-2 text-xs font-black tracking-wider uppercase transition-all';
</script>

<PageMeta
	title={m.help_meta_title()}
	description={m.help_meta_description()}
	path="/help"
	noIndex={query.length > 0}
	jsonLd={query ? null : jsonLd}
/>

<div class="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
	<!-- ================= HEADER AND SEARCH ================= -->
	<header class="max-w-3xl space-y-4">
		<h1 class="text-3xl font-black text-ink sm:text-4xl">{m.help_title()}</h1>
		<p class="text-sm leading-relaxed font-medium text-ink-soft sm:text-base">{m.help_intro()}</p>

		<!-- A real GET form: with Javascript it filters as you type, without it
		     it still searches, and either way the query ends up in the URL. -->
		<form method="GET" action={resolve('/help')} class="flex flex-wrap items-center gap-3 pt-2">
			{#if audience}
				<input type="hidden" name="for" value={audience} />
			{/if}
			<label class="relative min-w-0 flex-1" for="help-search">
				<span class="sr-only">{m.help_search_label()}</span>
				<Search
					class="pointer-events-none absolute start-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-dim"
				/>
				<input
					id="help-search"
					name="q"
					type="search"
					bind:value={typed}
					placeholder={m.help_search_placeholder()}
					class="w-full rounded-2xl border-2 border-edge bg-surface py-3.5 ps-11 pe-4 text-sm font-medium text-ink shadow-[2px_2px_0px_0px_rgb(var(--bento-shadow))] placeholder:text-ink-dim focus:ring-2 focus:ring-brand-strong focus:outline-none"
				/>
			</label>
			<button
				type="submit"
				class="rounded-2xl border-2 border-edge bg-inverse px-5 py-3.5 text-xs font-black text-inverse-ink shadow-[2px_2px_0px_0px_rgb(var(--bento-shadow))] transition-all hover:bg-inverse-hover"
			>
				{m.help_search_button()}
			</button>
		</form>

		<!-- Who the reader is. Links rather than buttons, so each side of the
		     help centre is a page that can be sent to somebody. -->
		<div class="flex flex-wrap items-center gap-2 pt-2">
			<span class="sr-only">{m.help_filter_label()}</span>
			{#each audiences as option (option.label)}
				<a
					href="{resolve('/help')}{search({ side: option.key })}"
					class="{chip} {audience === option.key
						? 'bg-inverse text-inverse-ink shadow-[2px_2px_0px_0px_rgb(var(--bento-shadow))]'
						: 'bg-surface text-ink-soft hover:bg-well'}"
				>
					{option.label}
				</a>
			{/each}
		</div>
	</header>

	<div class="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-[15rem_1fr]">
		<!-- ================= TOPIC RAIL ================= -->
		<!-- Hidden on a phone, where the topic sections below are the whole
		     navigation and a second copy of them is just more scrolling. -->
		<nav aria-label={m.help_topics_title()} class="hidden lg:block">
			<div class="sticky top-24 space-y-1">
				<p class="px-3 pb-2 text-xs font-black tracking-widest text-ink-dim uppercase">
					{m.help_topics_title()}
				</p>
				{#each byCategory as group (group.key)}
					<a
						href="{resolve('/help')}#{group.key}"
						class="flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm font-bold text-ink-soft transition-colors hover:bg-panel hover:text-ink"
					>
						{helpCategoryTitle(group.key as HelpCategoryKey)}
						<span class="text-xs font-black text-ink-dim">{group.articles.length}</span>
					</a>
				{/each}
			</div>
		</nav>

		<div class="min-w-0 space-y-12">
			{#if query}
				<!-- ================= SEARCH RESULTS ================= -->
				<section class="space-y-4">
					<div class="flex flex-wrap items-baseline justify-between gap-3">
						<h2 class="text-xl font-black text-ink sm:text-2xl">{m.help_results_title()}</h2>
						<div class="flex items-center gap-3">
							<p class="text-xs font-bold text-ink-dim">
								{m.help_results_count({ count: results.length, total: forAudience.length })}
							</p>
							<a
								href="{resolve('/help')}{search({ q: null })}"
								class="flex items-center gap-1 text-xs font-black text-brand-soft-fg hover:underline"
							>
								<X class="h-3.5 w-3.5" />
								{m.help_search_clear()}
							</a>
						</div>
					</div>

					{#if results.length}
						<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
							{#each results as article (article.slug)}
								<HelpArticleCard {article} showCategory />
							{/each}
						</div>
					{:else}
						<div class="bento-card bento-card-static space-y-2">
							<h3 class="text-base font-black text-ink">{m.help_no_results_title()}</h3>
							<p class="text-sm leading-relaxed font-medium text-ink-soft">
								{m.help_no_results_body()}
							</p>
						</div>
					{/if}
				</section>
			{:else}
				<!-- ================= QUICK LINKS ================= -->
				<section class="space-y-4">
					<h2 class="text-xl font-black text-ink sm:text-2xl">{m.help_quick_title()}</h2>
					<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
						{#each quickLinks as article (article.slug)}
							<a
								href={resolve(`/help/${article.slug}`)}
								class="flex items-center justify-between gap-3 rounded-2xl border-2 border-edge bg-panel px-4 py-3 text-sm font-black text-ink transition-all hover:bg-brand-soft"
							>
								{article.title}
								<ArrowRight class="h-4 w-4 shrink-0 text-ink-dim rtl:rotate-180" />
							</a>
						{/each}
					</div>
				</section>

				<!-- ================= EVERY TOPIC ================= -->
				<section class="space-y-10">
					<h2 class="sr-only">{m.help_browse_title()}</h2>
					{#each byCategory as group (group.key)}
						<div id={group.key} class="scroll-mt-24 space-y-4">
							<div class="space-y-1">
								<h3 class="text-xl font-black text-ink sm:text-2xl">
									{helpCategoryTitle(group.key as HelpCategoryKey)}
								</h3>
								<p class="text-sm font-medium text-ink-soft">
									{helpCategoryBlurb(group.key as HelpCategoryKey)}
								</p>
							</div>
							<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
								{#each group.articles as article (article.slug)}
									<HelpArticleCard {article} />
								{/each}
							</div>
						</div>
					{/each}
				</section>
			{/if}

			<!-- ================= SUPPORT ================= -->
			<section class="bento-card-dark space-y-3">
				<LifeBuoy class="h-6 w-6 text-inverse-brand" />
				<h2 class="text-xl font-black text-inverse-ink">{m.help_contact_title()}</h2>
				<p class="text-sm leading-relaxed font-medium text-inverse-ink-dim">
					{m.help_contact_body({ email })}
				</p>
				<div class="flex flex-wrap items-center gap-3 pt-1">
					<a
						href="mailto:{email}"
						class="flex items-center gap-2 rounded-2xl border-2 border-edge bg-brand px-5 py-3 text-xs font-black text-brand-ink-deep transition-all hover:bg-brand-strong"
					>
						<Mail class="h-4 w-4" />
						{m.help_contact_cta()}
					</a>
					{#if phone}
						<a
							href="tel:{phone}"
							class="flex items-center gap-2 text-xs font-bold text-inverse-ink-dim hover:text-inverse-ink"
						>
							<Phone class="h-4 w-4" />
							{m.help_contact_phone({ phone })}
						</a>
					{/if}
				</div>
			</section>

			<!-- ================= ELSEWHERE ON THE SITE ================= -->
			<section class="space-y-3">
				<h2 class="text-xs font-black tracking-widest text-ink-dim uppercase">
					{m.help_see_also_title()}
				</h2>
				<div class="flex flex-wrap gap-x-5 gap-y-2 text-sm font-bold text-ink-soft">
					<a href={resolve('/how-it-works')} class="hover:text-ink hover:underline">
						{m.help_see_also_hiw()}
					</a>
					<a href={resolve('/discover')} class="hover:text-ink hover:underline">
						{m.help_see_also_discover()}
					</a>
					<a href={resolve('/campaigns')} class="hover:text-ink hover:underline">
						{m.help_see_also_campaigns()}
					</a>
					<a href={resolve('/terms')} class="hover:text-ink hover:underline">
						{m.help_see_also_terms()}
					</a>
					<a href={resolve('/privacy')} class="hover:text-ink hover:underline">
						{m.help_see_also_privacy()}
					</a>
				</div>
			</section>
		</div>
	</div>
</div>
