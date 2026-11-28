<script lang="ts">
  import { fillRoute, paramsOf } from '../route-match';

  type Props = { pattern: string; onadd: (path: string) => void };

  let { pattern, onadd }: Props = $props();

  let values = $state<Record<string, string>>({});

  const params = $derived(paramsOf(pattern));

  function submit(e: KeyboardEvent) {
    if (e.key !== 'Enter') {
      return;
    }
    const path = fillRoute(pattern, values);
    if (path) {
      onadd(path);
      values = {};
    }
  }
</script>

<div class="fields" data-testid="example-field" data-route={pattern}>
  {#each params as param (param.name)}
    <label class="field">
      <span class="name">{param.name} =</span>
      <input type="text" spellcheck="false" autocomplete="off" placeholder={param.required ? 'value' : 'optional'} aria-label={`Value for ${param.name}`} data-testid="example-input" data-param={param.name} bind:value={values[param.name]} onkeydown={submit} />
    </label>
  {/each}
</div>

<style>
  .fields {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .field {
    display: flex;
    align-items: center;
    gap: 6px;
    color: var(--ui-text-2);
    font-size: var(--ui-text-xs);
  }

  .name {
    flex: none;
  }

  input {
    flex: 1;
    min-width: 0;
    height: 22px;
    padding: 0 6px;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-input);
    color: var(--ui-text);
    font: inherit;
  }

  input:focus-visible {
    outline: 1px solid var(--ui-accent);
  }
</style>
