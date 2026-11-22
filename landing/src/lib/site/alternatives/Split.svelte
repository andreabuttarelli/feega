<script lang="ts">
  import { lower } from '../lower';

  let { themName, them, us }: { themName: string; them: readonly string[]; us: readonly string[] } = $props();
</script>

<div class="split">
  <div class="pane">
    <h3>{lower(`Choose ${themName} if`)}</h3>
    <ul>{#each them as point (point)}<li>{point}</li>{/each}</ul>
  </div>
  <div class="pane ours">
    <h3>{lower('Choose Feega if')}</h3>
    <ul>{#each us as point (point)}<li>{point}</li>{/each}</ul>
  </div>
</div>
