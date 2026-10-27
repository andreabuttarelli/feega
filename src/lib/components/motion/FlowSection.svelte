<script lang="ts">
  import { page } from '$app/state';
  import type { MotionDoc } from '@feega/motion-core/motion/doc';
  import type { OpResult } from '@feega/motion-core/motion/timeline';
  import { MAX_FLOW_NAME } from '@feega/motion-core/motion/prototype/flow';
  import { prototypePlayer } from '$lib/canvas/prototype-player.svelte';
  import { setFlow } from '$lib/motion/prototype/flows';
  import { LINK_LABEL, LinkState, playEndpoint, requestPlayLink } from '$lib/motion/prototype/play-link';

  let { doc, onchange }: { doc: MotionDoc; onchange: (result: OpResult, summary: string) => void } = $props();

  const COPIED_MS = 1600;
  const DEFAULT_FLOW = 'Flow 1';

  let link = $state<LinkState>(LinkState.Idle);

  const flow = $derived(doc.flow ?? null);
  const nodeId = $derived(prototypePlayer.editing);

  async function copyLink() {
    if (!nodeId) {
      return;
    }
    link = LinkState.Working;
    const url = await requestPlayLink(fetch, playEndpoint({ projectId: page.params.projectId ?? '', canvasId: page.params.canvasId ?? '', nodeId }));
    if (!url) {
      link = LinkState.Failed;
      return;
    }
    await navigator.clipboard.writeText(url);
    link = LinkState.Copied;
    setTimeout(() => (link = LinkState.Idle), COPIED_MS);
  }
</script>

<section class="flow" data-testid="flow-section" aria-label="Prototype flow">
  <header>
    <h3>Prototype flow</h3>
    <button type="button" class="play" data-testid="prototype-play" disabled={!nodeId} onclick={() => prototypePlayer.play()}>Play</button>
  </header>
  {#if flow}
    <div class="line">
      <input
        type="text"
        aria-label="Flow name"
        data-testid="flow-name"
        maxlength={MAX_FLOW_NAME}
        value={flow.name}
        onchange={(e) => onchange(setFlow(doc, e.currentTarget.value), 'Renamed the flow')}
      />
      <button type="button" data-testid="flow-remove" onclick={() => onchange(setFlow(doc, null), 'Removed the flow')}>Remove</button>
    </div>
  {:else}
    <button type="button" class="start" data-testid="flow-start" onclick={() => onchange(setFlow(doc, DEFAULT_FLOW), 'Set the starting point')}>Set as starting point</button>
  {/if}
  <button type="button" class="copy" data-testid="prototype-copy-link" disabled={!nodeId || link === LinkState.Working} onclick={copyLink}>{LINK_LABEL[link]}</button>
  <p class="hint">The player and the play link start on a flow, then follow the links between frames.</p>
</section>

<style>
  .flow {
    display: flex;
    flex-direction: column;
    gap: var(--ui-space-2);
    padding: var(--ui-space-3) var(--ui-space-4);
    border-top: 1px solid var(--ui-border);
    font-size: var(--ui-type-caption);
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  h3 {
    margin: 0;
    font-size: var(--ui-type-caption);
    font-weight: 600;
  }

  .line {
    display: flex;
    align-items: center;
    gap: var(--ui-space-1);
  }

  input {
    min-width: 0;
    flex: 1;
  }

  .start,
  .copy,
  .line button {
    height: var(--ui-row-sm, 28px);
    padding: 0 var(--ui-space-3);
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-input);
    color: var(--ui-text);
    font: inherit;
    cursor: pointer;
  }

  .copy:disabled,
  .start:disabled {
    opacity: 0.5;
  }

  .play {
    background: var(--ui-accent-solid, #0b6bcb);
    color: var(--ui-accent-ink, #fff);
    border: 0;
    border-radius: var(--ui-radius-sm);
    padding: 2px var(--ui-space-3);
  }

  .play:disabled {
    opacity: 0.4;
  }

  .hint {
    margin: 0;
    color: var(--ui-text-secondary);
  }
</style>
