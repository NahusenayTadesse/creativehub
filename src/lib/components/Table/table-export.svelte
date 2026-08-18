<script lang="ts">
	import { Button } from '$lib/components/ui/button/index';
	import { Printer, Download, Grid3x3 } from '@lucide/svelte';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index';
	import { page } from '$app/state';
	import Papa from 'papaparse';
	import * as m from '$lib/paraglide/messages';

	const {
		fileName = page.url.pathname.split('/').pop() || 'export',
		tableId
	}: { fileName?: string; tableId: string } = $props();

	/** Reads the live table out of the DOM so exports match what is on screen. */
	const findTable = () => {
		const table = document.querySelector<HTMLTableElement>(tableId);
		if (!table) console.error(`Table with selector ${tableId} not found.`);
		return table;
	};

	/**
	 * Opens a print-only window containing just the table.
	 *
	 * Printing through the browser rather than generating a PDF keeps images —
	 * the previous jsPDF/autoTable export dropped them. A `<base>` tag makes the
	 * table's relative image URLs resolve against this site.
	 */
	function printTable() {
		const table = findTable();
		if (!table) return;

		const clone = table.cloneNode(true) as HTMLTableElement;

		// Unwrap interactive controls but keep what they wrap: the popover triggers
		// hold the cell's text and the image viewers hold the thumbnail.
		clone.querySelectorAll('button').forEach((button) => {
			button.replaceWith(...Array.from(button.childNodes));
		});
		clone.querySelectorAll('svg').forEach((icon) => icon.remove());

		const win = window.open('', '_blank', 'width=1024,height=768');
		if (!win) {
			console.error('Print window was blocked by the browser.');
			return;
		}

		/* Written into markup below, so it is escaped rather than trusted. */
		const escapeHtml = (value: string) =>
			value.replace(
				/[&<>"']/g,
				(c) =>
					({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string
			);

		const title = escapeHtml(`${fileName} — ${new Date().toLocaleDateString()}`);

		win.document.write(`<!doctype html>
<html>
	<head>
		<base href="${location.origin}/" />
		<title>${title}</title>
		<style>
			* { box-sizing: border-box; }
			body { font-family: system-ui, sans-serif; color: #1a1a1a; margin: 24px; }
			h1 { font-size: 18px; margin: 0 0 16px; }
			table { width: 100%; border-collapse: collapse; font-size: 12px; }
			th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; vertical-align: top; }
			th { background: #f2f2f2; font-weight: 600; }
			tr:nth-child(even) td { background: #fafafa; }
			img { max-width: 72px; max-height: 72px; object-fit: cover; }
			@page { size: landscape; margin: 12mm; }
		</style>
	</head>
	<body>
		<h1>${title}</h1>
		${clone.outerHTML}
	</body>
</html>`);
		win.document.close();

		// Images must finish loading or they print as blanks.
		const start = () => {
			win.focus();
			/* Closing in the same tick cancels the print in some browsers; wait for
			   the dialog to be dismissed, with a timeout in case it never fires. */
			win.addEventListener('afterprint', () => win.close(), { once: true });
			win.print();
			setTimeout(() => !win.closed && win.close(), 60_000);
		};

		const images = Array.from(win.document.images);
		if (images.length === 0) {
			start();
			return;
		}

		let pending = images.length;
		const done = () => {
			if (--pending === 0) start();
		};
		images.forEach((img) => {
			if (img.complete) done();
			else {
				img.addEventListener('load', done, { once: true });
				img.addEventListener('error', done, { once: true });
			}
		});
	}

	/**
	 * Neutralises a spreadsheet formula.
	 *
	 * Every cell here is user-supplied — a bio, a campaign title, a pitch — and
	 * Excel and LibreOffice execute a cell that opens with `=`, `+`, `-` or `@`
	 * when the file is opened. A leading apostrophe is the conventional
	 * mitigation: the spreadsheet treats the rest as literal text, and the
	 * apostrophe itself is not shown.
	 */
	const defuse = (value: string): string => (/^[=+\-@\t\r]/.test(value) ? `'${value}` : value);

	function exportCsv() {
		const table = findTable();
		if (!table) return;

		const rows = Array.from(table.querySelectorAll('tr')).map((row) =>
			Array.from(row.querySelectorAll('th, td')).map((cell) =>
				defuse((cell as HTMLElement).innerText.trim())
			)
		);

		const blob = new Blob([Papa.unparse(rows)], { type: 'text/csv;charset=utf-8;' });
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = `${fileName}.csv`;

		/* The anchor has to be in the document for the click to count in Firefox,
		   and revoking the URL in the same tick can abort the download. */
		link.style.display = 'none';
		document.body.appendChild(link);
		link.click();

		setTimeout(() => {
			link.remove();
			URL.revokeObjectURL(url);
		}, 0);
	}
</script>

<DropdownMenu.Root>
	<DropdownMenu.Trigger>
		{#snippet child({ props })}
			<Button {...props} variant="outline" class="ml-auto">
				<Download class="size-5" />
			</Button>
		{/snippet}
	</DropdownMenu.Trigger>
	<DropdownMenu.Content class="flex w-auto flex-col gap-2 p-2">
		<DropdownMenu.Item class="capitalize">
			{#snippet child({ props })}
				<Button {...props} variant="default" onclick={printTable}>
					<Printer class="size-4 text-white dark:text-black" />
					{m.tbl_print()}
				</Button>
			{/snippet}
		</DropdownMenu.Item>
		<DropdownMenu.Item class="capitalize">
			{#snippet child({ props })}
				<Button {...props} variant="default" onclick={exportCsv}>
					<Grid3x3 class="size-4 text-white dark:text-black" />
					{m.tbl_export_csv()}
				</Button>
			{/snippet}
		</DropdownMenu.Item>
	</DropdownMenu.Content>
</DropdownMenu.Root>
