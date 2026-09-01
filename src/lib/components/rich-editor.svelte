<script lang="ts">
	/* eslint-disable @typescript-eslint/no-explicit-any --
	   The editor instance is Tiptap's `Editor`, and Tipex does not re-export the
	   type. Every use of it here is a documented Tiptap command — `chain()`,
	   `isActive()`, `getHTML()` — so naming the type would restate the library's
	   own API without checking anything this file can get wrong. */
	import { untrack } from 'svelte';
	import { Tipex, defaultExtensions } from '@friendofsvelte/tipex';
	import Placeholder from '@tiptap/extension-placeholder';
	import * as m from '$lib/paraglide/messages';
	import { toast } from 'svelte-sonner';
	import {
		Bold,
		Italic,
		Underline,
		Strikethrough,
		Heading2,
		Heading3,
		List,
		ListOrdered,
		ListChecks,
		Quote,
		Code2,
		Minus,
		Link2,
		Link2Off,
		ImagePlus,
		Undo2,
		Redo2,
		RemoveFormatting,
		LoaderCircle
	} from '@lucide/svelte';

	/**
	 * The rich text editor an article is written in.
	 *
	 * Two things make it more than a wrapper around Tipex.
	 *
	 * The content area carries `.article-body`, the same class the published
	 * page uses, so the editor is a preview rather than an approximation — a
	 * heading is the size it will be, and a code block is on the same dark card.
	 *
	 * And the value is mirrored into a hidden input, so this posts as an
	 * ordinary form field. The editor is a `contenteditable`, which no form
	 * submits; without the mirror every page using it would need its own
	 * JavaScript to get the body to the server, and would lose the body
	 * entirely if that script had not run yet.
	 */
	let {
		value = $bindable(''),
		name,
		label,
		hint = '',
		error = '',
		/** Where an inserted image is POSTed. Omit to hide the image button. */
		uploadUrl = '',
		placeholder = ''
	}: {
		value?: string;
		name: string;
		label: string;
		hint?: string;
		error?: string;
		uploadUrl?: string;
		placeholder?: string;
	} = $props();

	let editor = $state<any>();
	let fileInput = $state<HTMLInputElement>();
	let uploading = $state(false);

	/*
	 * Tipex's own set, with the placeholder swapped for a configured one — the
	 * default carries no text, so an empty editor is a blank rectangle with no
	 * indication that it is where the article goes.
	 */
	const extensions = untrack(() => [
		...defaultExtensions.filter((extension) => extension.name !== 'placeholder'),
		Placeholder.configure({ placeholder, showOnlyWhenEditable: false })
	]);

	/**
	 * Puts the article's own class on the editable node.
	 *
	 * ProseMirror creates that element itself, so it cannot be given a class in
	 * markup, and Tipex exposes no `editorProps` to pass one through. Without
	 * it every rule in `.article-body` misses and the editor stops resembling
	 * the page it is writing.
	 */
	const onCreate = ({ editor: instance }: { editor: any }) => {
		instance.view.dom.classList.add('article-body');
	};

	/** Open only while a link is being typed; see `applyLink`. */
	let linkOpen = $state(false);
	let linkValue = $state('');
	let linkInput = $state<HTMLInputElement>();

	/* The body as it stood when this component was created. Read once: handing
	   Tipex a value that changes would reset the editor mid-sentence, and the
	   editor is the owner of this value from mount onwards. */
	const initialBody = value;

	const sync = () => {
		if (!editor) return;
		/* `isEmpty` rather than the markup, because an emptied editor still
		   holds `<p></p>` — which would save as a body with a blank paragraph
		   in it and count as "has content" everywhere downstream. */
		value = editor.isEmpty ? '' : editor.getHTML();
	};

	const run = (fn: (chain: any) => any) => {
		if (!editor) return;
		fn(editor.chain().focus()).run();
		sync();
	};

	/** True when the cursor sits inside `mark`, so its button can show pressed. */
	const active = (mark: string, attrs?: Record<string, unknown>) =>
		Boolean(editor?.isActive(mark, attrs));

	/**
	 * Opens the link box, prefilled with the link the cursor is already in.
	 *
	 * A browser `prompt()` would be fewer lines and is what most editors reach
	 * for, but it is modal over the whole tab and unstyleable, and on a phone it
	 * takes the keyboard away from the selection it is about to act on.
	 */
	function openLink() {
		linkValue = editor?.getAttributes('link')?.href ?? '';
		linkOpen = true;
		/* The input does not exist until the box renders. */
		queueMicrotask(() => linkInput?.focus());
	}

	function applyLink() {
		const href = linkValue.trim();
		linkOpen = false;
		if (!href) return;

		/*
		 * Only http(s) and mailto reach the document. `javascript:` in an href
		 * executes on click, and the sanitiser on the server drops it — so
		 * without this check the operator would insert a link, see it in the
		 * editor, save, and find it silently gone from the published page.
		 */
		if (!/^(https?:\/\/|mailto:|\/)/i.test(href)) {
			toast.error(m.re_link_invalid());
			return;
		}

		run((chain) => chain.extendMarkRange('link').setLink({ href }));
	}

	/**
	 * Uploads a picked image and puts it where the cursor is.
	 *
	 * The upload goes through the same server route every other upload does, so
	 * the file is type-checked, size-checked and stored under a generated name
	 * rather than embedded as base64 — a pasted data URL would otherwise be
	 * carried in the row, the feed and every page render of the article.
	 */
	async function uploadImage(file: File) {
		uploading = true;
		try {
			const body = new FormData();
			body.append('file', file);
			const response = await fetch(uploadUrl, { method: 'POST', body });
			const result = await response.json().catch(() => ({}));

			if (!response.ok || !result?.url) {
				toast.error(result?.message ?? m.re_upload_failed());
				return;
			}

			run((chain) => chain.setImage({ src: result.url, alt: file.name }));
		} catch (err) {
			console.error('Inline image upload failed:', err);
			toast.error(m.re_upload_failed());
		} finally {
			uploading = false;
		}
	}

	function onPickImage(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		/* Cleared so that picking the same file twice in a row still fires. */
		input.value = '';
		if (file) uploadImage(file);
	}

	const buttonClass = (isOn: boolean) =>
		`flex h-8 w-8 items-center justify-center rounded-lg border-2 transition-colors ${
			isOn
				? 'border-edge bg-inverse text-inverse-ink'
				: 'border-transparent text-ink-soft hover:border-edge-soft hover:bg-well'
		}`;
