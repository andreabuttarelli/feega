<script lang="ts">
  import SpendPage from '$lib/components/settings/pages/SpendPage.svelte';

  let { data, form } = $props();
</script>

<SpendPage {data} {form} />
