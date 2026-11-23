<script lang="ts">
  import { Key, ON, type DemoState } from '../script';

  let { demo }: { demo: DemoState } = $props();
</script>

<span class="page">
  <i class="announce" class:in={demo[Key.Inserted] === ON}><b>NEW</b>Version 2.0 is out</i>
  <i class="line wide"></i>
  <i class="line"></i>
</span>

<style>
  .page {
    display: grid;
    gap: 5px;
    width: 150px;
    padding: 6px;
    overflow: hidden;
    border-radius: 6px;
    background: #f7f5f0;
  }

  .line {
    display: block;
    height: 5px;
    border-radius: 2px;
    background: #d9d5cb;
  }

  .line.wide {
    width: 70%;
  }

  .announce {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    height: 14px;
    margin: -6px -6px 0;
    background: #fbfaf7;
    box-shadow: inset 0 -1px 0 #ece9e2;
    color: #1a1a1a;
    font: normal 7px -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
    opacity: 0;
    transform: scaleY(0);
    transform-origin: 50% 0;
    transition:
      opacity 0.4s cubic-bezier(0.87, 0, 0.13, 1),
      transform 0.5s cubic-bezier(0.87, 0, 0.13, 1);
  }

  .announce.in {
    opacity: 1;
    transform: scaleY(1);
  }

  b {
    padding: 1px 3px;
    border-radius: 3px;
    background: #ff5100;
    color: #ffffff;
    font-size: 5px;
  }
</style>
