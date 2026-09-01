<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import * as m from '$lib/paraglide/messages';
	import AppImage from '$lib/components/app-image.svelte';
	import PageHeader from '$lib/components/page-header.svelte';
	import PaginationBar from '$lib/components/pagination-bar.svelte';
	import SearchInput from '$lib/components/search-input.svelte';
	import CrudDialog from '$lib/components/Table/crud-dialog.svelte';
	import CrudDelete from '$lib/components/Table/crud-delete.svelte';
	import {
		accentTile,
		BLOG_STATUSES,
		formatPostDate,
		isScheduled,
		statusClass,
		statusLabel
	} from '$lib/blog';
	import { withParams } from '$lib/query';
	import { Clock, ExternalLink, ImageOff, Inbox, SearchX, SquarePen, Tags } from '@lucide/svelte';

	let { data } = $props();

	const listState = $derived(data.posts.state);
	const selectedStatus = $derived(listState.values.status ?? 'all');

	const statusLink = (status: string) =>
		withParams(page.url, { status: status === 'all' ? null : status });

	const countFor = (status: string) => data.statusCounts[status] ?? 0;
	const total = $derived(Object.values(data.statusCounts).reduce((sum, n) => sum + n, 0));
</script>

<svelte:head><title>{m.bp_meta_title()}</title></svelte:head>

