<script lang="ts">
  import { FOR_HUB } from '$lib/site/topics';
  import TopicPage from '$lib/site/topics/TopicPage.svelte';

  let { data } = $props();
</script>

<TopicPage topic={data.topic} path={data.path} hub={FOR_HUB} />
