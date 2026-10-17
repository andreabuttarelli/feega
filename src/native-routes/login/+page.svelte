<script lang="ts">
  import WebLogin from '$web/login/+page.svelte';

  let { data, form } = $props();
</script>

<WebLogin {data} {form} />