<div class="space-y-6">
	<PageHeader eyebrow={m.sb_blog()} title={m.bp_title()} description={m.bp_description()}>
		{#snippet actions()}
			<a
				href={resolve('/dashboard/admin/blog/categories')}
				class="inline-flex items-center gap-1.5 rounded-xl border-2 border-edge bg-surface px-3 py-2 text-xs font-black text-ink shadow-[2px_2px_0px_0px_rgb(var(--bento-shadow))] transition-all hover:bg-panel"
			>
				<Tags class="h-3.5 w-3.5" />
				{m.bc_title()}
			</a>
			<a
				href={resolve('/blog')}
				class="inline-flex items-center gap-1.5 rounded-xl border-2 border-edge bg-surface px-3 py-2 text-xs font-black text-ink shadow-[2px_2px_0px_0px_rgb(var(--bento-shadow))] transition-all hover:bg-panel"
			>
				<ExternalLink class="h-3.5 w-3.5" />
				{m.bp_view_site()}
			</a>
			<CrudDialog
				title={m.bp_new()}
				data={data.createForm}
				action="?/create"
				fields={[
					{
						name: 'title',
						label: m.bp_field_title(),
						required: true,
						placeholder: m.bp_title_hint()
					}
				]}
				trigger={m.bp_new()}
			/>
		{/snippet}
	</PageHeader>

	<!-- State tabs. Each is a link that rewrites the URL, and the counts come
	     from the same query the rows do. -->
	<div class="flex flex-wrap items-center gap-2">
		<a
			href={statusLink('all')}
			data-sveltekit-noscroll
			class="rounded-xl border-2 border-edge px-3 py-1.5 text-[11px] font-black tracking-wider uppercase transition-all {selectedStatus ===
			'all'
				? 'bg-inverse text-inverse-ink shadow-[2px_2px_0px_0px_rgb(var(--bento-shadow))]'
				: 'bg-surface text-ink-soft hover:bg-panel'}"
		>
			{m.common_all()} · {total}
		</a>
		{#each BLOG_STATUSES as status (status)}
			<a
				href={statusLink(status)}
				data-sveltekit-noscroll
				class="rounded-xl border-2 border-edge px-3 py-1.5 text-[11px] font-black tracking-wider uppercase transition-all {selectedStatus ===
				status
					? 'bg-inverse text-inverse-ink shadow-[2px_2px_0px_0px_rgb(var(--bento-shadow))]'
					: 'bg-surface text-ink-soft hover:bg-panel'}"
			>
				{statusLabel(status)} · {countFor(status)}
			</a>
		{/each}
	</div>

	<div class="flex flex-wrap items-center justify-between gap-3">
		<SearchInput value={listState.search} class="w-full sm:w-72" />
		{#if data.posts.total > 0}
			<span class="text-xs font-bold text-ink-soft">
				{m.pg_showing({ start: data.posts.from, end: data.posts.to, total: data.posts.total })}
			</span>
		{/if}
	</div>

	{#if data.posts.rows.length === 0}
		<div class="bento-card bento-card-static space-y-3 py-16 text-center">
			{#if listState.search}
				<SearchX class="mx-auto h-10 w-10 text-ink-faint" />
				<h3 class="text-base font-black text-ink">{m.pg_no_results()}</h3>
				<p class="mx-auto max-w-sm text-xs font-medium text-ink-soft">
					{m.crud_no_search_match({ search: listState.search })}
				</p>
			{:else}
				<Inbox class="mx-auto h-10 w-10 text-ink-faint" />
				<h3 class="text-base font-black text-ink">{m.bp_empty()}</h3>
				<p class="mx-auto max-w-sm text-xs font-medium text-ink-soft">{m.bp_empty_hint()}</p>
			{/if}
		</div>
	{:else}
		<div class="space-y-3">
			{#each data.posts.rows as post (post.id)}
				<div
					class="bento-card bento-card-static flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center"
				>
					<div
						class="h-24 w-full shrink-0 overflow-hidden rounded-xl border-2 border-edge bg-well sm:w-36"
					>
						{#if post.featuredImage}
							<AppImage
								src={post.featuredImage}
								alt={post.featuredImageAlt ?? post.title}
								kind="cover"
								seed={post.slug}
								class="h-full w-full object-cover"
								loading="lazy"
								decoding="async"
							/>
						{:else}
							<div class="flex h-full w-full items-center justify-center text-ink-faint">
								<ImageOff class="h-5 w-5" />
							</div>
						{/if}
					</div>

					<div class="min-w-0 flex-1 space-y-1.5">
						<div class="flex flex-wrap items-center gap-2">
							<span
								class="rounded-md border-2 px-2 py-0.5 text-[10px] font-black tracking-wider uppercase {statusClass(
									post.status
								)}"
							>
								{statusLabel(post.status)}
							</span>
							{#if isScheduled(post)}
								<span
									class="inline-flex items-center gap-1 rounded-md border border-info-edge bg-info-soft px-2 py-0.5 text-[10px] font-black text-info-fg"
								>
									<Clock class="h-3 w-3" />
									{m.bp_scheduled({ date: formatPostDate(post.publishedAt) })}
								</span>
							{/if}
							{#if post.categoryName}
								<span
									class="rounded-md border border-edge px-2 py-0.5 text-[10px] font-black text-ink {accentTile(
										post.categoryAccent
									)}"
								>
									{post.categoryName}
								</span>
							{/if}
							{#if post.isFeatured}
								<span
									class="rounded-md border border-edge bg-tile-yellow px-2 py-0.5 text-[10px] font-black text-ink"
								>
									{m.bp_featured()}
								</span>
							{/if}
						</div>

						<!-- `line-clamp-1` rather than `truncate`: both show one line, but
						     `truncate` sets `white-space: nowrap`, which makes the title's
						     min-content width the whole title — and the dashboard's `main`
						     grows to fit its content rather than clipping it, so one long
						     headline put a horizontal scrollbar under the entire page. -->
						<h3 class="line-clamp-1 text-sm font-black text-ink">{post.title}</h3>

						{#if post.excerpt}
							<p class="line-clamp-2 text-xs font-medium text-ink-soft">{post.excerpt}</p>
						{/if}

						<p class="text-[11px] font-bold text-ink-dim">
							{post.authorName || m.bp_no_author()}
							{#if post.publishedAt}
								· {formatPostDate(post.publishedAt)}
							{/if}
							{#if post.readingMinutes}
								· {m.bp_read_minutes({ minutes: post.readingMinutes })}
							{/if}
						</p>
					</div>

					<div class="flex shrink-0 items-center gap-2 sm:ms-auto">
						{#if post.status === 'published'}
							<a
								href={resolve(`/blog/${post.slug}`)}
								class="rounded-lg border-2 border-edge bg-surface p-2 text-ink-soft transition-colors hover:bg-panel hover:text-ink"
								title={m.bp_view()}
							>
								<ExternalLink class="h-4 w-4" />
							</a>
						{/if}
						<a
							href={resolve(`/dashboard/admin/blog/${post.id}`)}
							class="inline-flex items-center gap-1.5 rounded-lg border-2 border-edge bg-inverse px-3 py-2 text-xs font-black text-inverse-ink transition-colors hover:bg-inverse-hover"
						>
							<SquarePen class="h-3.5 w-3.5" />
							{m.crud_edit_short()}
						</a>
						<CrudDelete data={data.deleteForm} id={post.id} name={post.title} />
					</div>
				</div>
			{/each}
		</div>

		<PaginationBar result={data.posts} />
	{/if}
</div>
