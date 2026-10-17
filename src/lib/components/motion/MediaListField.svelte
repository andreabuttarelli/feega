<script lang="ts">
  import { LinkUse, MediaAccept, setSlot, slotPick, type MediaPick, type MediaSlot } from '$lib/motion/media/pick';
  import MediaPicker from './MediaPicker.svelte';
  import type { LibraryMedia, MediaUploader } from './media-upload';

  let { value, assets, label, upload = null, onchange }: { value: unknown; assets: LibraryMedia[]; label: string; upload?: MediaUploader | null; onchange: (list: MediaSlot[]) => void } = $props();

  const list = $derived((Array.isArray(value) ? value : []) as MediaSlot[]);
  const set = (at: number, pick: MediaPick | null) => onchange(setSlot(list, at, pick));
</script>

<div class="flex flex-col gap-1.5" data-testid="media-list">
  {#each list as slot, i (i)}
    <MediaPicker label={`${label} ${i + 1}`} value={slotPick(slot)} {assets} accept={MediaAccept.Any} links={LinkUse.Import} uploader={upload} onpick={(pick) => set(i, pick)} />
  {/each}
  {#key list.length}
    <MediaPicker label={`Add to ${label}`} value={null} {assets} accept={MediaAccept.Any} links={LinkUse.Import} uploader={upload} onpick={(pick) => set(list.length, pick)} />
  {/key}
</div>
