<script lang="ts">
  import MotionEditorShell from '$lib/components/motion/MotionEditorShell.svelte';
  import { Mount } from '$lib/motion/editor-mount';
  import { motionEditorPath } from '$lib/canvas/motion-node';
  import type { MotionEditorData } from '$lib/server/motion/editor-session';
  import { PANEL_ATTR, fitPadding, freeArea, type FitPadding } from '$lib/canvas/free-area';

  let { projectId, canvasId, nodeId, onclose, onframe }: { projectId: string; canvasId: string; nodeId: string; onclose: () => void; onframe: (padding: FitPadding) => void } = $props();

  const SETTLE_MS = 150;

  const editorPath = $derived(motionEditorPath({ projectId, canvasId, nodeId }));
  let session = $state.raw<MotionEditorData | null>(null);
  let failed = $state(false);

  $effect(() => {
    const url = `${editorPath}/session`;
    let stale = false;
    session = null;
    failed = false;
    void fetch(url)
      .then((res) => (res.ok ? (res.json() as Promise<MotionEditorData>) : null))
      .then((next) => {
        if (stale) {
          return;
        }
        session = next;
        failed = next === null;
      });
    return () => {
      stale = true;
    };
  });

  $effect(() => {
    if (!session) {
      return;
    }
    const timer = setTimeout(() => {
      const flow = document.querySelector('.svelte-flow')?.getBoundingClientRect();
      if (!flow) {
        return;
      }
      const panels = [...document.querySelectorAll(`[data-testid="motion-editor"] [${PANEL_ATTR}]`)].map((el) => {
        const r = el.getBoundingClientRect();
        return { left: r.left - flow.left, top: r.top - flow.top, right: r.right - flow.left, bottom: r.bottom - flow.top };
      });
      onframe(fitPadding(freeArea({ width: flow.width, height: flow.height }, panels)));
    }, SETTLE_MS);
    return () => clearTimeout(timer);
  });
</script>

{#if session}
  <MotionEditorShell data={session} mount={Mount.Canvas} fullHref={editorPath} {onclose} />
{:else if failed}
  <p class="inline-status" role="status">This video could not be opened here. <a href={editorPath}>Open the editor</a></p>
{:else}
  <p class="inline-status" role="status" data-testid="inline-motion-loading">Opening the editor…</p>
{/if}

<style>
  .inline-status {
    position: fixed;
    left: 50%;
    bottom: 24px;
    transform: translateX(-50%);
    z-index: 40;
    margin: 0;
    padding: 8px 14px;
    background: var(--ui-raised, #fff);
    color: var(--ui-ink, #111);
    font-size: 13px;
  }
</style>
