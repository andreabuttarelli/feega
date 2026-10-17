<script lang="ts" module>
  import { earlyFetch } from '$lib/canvas/early-fetch';
  import type { MotionEditorData } from '$lib/server/motion/editor-session';

  const lastSessions = new Map<string, MotionEditorData>();

  const sessions = earlyFetch<MotionEditorData | null>({
    load: (url) => fetch(url).then((res) => (res.ok ? (res.json() as Promise<MotionEditorData>) : null)),
    now: () => performance.now()
  });

  export const sessionUrl = (editorPath: string) => `${editorPath}/session`;

  export function prefetchSession(editorPath: string) {
    const url = sessionUrl(editorPath);
    if (lastSessions.has(url)) {
      return;
    }
    sessions.start(url);
  }

  let lastPress: number | null = null;

  if (typeof window !== 'undefined') {
    addEventListener('pointerdown', (e) => (lastPress = e.timeStamp), { capture: true, passive: true });
  }
</script>

<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import MotionEditorShell from '$lib/components/motion/MotionEditorShell.svelte';
  import { Mount } from '$lib/motion/editor-mount';
  import { motionEditorPath } from '$lib/canvas/motion-node';
  import { DOCK_ATTR, freeArea, type Dock, type Insets } from '$lib/canvas/free-area';
  import { warmPlayer } from '$lib/motion/hyperframes/warm-player';
  import { inlineStage } from '$lib/canvas/inline-stage.svelte';
  import { frameDocs } from '$lib/canvas/frame-docs.svelte';
  import { reopened } from '$lib/canvas/reopen-session';
  import { Paint } from '$lib/canvas/inline-motion';
  import { OpenMark, openTiming, tapTime } from '$lib/canvas/open-timing';
  import { engineOf } from '$lib/motion/engine';
  import { OpensOn, viewportOf } from '$lib/motion/editor-layout';
  import { propertiesRequest } from '$lib/canvas/phone-properties';
  import { get } from 'svelte/store';
  import { track } from '$lib/analytics';
  import type { CanvasUndo, MoveOut } from '$lib/canvas/canvas-drop';

  let { projectId, canvasId, nodeId, revision = 0, leaving = false, onclose, onframe, onmoveout = null, canvasundo = null }: { projectId: string; canvasId: string; nodeId: string; revision?: number; leaving?: boolean; onclose: () => void; onframe: (free: Insets) => void; onmoveout?: MoveOut | null; canvasundo?: CanvasUndo | null } = $props();

  const opensOn = untrack(() => (get(propertiesRequest) === nodeId ? OpensOn.Properties : OpensOn.Stage));
  propertiesRequest.set(null);

  const SETTLE_MS = 150;
  const OPEN_EVENT = 'frame_open_timing';

  const editorPath = $derived(motionEditorPath({ projectId, canvasId, nodeId }));
  let session = $state.raw<MotionEditorData | null>(null);
  let failed = $state(false);

  const timing = openTiming({
    tap: tapTime(lastPress, performance.now()),
    now: () => performance.now(),
    report: (phases) => track(OPEN_EVENT, { ...phases, engine: engineOf(navigator.userAgent), viewport: viewportOf(innerWidth), cores: navigator.hardwareConcurrency ?? null })
  });

  onMount(() => () => timing.end());

  $effect(() => {
    void warmPlayer(location.origin);
  });

  $effect(() => {
    const url = sessionUrl(editorPath);
    let stale = false;
    const release = sessions.hold(url);
    const reused = reopened(lastSessions.get(url) ?? null, frameDocs.headOf(nodeId) as MotionEditorData['head'] | null, untrack(() => revision));
    if (reused) {
      timing.mark(OpenMark.Session);
      session = reused;
      failed = false;
      return release;
    }
    const landed = sessions.settled(url);
    if (landed) {
      lastSessions.set(url, landed);
    }
    session = landed ?? null;
    failed = false;
    void sessions.take(url).then((next) => {
      if (landed) {
        return;
      }
      if (stale) {
        return;
      }
      timing.mark(OpenMark.Session);
      if (next) {
        lastSessions.set(url, next);
      }
      session = next;
      failed = next === null;
    });
    return () => {
      stale = true;
      release();
    };
  });

  $effect(() => {
    if (session) {
      timing.mark(OpenMark.Chrome);
    }
  });

  $effect(() => {
    if (inlineStage.paintOf(nodeId) !== Paint.Pending) {
      untrack(() => timing.mark(OpenMark.Shown));
    }
  });

  function stageReady() {
    timing.mark(OpenMark.Ready);
    inlineStage.ready(nodeId);
  }

  $effect(() => {
    if (!session) {
      return;
    }
    const timer = setTimeout(() => {
      const flow = document.querySelector('.svelte-flow')?.getBoundingClientRect();
      if (!flow) {
        return;
      }
      const docked = [...document.querySelectorAll<HTMLElement>(`[${DOCK_ATTR}]`)].map((el) => {
        const r = el.getBoundingClientRect();
        return { dock: el.getAttribute(DOCK_ATTR) as Dock, box: { left: r.left - flow.left, top: r.top - flow.top, right: r.right - flow.left, bottom: r.bottom - flow.top } };
      });
      onframe(freeArea({ width: flow.width, height: flow.height }, docked));
    }, SETTLE_MS);
    return () => clearTimeout(timer);
  });
</script>

{#if session}
  <div class="inline" class:leaving data-leaving={leaving || undefined}>
    <MotionEditorShell data={session} mount={Mount.Canvas} fullHref={editorPath} {onclose} onstageready={stageReady} {onmoveout} {canvasundo} {opensOn} />
  </div>
{:else if failed}
  <p class="inline-status" role="status">This video could not be opened here. <a href={editorPath}>Open the editor</a></p>
{:else}
  <p class="inline-status" role="status" data-testid="inline-motion-loading">Opening the editor…</p>
{/if}

<style>
  .inline {
    display: contents;
  }

  .leaving {
    visibility: hidden;
    pointer-events: none;
  }

  .leaving :global([data-testid='editor-stage']) {
    visibility: visible;
  }

  .leaving :global([data-testid='selection-overlay']) {
    visibility: hidden;
  }

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
