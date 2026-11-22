<script lang="ts">
  import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
  import type { FontChoice, MissingFont } from '../messages';
  import FontPicker from './FontPicker.svelte';
  import { FontAction, noticeText, offeredAction } from './missing-font';
  import { systemFonts } from './system-fonts';

  type Props = { missing: MissingFont; project: string[]; onreplace: (from: string, to: FontChoice) => void; onload: (family: string) => void };

  let { missing, project, onreplace, onload }: Props = $props();

  let choosing = $state(false);
  let system = $state<string[]>([]);

  async function startReplacing() {
    choosing = true;
    system = await systemFonts();
  }

  function replace(to: FontChoice) {
    choosing = false;
    onreplace(missing.family, to);
  }
</script>

<div class="missing-font" role="alert" data-testid="missing-font">
  <div class="message"><TriangleAlert size={13} /><span>{noticeText(missing)}</span></div>
  <div class="actions">
    {#if offeredAction(missing) === FontAction.LoadFromGoogle}
      <button type="button" class="action" data-action="load-font" onclick={() => onload(missing.family)}>Load from Google Fonts</button>
    {/if}
    <button type="button" class="action" data-action="replace-font" onclick={startReplacing}>Replace everywhere</button>
  </div>
  {#if choosing}
    <FontPicker family="" {project} {system} placeholder="Replace {missing.family} with…" onpick={replace} />
  {/if}
</div>

<style>
  .missing-font {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
    font-size: var(--ui-text-sm);
  }

  .message {
    display: flex;
    gap: 6px;
    align-items: flex-start;
    color: #ff9f0a;
    line-height: 1.35;
  }

  .message :global(svg) {
    flex: none;
    margin-top: 1px;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .action {
    padding: 2px 8px;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-input);
    color: var(--ui-text);
    font: inherit;
    cursor: pointer;
  }

  .action:hover {
    background: var(--ui-input-hover);
  }
</style>