</script>

<div class="space-y-1.5">
	<div class="flex items-baseline justify-between gap-3">
		<span class="text-xs font-black tracking-wide text-ink">{label}</span>
		{#if hint}
			<span class="text-[11px] font-medium text-ink-dim">{hint}</span>
		{/if}
	</div>

	<div
		class="overflow-hidden rounded-2xl border-2 bg-surface shadow-[2px_2px_0px_0px_rgb(var(--bento-shadow))] {error
			? 'border-danger-edge'
			: 'border-edge'}"
	>
		<Tipex
			body={initialBody}
			{extensions}
			controlComponent={null}
			floating={false}
			autofocus={false}
			bind:tipex={editor}
			oncreate={onCreate}
			onupdate={sync}
			class="flex flex-col"
		>
			{#snippet head(instance)}
				<!-- `instance` is reassigned on every transaction, which is what makes
				     the pressed states below update as the cursor moves. -->
				{@const _ = instance}
				<div
					class="flex flex-wrap items-center gap-0.5 border-b-2 border-edge bg-panel px-2 py-1.5"
					role="toolbar"
					aria-label={label}
				>
					<button
						type="button"
						class={buttonClass(active('bold'))}
						aria-pressed={active('bold')}
						title={m.re_bold()}
						onclick={() => run((c) => c.toggleBold())}
					>
						<Bold class="h-4 w-4" />
					</button>
					<button
						type="button"
						class={buttonClass(active('italic'))}
						aria-pressed={active('italic')}
						title={m.re_italic()}
						onclick={() => run((c) => c.toggleItalic())}
					>
						<Italic class="h-4 w-4" />
					</button>
					<button
						type="button"
						class={buttonClass(active('underline'))}
						aria-pressed={active('underline')}
						title={m.re_underline()}
						onclick={() => run((c) => c.toggleUnderline())}
					>
						<Underline class="h-4 w-4" />
					</button>
					<button
						type="button"
						class={buttonClass(active('strike'))}
						aria-pressed={active('strike')}
						title={m.re_strike()}
						onclick={() => run((c) => c.toggleStrike())}
					>
						<Strikethrough class="h-4 w-4" />
					</button>

					<span class="mx-1 h-5 w-px bg-edge-mid"></span>

					<!-- H1 is the article title, which the page renders itself. An
					     author who could also type one would produce two. -->
					<button
						type="button"
						class={buttonClass(active('heading', { level: 2 }))}
						aria-pressed={active('heading', { level: 2 })}
						title={m.re_heading_2()}
						onclick={() => run((c) => c.toggleHeading({ level: 2 }))}
					>
						<Heading2 class="h-4 w-4" />
					</button>
					<button
						type="button"
						class={buttonClass(active('heading', { level: 3 }))}
						aria-pressed={active('heading', { level: 3 })}
						title={m.re_heading_3()}
						onclick={() => run((c) => c.toggleHeading({ level: 3 }))}
					>
						<Heading3 class="h-4 w-4" />
					</button>

					<span class="mx-1 h-5 w-px bg-edge-mid"></span>

					<button
						type="button"
						class={buttonClass(active('bulletList'))}
						aria-pressed={active('bulletList')}
						title={m.re_bullets()}
						onclick={() => run((c) => c.toggleBulletList())}
					>
						<List class="h-4 w-4" />
					</button>
					<button
						type="button"
						class={buttonClass(active('orderedList'))}
						aria-pressed={active('orderedList')}
						title={m.re_numbers()}
						onclick={() => run((c) => c.toggleOrderedList())}
					>
						<ListOrdered class="h-4 w-4" />
					</button>
					<button
						type="button"
						class={buttonClass(active('taskList'))}
						aria-pressed={active('taskList')}
						title={m.re_checklist()}
						onclick={() => run((c) => c.toggleTaskList())}
					>
						<ListChecks class="h-4 w-4" />
					</button>
					<button
						type="button"
						class={buttonClass(active('blockquote'))}
						aria-pressed={active('blockquote')}
						title={m.re_quote()}
						onclick={() => run((c) => c.toggleBlockquote())}
					>
						<Quote class="h-4 w-4" />
					</button>
					<button
						type="button"
						class={buttonClass(active('codeBlock'))}
						aria-pressed={active('codeBlock')}
						title={m.re_code()}
						onclick={() => run((c) => c.toggleCodeBlock())}
					>
						<Code2 class="h-4 w-4" />
					</button>
					<button
						type="button"
						class={buttonClass(false)}
						title={m.re_divider()}
						onclick={() => run((c) => c.setHorizontalRule())}
					>
						<Minus class="h-4 w-4" />
					</button>

					<span class="mx-1 h-5 w-px bg-edge-mid"></span>

					<button
						type="button"
						class={buttonClass(active('link'))}
						aria-pressed={active('link')}
						title={m.re_link()}
						onclick={openLink}
					>
						<Link2 class="h-4 w-4" />
					</button>
					{#if active('link')}
						<button
							type="button"
							class={buttonClass(false)}
							title={m.re_unlink()}
							onclick={() => run((c) => c.extendMarkRange('link').unsetLink())}
						>
							<Link2Off class="h-4 w-4" />
						</button>
					{/if}

					{#if uploadUrl}
						<button
							type="button"
							class={buttonClass(false)}
							title={m.re_image()}
							disabled={uploading}
							onclick={() => fileInput?.click()}
						>
							{#if uploading}
								<LoaderCircle class="h-4 w-4 animate-spin" />
							{:else}
								<ImagePlus class="h-4 w-4" />
							{/if}
						</button>
					{/if}

					<span class="mx-1 h-5 w-px bg-edge-mid"></span>

					<button
						type="button"
						class={buttonClass(false)}
						title={m.re_clear_formatting()}
						onclick={() => run((c) => c.unsetAllMarks().clearNodes())}
					>
						<RemoveFormatting class="h-4 w-4" />
					</button>

					<div class="ms-auto flex items-center gap-0.5">
						<button
							type="button"
							class={buttonClass(false)}
							title={m.re_undo()}
							onclick={() => run((c) => c.undo())}
						>
							<Undo2 class="h-4 w-4" />
						</button>
						<button
							type="button"
							class={buttonClass(false)}
							title={m.re_redo()}
							onclick={() => run((c) => c.redo())}
						>
							<Redo2 class="h-4 w-4" />
						</button>
					</div>
				</div>

				{#if linkOpen}
					<div class="flex items-center gap-2 border-b-2 border-edge-soft bg-well px-3 py-2">
						<input
							bind:this={linkInput}
							bind:value={linkValue}
							type="url"
							inputmode="url"
							placeholder="https://"
							aria-label={m.re_link()}
							class="min-w-0 flex-1 rounded-lg border-2 border-edge-mid bg-surface px-2.5 py-1.5 text-xs font-medium text-ink outline-none focus:border-edge"
							onkeydown={(event) => {
								/* Enter must not reach the surrounding form: this box is
								   inside the post editor, and submitting it here would save
								   the article instead of adding the link. */
								if (event.key === 'Enter') {
									event.preventDefault();
									applyLink();
								}
								if (event.key === 'Escape') linkOpen = false;
							}}
						/>
						<button
							type="button"
							onclick={applyLink}
							class="rounded-lg border-2 border-edge bg-inverse px-3 py-1.5 text-[11px] font-black text-inverse-ink"
						>
							{m.re_link_apply()}
						</button>
						<button
							type="button"
							onclick={() => (linkOpen = false)}
							class="rounded-lg px-2 py-1.5 text-[11px] font-bold text-ink-soft hover:text-ink"
						>
							{m.common_cancel()}
						</button>
					</div>
				{/if}
			{/snippet}
		</Tipex>
	</div>

	<!--
		What actually posts. The editor is a `contenteditable`, which no form
		submits, so the body reaches the action through this.
	-->
	<input type="hidden" {name} {value} />

	{#if uploadUrl}
		<input
			bind:this={fileInput}
			type="file"
			accept="image/png,image/jpeg,image/webp,image/avif"
			class="hidden"
			onchange={onPickImage}
		/>
	{/if}

	{#if error}
		<p class="text-xs font-bold text-danger-fg">{error}</p>
	{/if}
</div>

<style>
	/* The content area is the article, so it carries the article's own rules.
	   `:global` because the element belongs to ProseMirror, not to this
	   component's markup, and so carries none of its scoping attributes. */
	:global(.tipex-editor-section .ProseMirror) {
		padding: 1.25rem 1.5rem;
	}

	:global(.tipex-editor-section) {
		max-height: 34rem;
		overflow-y: auto;
	}
</style>
