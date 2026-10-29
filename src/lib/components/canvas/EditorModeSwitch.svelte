<script lang="ts">
  import { SegmentedControl } from '$lib/components/ui/shell';
  import { EditorMode, MODES, editorMode, readEditorMode } from '$lib/canvas/editor-mode.svelte';

  const OPTIONS = Object.values(EditorMode).map((value) => ({ value, label: MODES[value].label }));
</script>

<div class="mode-switch" data-testid="editor-mode-switch" data-mode={editorMode.current}>
  <SegmentedControl label="Editor mode" options={OPTIONS} value={editorMode.current} onchange={(value) => editorMode.set(readEditorMode(value))} />
</div>

<style>
  .mode-switch {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    height: 38px;
    padding: 0 4px;
    pointer-events: auto;
    border-radius: var(--ui-radius-lg);
    background: var(--ui-panel-raised);
    box-shadow: var(--ui-shadow-float);
  }

  @media (max-width: 767px) {
    .mode-switch {
      display: none;
    }
  }
</style>
