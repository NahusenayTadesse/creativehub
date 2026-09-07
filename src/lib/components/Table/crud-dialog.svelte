<script lang="ts" module>
	import type { SuperValidated } from 'sveltekit-superforms';
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
		/**
		 * Marks this field as one that can be checked against the outside world
		 * before the form is saved — today, whether a social handle names a real
		 * account. The dialog stays generic: it knows only that there is an
		 * endpoint to POST the form's current values to, and that the answer is
		 * `{ status, text, url }`. What the statuses mean is the endpoint's
		 * business.
		 */
		check?: {
			/** POST target. Receives every field's current value as JSON. */
			endpoint: string;
			/** Button label, e.g. "Check this account". */
			label: string;
		};
	};

	/** The shape a `check` endpoint answers with. */
	export type CheckResult = {
		status: 'found' | 'not_found' | 'unknown';
		text: string;
		url?: string | null;
	};
</script>

<script lang="ts">
	import { untrack } from 'svelte';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { ScrollArea } from '$lib/components/ui/scroll-area/index.js';
	import { Button, type ButtonVariant } from '$lib/components/ui/button/index.js';
	import InputComp from '$lib/formComponents/InputComp.svelte';
	import Errors from '$lib/formComponents/Errors.svelte';
	import LoadingBtn from '$lib/formComponents/LoadingBtn.svelte';
	import {
		Save,
		Plus,
		SquarePen,
		Search,
		CircleCheck,
		CircleAlert,
		CircleHelp
	} from '@lucide/svelte';
	import { superForm } from 'sveltekit-superforms';
	import { toast } from 'svelte-sonner';
	import * as m from '$lib/paraglide/messages';

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
		data: SuperValidated<Record<string, unknown>>;
		action: string;
		fields: CrudField[];
		values?: Record<string, unknown>;
		existing?: Record<string, string>;
		trigger?: string;
		variant?: ButtonVariant;
		iconOnly?: boolean;
	} = $props();

	const editing = untrack(() => 'id' in values);
	const formId = `crud-${Math.random().toString(36).slice(2, 9)}`;

	const { form, errors, enhance, delayed, message, allErrors } = superForm(
		untrack(() => data),
		{
			resetForm: !editing,
			// Each row renders its own dialog, so they must not share form state.
			id: formId
		}
	);

	const prefill = () => {
		for (const [key, value] of Object.entries(values)) $form[key] = value;
	};

	prefill();

	let open = $state(false);

	/**
	 * Re-prefills when the row behind this dialog changes, but only while it is
	 * shut.
	 *
	 * `crud-section` keys these by row id, so an instance keeps its identity
	 * across an invalidation — and used to keep the values it was constructed
	 * with, so a row edited elsewhere opened showing the old ones. Guarding on
	 * `open` is what stops the same reload from wiping out an edit in progress.
	 */
	let prefilled = $state(untrack(() => JSON.stringify(values)));
	$effect(() => {
		const next = JSON.stringify(values);
		if (next === prefilled || open) return;
		prefilled = next;
		prefill();
	});

	$effect(() => {
		if (!$message) return;
		if ($message.type === 'error') {
			toast.error($message.text);
		} else {
			toast.success($message.text);
			open = false;
		}
	});

	/* One verdict per checkable field, keyed by field name, cleared as soon as
	   the value it was about changes — a tick beside an edited handle would be
	   describing the handle before it. */
	let checks = $state<Record<string, CheckResult | undefined>>({});
	let checking = $state<Record<string, boolean>>({});
	let checkedValue: Record<string, string> = {};

	async function runCheck(field: CrudField) {
		if (!field.check || checking[field.name]) return;
		checking[field.name] = true;
		checks[field.name] = undefined;
		try {
			const response = await fetch(field.check.endpoint, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify($form)
			});
			if (!response.ok) throw new Error(String(response.status));
			checks[field.name] = (await response.json()) as CheckResult;
			checkedValue[field.name] = String($form[field.name] ?? '');
		} catch {
			toast.error(m.crud_check_failed());
		} finally {
			checking[field.name] = false;
		}
	}

	/* The verdict is only about the value that was checked. */
	const verdictFor = (field: CrudField) =>
		checkedValue[field.name] === String($form[field.name] ?? '') ? checks[field.name] : undefined;
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

						{#if field.check}
							{@const verdict = verdictFor(field)}
							<div class="-mt-1 flex flex-wrap items-center gap-2">
								<Button
									type="button"
									size="sm"
									variant="outline"
									disabled={checking[field.name] || !$form[field.name]}
									onclick={() => runCheck(field)}
								>
									{#if checking[field.name]}
										<LoadingBtn name={m.crud_checking()} />
									{:else}
										<Search class="size-4" />
										{field.check.label}
									{/if}
								</Button>

								{#if verdict}
									<span
										class="inline-flex items-center gap-1.5 text-[11px] font-bold {verdict.status ===
										'found'
											? 'text-brand-soft-fg'
											: verdict.status === 'not_found'
												? 'text-danger-fg'
												: 'text-ink-soft'}"
									>
										{#if verdict.status === 'found'}
											<CircleCheck class="size-3.5" />
										{:else if verdict.status === 'not_found'}
											<CircleAlert class="size-3.5" />
										{:else}
											<CircleHelp class="size-3.5" />
										{/if}
										{verdict.text}
										{#if verdict.url}
											<!-- The address the check looked up, on the platform itself. Never a
											     route on this site, so `resolve` has nothing to say about it. -->
											<!-- eslint-disable svelte/no-navigation-without-resolve -->
											<a
												href={verdict.url}
												target="_blank"
												rel="noopener noreferrer nofollow"
												class="underline underline-offset-2"
											>
												{m.crud_check_open()}
											</a>
											<!-- eslint-enable svelte/no-navigation-without-resolve -->
										{/if}
									</span>
								{/if}
							</div>
						{/if}
					{/each}

					<Button type="submit" form={formId} class="mt-4">
						{#if $delayed}
							<LoadingBtn name={m.common_saving()} />
						{:else}
							<Save class="size-4" />
							{editing ? m.common_save_changes() : m.common_add()}
						{/if}
					</Button>
				</form>
			</div>
		</ScrollArea>
	</Dialog.Content>
</Dialog.Root>
