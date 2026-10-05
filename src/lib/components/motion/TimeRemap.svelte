<script lang="ts">
  import type { MotionClip, MotionDoc } from '$lib/motion/doc';
  import { REMAP_KEY, clearTimeRemap, enableTimeRemap, freezeFrame, isRemapped, sourceSeconds } from '$lib/motion/time-remap';
  import type { OpResult } from '$lib/motion/timeline';

  let { doc, clip, frame, onchange }: { doc: MotionDoc; clip: MotionClip; frame: number; onchange: (doc: MotionDoc, summary: string) => void } = $props();

  let error = $state('');
  const keys = $derived(clip.keyframes[REMAP_KEY]?.length ?? 0);
  const local = $derived(Math.min(Math.max(0, frame - clip.from), clip.durationInFrames - 1));
  const source = $derived(Math.round(sourceSeconds(clip, local, doc.fps) * 100) / 100);

  function commit(result: OpResult, summary: string) {
    if (!result.ok) {
      error = result.error;
      return;
    }
    error = '';
    onchange(result.doc, summary);
  }
</script>

<section class="remap" data-testid="time-remap">
  <h4>Time remap</h4>
  <p class="state">Source {source}s at the playhead · {keys ? `${keys} remap keyframe${keys > 1 ? 's' : ''}` : isRemapped(clip) ? 'speed / reverse' : 'normal playback'}</p>
  <div class="buttons">
    <button type="button" disabled={keys > 0} onclick={() => commit(enableTimeRemap(doc, clip.id), 'Enabled time remap')}>Remap keyframes</button>
    <button type="button" onclick={() => commit(freezeFrame(doc, clip.id, frame), 'Froze the frame')}>Freeze frame</button>
    <button type="button" disabled={!isRemapped(clip)} onclick={() => commit(clearTimeRemap(doc, clip.id), 'Cleared time remap')}>Clear</button>
  </div>
  {#if error}<p class="error" role="alert">{error}</p>{/if}
</section>

<style>
  .remap {
    padding: var(--ui-space-2) var(--ui-space-3) var(--ui-space-3);
    border-top: 1px solid var(--ui-line);
    font-size: var(--ui-text-sm);
  }

  h4 {
    margin: 0 0 var(--ui-space-1);
    font-family: var(--ui-mono);
    font-size: var(--ui-text-xs);
    font-weight: 400;
    text-transform: uppercase;
    color: var(--ui-ink-2);
  }

  .state {
    margin: 0 0 var(--ui-space-2);
    color: var(--ui-ink-2);
  }

  .buttons {
    display: flex;
    flex-wrap: wrap;
    gap: var(--ui-space-1);
  }

  button {
    padding: var(--ui-space-1) var(--ui-space-2);
    border: 1px solid var(--ui-line-strong);
    background: var(--ui-bg);
    color: var(--ui-ink);
    font: inherit;
  }

  button:hover:not(:disabled) {
    background: var(--ui-hover);
  }

  button:disabled {
    color: var(--ui-ink-3);
  }

  .error {
    margin: var(--ui-space-1) 0 0;
    color: var(--ui-ink);
  }
</style>
