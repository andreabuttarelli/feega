<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { CODE_ENTRY, codeFrameHtml, type CodeFiles, type Framework, type VarValues } from '$lib/canvas/code-frame';
  import { varDecl, type VarDecl } from '$lib/canvas/code-vars';
  import { IFRAME_REFERRER_POLICY, IFRAME_SANDBOX } from '$lib/canvas/iframe-node';
  import { BarTab, rightBar } from '$lib/components/brand-agent/right-bar-host.svelte';
  import type { CodeLanguage, CodeView } from '$lib/components/motion/code-editor';
  import CodeVarsPanel from './CodeVarsPanel.svelte';
  import { forgetVars, rememberVars, varsOf } from '$lib/canvas/code-vars-registry.svelte';

  const RENDER_DEBOUNCE_MS = 500;

  const LANGUAGE_BY_EXTENSION: [RegExp, `${CodeLanguage}`][] = [
    [/\.css$/, 'css'],
    [/\.svelte$/, 'svelte'],
    [/./, 'tsx']
  ];

  const languageOf = (path: string) => LANGUAGE_BY_EXTENSION.find(([test]) => test.test(path))![1] as CodeLanguage;

  type FrameMessage = { type: 'feega:vars'; vars: { name: string; spec: unknown; shorthand: string }[] } | { type: 'feega:set'; name: string; value: string } | { type: 'feega:ready' };

  let {
    framework,
    files,
    editing,
    route = '/',
    vars,
    selected = false,
    label = 'Code frame',
    owner,
    onchange,
    onvars
  }: {
    framework: Framework;
    files: CodeFiles;
    editing: boolean;
    route?: string;
    vars: VarValues;
    selected?: boolean;
    label?: string;
    owner: string;
    onchange?: (files: CodeFiles) => void;
    onvars: (vars: VarValues) => void;
  } = $props();

  let frame = $state<HTMLIFrameElement | null>(null);

  function post(values: VarValues) {
    frame?.contentWindow?.postMessage({ type: 'feega:values', values: $state.snapshot(values) }, '*');
  }

  $effect(() => post(vars));

  function portalFirst(node: HTMLElement, target: HTMLElement) {
    target.prepend(node);
    return { destroy: () => node.remove() };
  }

  $effect(() => {
    if (selected) {
      untrack(() => rightBar.select(BarTab.Properties));
    }
  });

  $effect(() => {
    const listen = (e: MessageEvent<FrameMessage>) => {
      if (!frame || e.source !== frame.contentWindow || !e.data) {
        return;
      }
      if (e.data.type === 'feega:ready') {
        post(vars);
      }
      if (e.data.type === 'feega:vars') {
        rememberVars(owner, e.data.vars.map((v) => varDecl(v.name, v.spec, v.shorthand as VarDecl['type'])).filter((d): d is VarDecl => d !== null));
      }
      if (e.data.type === 'feega:set') {
        onvars({ ...vars, [e.data.name]: e.data.value });
      }
    };
    addEventListener('message', listen);
    return () => removeEventListener('message', listen);
  });

  const entry = $derived(CODE_ENTRY[framework]);

  let draft = $state<CodeFiles>({ ...files });
  let shown = $state<CodeFiles>({ ...files });
  let active = $state(CODE_ENTRY[framework]);
  let naming = $state<string | null>(null);
  let committed = JSON.stringify(files);
  let timer: ReturnType<typeof setTimeout> | null = null;

  $effect(() => {
    const incoming = JSON.stringify(files);
    if (incoming === committed) {
      return;
    }

    committed = incoming;
    draft = { ...files };
    shown = { ...files };
    if (!(active in files)) {
      active = entry;
    }
  });

  const html = $derived(codeFrameHtml(framework, shown, { route, values: untrack(() => $state.snapshot(vars)) }));

  function commit() {
    timer = null;
    forgetVars(owner);
    shown = { ...draft };
    committed = JSON.stringify(draft);
    onchange?.({ ...draft });
  }

  function edited(text: string) {
    draft = { ...draft, [active]: text };
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(commit, RENDER_DEBOUNCE_MS);
  }

  function addFile() {
    const path = naming?.trim().replace(/^\.?\//, '');
    naming = null;
    if (!path || path in draft) {
      return;
    }

    draft = { ...draft, [path]: '' };
    active = path;
    commit();
  }

  function removeFile(path: string) {
    if (path === entry || !confirm(`Delete ${path}?`)) {
      return;
    }

    draft = Object.fromEntries(Object.entries(draft).filter(([name]) => name !== path));
    active = entry;
    commit();
  }

  let host = $state<HTMLDivElement | null>(null);
  let view = $state<CodeView | null>(null);

  onMount(() => {
    return () => {
      if (timer) {
        clearTimeout(timer);
        commit();
      }
    };
  });

  $effect(() => {
    const el = host;
    if (!el) {
      return;
    }

    let mounted: CodeView | null = null;
    let live = true;
    void import('$lib/components/motion/code-editor').then(({ mountCode }) => {
      if (live) {
        mounted = mountCode(el, edited);
        view = mounted;
      }
    });

    return () => {
      live = false;
      mounted?.destroy();
      view = null;
    };
  });

  $effect(() => {
    view?.show(draft[active] ?? '', languageOf(active), null);
  });
</script>

<div class="code-body">
  <iframe
    title="Code frame"
    bind:this={frame}
    data-testid="code-frame"
    srcdoc={html}
    sandbox={IFRAME_SANDBOX}
    referrerpolicy={IFRAME_REFERRER_POLICY}
  ></iframe>
</div>

{#if selected && rightBar.propertiesPane}
  <div class="code-vars" use:portalFirst={rightBar.propertiesPane}>
    <CodeVarsPanel {label} declared={varsOf(owner)} values={vars} onchange={onvars} />
  </div>
{/if}

{#if editing}
  <footer class="code-editor nodrag nopan nowheel">
    <div class="code-files" role="tablist" aria-label="Files">
      {#each Object.keys(draft) as path (path)}
        <span class="code-file" class:is-on={path === active}>
          <button type="button" role="tab" aria-selected={path === active} onclick={() => (active = path)}>{path}</button>
          {#if path !== entry}
            <button type="button" class="code-file-x" aria-label={`Delete ${path}`} onclick={() => removeFile(path)}>×</button>
          {/if}
        </span>
      {/each}
      {#if naming === null}
        <button type="button" class="code-add" aria-label="Add file" onclick={() => (naming = '')}>+</button>
      {:else}
        <!-- svelte-ignore a11y_autofocus -->
        <input
          class="code-name"
          aria-label="New file name"
          placeholder="pages/Home.tsx"
          autofocus
          bind:value={naming}
          onblur={addFile}
          onkeydown={(e) => e.key === 'Enter' && addFile()}
        />
      {/if}
    </div>
    <div class="code-host" bind:this={host}></div>
  </footer>
{/if}

<style>
  .code-body {
    flex: 1;
    min-height: 0;
    background: #fff;
  }
  .code-body iframe {
    display: block;
    width: 100%;
    height: 100%;
    border: none;
    background: #fff;
  }
  .code-editor {
    display: flex;
    flex-direction: column;
    height: 45%;
    min-height: 140px;
    border-top: 1px solid var(--line, #e5e5e5);
    background: var(--paper, #fff);
  }
  .code-files {
    display: flex;
    flex-wrap: wrap;
    gap: 2px;
    padding: 4px 6px;
    border-bottom: 1px solid var(--line, #e5e5e5);
  }
  .code-file {
    display: inline-flex;
    align-items: center;
    border-radius: var(--ui-radius-sm, 4px);
  }
  .code-file.is-on {
    background: var(--paper-2, #f2f2f2);
  }
  .code-file button,
  .code-add {
    padding: 2px 6px;
    font: 11.5px ui-monospace, Menlo, monospace;
    color: var(--ink-soft, #6e6e73);
    background: none;
    border: none;
    cursor: pointer;
  }
  .code-file.is-on button {
    color: var(--ink, #1d1d1f);
  }
  .code-name {
    width: 140px;
    padding: 2px 6px;
    font: 11.5px ui-monospace, Menlo, monospace;
    border: 1px solid var(--line-2, #d2d2d7);
    border-radius: var(--ui-radius-sm, 4px);
  }
  .code-host {
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }
</style>
