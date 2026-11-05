<script lang="ts">
  const COMMAND = 'npx';
  const NAME = 'feega';
</script>

<code class="npx"><span>{COMMAND}</span> <span class="name">{NAME}</span></code>

<style>
  .npx {
    display: inline-block;
    padding: 4px 8px;
    border-radius: 8px;
    background: #222;
    font-family: 'DM Mono', monospace;
    font-size: 16px;
    line-height: 19.2px;
    letter-spacing: -0.02em;
    white-space: pre;
  }

  span {
    opacity: 0.8;
    color: #fff;
  }

  .name {
    color: #ff7373;
  }
</style>
