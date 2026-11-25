<script lang="ts">
  import InstallCta from '../InstallCta.svelte';
</script>

<section class="closing site-wide">
  <h2>start designing in your code</h2>
  <InstallCta id="closing-install" />
</section>

<style>
  .closing {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 32px;
    padding: 96px 20px;
    text-align: center;
  }

    .closing h2 {
    margin: 0;
    font-family: 'Instrument Serif', serif;
    font-size: 48px;
    font-weight: 400;
    line-height: 0.95;
    letter-spacing: -0.04em;
    color: #fff;
  }

  @media (min-width: 810px) {
      .closing h2 {
      font-size: 72px;
    }
  }
</style>
