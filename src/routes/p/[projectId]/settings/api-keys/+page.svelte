<script lang="ts">
  import ApiKeysPage from '$lib/components/settings/pages/ApiKeysPage.svelte';

  let { data, form } = $props();
</script>

<ApiKeysPage {data} {form} />
