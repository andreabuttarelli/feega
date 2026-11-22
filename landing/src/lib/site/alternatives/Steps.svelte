<script lang="ts">
  import type { Step } from './alternative';

  let { steps }: { steps: readonly Step[] } = $props();
</script>

<ol class="steps">
  {#each steps as step (step.title)}
    <li><strong>{step.title}</strong><span>{step.text}</span></li>
  {/each}
</ol>
