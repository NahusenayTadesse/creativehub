<script lang="ts" module>
	import {
		Award,
		Briefcase,
		Coffee,
		Cpu,
		Drama,
		Dumbbell,
		Globe,
		GraduationCap,
		HandCoins,
		Handshake,
		Heart,
		Landmark,
		Leaf,
		MapPin,
		Megaphone,
		Package,
		Plane,
		ShieldCheck,
		Sparkles,
		Sprout,
		Stethoscope,
		Ticket,
		Truck,
		UtensilsCrossed,
		Users
	} from '@lucide/svelte';

	/**
	 * Icons are stored as plain names on the row so an admin can pick one from a
	 * dropdown without shipping component references through the load.
	 */
	const icons = {
		Award,
		Briefcase,
		Coffee,
		Cpu,
		Drama,
		Dumbbell,
		Globe,
		GraduationCap,
		HandCoins,
		Handshake,
		Heart,
		Landmark,
		Leaf,
		MapPin,
		Megaphone,
		Package,
		Plane,
		ShieldCheck,
		Sparkles,
		Sprout,
		Stethoscope,
		Ticket,
		Truck,
		UtensilsCrossed,
		Users
	};

	export type IconName = keyof typeof icons;
	export const iconNames = Object.keys(icons) as IconName[];
</script>

<script lang="ts">
	let {
		name,
		fallback = 'Sparkles',
		...rest
	}: { name?: string | null; fallback?: IconName; class?: string } = $props();

	const Icon = $derived(icons[(name ?? '') as IconName] ?? icons[fallback]);
</script>

<Icon {...rest} />
