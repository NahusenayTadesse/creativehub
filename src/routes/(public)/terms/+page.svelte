<script lang="ts">
	import * as m from '$lib/paraglide/messages';
	import LegalPage from '$lib/components/legal-page.svelte';
	import Section from '$lib/components/legal-section.svelte';

	let { data } = $props();

	/* The fee and the contact address are the two facts in here that are set in
	   the admin settings, so they are read rather than written into the prose. */
	const fee = $derived(data.settings?.platformFeePercent ?? 15);
	const email = $derived(data.settings?.supportEmail ?? 'support@creatornetwork.et');

	const UPDATED = '25 August 2026';
</script>

<svelte:head>
	<title>{m.tos_meta_title()}</title>
	<meta name="description" content={m.tos_intro()} />
</svelte:head>

<LegalPage title={m.tos_title()} updated={UPDATED} intro={m.tos_intro()}>
	<Section heading={m.tos_what_h()}><p>{m.tos_what_b()}</p></Section>
	<Section heading={m.tos_accounts_h()}><p>{m.tos_accounts_b()}</p></Section>

	<Section heading={m.tos_listed_h()}>
		<p>{m.tos_listed_b()}</p>
		<p>{m.tos_listed_b2()}</p>
	</Section>

	<Section heading={m.tos_deals_h()}><p>{m.tos_deals_b()}</p></Section>
	<Section heading={m.tos_fees_h()}><p>{m.tos_fees_b({ fee })}</p></Section>
	<Section heading={m.tos_payment_h()}><p>{m.tos_payment_b()}</p></Section>
	<Section heading={m.tos_offplatform_h()}><p>{m.tos_offplatform_b()}</p></Section>
	<Section heading={m.tos_content_h()}><p>{m.tos_content_b()}</p></Section>
	<Section heading={m.tos_badges_h()}><p>{m.tos_badges_b()}</p></Section>
	<Section heading={m.tos_use_h()}><p>{m.tos_use_b()}</p></Section>
	<Section heading={m.tos_closure_h()}><p>{m.tos_closure_b()}</p></Section>
	<Section heading={m.tos_disputes_h()}><p>{m.tos_disputes_b()}</p></Section>
	<Section heading={m.tos_liability_h()}><p>{m.tos_liability_b()}</p></Section>
	<Section heading={m.tos_law_h()}><p>{m.tos_law_b()}</p></Section>
	<Section heading={m.tos_changes_h()}><p>{m.tos_changes_b()}</p></Section>
	<Section heading={m.legal_contact_h()}><p>{m.tos_contact_b({ email })}</p></Section>
</LegalPage>
