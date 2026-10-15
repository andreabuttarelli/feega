<script lang="ts">
  import Video from '@lucide/svelte/icons/video';
  import GenerateBadge from './GenerateBadge.svelte';

  let props: Record<string, unknown> = $props();
</script>

<GenerateBadge icon={Video} {...props} />
