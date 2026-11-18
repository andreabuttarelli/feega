<script lang="ts">
  import ModelsPage from '$lib/components/settings/pages/ModelsPage.svelte';

  let { data, form } = $props();
</script>

<ModelsPage {data} {form} />
