<script lang="ts">
  import Embed from './Embed.svelte';
  import { MOTION_EMBED_ID } from '../home';

  const MOTION = `<feega-motion src="${MOTION_EMBED_ID}"></feega-motion>`;
</script>

<section class="motion" id="canvas">
  <Embed title="An interactive feega motion" script="/embed.js" body={MOTION} />
  <h2>Your design tool shouldn’t limit you</h2>
</section>

<style>
  .motion {
    position: relative;
    height: 600px;
    margin-top: 20px;
  }

  h2 {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 20px;
    color: #fff;
    text-align: center;
    font-size: 40px;
    line-height: 1;
    letter-spacing: -0.04em;
    font-weight: 400;
    pointer-events: none;
  }

  @media (min-width: 810px) {
    .motion {
      height: 900px;
    }

    h2 {
      font-size: 58px;
      line-height: 58px;
    }
  }
</style>
