<script lang="ts">
  import { onMount } from 'svelte';
  import { FRAMEWORK_QUERY } from './paths';
  import { FRAMEWORK_LABEL } from './labels';
  import { Framework, type FrameworkCode } from './template';

  let { code, initial }: { code: FrameworkCode; initial: Framework } = $props();

  const COPIED_MS = 1600;
  const frameworks = Object.values(Framework);

  let active = $state<Framework>(Framework.Svelte);
  let copied = $state('');

  onMount(() => {
    const wanted = new URLSearchParams(window.location.search).get(FRAMEWORK_QUERY);
    active = frameworks.find((f) => f === wanted) ?? initial;
  });

  async function copy(name: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      copied = name;
      setTimeout(() => (copied = ''), COPIED_MS);
    } catch {
      copied = '';
    }
  }
</script>

<div class="tpl-code">
  <div class="chips" role="tablist" aria-label="Framework">
    {#each frameworks as framework (framework)}
      <button type="button" role="tab" id="tab-{framework}" aria-controls="code-{framework}" aria-selected={active === framework} onclick={() => (active = framework)}>
        {FRAMEWORK_LABEL[framework]}
      </button>
    {/each}
  </div>

  {#each frameworks as framework (framework)}
    <div role="tabpanel" id="code-{framework}" aria-labelledby="tab-{framework}" hidden={active !== framework}>
      {#each code[framework] as file (file.name)}
        <figure class="file">
          <figcaption>
            <span>{file.name}</span>
            <button type="button" class="copy" onclick={() => copy(`${framework}-${file.name}`, file.code)}>
              {copied === `${framework}-${file.name}` ? 'copied' : 'copy'}
            </button>
          </figcaption>
          <pre tabindex="0"><code>{file.code}</code></pre>
        </figure>
      {/each}
    </div>
  {/each}
</div>
