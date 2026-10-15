<script lang="ts">
  import Image from '@lucide/svelte/icons/image';
  import GenerateBadge from './GenerateBadge.svelte';

  let props: Record<string, unknown> = $props();
</script>

<GenerateBadge icon={Image} {...props} />
