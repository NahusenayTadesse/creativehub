<script lang="ts">
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { BadgeCheck, Loader, OctagonMinus } from '@lucide/svelte';

	/* ---------- public prop ---------- */
	interface Props {
		status: string;
	}
	let { status }: Props = $props();

	/* ---------- lookup tables ---------- */
	const statusMeta = {
		/* confirmed / paid */
		confirmed: { icon: BadgeCheck, colour: 'bg-green-400' },
		paid: { icon: BadgeCheck, colour: 'bg-green-400' },
		quoted: { icon: BadgeCheck, colour: 'bg-green-400' },

		complete: { icon: BadgeCheck, colour: 'bg-green-400' },
		incomplete: { icon: OctagonMinus, colour: 'bg-red-500' },

		/* cancelled / unpaid */
		cancelled: { icon: OctagonMinus, colour: 'bg-red-500' },
		unpaid: { icon: OctagonMinus, colour: 'bg-red-500' },
		dead: { icon: OctagonMinus, colour: 'bg-red-500' },

		/* pending */
		pending: { icon: Loader, colour: 'bg-yellow-500' },
		delivered: { icon: BadgeCheck, colour: 'bg-green-400' },
		read: { icon: BadgeCheck, colour: 'bg-green-400' },

		/* active */
		active: { icon: BadgeCheck, colour: 'bg-green-400' },
		contracted: { icon: BadgeCheck, colour: 'bg-green-400' },
		inactive: { icon: OctagonMinus, colour: 'bg-red-500' },

		yes: { icon: BadgeCheck, colour: 'bg-green-400' },
		no: { icon: OctagonMinus, colour: 'bg-red-500' },

		unremovable: { icon: BadgeCheck, colour: 'bg-green-400' },
		removable: { icon: OctagonMinus, colour: 'bg-red-500' },

		out: { icon: OctagonMinus, colour: 'bg-red-500' },
		low: { icon: Loader, colour: 'bg-yellow-500' },
		new: { icon: Loader, colour: 'bg-yellow-500' },
		live: { icon: BadgeCheck, colour: 'bg-green-400' },

		/* fallback */
		unknown: { icon: Loader, colour: 'bg-gray-500' }
	} as const;

	/* ---------- derived ---------- */
	const key = String(status).trim().toLowerCase() as keyof typeof statusMeta;
	const { icon: Icon, colour } = statusMeta[key] ?? statusMeta.unknown;
</script>

<Badge variant="secondary" class="{colour} text-white">
	<Icon />
	{String(status)}
</Badge>
