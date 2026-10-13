<script lang="ts">
  import MotionEditorShell from '$lib/components/motion/MotionEditorShell.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
</script>

<MotionEditorShell {data} />
