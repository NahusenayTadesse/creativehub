<script lang="ts" module>
	import type { Item } from '$lib/global.svelte';

	/** Declarative description of one form control, rendered through InputComp. */
	export type CrudField = {
		name: string;
		label: string;
		/** Any type InputComp understands: text, textarea, number, file, select… */
		type?: string;
		required?: boolean;
		placeholder?: string;
		rows?: number;
		items?: Item[];
	};
</script>

<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { ScrollArea } from '$lib/components/ui/scroll-area/index.js';
	import { Button, type ButtonVariant } from '$lib/components/ui/button/index.js';
	import InputComp from '$lib/formComponents/InputComp.svelte';
	import Errors from '$lib/formComponents/Errors.svelte';
	import LoadingBtn from '$lib/formComponents/LoadingBtn.svelte';
	import { Save, Plus, SquarePen } from '@lucide/svelte';
	import { superForm } from 'sveltekit-superforms';
	import { toast } from 'svelte-sonner';

	let {
		title,
		data,
		action,
		fields,
		/** Existing row values to prefill; presence of `id` switches this to edit mode. */
		values = {},
		/** Currently stored asset for each file field, so the dialog can preview it. */
		existing = {},
		trigger,
		variant,
		iconOnly = false
	}: {
		title: string;
		data: any;
		action: string;
		fields: CrudField[];
		values?: Record<string, any>;
		existing?: Record<string, string>;
		trigger?: string;
		variant?: ButtonVariant;
		iconOnly?: boolean;
	} = $props();

	const editing = 'id' in values;
	const formId = `crud-${Math.random().toString(36).slice(2, 9)}`;

	const { form, errors, enhance, delayed, message, allErrors } = superForm(data, {
		resetForm: !editing,
		// Each row renders its own dialog, so they must not share form state.
		id: formId
	});

	// Prefill once at construction, the same way the testimonials dialog does.
	for (const [key, value] of Object.entries(values)) {
		$form[key] = value;
	}

	let open = $state(false);

	$effect(() => {
		if (!$message) return;
		if ($message.type === 'error') {
			toast.error($message.text);
		} else {
			toast.success($message.text);
			open = false;
		}
	});
</script>

<Dialog.Root bind:open>
	<Dialog.Trigger>
		{#snippet child({ props })}
			<Button
				{...props}
				size="sm"
				variant={variant ?? (editing ? 'ghost' : 'default')}
				class="border-0"
			>
				{#if editing}
					<SquarePen class="size-4" />
				{:else}
					<Plus class="size-4" />
				{/if}
				{#if !iconOnly}
					{trigger ?? title}
				{/if}
			</Button>
		{/snippet}
	</Dialog.Trigger>

	<Dialog.Content class="w-lg!">
		<Dialog.Header>
			<Dialog.Title>{title}</Dialog.Title>
		</Dialog.Header>

		<ScrollArea class="h-auto w-full! min-w-0! px-2 pr-4" orientation="both">
			<div class="h-auto max-h-96 w-full lg:max-h-[calc(100vh-14rem)]">
				<form
					{action}
					method="post"
					id={formId}
					use:enhance
					enctype="multipart/form-data"
					class="flex w-full flex-col gap-2 p-1"
				>
					<Errors allErrors={$allErrors} />

					{#if editing}
						<input type="hidden" name="id" value={$form.id} />
					{/if}

					{#each fields as field (field.name)}
						<InputComp
							{form}
							{errors}
							label={field.label}
							name={field.name}
							type={field.type ?? 'text'}
							required={field.required ?? false}
							placeholder={field.placeholder ?? ''}
							rows={field.rows ?? 5}
							items={field.items ?? []}
							image={existing[field.name] ?? ''}
						/>
					{/each}

					<Button type="submit" form={formId} class="mt-4">
						{#if $delayed}
							<LoadingBtn name="Saving" />
						{:else}
							<Save class="size-4" /> {editing ? 'Save Changes' : 'Add'}
						{/if}
					</Button>
				</form>
			</div>
		</ScrollArea>
	</Dialog.Content>
</Dialog.Root>
