<script lang="ts">
  import { fillRoute, paramsOf } from '../route-match';
  import SampleMenu from './SampleMenu.svelte';
  import { TargetKind } from './sample-values';

  type Props = { pattern: string; onadd: (path: string) => void; oncollapse?: () => void; focus?: boolean };

  let { pattern, onadd, oncollapse, focus = false }: Props = $props();

  let values = $state<Record<string, string>>({});

  const params = $derived(paramsOf(pattern));

  function submit(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      oncollapse?.();
      return;
    }
    if (e.key !== 'Enter') {
      return;
    }
    openPage();
  }

  const isEmpty = () => Object.values(values).every((value) => !value);

  function leave(e: FocusEvent) {
    const to = e.relatedTarget as Element | null;
    if (to?.closest('.example, [role="menu"]') || !isEmpty()) {
      return;
    }
    oncollapse?.();
  }

  function autofocus(node: HTMLInputElement) {
    if (focus) {
      node.focus();
    }
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
      oncollapse?.();
    }
  }
</script>

<div class="example" data-testid="example-field" data-route={pattern}>
  {#each params as param (param.name)}
    <div class="box">
      <input type="text" spellcheck="false" autocomplete="off" placeholder={`Type a ${param.name}${param.required ? '' : ' (optional)'}…`} title={`Type a ${param.name} and press Enter to open the page`} aria-label={`Value for ${param.name}`} data-testid="example-input" data-param={param.name} use:autofocus bind:value={values[param.name]} onkeydown={submit} onblur={leave} />
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
