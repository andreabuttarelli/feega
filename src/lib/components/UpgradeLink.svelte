<script lang="ts">
  import { _ } from 'svelte-i18n';
  import { page } from '$app/state';
  import { BILLING_PATH } from '$lib/billing-path';
</script>

<a class="upgrade-link" href={BILLING_PATH}>{$_('app.nav.upgrade')} →</a>

<style>
  .upgrade-link {
    font-weight: 600;
    text-decoration: underline;
    text-underline-offset: 2px;
    white-space: nowrap;
    color: inherit;
  }
</style>
