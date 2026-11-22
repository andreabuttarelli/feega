<script lang="ts">
  import { page } from '$app/stores';
  import BillingPage from '$lib/components/settings/pages/BillingPage.svelte';
  import { checkoutOutcomeOf } from '$lib/billing-path';

  let { data } = $props();
</script>

<BillingPage {data} outcome={checkoutOutcomeOf($page.url)} />
