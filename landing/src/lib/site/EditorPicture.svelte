<script lang="ts">
  import { EDITOR_SHOTS, type EditorShotId } from './editor-shots';

  let { id, loading = 'lazy' }: { id: EditorShotId; loading?: 'eager' | 'lazy' } = $props();

  const shot = $derived(EDITOR_SHOTS[id]);
</script>

<picture>
  <img src={shot.src} alt={shot.alt} width={shot.width} height={shot.height} {loading} decoding="async" />
</picture>
