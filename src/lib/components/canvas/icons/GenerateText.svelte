<script lang="ts">
  import Pilcrow from '@lucide/svelte/icons/pilcrow';
  import GenerateBadge from './GenerateBadge.svelte';

  let props: Record<string, unknown> = $props();
</script>

<GenerateBadge icon={Pilcrow} {...props} />
