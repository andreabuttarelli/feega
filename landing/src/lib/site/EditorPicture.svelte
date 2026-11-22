<script lang="ts">
  import { EDITOR_SHOTS, NARROW_MEDIA, type EditorShotId } from './editor-shots';

  let { id, loading = 'lazy' }: { id: EditorShotId; loading?: 'eager' | 'lazy' } = $props();

  const shot = $derived(EDITOR_SHOTS[id]);
</script>

<picture>
  <source media={NARROW_MEDIA} srcset={shot.narrow.src} width={shot.narrow.width} height={shot.narrow.height} />
  <img src={shot.src} alt={shot.alt} width={shot.width} height={shot.height} {loading} decoding="async" />
</picture>
