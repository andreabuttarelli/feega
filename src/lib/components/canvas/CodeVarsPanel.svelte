<script lang="ts">
  import type { VarValue, VarValues } from '$lib/canvas/code-frame';
  import { VarType, checkVarValue, type VarDecl } from '$lib/canvas/code-vars';

  let { label, declared, values, onchange }: { label: string; declared: VarDecl[]; values: VarValues; onchange: (values: VarValues) => void } = $props();

  let errors = $state<Record<string, string>>({});

  const valueOf = (decl: VarDecl) => values[decl.name] ?? decl.default;

  function set(decl: VarDecl, raw: VarValue) {
    const verdict = checkVarValue(decl, raw);
    if (!verdict.ok) {
      errors = { ...errors, [decl.name]: verdict.error };
      return;
    }

    errors = Object.fromEntries(Object.entries(errors).filter(([name]) => name !== decl.name));
    if (verdict.value !== values[decl.name]) {
      onchange({ ...values, [decl.name]: verdict.value });
    }
  }

  const text = (e: Event) => (e.currentTarget as HTMLInputElement).value;
  const number = (e: Event) => Number((e.currentTarget as HTMLInputElement).value);
</script>

<section class="vars" data-testid="code-vars" aria-label="Variables">
  <h3>{label} · Variables</h3>
  {#if declared.length === 0}
    <p class="empty">No variables yet. Declare one in the code: <code>feega.text('title', 'Hello')</code>.</p>
  {/if}
  {#each declared as decl (decl.name)}
    {@const value = valueOf(decl)}
    <label class="var" data-var={decl.name}>
      <span class="name">{decl.label ?? decl.name}<small>{decl.type}</small></span>
      {#if decl.type === VarType.Text || decl.type === VarType.Font}
        <input type="text" value={String(value)} onchange={(e) => set(decl, text(e))} />
      {:else if decl.type === VarType.LongText}
        <textarea rows="3" value={String(value)} onchange={(e) => set(decl, text(e))}></textarea>
      {:else if decl.type === VarType.Color}
        <span class="row">
          <input type="color" value={String(value)} oninput={(e) => set(decl, text(e))} />
          <input type="text" value={String(value)} onchange={(e) => set(decl, text(e))} />
        </span>
      {:else if decl.type === VarType.Range}
        <span class="row">
          <input type="range" min={decl.min} max={decl.max} step={decl.step} value={Number(value)} oninput={(e) => set(decl, number(e))} />
          <output>{value}</output>
        </span>
      {:else if decl.type === VarType.Number}
        <input type="number" min={decl.min} max={decl.max} step={decl.step} value={Number(value)} onchange={(e) => set(decl, number(e))} />
      {:else if decl.type === VarType.Boolean}
        <input type="checkbox" checked={value === true} onchange={(e) => set(decl, (e.currentTarget as HTMLInputElement).checked)} />
      {:else if decl.type === VarType.Select}
        <select value={String(value)} onchange={(e) => set(decl, (e.currentTarget as HTMLSelectElement).value)}>
          {#each decl.options ?? [] as option (option)}
            <option value={option}>{option}</option>
          {/each}
        </select>
      {:else if decl.type === VarType.Image}
        <span class="row">
          <img src={String(value)} alt="" />
          <input type="url" value={String(value)} onchange={(e) => set(decl, text(e))} />
        </span>
      {/if}
      {#if errors[decl.name]}<span class="error" role="alert">{errors[decl.name]}</span>{/if}
    </label>
  {/each}
</section>

<style>
  .vars {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px;
    font-size: 12px;
  }
  h3 {
    margin: 0;
    font-size: 12px;
    font-weight: 600;
  }
  .empty {
    margin: 0;
    color: var(--ink-soft, #6e6e73);
  }
  .var {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .name {
    display: flex;
    justify-content: space-between;
  }
  small {
    color: var(--ink-soft, #6e6e73);
  }
  .row {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .row input[type='text'],
  .row input[type='url'],
  .row input[type='range'] {
    flex: 1;
    min-width: 0;
  }
  input[type='text'],
  input[type='url'],
  input[type='number'],
  textarea,
  select {
    padding: 4px 6px;
    font: inherit;
    border: 1px solid var(--line-2, #d2d2d7);
    border-radius: var(--ui-radius-sm, 4px);
    background: var(--paper, #fff);
    color: var(--ink, #1d1d1f);
  }
  input[type='color'] {
    width: 28px;
    height: 24px;
    padding: 0;
    border: none;
  }
  img {
    width: 28px;
    height: 28px;
    object-fit: cover;
    border-radius: var(--ui-radius-xs, 2px);
  }
  .error {
    color: #b42318;
  }
</style>
