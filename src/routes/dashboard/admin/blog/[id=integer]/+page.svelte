<script lang="ts">
	import { untrack } from 'svelte';
	import { resolve } from '$app/paths';
	import * as m from '$lib/paraglide/messages';
	import { superForm } from 'sveltekit-superforms';
	import { toast } from 'svelte-sonner';
	import AppImage from '$lib/components/app-image.svelte';
	import PageHeader from '$lib/components/page-header.svelte';
	import RichEditor from '$lib/components/rich-editor.svelte';
	import InputComp from '$lib/formComponents/InputComp.svelte';
	import Errors from '$lib/formComponents/Errors.svelte';
	import LoadingBtn from '$lib/formComponents/LoadingBtn.svelte';
	import CrudDialog, { type CrudField } from '$lib/components/Table/crud-dialog.svelte';
	import CrudDelete from '$lib/components/Table/crud-delete.svelte';
	import { BLOG_STATUSES, formatPostDate, isScheduled, statusClass, statusLabel } from '$lib/blog';
	import { ArrowLeft, ExternalLink, ImageOff, Images, Save } from '@lucide/svelte';

	let { data } = $props();

	/* `resetForm: false`: this page edits one row, and a reset after a save
	   would empty every field the operator is still looking at. */
	const { form, errors, enhance, delayed, allErrors, message } = superForm(
		untrack(() => data.form),
		{ resetForm: false }
	);

	$effect(() => {
		if (!$message) return;
		if ($message.type === 'error') toast.error($message.text);
		else toast.success($message.text);
	});

	const categoryItems = $derived([
		{ value: 0, name: m.bp_no_category() },
		...data.categories.map((category) => ({ value: category.id, name: category.name }))
	]);

	const statusItems = $derived(
		BLOG_STATUSES.map((status) => ({ value: status, name: statusLabel(status) }))
	);

	/** The gallery dialogs' fields. `postId` is stamped by the route, not posted. */
	const imageFields: CrudField[] = $derived([
		{ name: 'image', label: m.bi_image(), type: 'file', placeholder: m.bi_image_hint() },
		{ name: 'caption', label: m.bi_caption(), type: 'text' },
		{ name: 'alt', label: m.bi_alt(), type: 'text', placeholder: m.bi_alt_hint() },
		{ name: 'sortOrder', label: m.common_sort_order(), type: 'number' },
		{
			name: 'isActive',
			label: m.common_visible(),
			type: 'checkboxSingle',
			placeholder: m.bi_visible_hint()
		}
	]);

	const imageValues = (image: (typeof data.images)[number]) => ({
		id: image.id,
		caption: image.caption ?? '',
		alt: image.alt ?? '',
		sortOrder: image.sortOrder,
		isActive: image.isActive
	});
</script>

<svelte:head><title>{m.bp_edit_meta_title({ title: data.post.title })}</title></svelte:head>

