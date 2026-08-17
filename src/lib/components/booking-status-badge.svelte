<script lang="ts">
	import { STATUS_LABELS, ESCROW_LABELS } from '$lib/domain/booking';

	let {
		status,
		kind = 'booking'
	}: { status: string; kind?: 'booking' | 'escrow' | 'application' | 'campaign' } = $props();

	/** State is carried by colour and by wording, never by colour alone. */
	const TONES: Record<string, string> = {
		// booking lifecycle
		proposed: 'bg-slate-100 text-slate-800 border-slate-400',
		negotiating: 'bg-amber-100 text-amber-900 border-amber-500',
		booked: 'bg-indigo-100 text-indigo-900 border-indigo-500',
		in_production: 'bg-indigo-100 text-indigo-900 border-indigo-500',
		submitted: 'bg-amber-100 text-amber-900 border-amber-500',
		revision: 'bg-orange-100 text-orange-900 border-orange-500',
		approved: 'bg-emerald-100 text-emerald-900 border-emerald-500',
		awaiting_settlement: 'bg-amber-100 text-amber-900 border-amber-500',
		completed: 'bg-emerald-100 text-emerald-900 border-emerald-600',
		cancelled: 'bg-red-100 text-red-900 border-red-500',
		disputed: 'bg-red-100 text-red-900 border-red-600',
		// escrow
		unfunded: 'bg-slate-100 text-slate-700 border-slate-400',
		pending: 'bg-amber-100 text-amber-900 border-amber-500',
		held: 'bg-emerald-100 text-emerald-900 border-emerald-500',
		released: 'bg-blue-100 text-blue-900 border-blue-500',
		refunded: 'bg-slate-100 text-slate-700 border-slate-400',
		// applications
		applied: 'bg-slate-100 text-slate-800 border-slate-400',
		shortlisted: 'bg-indigo-100 text-indigo-900 border-indigo-500',
		selected: 'bg-emerald-100 text-emerald-900 border-emerald-600',
		rejected: 'bg-red-100 text-red-900 border-red-500',
		withdrawn: 'bg-slate-100 text-slate-600 border-slate-400',
		// campaigns
		draft: 'bg-slate-100 text-slate-700 border-slate-400',
		published: 'bg-emerald-100 text-emerald-900 border-emerald-600',
		closed: 'bg-slate-200 text-slate-800 border-slate-500'
	};

	const label = $derived(
		kind === 'escrow'
			? (ESCROW_LABELS[status as keyof typeof ESCROW_LABELS] ?? status)
			: kind === 'booking'
				? (STATUS_LABELS[status as keyof typeof STATUS_LABELS] ?? status)
				: status.replace(/_/g, ' ')
	);
</script>

<span
	class="inline-flex items-center rounded-lg border-2 px-2 py-0.5 text-[10px] font-black tracking-wider whitespace-nowrap uppercase {TONES[
		status
	] ?? 'border-slate-400 bg-slate-100 text-slate-700'}"
>
	{label}
</span>
