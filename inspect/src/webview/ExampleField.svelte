<script lang="ts">
  import { fillRoute, paramsOf } from '../route-match';
  import SampleMenu from './SampleMenu.svelte';
  import { TargetKind } from './sample-values';

  type Props = { pattern: string; onadd: (path: string) => void };

  let { pattern, onadd }: Props = $props();

  let values = $state<Record<string, string>>({});

  const params = $derived(paramsOf(pattern));

  function submit(e: KeyboardEvent) {
    if (e.key !== 'Enter') {
      return;
    }
    openPage();
  }

  function pick(name: string, value: string) {
    values[name] = value;
    openPage();
  }

  function openPage() {
    const path = fillRoute(pattern, values);
    if (path) {
      onadd(path);
      values = {};
    }
  }
</script>

<div class="example" data-testid="example-field" data-route={pattern}>
  {#each params as param (param.name)}
    <div class="box">
      <input type="text" spellcheck="false" autocomplete="off" placeholder={`Open with a ${param.name}${param.required ? '' : ' (optional)'}…`} title={`Type a ${param.name} and press Enter to open the page`} aria-label={`Value for ${param.name}`} data-testid="example-input" data-param={param.name} bind:value={values[param.name]} onkeydown={submit} />
      <SampleMenu target={{ kind: TargetKind.Route }} onpick={(value) => pick(param.name, value)} />
    </div>
  {/each}
</div>

<style>
  .example {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .box {
    position: relative;
  }

  input {
    box-sizing: border-box;
    width: 100%;
    height: 24px;
    padding: 0 26px 0 8px;
    border: 1px solid transparent;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-input);
    color: var(--ui-text);
    font: inherit;
    font-size: var(--ui-text-xs);
    outline: none;
  }

  input::placeholder {
    color: var(--ui-text-3);
  }

  input:focus {
    border-color: var(--ui-accent);
  }
</style>
