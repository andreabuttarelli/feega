<script lang="ts">
  import ContentPage from '$lib/components/settings/pages/ContentPage.svelte';

  let { data, form } = $props();
</script>

<ContentPage {data} {form} />
