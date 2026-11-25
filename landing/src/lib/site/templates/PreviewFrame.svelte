<script lang="ts">
  import { previewPath } from './paths';
  import { HEIGHT_MESSAGE } from './preview';
  import { Theme, type Template } from './template';

  let { template }: { template: Template } = $props();

  const FIRST_HEIGHT = 520;

  const DEVICES = [
    { width: 375, label: 'Mobile', icon: '<rect x="7" y="2" width="10" height="20" rx="2" /><path d="M11 18h2" />' },
    { width: 768, label: 'Tablet', icon: '<rect x="4" y="3" width="16" height="18" rx="2" /><path d="M11 18h2" />' },
    { width: 1280, label: 'Desktop', icon: '<rect x="2" y="4" width="20" height="13" rx="2" /><path d="M8 21h8M12 17v4" />' }
  ] as const;

  const THEMES = [
    { value: Theme.Light, label: 'Light', icon: '<circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />' },
    { value: Theme.Dark, label: 'Dark', icon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />' }
  ] as const;

  let viewport = $state<number>(1280);
  let theme = $state<Theme>(Theme.Dark);
  let boxWidth = $state(0);
  let height = $state(FIRST_HEIGHT);
  let frame = $state<HTMLIFrameElement>();

  const scale = $derived(boxWidth > 0 ? Math.min(1, boxWidth / viewport) : 1);
  const offset = $derived(Math.max(0, (boxWidth - viewport * scale) / 2));

  function onMessage(event: MessageEvent) {
    if (event.source !== frame?.contentWindow || event.data?.type !== HEIGHT_MESSAGE) {
      return;
    }
    height = Number(event.data.height) || FIRST_HEIGHT;
  }

  function onKeys(event: KeyboardEvent, step: () => void, back: () => void) {
    const forward = event.key === 'ArrowRight' || event.key === 'ArrowDown';
    const backward = event.key === 'ArrowLeft' || event.key === 'ArrowUp';
    if (!forward && !backward) {
      return;
    }
    event.preventDefault();
    (forward ? step : back)();
    const group = event.currentTarget as HTMLElement;
    queueMicrotask(() => group.querySelector<HTMLElement>('[aria-checked="true"]')?.focus());
  }

  function moveDevice(delta: number) {
    const index = DEVICES.findIndex((d) => d.width === viewport);
    viewport = DEVICES[(index + delta + DEVICES.length) % DEVICES.length].width;
  }

  function moveTheme(delta: number) {
    const index = THEMES.findIndex((t) => t.value === theme);
    theme = THEMES[(index + delta + THEMES.length) % THEMES.length].value;
  }
</script>

<svelte:window onmessage={onMessage} />

<div class="tpl-preview">
  <div class="tpl-tools">
    <div class="chips icons" role="radiogroup" aria-label="Preview width" tabindex="-1" onkeydown={(e) => onKeys(e, () => moveDevice(1), () => moveDevice(-1))}>
      {#each DEVICES as device (device.width)}
        <button
          type="button"
          role="radio"
          aria-checked={viewport === device.width}
          aria-label={device.label}
          title="{device.label} · {device.width}px"
          tabindex={viewport === device.width ? 0 : -1}
          onclick={() => (viewport = device.width)}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{@html device.icon}</svg>
        </button>
      {/each}
    </div>
    <div class="chips icons" role="radiogroup" aria-label="Preview theme" tabindex="-1" onkeydown={(e) => onKeys(e, () => moveTheme(1), () => moveTheme(-1))}>
      {#each THEMES as option (option.value)}
        <button
          type="button"
          role="radio"
          aria-checked={theme === option.value}
          aria-label={option.label}
          title={option.label}
          tabindex={theme === option.value ? 0 : -1}
          onclick={() => (theme = option.value)}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{@html option.icon}</svg>
        </button>
      {/each}
    </div>
  </div>
  <div class="stage" bind:clientWidth={boxWidth} style="height:{height * scale}px">
    <iframe
      bind:this={frame}
      title="{template.name} live preview"
      src="{previewPath(template.id)}#{theme}"
      sandbox="allow-scripts"
      loading="lazy"
      style="width:{viewport}px;height:{height}px;transform:translateX({offset}px) scale({scale})"
    ></iframe>
  </div>
</div>
