<script lang="ts">
  import { Key, OFF, ON, type DemoState } from '../demo/script';
  import { Target } from '../demo/scripts';
  import './mock.css';

  let { demo }: { demo: DemoState } = $props();

  const hasRow = $derived(demo[Key.Row] !== OFF);
</script>

<div class="gm panel" data-mock="changes">
  <div class="tab-list"><span class="tab">Properties</span><span class="tab on">Changes {hasRow ? 1 : 0}</span><span class="undo-redo"><span data-t={Target.Undo}>Undo</span><span data-t={Target.Redo}>Redo</span></span></div>

  <div class="changes">
    <header><span class="fill" data-t={Target.ChangesTitle}>{hasRow ? 1 : 0} {hasRow ? 'file' : 'files'} changed</span><span class="link">Source Control</span><span class="link danger">Revert all</span></header>
    <div class="change" class:gone={!hasRow}>
      <div class="what-row"><strong>radius</strong><span class="value">14</span></div>
      <span class="meta">Button.jsx:3:5 · element · 01:23 PM</span>
      <div class="links"><span class="link">Open</span><span class="link" data-t={Target.ShowDiff}>Show diff</span><span class="link">Revert</span></div>
      <div class="diff" class:shown={demo[Key.Diff] === ON}><span class="minus">- rounded-lg</span><span class="plus">+ rounded-[14px]</span></div>
    </div>
  </div>
</div>
