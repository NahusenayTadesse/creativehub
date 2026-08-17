<script lang="ts" generics="TData, TValue">
	import {
		type ColumnDef,
		getCoreRowModel,
		getPaginationRowModel,
		type ColumnFilter,
		ColumnFiltering,
		getSortedRowModel,
		type RowSelectionState,
		getFilteredRowModel,
		type PaginationState,
		type SortingState,
		type ColumnFiltersState,
		type VisibilityState,
		type GlobalFilterColumn
	} from '@tanstack/table-core';
	import TableExport from './table-export.svelte';

	import { Input } from '$lib/components/ui/input/index.js';

	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import { ScrollArea } from '$lib/components/ui/scroll-area/index.js';

	let {
		data,
		columns,
		search = true,
		class: className = '',
		fileName = 'File',
		selected = $bindable()
	}: DataTableProps<TData, TValue> = $props();
	// let filterSchema = $derived(
	//   discoverFilterSchema(data).filter(meta => !filterBlacklist.includes(meta.key))
	// );  import { Input } from "$lib/components/ui/input/index.js";

	import { createSvelteTable, FlexRender } from '$lib/components/ui/data-table/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { ChevronDownIcon, Frown, ListOrdered } from '@lucide/svelte';
	import * as Resizable from '$lib/components/ui/resizable/index.js';
	import ResizableHandle from '../ui/resizable/resizable-handle.svelte';
	import { isMobile } from '$lib/global.svelte';

	let pagination = $state<PaginationState>({ pageIndex: 0, pageSize: data.length });
	let columnFilters = $state<ColumnFiltersState>([]);

	type DataTableProps<TData, TValue> = {
		columns: ColumnDef<TData, TValue>[];
		data: TData[];
		search?: boolean;
		class?: string;
		fileName?: string;
		selected?: TData[];
	};

	let sorting = $state<SortingState>([]);
	let globalFilter = $state<GlobalFilterColumn>();

	let columnVisibility = $state<VisibilityState>({});
	let rowSelection = $state<RowSelectionState>({});

	const table = createSvelteTable({
		get data() {
			return data;
		},
		columns,
		state: {
			get pagination() {
				return pagination;
			},
			get sorting() {
				return sorting;
			},
			get columnFilters() {
				return columnFilters;
			},
			get columnVisibility() {
				return columnVisibility;
			},

			get globalFilter() {
				return globalFilter;
			},
			get rowSelection() {
				return rowSelection;
			}
		},
		onPaginationChange: (updater) => {
			if (typeof updater === 'function') {
				pagination = updater(pagination);
			} else {
				pagination = updater;
			}
		},
		onSortingChange: (updater) => {
			if (typeof updater === 'function') {
				sorting = updater(sorting);
			} else {
				sorting = updater;
			}
		},
		onColumnFiltersChange: (updater) => {
			if (typeof updater === 'function') {
				columnFilters = updater(columnFilters);
			} else {
				columnFilters = updater;
			}
		},
		onColumnVisibilityChange: (updater) => {
			if (typeof updater === 'function') {
				columnVisibility = updater(columnVisibility);
			} else {
				columnVisibility = updater;
			}
		},
		onRowSelectionChange: (updater) => {
			if (typeof updater === 'function') {
				rowSelection = updater(rowSelection);
			} else {
				rowSelection = updater;
			}
		},

		getCoreRowModel: getCoreRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getFilteredRowModel: getFilteredRowModel()
	});

	const uniqueTableId = `table-${Math.random().toString(36).substring(2, 15)}`;

	function getTableBreakpoints<T>(data: T[]): number[] {
		const totalItems = data.length;
		const step = 10;
		const breakpoints: number[] = [];

		for (let i = step; i < totalItems; i += step) {
			breakpoints.push(i);
		}

		if (totalItems > 0) {
			breakpoints.push(totalItems);
		}

		return breakpoints;
	}
	if (selected) {
		$effect(() => {
			const selectedRows = table.getSelectedRowModel().rows;

			// Extract the original data from those rows
			selected = selectedRows.map((row) => row.original);
		});
	}
</script>

