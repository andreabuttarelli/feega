<script lang="ts">
  import type { MotionClip, MotionDoc } from '$lib/motion/doc';
  import type { OpResult } from '$lib/motion/timeline';
  import { interactiveOf } from '$lib/motion/interactive/settings';
  import { VAR_KINDS, VarKind, bindTargets, bindVar, declareVar, removeVar, starterVar, type VarDecl, type VarValue, type VarValues } from '$lib/motion/interactive/vars';

  let {
    doc,
    values = $bindable({}),
    clip,
    onchange
  }: { doc: MotionDoc; values?: VarValues; clip: MotionClip | null; onchange: (next: MotionDoc, summary: string) => void } = $props();

  const vars = $derived(interactiveOf(doc).vars);
  let name = $state('');
  let kind = $state<VarKind>(VarKind.Number);
  let error = $state('');
  let bindName = $state('');
  let bindProp = $state('');

  const bindDecl = $derived(vars.find((v) => v.name === bindName) ?? vars[0]);
  const targets = $derived(clip && bindDecl ? bindTargets(clip.component, bindDecl.kind) : []);

  const valueOf = (decl: VarDecl): VarValue => values[decl.name] ?? decl.default;
  const preview = (decl: VarDecl, value: VarValue) => (values = { ...values, [decl.name]: value });

  function commit(r: OpResult, summary: string) {
    error = r.ok ? '' : r.error;
    if (r.ok) {
      onchange(r.doc, summary);
    }
  }

  function add() {
    commit(declareVar(doc, starterVar(kind, name.trim())), `declared variable ${name}`);
    if (!error) {
      name = '';
    }
  }

  function keep(decl: VarDecl) {
    commit(declareVar(doc, { ...decl, default: valueOf(decl) } as VarDecl), `default of ${decl.name}`);
  }

  function setEdge(decl: VarDecl & { kind: VarKind.Number }, edge: 'min' | 'max', raw: string) {
    commit(declareVar(doc, { ...decl, [edge]: Number(raw) }), `${edge} of ${decl.name}`);
  }

  function setOptions(decl: VarDecl & { kind: VarKind.Enum }, raw: string) {
    const list = raw.split(',').map((o) => o.trim()).filter(Boolean);
    commit(declareVar(doc, { ...decl, options: list, default: list.includes(decl.default) ? decl.default : (list[0] ?? '') }), `options of ${decl.name}`);
  }

  function bind() {
    if (!clip || !bindDecl) {
      return;
    }
    commit(bindVar(doc, { var: bindDecl.name, clip: clip.id, prop: bindProp || targets[0] }), `bound ${bindDecl.name}`);
  }
</script>

<details class="vars" data-testid="vars-panel">
  <summary>Interactive · Advanced</summary>
  {#each vars as decl (decl.name)}
    <div class="var" data-testid={`var-${decl.name}`}>
      <code>{decl.name}</code>
      {#if decl.kind === VarKind.Number}
        <input type="number" class="edge" value={decl.min} aria-label={`${decl.name} min`} onchange={(e) => setEdge(decl, 'min', e.currentTarget.value)} />
        <input type="range" min={decl.min} max={decl.max} step={(decl.max - decl.min) / 100 || 0.01} value={valueOf(decl)} oninput={(e) => preview(decl, Number(e.currentTarget.value))} />
        <input type="number" class="edge" value={decl.max} aria-label={`${decl.name} max`} onchange={(e) => setEdge(decl, 'max', e.currentTarget.value)} />
        <span class="mono">{valueOf(decl)}</span>
      {:else if decl.kind === VarKind.Boolean}
        <input type="checkbox" checked={Boolean(valueOf(decl))} onchange={(e) => preview(decl, e.currentTarget.checked)} />
      {:else if decl.kind === VarKind.Enum}
        <select value={valueOf(decl)} onchange={(e) => preview(decl, e.currentTarget.value)}>
          {#each decl.options as option (option)}<option value={option}>{option}</option>{/each}
        </select>
        <input type="text" class="options" value={decl.options.join(', ')} aria-label={`${decl.name} options`} onchange={(e) => setOptions(decl, e.currentTarget.value)} />
      {:else if decl.kind === VarKind.Color}
        <input type="color" value={valueOf(decl)} oninput={(e) => preview(decl, e.currentTarget.value)} />
      {:else}
        <input type="text" value={valueOf(decl)} oninput={(e) => preview(decl, e.currentTarget.value)} />
      {/if}
      <button type="button" disabled={valueOf(decl) === decl.default} title="Use this value as the default the video renders" onclick={() => keep(decl)}>Set default</button>
      <button type="button" aria-label={`Remove ${decl.name}`} onclick={() => commit(removeVar(doc, decl.name), `removed variable ${decl.name}`)}>×</button>
    </div>
  {/each}

  <form class="row" onsubmit={(e) => (e.preventDefault(), add())}>
    <input type="text" placeholder="variable name" bind:value={name} aria-label="Variable name" />
    <select bind:value={kind} aria-label="Variable kind">
      {#each VAR_KINDS as k (k)}<option value={k}>{k}</option>{/each}
    </select>
    <button type="submit" disabled={!name.trim()} data-testid="var-add">Add variable</button>
  </form>

  {#if clip && vars.length}
    <div class="row">
      <span>Bind</span>
      <select bind:value={bindName} aria-label="Variable to bind">
        {#each vars as decl (decl.name)}<option value={decl.name}>{decl.name}</option>{/each}
      </select>
      <select bind:value={bindProp} aria-label="Property">
        {#each targets as prop (prop)}<option value={prop}>{prop}</option>{/each}
      </select>
      <button type="button" disabled={!targets.length} onclick={bind} data-testid="var-bind">to selected layer</button>
    </div>
  {/if}
  {#if error}<p class="error" role="alert">{error}</p>{/if}
</details>

<style>
  .vars {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 12px;
    padding: 4px 0;
  }

  summary {
    cursor: pointer;
    color: var(--ui-ink-2);
  }
  .var,
  .row {
    display: flex;
    gap: 6px;
    align-items: center;
    flex-wrap: wrap;
  }
  .edge {
    width: 48px;
  }
  .options {
    width: 120px;
  }
  .mono {
    font-family: var(--font-mono, monospace);
    min-width: 3ch;
  }
  input,
  select,
  button {
    border-radius: 0;
  }
  input[type='range'] {
    width: 100px;
  }
  .error {
    color: var(--ui-danger, #dc2626);
    margin: 0;
  }
</style>
