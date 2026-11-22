<script lang="ts">
  import type { Question } from './alternative';

  let { items }: { items: readonly Question[] } = $props();
</script>

<div class="faq">
  {#each items as item (item.q)}
    <details>
      <summary>{item.q}</summary>
      <p>{item.a}</p>
    </details>
  {/each}
</div>