<!-- min-h-0 is required for flex-child overflow -->
<!-- <div class="flex-1 text-sm text-muted-foreground">
	{table.getFilteredSelectedRowModel().rows.length} of{''}
	{table.getFilteredRowModel().rows.length} row(s) selected.

	{#each table.getFilteredRowModel().rows as selected}
		{selected?.id}
	{/each}
</div> -->
<Resizable.PaneGroup
	direction="horizontal"
	class="mt-4 flex w-full min-w-full gap-0 rounded-lg lg:w-fit lg:min-w-2xl {className}"
>
	<Resizable.Pane
		defaultSize={isMobile()
			? 100
			: table.getAllColumns().filter((col) => col.getIsVisible()).length * 20}
		class="bg-background"
	>
		<ScrollArea orientation="vertical" class="w-full rounded-lg p-2">
			<div class="flex min-w-full flex-col gap-2 rounded-md border-0 px-1">
				
					<ScrollArea
						orientation="horizontal"
						class="flex w-full flex-row rounded-md border whitespace-nowrap"
					>
						<div
							class="flex w-full space-x-4 p-4
						"
						>
						{#if search}
							<Input
								type="search"
								placeholder="Search Table..."
								class="w-64 lg:w-full"
								bind:value={globalFilter}
								oninput={() => table.setGlobalFilter(globalFilter)}
							/>
							{/if}
							<DropdownMenu.Root>
								<DropdownMenu.Trigger>
									{#snippet child({ props })}
										<Button {...props} variant="outline" class="ml-auto"
											>Columns <ChevronDownIcon class="size-5" />
										</Button>
									{/snippet}
								</DropdownMenu.Trigger>
								<DropdownMenu.Content align="end">
									{#each table.getAllColumns().filter((col) => col.getCanHide()) as column (column)}
										<DropdownMenu.CheckboxItem
											class="capitalize"
											bind:checked={
												() => column.getIsVisible(), (v) => column.toggleVisibility(!!v)
											}
										>
											{column.id.replace(/([a-z])([A-Z])/g, '$1 $2')}
										</DropdownMenu.CheckboxItem>
									{/each}
								</DropdownMenu.Content>
							</DropdownMenu.Root>

							<DropdownMenu.Root>
								<DropdownMenu.Trigger>
									{#snippet child({ props })}
										<Button {...props} variant="outline" class="ml-auto"
											>Pages <ChevronDownIcon class="size-5" />
										</Button>
									{/snippet}
								</DropdownMenu.Trigger>
								<DropdownMenu.Content align="center" class="flex w-4! flex-col">
									{#each getTableBreakpoints(data) as column (column)}
										<DropdownMenu.Item
											class="w-4! capitalize"
											onclick={() => {
												table.setPageSize(column);
											}}
										>
											{#snippet child({ props })}
												<Button
													{...props}
													variant={pagination.pageSize === column ? 'default' : 'ghost'}
													size="icon"
													class="max-w-16"
													>{column}
												</Button>
											{/snippet}
										</DropdownMenu.Item>
									{/each}
								</DropdownMenu.Content>
							</DropdownMenu.Root>
							<TableExport {fileName} tableId="#{uniqueTableId}" />
							<Button variant="outline">
								<ListOrdered />
								{table.getFilteredRowModel().rows.length} Results
							</Button>
						</div>
					</ScrollArea>
				
				<div class="rounded-md border">
					<Table.Root id={uniqueTableId} class="relative max-h-96">
						<Table.Header>
							{#each table.getHeaderGroups() as headerGroup (headerGroup.id)}
								<Table.Row>
									{#each headerGroup.headers as header, index}
										<Table.Head
											colspan={header.colSpan}
											class="{index === 1
												? 'sticky left-0 z-10 bg-background'
												: ''} p-0 px-2 text-start"
										>
											{#if !header.isPlaceholder}
												<FlexRender
													content={header.column.columnDef.header}
													context={header.getContext()}
												/>
											{/if}
										</Table.Head>
									{/each}
								</Table.Row>
							{/each}
						</Table.Header>
						<Table.Body>
							{#each table.getRowModel().rows as row (row.id)}
								<Table.Row data-state={row.getIsSelected() && 'selected'}>
									{#each row.getVisibleCells() as cell, index}
										<Table.Cell
											class="word-break capitalize {index === 1
												? 'sticky left-0 z-10 bg-background'
												: ''}"
										>
											<FlexRender
												content={cell.column.columnDef.cell}
												context={cell.getContext()}
											/>
										</Table.Cell>
									{/each}
								</Table.Row>
							{:else}
								<Table.Row>
									<Table.Cell colspan={columns.length} class="text-center font-2xl">
										<div class="flex flex-row items-center justify-center gap-2">
											<Frown class="animate-bounce" /> Nothing found here.
										</div>
									</Table.Cell>
								</Table.Row>
							{/each}
						</Table.Body>
					</Table.Root>

					{#if table.getPageCount() > 1}
						<div
							class="absolute -bottom-5 flex w-full items-end justify-end space-x-2 justify-self-center py-4"
						>
							<Button
								variant="outline"
								size="sm"
								onclick={() => table.previousPage()}
								disabled={!table.getCanPreviousPage()}
							>
								Previous
							</Button>
							<Button
								variant="outline"
								size="sm"
								onclick={() => table.nextPage()}
								disabled={!table.getCanNextPage()}
							>
								Next
							</Button>
						</div>
					{/if}
				</div>
			</div>
		</ScrollArea>
	</Resizable.Pane>
	<ResizableHandle withHandle />
	{#if isMobile()}
		<Resizable.Pane defaultSize={0}></Resizable.Pane>
	{:else}
		<Resizable.Pane></Resizable.Pane>
	{/if}
</Resizable.PaneGroup>
