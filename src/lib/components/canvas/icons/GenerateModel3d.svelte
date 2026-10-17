<script lang="ts">
  import Glyph from '@lucide/svelte/icons/box';
  import GenerateBadge from './GenerateBadge.svelte';

  let props: Record<string, unknown> = $props();
</script>

<GenerateBadge icon={Glyph} {...props} />
