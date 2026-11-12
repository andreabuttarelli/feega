<script lang="ts">
  import CodebaseStory from '../codebase/CodebaseStory.svelte';
</script>

<section class="codebase site-wide" id="codebase">
  <CodebaseStory />
</section>

<style>
  .codebase {
    padding: 120px 20px 0;
  }

  @media (min-width: 810px) {
    .codebase {
      padding: 160px 0 0;
    }
  }
</style>
