<script lang="ts">
	import { statusLabel, escrowLabel, applicationLabel, campaignLabel } from '$lib/domain/booking';

	let {
		status,
		kind = 'booking'
	}: { status: string; kind?: 'booking' | 'escrow' | 'application' | 'campaign' } = $props();

	/** State is carried by colour and by wording, never by colour alone. */
	const TONES: Record<string, string> = {
		// booking lifecycle
		proposed: 'bg-well text-ink border-edge-mid',
		negotiating: 'bg-warn-soft text-warn-fg border-warn-edge',
		booked: 'bg-info-soft text-info-fg border-info-edge',
		in_production: 'bg-info-soft text-info-fg border-info-edge',
		submitted: 'bg-warn-soft text-warn-fg border-warn-edge',
		revision: 'bg-tint-orange text-tint-orange-fg border-tint-orange-edge',
		approved: 'bg-brand-soft text-brand-soft-fg border-brand-edge',
		awaiting_settlement: 'bg-warn-soft text-warn-fg border-warn-edge',
		completed: 'bg-brand-soft text-brand-soft-fg border-brand-edge',
		cancelled: 'bg-danger-soft text-danger-fg border-danger-edge',
		disputed: 'bg-danger-soft text-danger-fg border-danger-edge',
		// escrow
		unfunded: 'bg-well text-ink-soft border-edge-mid',
		pending: 'bg-warn-soft text-warn-fg border-warn-edge',
		held: 'bg-brand-soft text-brand-soft-fg border-brand-edge',
		released: 'bg-tint-blue text-tint-blue-fg border-tint-blue-edge',
		refunded: 'bg-well text-ink-soft border-edge-mid',
		// applications
		applied: 'bg-well text-ink border-edge-mid',
		shortlisted: 'bg-info-soft text-info-fg border-info-edge',
		selected: 'bg-brand-soft text-brand-soft-fg border-brand-edge',
		rejected: 'bg-danger-soft text-danger-fg border-danger-edge',
		withdrawn: 'bg-well text-ink-soft border-edge-mid',
		// campaigns
		draft: 'bg-well text-ink-soft border-edge-mid',
		published: 'bg-brand-soft text-brand-soft-fg border-brand-edge',
		closed: 'bg-well text-ink border-edge-mid'
	};

	const label = $derived(
		kind === 'escrow'
			? escrowLabel(status)
			: kind === 'booking'
				? statusLabel(status)
				: kind === 'application'
					? applicationLabel(status)
					: campaignLabel(status)
	);
</script>

<span
	class="inline-flex items-center rounded-lg border-2 px-2 py-0.5 text-[10px] font-black tracking-wider whitespace-nowrap uppercase {TONES[
		status
	] ?? 'border-edge-mid bg-well text-ink-soft'}"
>
	{label}
</span>
