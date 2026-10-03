<script lang="ts">
  import { onMount } from 'svelte';
  import { FPS } from '$lib/motion/design';

  type Player = HTMLElement & { seek: (t: number) => void; play: () => void; pause: () => void; currentTime: number };

  const RELOAD_DEBOUNCE_MS = 250;

  let {
    html,
    width,
    height,
    frame = $bindable(0),
    playing = $bindable(false)
  }: { html: string; width: number; height: number; frame?: number; playing?: boolean } = $props();

  let host = $state<HTMLDivElement | null>(null);
  let player: Player | null = null;
  let reported = -1;
  let ready = false;
  let pending: ReturnType<typeof setTimeout> | null = null;

  function load(next: string) {
    if (!player) {
      return;
    }
    ready = false;
    player.setAttribute('srcdoc', next);
  }

  onMount(() => {
    let disposed = false;
    void import('@hyperframes/player').then(() => {
      if (disposed || !host) {
        return;
      }
      const el = document.createElement('hyperframes-player') as Player;
      el.setAttribute('sandbox-origin', 'opaque');
      el.setAttribute('assets-loading-ui', 'none');
      el.setAttribute('disable-click-to-play', '');
      el.style.width = '100%';
      el.style.height = '100%';
      el.addEventListener('ready', () => {
        ready = true;
        el.seek(frame / FPS);
      });
      el.addEventListener('timeupdate', (e) => {
        const next = Math.round(((e as CustomEvent<{ currentTime: number }>).detail.currentTime ?? 0) * FPS);
        reported = next;
        frame = next;
      });
      el.addEventListener('play', () => (playing = true));
      el.addEventListener('pause', () => (playing = false));
      el.addEventListener('ended', () => (playing = false));
      host.appendChild(el);
      player = el;
      load(html);
    });
    return () => {
      disposed = true;
      player?.remove();
      player = null;
    };
  });

  $effect(() => {
    const next = html;
    if (pending) {
      clearTimeout(pending);
    }
    pending = setTimeout(() => load(next), RELOAD_DEBOUNCE_MS);
  });

  $effect(() => {
    const target = frame;
    if (!player || !ready || playing || target === reported) {
      return;
    }
    reported = target;
    player.seek(target / FPS);
  });

  $effect(() => {
    if (!player || !ready) {
      return;
    }
    if (playing) {
      player.play();
    } else {
      player.pause();
    }
  });
</script>

<div class="stage" style={`aspect-ratio: ${width} / ${height};`} data-testid="motion-preview">
  <div class="host" bind:this={host}></div>
</div>

<style>
  .stage {
    position: relative;
    max-width: 100%;
    max-height: 100%;
    background: #000;
    outline: 1px solid var(--line);
  }

  .host {
    position: absolute;
    inset: 0;
  }
</style>