<div class="space-y-6">
	<PageHeader eyebrow={m.sb_blog()} title={data.post.title} description={`/blog/${data.post.slug}`}>
		{#snippet actions()}
			<a
				href={resolve('/dashboard/admin/blog')}
				class="inline-flex items-center gap-1.5 rounded-xl border-2 border-edge bg-surface px-3 py-2 text-xs font-black text-ink shadow-[2px_2px_0px_0px_rgb(var(--bento-shadow))] transition-all hover:bg-panel"
			>
				<ArrowLeft class="h-3.5 w-3.5" />
				{m.bp_back()}
			</a>
			{#if data.post.status === 'published'}
				<a
					href={resolve(`/blog/${data.post.slug}`)}
					class="inline-flex items-center gap-1.5 rounded-xl border-2 border-edge bg-surface px-3 py-2 text-xs font-black text-ink shadow-[2px_2px_0px_0px_rgb(var(--bento-shadow))] transition-all hover:bg-panel"
				>
					<ExternalLink class="h-3.5 w-3.5" />
					{m.bp_view()}
				</a>
			{/if}
			<span
				class="rounded-xl border-2 px-3 py-2 text-[11px] font-black tracking-wider uppercase {statusClass(
					data.post.status
				)}"
			>
				{statusLabel(data.post.status)}
			</span>
		{/snippet}
	</PageHeader>

	{#if isScheduled(data.post)}
		<div class="bento-card-yellow text-[11px] font-bold text-warn-fg">
			{m.bp_scheduled_note({ date: formatPostDate(data.post.publishedAt) })}
		</div>
	{/if}

	<form method="POST" action="?/save" use:enhance enctype="multipart/form-data">
		<Errors allErrors={$allErrors} />
		<input type="hidden" name="id" value={data.post.id} />

		<div class="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
			<!-- The article itself -->
			<div class="space-y-6">
				<div class="bento-card bento-card-static space-y-2">
					<InputComp
						{form}
						{errors}
						label={m.bp_field_title()}
						name="title"
						type="text"
						required
						placeholder={m.bp_title_hint()}
					/>
					<InputComp
						{form}
						{errors}
						label={m.bp_excerpt()}
						name="excerpt"
						type="textarea"
						rows={3}
						placeholder={m.bp_excerpt_hint()}
					/>
				</div>

				<div class="bento-card bento-card-static">
					<RichEditor
						name="body"
						bind:value={$form.body}
						label={m.bp_body()}
						hint={m.bp_body_hint()}
						placeholder={m.bp_body_placeholder()}
						error={$errors.body?.[0] ?? ''}
						uploadUrl={resolve('/dashboard/admin/blog/upload')}
					/>
				</div>
			</div>

			<!-- Everything about the article rather than in it -->
			<div class="space-y-6">
				<div class="bento-card bento-card-static space-y-2">
					<h2 class="bento-eyebrow">{m.bp_publishing()}</h2>
					<InputComp
						{form}
						{errors}
						label={m.bp_status()}
						name="status"
						type="select"
						items={statusItems}
					/>
					<InputComp
						{form}
						{errors}
						label={m.bp_publish_date()}
						name="publishedOn"
						type="date"
						futureDays
						hint={m.bp_publish_date_hint()}
					/>
					<InputComp
						{form}
						{errors}
						label={m.bp_author()}
						name="authorName"
						type="text"
						placeholder={m.bp_author_hint()}
					/>
					<InputComp
						{form}
						{errors}
						label={m.bp_featured()}
						name="isFeatured"
						type="checkboxSingle"
						placeholder={m.bp_featured_hint()}
					/>
					<InputComp {form} {errors} label={m.common_sort_order()} name="sortOrder" type="number" />
				</div>

				<div class="bento-card bento-card-static space-y-2">
					<h2 class="bento-eyebrow">{m.bp_filing()}</h2>
					<InputComp
						{form}
						{errors}
						label={m.bp_category()}
						name="categoryId"
						type="select"
						items={categoryItems}
					/>
					<InputComp
						{form}
						{errors}
						label={m.bp_tags()}
						name="tags"
						type="textarea"
						rows={3}
						placeholder={m.bp_tags_hint()}
					/>
				</div>

				<div class="bento-card bento-card-static space-y-2">
					<h2 class="bento-eyebrow">{m.bp_featured_image()}</h2>
					<InputComp
						{form}
						{errors}
						label={m.bp_featured_image()}
						name="featuredImage"
						type="file"
						image={data.post.featuredImage}
						placeholder={m.bp_featured_image_hint()}
					/>
					<InputComp
						{form}
						{errors}
						label={m.bp_image_alt()}
						name="featuredImageAlt"
						type="text"
						placeholder={m.bp_image_alt_hint()}
					/>
				</div>

				<div class="bento-card bento-card-static space-y-2">
					<h2 class="bento-eyebrow">{m.bp_seo()}</h2>
					<InputComp
						{form}
						{errors}
						label={m.bp_meta_title_field()}
						name="metaTitle"
						type="text"
						placeholder={data.post.title}
					/>
					<InputComp
						{form}
						{errors}
						label={m.bp_meta_description()}
						name="metaDescription"
						type="textarea"
						rows={3}
						placeholder={m.bp_meta_description_hint()}
					/>
					<InputComp
						{form}
						{errors}
						label={m.bp_og_image()}
						name="ogImage"
						type="file"
						image={data.post.ogImage ?? ''}
						placeholder={m.bp_og_image_hint()}
					/>
					<InputComp
						{form}
						{errors}
						label={m.bp_no_index()}
						name="noIndex"
						type="checkboxSingle"
						placeholder={m.bp_no_index_hint()}
					/>
				</div>

				<button
					type="submit"
					disabled={$delayed}
					class="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-edge bg-brand py-3 text-xs font-black text-brand-ink shadow-[3px_3px_0px_0px_rgb(var(--bento-shadow))] hover:bg-brand-strong disabled:opacity-60"
				>
					{#if $delayed}
						<LoadingBtn name={m.common_saving()} />
					{:else}
						<Save class="h-4 w-4" />
						{m.common_save_changes()}
					{/if}
				</button>
			</div>
		</div>
	</form>

	<!--
		The gallery sits outside the article form on purpose: each picture is its
		own round trip, and a form cannot be nested inside another. That also means
		adding a picture never risks the unsaved body above it.
	-->
	<div class="bento-card bento-card-static space-y-4">
		<div class="flex flex-wrap items-center justify-between gap-3">
			<div>
				<h2 class="bento-eyebrow">{m.bi_title()}</h2>
				<p class="text-xs font-medium text-ink-soft">{m.bi_description()}</p>
			</div>
			<CrudDialog
				title={m.crud_add({ label: m.bi_label() })}
				data={data.imageAddForm}
				action="?/addImage"
				fields={imageFields}
				trigger={m.bi_add()}
			/>
		</div>

		{#if data.images.length === 0}
			<div class="rounded-2xl border-2 border-dashed border-edge-mid py-10 text-center">
				<Images class="mx-auto h-8 w-8 text-ink-faint" />
				<p class="mt-2 text-xs font-bold text-ink-soft">{m.bi_empty()}</p>
			</div>
		{:else}
			<div class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
				{#each data.images as image (image.id)}
					<div class="space-y-2">
						<div
							class="relative aspect-[4/3] overflow-hidden rounded-xl border-2 border-edge bg-well"
						>
							{#if image.image}
								<AppImage
									src={image.image}
									alt={image.alt ?? image.caption ?? ''}
									kind="media"
									seed={String(image.id)}
									class="h-full w-full object-cover"
									loading="lazy"
									decoding="async"
								/>
							{:else}
								<div class="flex h-full w-full items-center justify-center text-ink-faint">
									<ImageOff class="h-5 w-5" />
								</div>
							{/if}
							<span
								class="absolute top-1.5 left-1.5 rounded-md border border-edge bg-surface px-1.5 py-0.5 text-[10px] font-black text-ink"
							>
								#{image.sortOrder}
							</span>
							{#if !image.isActive}
								<span
									class="absolute top-1.5 right-1.5 rounded-md border border-edge-mid bg-well px-1.5 py-0.5 text-[10px] font-black text-ink-soft uppercase"
								>
									{m.common_hidden()}
								</span>
							{/if}
						</div>

						{#if image.caption}
							<p class="line-clamp-2 text-[11px] font-medium text-ink-soft">{image.caption}</p>
						{/if}

						<div class="flex items-center justify-end gap-1">
							<CrudDialog
								title={m.crud_edit({ label: m.bi_label() })}
								data={data.imageEditForm}
								action="?/editImage"
								fields={imageFields}
								values={imageValues(image)}
								existing={{ image: image.image }}
								variant="outline"
								iconOnly
							/>
							<CrudDelete
								data={data.imageDeleteForm}
								action="?/deleteImage"
								id={image.id}
								name={image.caption ?? m.bi_label()}
							/>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>
