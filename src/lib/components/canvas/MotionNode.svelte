<script lang="ts">
  import Clapperboard from '@lucide/svelte/icons/clapperboard';
  import { FORMATS } from '$lib/motion/doc';
  import type { MotionNode } from '$lib/canvas/motion-node';

  let { node, href }: { node: MotionNode; href: string } = $props();

  const size = $derived(FORMATS[node.format]);
</script>

<div class="motion" data-testid="motion-node">
  <div class="frame" style={`aspect-ratio: ${size.width} / ${size.height};`}>
    <Clapperboard size={28} />
    <span class="format">{size.label}</span>
  </div>
  <div class="foot">
    <span class="rev">{node.docHeadRevision ? `Revision ${node.docHeadRevision}` : 'Empty video'}</span>
    <a class="open nodrag" {href} data-testid="open-motion-editor">Open editor</a>
  </div>
</div>

<style>
  .motion {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    background: var(--paper);
  }

  .frame {
    flex: 1;
    min-height: 0;
    max-height: calc(100% - 44px);
    margin: 10px auto 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    background: #0a0a0a;
    color: #f0eee9;
  }

  .format {
    font-family: 'Fragment Mono', ui-monospace, monospace;
    font-size: 11px;
    color: #0099ff;
  }

  .foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 44px;
    padding: 0 10px;
    border-top: 1px solid var(--line);
    font-size: 12px;
  }

  .rev {
    color: var(--ink-soft);
  }

  .open {
    padding: 6px 12px;
    background: var(--ink);
    color: var(--paper);
  }
</style>
