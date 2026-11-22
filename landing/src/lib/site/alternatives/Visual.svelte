<script lang="ts">
  import EditorPicture from '../EditorPicture.svelte';
  import { DiffSign, VisualKind, type Visual } from './alternative';

  let { visual }: { visual: Visual } = $props();

  const SIGN_CLASS: Readonly<Record<DiffSign, string>> = {
    [DiffSign.Add]: 'add',
    [DiffSign.Remove]: 'del',
    [DiffSign.Keep]: 'keep'
  };
</script>

{#if visual.kind === VisualKind.Editor}
  <div class="vis editor"><EditorPicture id={visual.shot} /></div>
{:else if visual.kind === VisualKind.Diff}
  <div class="vis diff" role="img" aria-label="A source diff in {visual.file}">
    <div class="file">{visual.file}</div>
    <pre>{#each visual.lines as line, i (i)}<span class={SIGN_CLASS[line.sign]}>{line.sign} {line.text}
</span>{/each}</pre>
  </div>
{:else}
  <div class="vis flow">
    {#each [visual.them, visual.us] as lane, i (lane.title)}
      <div class="lane" class:ours={i === 1}>
        <strong>{lane.title}</strong>
        <ol>{#each lane.steps as step (step)}<li>{step}</li>{/each}</ol>
      </div>
    {/each}
  </div>
{/if}
