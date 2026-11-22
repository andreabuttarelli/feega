<script lang="ts">
  import { INTEGRATIONS_HUB } from '$lib/site/topics';
  import TopicPage from '$lib/site/topics/TopicPage.svelte';

  let { data } = $props();
</script>

<TopicPage topic={data.topic} path={data.path} hub={INTEGRATIONS_HUB} />
