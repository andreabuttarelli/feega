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
  }

  h2 {
    position: absolute;
    left: 0;
    right: 0;
    top: 50%;
    transform: translateY(-50%);
    padding: 0 20px;
    color: #fff;
    text-align: center;
    font-size: 37px;
    line-height: 37px;
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
