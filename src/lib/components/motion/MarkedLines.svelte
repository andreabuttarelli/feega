<script lang="ts">
  import type { MotionClip, MotionDoc } from '$lib/motion/doc';
  import { setProps } from '$lib/motion/timeline';
  import { LineEdit, editLines, lineRows, markedPoster } from '$lib/motion/poster-lines';

  let { doc, clip, onchange }: { doc: MotionDoc; clip: MotionClip; onchange: (doc: MotionDoc, summary: string) => void } = $props();

  const poster = $derived(markedPoster(String(clip.props.name))!);
  const raw = $derived(String(clip.props[poster.lines] ?? ''));
  const rows = $derived(lineRows(raw));

  const SUMMARY: Record<LineEdit, string> = {
    [LineEdit.Text]: 'Edit line',
    [LineEdit.AddPhoto]: 'Add photo',
    [LineEdit.RemovePhoto]: 'Remove photo',
    [LineEdit.Arrow]: 'Toggle arrow',
    [LineEdit.AddLine]: 'Add line',
    [LineEdit.RemoveLine]: 'Remove line'
  };

  function run(i: number, edit: LineEdit, text = '') {
    const next = editLines({ lines: raw, media: clip.props[poster.media] }, i, edit, text);
    const result = setProps(doc, clip.id, { [poster.lines]: next.lines, [poster.media]: next.media });
    if (result.ok) {
      onchange(result.doc, SUMMARY[edit]);
    }
  }
</script>

<ol class="lines" data-testid="marked-lines">
  {#each rows as row, i (i)}
    <li>
      <input type="text" aria-label={`Line ${i + 1}`} value={row.text} onchange={(e) => run(i, LineEdit.Text, e.currentTarget.value)} />
      <div class="tools">
        <button type="button" onclick={() => run(i, LineEdit.AddPhoto)}>+ Photo</button>
        {#if row.photos.length}<button type="button" onclick={() => run(i, LineEdit.RemovePhoto)}>− Photo</button>{/if}
        <button type="button" class:on={row.arrow} aria-pressed={row.arrow} onclick={() => run(i, LineEdit.Arrow)}>Arrow</button>
        <button type="button" aria-label={`Remove line ${i + 1}`} onclick={() => run(i, LineEdit.RemoveLine)}>×</button>
      </div>
    </li>
  {/each}
</ol>
<button type="button" class="add" onclick={() => run(rows.length - 1, LineEdit.AddLine)}>Add line</button>

<style>
  .lines {
    list-style: none;
    margin: 0 0 4px;
    padding: 0;
    display: grid;
    gap: 6px;
  }

  li {
    display: grid;
    gap: 2px;
  }


  input[type='text'],
  select {
    width: 100%;
    height: 24px;
    padding: 0 6px;
    border: 1px solid transparent;
    border-radius: 0;
    background: var(--ui-field);
    color: var(--ui-ink);
    font: inherit;
  }

  input[type='text']:focus,
  select:focus {
    outline: none;
    border-color: var(--ui-accent);
  }

  .tools {
    display: flex;
    gap: 4px;
  }

  button {
    font-size: var(--ui-text-sm, 11px);
    padding: 2px 6px;
    border: 1px solid var(--ui-line);
    background: var(--ui-surface);
    border-radius: 0;
  }

  button.on {
    background: var(--ui-accent);
    color: var(--ui-on-accent, #fff);
  }

  .add {
    margin-bottom: 6px;
  }
</style>
