<script lang="ts">
	/**
	 * Booking value by month. Hand-drawn SVG rather than a chart library: the
	 * bento look needs hard borders and solid offsets, and the shape is simple
	 * enough that a dependency would cost more than it saves.
	 */
	let {
		data = [],
		height = 200
	}: { data: { month: string; total: number; count: number }[]; height?: number } = $props();

	const max = $derived(Math.max(1, ...data.map((d) => d.total)));

	const label = (month: string) => {
		const [year, m] = month.split('-');
		const date = new Date(Number(year), Number(m) - 1, 1);
		return date.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
	};

	let hovered = $state<number | null>(null);
</script>

{#if data.length === 0}
	<p class="py-8 text-center text-xs font-medium text-slate-500">
		No bookings recorded yet — the chart fills in as deals are created.
	</p>
{:else}
	<div class="w-full overflow-x-auto">
		<!-- A single month should read as one column, not a filled panel. -->
		<div class="flex min-w-[320px] items-end gap-3" style="height: {height}px">
			{#each data as point, index (point.month)}
				{@const pct = (point.total / max) * 100}
				<div
					class="flex h-full flex-1 flex-col justify-end gap-2"
					style="max-width: {Math.max(100 / Math.max(data.length, 6), 8)}%"
				>
					<div class="relative flex flex-1 items-end">
						{#if hovered === index}
							<div
								class="absolute -top-1 left-1/2 z-10 -translate-x-1/2 rounded-lg border-2 border-slate-900 bg-white px-2 py-1 text-[10px] font-black whitespace-nowrap shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]"
							>
								{point.total.toLocaleString()} · {point.count} booking{point.count === 1 ? '' : 's'}
							</div>
						{/if}
						<button
							type="button"
							onmouseenter={() => (hovered = index)}
							onmouseleave={() => (hovered = null)}
							onfocus={() => (hovered = index)}
							onblur={() => (hovered = null)}
							aria-label="{label(point.month)}: {point.total.toLocaleString()} across {point.count} bookings"
							class="w-full rounded-t-xl border-2 border-slate-900 bg-emerald-500 transition-all hover:bg-emerald-400"
							style="height: {Math.max(pct, 3)}%"
						></button>
					</div>
					<span class="text-center text-[10px] font-black tracking-wider text-slate-500 uppercase">
						{label(point.month)}
					</span>
				</div>
			{/each}
		</div>
	</div>
{/if}
