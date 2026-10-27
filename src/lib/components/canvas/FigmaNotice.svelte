<script lang="ts">
  import type { FigmaNotice } from '$lib/canvas/figma/notice';

  let { notice, settingsHref, onclose }: { notice: FigmaNotice; settingsHref: string; onclose: () => void } = $props();

  const CLOSE_AFTER_MS = 12000;

  let open = $state(false);
  let hovered = $state(false);

  $effect(() => {
    if (open || hovered) {
      return;
    }
    const timer = setTimeout(onclose, CLOSE_AFTER_MS);
    return () => clearTimeout(timer);
  });
</script>

<div
  class="figma-notice rounded-lg"
  role="status"
  data-testid="figma-notice"
  onmouseenter={() => (hovered = true)}
  onmouseleave={() => (hovered = false)}
>
  <div class="head">
    <p data-testid="figma-notice-summary">{notice.summary}</p>
    {#if notice.needsToken}
      <a href={settingsHref}>Open settings</a>
    {/if}
    <button type="button" aria-label="Dismiss" onclick={onclose}>×</button>
  </div>
  {#if notice.groups.length}
    <details ontoggle={(e) => (open = e.currentTarget.open)}>
      <summary>Details</summary>
      <div class="groups">
        {#each notice.groups as group (group.label)}
          <section>
            <h4>{group.label} ({group.items.length})</h4>
            <ul>
              {#each group.items as item (item)}
                <li>{item}</li>
              {/each}
            </ul>
          </section>
        {/each}
      </div>
    </details>
  {/if}
</div>

<style>
  .figma-notice {
    position: absolute;
    z-index: 10;
    left: 16px;
    top: calc(var(--chrome-top, 10px) + 52px);
    width: max-content;
    max-width: min(420px, calc(100% - 32px));
    padding: 8px 10px;
    font-size: var(--ui-text-sm);
    color: var(--ui-text);
    background: var(--ui-panel-raised);
    border: 1px solid var(--ui-line);
    box-shadow: var(--ui-shadow-raised);
  }

  .head {
    display: flex;
    align-items: baseline;
    gap: 8px;
  }

  .head p {
    flex: 1;
    margin: 0;
  }

  .head a {
    color: var(--ui-text-secondary);
    text-decoration: underline;
    white-space: nowrap;
  }

  .head button {
    border: 0;
    background: none;
    color: var(--ui-text-secondary);
    cursor: pointer;
  }

  summary {
    margin-top: 4px;
    color: var(--ui-text-secondary);
    cursor: pointer;
  }

  .groups {
    max-height: 30vh;
    margin-top: 6px;
    overflow-y: auto;
  }

  h4 {
    margin: 6px 0 2px;
    font-size: var(--ui-text-xs);
    color: var(--ui-text-secondary);
  }

  ul {
    margin: 0;
    padding-left: 16px;
    color: var(--ui-text-secondary);
  }
</style>
