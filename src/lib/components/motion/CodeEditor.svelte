<script lang="ts">
  import { onMount } from 'svelte';
  import type { MotionDoc } from '$lib/motion/doc';
  import { CheckState, checkState, type CustomSource, type PropsSchema } from '$lib/motion/custom/component';
  import { writeComponent } from '$lib/motion/custom/ops';
  import type { CodeLanguage, CodeView } from './code-editor';

  const EDIT_DEBOUNCE_MS = 600;

  const Pane = { Html: 'html', Css: 'css', Js: 'js', Props: 'props' } as const;
  type Pane = (typeof Pane)[keyof typeof Pane];

  const FILES: { file: Pane; label: string; language: `${CodeLanguage}` }[] = [
    { file: Pane.Js, label: 'JS', language: 'js' },
    { file: Pane.Html, label: 'HTML', language: 'html' },
    { file: Pane.Css, label: 'CSS', language: 'css' },
    { file: Pane.Props, label: 'Props', language: 'json' }
  ];

  const STATE_LABEL: Record<CheckState, string> = {
    [CheckState.Passed]: 'Seek check passed',
    [CheckState.Failed]: 'Seek check failed: export is blocked',
    [CheckState.Unchecked]: 'Checking…'
  };

  let { doc, name, previous, onchange }: { doc: MotionDoc; name: string; previous: CustomSource | null; onchange: (doc: MotionDoc, summary: string) => void } = $props();

  let host = $state<HTMLDivElement | null>(null);
  let view = $state<CodeView | null>(null);
  let file = $state<Pane>(Pane.Js);
  let showDiff = $state(false);
  let error = $state('');
  let timer: ReturnType<typeof setTimeout> | null = null;
  let typed: string | null = null;
  let shownKey = '';

  const component = $derived(doc.components[name]);
  const checked = $derived(component ? checkState(component) : CheckState.Unchecked);
  const problems = $derived(component?.check && checked !== CheckState.Unchecked ? component.check.problems : []);

  const textOf = (source: CustomSource, schema: PropsSchema, f: Pane) => (f === Pane.Props ? JSON.stringify(schema, null, 2) : source[f]);

  onMount(() => {
    let disposed = false;
    void import('./code-editor').then(({ mountCode }) => {
      if (disposed || !host) {
        return;
      }
      view = mountCode(host, edited);
    });
    return () => {
      disposed = true;
      view?.destroy();
    };
  });

  $effect(() => {
    if (!view || !component) {
      return;
    }
    const language = FILES.find((f) => f.file === file)!.language as CodeLanguage;
    const original = showDiff && previous && file !== Pane.Props ? previous[file as Exclude<Pane, 'props'>] : null;
    const text = textOf(component.source, component.propsSchema, file);
    const key = `${file}|${original}`;
    if (key === shownKey && typed === text) {
      return;
    }
    shownKey = key;
    typed = text;
    view.show(text, language, original);
  });

  function edited(text: string) {
    typed = text;
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => commit(text), EDIT_DEBOUNCE_MS);
  }

  function commit(text: string) {
    if (!component) {
      return;
    }
    const draft = { source: { ...component.source }, propsSchema: component.propsSchema };
    if (file === Pane.Props) {
      try {
        draft.propsSchema = JSON.parse(text) as PropsSchema;
      } catch {
        error = 'Props: not valid JSON yet';
        return;
      }
    } else {
      draft.source[file as Exclude<Pane, 'props'>] = text;
    }
    const result = writeComponent(doc, name, draft);
    if (!result.ok) {
      error = result.error;
      return;
    }
    error = '';
    onchange(result.doc, `Edited the code of ${name}`);
  }

  function pick(next: Pane) {
    file = next;
  }
</script>

<div class="code" data-testid="code-tab">
  <div class="files" role="tablist">
    {#each FILES as f (f.file)}
      <button type="button" role="tab" aria-selected={file === f.file} class:on={file === f.file} onclick={() => pick(f.file)}>{f.label}</button>
    {/each}
    <label class="diff"><input type="checkbox" bind:checked={showDiff} disabled={!previous || file === Pane.Props} /> Diff</label>
  </div>
  <div class="editor" bind:this={host}></div>
  <div class="status" class:bad={checked === CheckState.Failed || error} data-testid="code-status">
    <span>{name} · v{component?.version ?? 0} · {STATE_LABEL[checked]}</span>
    {#if error}<pre role="alert">{error}</pre>{/if}
    {#each problems as problem, i (i)}<pre>{problem}</pre>{/each}
  </div>
</div>

<style>
  .code {
    display: flex;
    flex-direction: column;
    min-height: 0;
    flex: 1;
  }

  .files {
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 4px 8px;
    border-bottom: 1px solid var(--ui-line);
  }

  .files button {
    padding: 3px 8px;
    font-family: var(--ui-mono);
    font-size: 11px;
    color: var(--ui-ink-2);
  }

  .files button.on {
    color: var(--ui-ink);
    box-shadow: inset 0 -2px 0 var(--ui-ink);
  }

  .diff {
    margin-left: auto;
    display: inline-flex;
    gap: 4px;
    align-items: center;
    font-size: 11px;
    color: var(--ui-ink-2);
  }

  .editor {
    flex: 1;
    min-height: 260px;
    overflow: auto;
  }

  .status {
    border-top: 1px solid var(--ui-line);
    padding: 6px 10px;
    font-size: 11px;
    color: var(--ui-ink-2);
    max-height: 30%;
    overflow: auto;
  }

  .status.bad {
    color: #b42318;
  }

  pre {
    margin: 4px 0 0;
    white-space: pre-wrap;
    font-family: var(--ui-mono);
    font-size: 11px;
  }
</style>
