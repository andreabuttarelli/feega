<script lang="ts">
  import { onMount } from 'svelte';
  import MotionEditorShell from '$lib/components/motion/MotionEditorShell.svelte';
  import PageZoomLock from '$lib/components/canvas/PageZoomLock.svelte';
  import { connectCanvas } from '$lib/realtime/canvas-channel';
  import { displayName, frameHub, provideFramePresence } from '$lib/realtime/frame-presence';
  import { createSupabaseBrowserClient } from '$lib/supabase/client';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  const user = data.session?.user ?? null;
  const frames = frameHub({ userId: user?.id ?? '', name: displayName(user?.email ?? 'User') });
  if (user) {
    provideFramePresence(frames.port);
  }

  const ignore = () => {};

  onMount(() => {
    if (!user) {
      return;
    }
    return connectCanvas({
      client: createSupabaseBrowserClient(),
      canvasId: data.canvas.id,
      projectId: data.projectId,
      peer: { userId: user.id, name: user.email ?? 'User', avatar: null, path: location.pathname, threadId: null },
      onChange: ignore,
      onReconnect: ignore,
      onCanvasList: ignore,
      onPeers: ignore,
      onLink: ignore,
      frames: frames.line
    });
  });
</script>

<PageZoomLock />
<MotionEditorShell {data} />
