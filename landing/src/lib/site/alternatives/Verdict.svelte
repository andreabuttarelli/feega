<script lang="ts">
  import { lower } from '../lower';

  let { text }: { text: string } = $props();
</script>

<aside class="verdict">
  <span class="tag">{lower('The verdict')}</span>
  <p>{text}</p>
</aside>
