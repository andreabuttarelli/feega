<script lang="ts">
  import ProfilePage from '$lib/components/settings/pages/ProfilePage.svelte';

  let { data, form } = $props();
</script>

<ProfilePage {data} {form} />
