<script lang="ts">
  import NodeBoundary from '../NodeBoundary.svelte';

  let { fail }: { fail: boolean } = $props();

  function body(): string {
    if (fail) {
      throw new Error('could not be cloned');
    }
    return 'node body';
  }
</script>

<div class="neighbour">other node</div>
<NodeBoundary>
  <p>{body()}</p>
</NodeBoundary>
