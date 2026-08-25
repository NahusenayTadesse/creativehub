<script lang="ts">
	import * as m from '$lib/paraglide/messages';
	import LegalPage from '$lib/components/legal-page.svelte';
	import Section from '$lib/components/legal-section.svelte';

	let { data } = $props();

	const name = $derived(data.settings?.siteName ?? 'Creator Network');
	const email = $derived(data.settings?.supportEmail ?? 'support@creatornetwork.et');

	const UPDATED = '25 August 2026';
</script>

<svelte:head>
	<title>{m.pp_meta_title()}</title>
	<meta name="description" content={m.pp_intro()} />
</svelte:head>

<LegalPage title={m.pp_title()} updated={UPDATED} intro={m.pp_intro()}>
	<Section heading={m.pp_who_h()}><p>{m.pp_who_b({ name, email })}</p></Section>

	<!-- The section that matters most here: 146 of the profiles on this site
	     belong to people who have never used it. -->
	<Section heading={m.pp_imported_h()}>
		<p>{m.pp_imported_b()}</p>
		<p>{m.pp_imported_b2()}</p>
		<p>{m.pp_imported_b3({ email })}</p>
	</Section>

	<Section heading={m.pp_account_h()}><p>{m.pp_account_b()}</p></Section>
	<Section heading={m.pp_auto_h()}><p>{m.pp_auto_b()}</p></Section>
	<Section heading={m.pp_cookies_h()}><p>{m.pp_cookies_b()}</p></Section>
	<Section heading={m.pp_use_h()}><p>{m.pp_use_b()}</p></Section>
	<Section heading={m.pp_share_h()}><p>{m.pp_share_b()}</p></Section>
	<Section heading={m.pp_masking_h()}><p>{m.pp_masking_b()}</p></Section>
	<Section heading={m.pp_retention_h()}><p>{m.pp_retention_b()}</p></Section>
	<Section heading={m.pp_rights_h()}><p>{m.pp_rights_b({ email })}</p></Section>
	<Section heading={m.pp_security_h()}><p>{m.pp_security_b()}</p></Section>
	<Section heading={m.pp_children_h()}><p>{m.pp_children_b()}</p></Section>
	<Section heading={m.pp_changes_h()}><p>{m.pp_changes_b()}</p></Section>
	<Section heading={m.legal_contact_h()}><p>{m.pp_contact_b({ email })}</p></Section>
</LegalPage>
