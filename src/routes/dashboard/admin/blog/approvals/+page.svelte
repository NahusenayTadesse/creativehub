<script lang="ts">
	import type { SubmitFunction } from '@sveltejs/kit';
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';
	import { toast } from 'svelte-sonner';
	import * as m from '$lib/paraglide/messages';
	import AppImage from '$lib/components/app-image.svelte';
	import PageHeader from '$lib/components/page-header.svelte';
	import PaginationBar from '$lib/components/pagination-bar.svelte';
	import SearchInput from '$lib/components/search-input.svelte';
	import InputComp from '$lib/formComponents/InputComp.svelte';
	import { accentTile, formatPostDate } from '$lib/blog';
	import { authorProfile } from '$lib/domain/blog-post';
	import {
		Check,
		Clock,
		ExternalLink,
		ImageOff,
		Inbox,
		Newspaper,
		SquarePen,
		X
	} from '@lucide/svelte';

	let { data } = $props();

	/* One note per row, carried into whichever outcome is picked as a hidden
	   field, so switching between approve and reject keeps what was typed. */
	let notes = $state<Record<number, string>>({});

	const handle =
		(text: string): SubmitFunction =>
		() =>
		async ({ result, update }) => {
			if (result.type === 'failure') toast.error(result.data?.message ?? m.common_refused());
			else if (result.type === 'success') toast.success(text);
			await update();
		};
</script>

<svelte:head><title>{m.bq_meta_title()}</title></svelte:head>

<div class="space-y-6">
	<PageHeader eyebrow={m.sb_blog()} title={m.bq_title()} description={m.bq_description()}>
		{#snippet actions()}
			<a
				href={resolve('/dashboard/admin/blog')}
				class="inline-flex items-center gap-1.5 rounded-xl border-2 border-edge bg-surface px-3 py-2 text-xs font-black text-ink shadow-[2px_2px_0px_0px_rgb(var(--bento-shadow))] transition-all hover:bg-panel"
			>
				<Newspaper class="h-3.5 w-3.5" />
				{m.sb_blog_posts()}
			</a>
		{/snippet}
	</PageHeader>

	<div class="flex flex-wrap items-center justify-between gap-3">
		<SearchInput value={data.posts.state.search} class="w-full sm:w-72" />
		{#if data.posts.total > 0}
			<span class="text-xs font-bold text-ink-soft">
				{m.pg_showing({ start: data.posts.from, end: data.posts.to, total: data.posts.total })}
			</span>
		{/if}
	</div>

	{#if data.posts.rows.length === 0}
		<div class="bento-card bento-card-static space-y-3 py-16 text-center">
			<Inbox class="mx-auto h-10 w-10 text-ink-faint" />
			<h3 class="text-base font-black text-ink">{m.bq_empty()}</h3>
			<p class="mx-auto max-w-sm text-xs font-medium text-ink-soft">{m.bq_empty_hint()}</p>
		</div>
	{:else}
		<div class="space-y-4">
			{#each data.posts.rows as post (post.id)}
				{@const profile = authorProfile(post)}
				<div class="bento-card bento-card-static space-y-4">
					<div class="flex flex-col gap-4 sm:flex-row">
						<div
							class="h-28 w-full shrink-0 overflow-hidden rounded-xl border-2 border-edge bg-well sm:w-40"
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
									class="rounded-md border-2 border-info-edge bg-info-soft px-2 py-0.5 text-[10px] font-black tracking-wider text-info-fg uppercase"
								>
									{profile?.kind === 'organization' ? m.bq_from_brand() : m.bq_from_creator()}
								</span>
								{#if post.categoryName}
									<span
										class="rounded-md border border-edge px-2 py-0.5 text-[10px] font-black text-ink {accentTile(
											post.categoryAccent
										)}"
									>
										{post.categoryName}
									</span>
								{/if}
								{#if post.readingMinutes}
									<span
										class="inline-flex items-center gap-1 text-[10px] font-black text-ink-dim uppercase"
									>
										<Clock class="h-3 w-3" />
										{m.bp_read_minutes({ minutes: post.readingMinutes })}
									</span>
								{/if}
								{#if post.publishedAt}
									<!-- Already been live once: this is a correction to an
									     article readers may have open right now. -->
									<span
										class="rounded-md border border-edge-mid bg-tile-yellow px-2 py-0.5 text-[10px] font-black text-ink"
									>
										{m.bq_was_live()}
									</span>
								{/if}
							</div>

							<h3 class="line-clamp-2 text-sm font-black text-ink">{post.title}</h3>

							{#if post.excerpt}
								<p class="line-clamp-3 text-xs font-medium text-ink-soft">{post.excerpt}</p>
							{/if}

							<p class="text-[11px] font-bold text-ink-dim">
								{#if profile}
									<a
										href={resolve(profile.href)}
										target="_blank"
										class="hover:text-brand-fg hover:underline"
									>
										{post.authorName}
									</a>
								{:else}
									{post.authorName}
								{/if}
								· {m.bq_submitted_on({ date: formatPostDate(post.submittedAt) })}
							</p>
						</div>

						<div class="flex shrink-0 flex-row gap-2 sm:flex-col">
							<!-- The article as a reader would meet it. An operator may open
							     an unpublished post, which is what makes this a preview. -->
							<a
								href={resolve(`/blog/${post.slug}`)}
								target="_blank"
								class="inline-flex items-center gap-1.5 rounded-lg border-2 border-edge bg-surface px-3 py-2 text-xs font-black text-ink transition-colors hover:bg-panel"
							>
								<ExternalLink class="h-3.5 w-3.5" />
								{m.bq_read()}
							</a>
							<a
								href={resolve(`/dashboard/admin/blog/${post.id}`)}
								class="inline-flex items-center gap-1.5 rounded-lg border-2 border-edge bg-surface px-3 py-2 text-xs font-black text-ink transition-colors hover:bg-panel"
							>
								<SquarePen class="h-3.5 w-3.5" />
								{m.crud_edit_short()}
							</a>
						</div>
					</div>

					<div class="space-y-2 border-t-2 border-edge-soft pt-3">
						<InputComp
							name="note-{post.id}"
							type="textarea"
							rows={2}
							label={m.bq_note()}
							placeholder={m.bq_note_hint()}
							bind:value={notes[post.id]}
						/>

						<div class="flex flex-wrap justify-end gap-2">
							<form method="POST" action="?/decide" use:enhance={handle(m.bq_rejected())}>
								<input type="hidden" name="id" value={post.id} />
								<input type="hidden" name="decision" value="reject" />
								<input type="hidden" name="note" value={notes[post.id] ?? ''} />
								<button
									type="submit"
									class="flex items-center gap-1.5 rounded-xl border-2 border-edge bg-surface px-3 py-1.5 text-xs font-black text-danger-fg hover:bg-danger-soft"
								>
									<X class="h-3.5 w-3.5" />
									{m.bq_reject()}
								</button>
							</form>

							<form method="POST" action="?/decide" use:enhance={handle(m.bq_approved())}>
								<input type="hidden" name="id" value={post.id} />
								<input type="hidden" name="decision" value="approve" />
								<input type="hidden" name="note" value={notes[post.id] ?? ''} />
								<button
									type="submit"
									class="flex items-center gap-1.5 rounded-xl border-2 border-edge bg-brand px-3 py-1.5 text-xs font-black text-brand-ink hover:bg-brand-strong"
								>
									<Check class="h-3.5 w-3.5" />
									{m.bq_approve()}
								</button>
							</form>
						</div>
					</div>
				</div>
			{/each}
		</div>

		<PaginationBar result={data.posts} />
	{/if}
</div>
