<script lang="ts">
  const LINES = ['Remotion is code: every tweak is a diff and a re-render.', 'Feega is a canvas: you see it live and drag it.'];
</script>

<div class="remotion">
  <h3>Why not Remotion?</h3>
  <p>{LINES[0]} <br />{LINES[1]}</p>
</div>

<style>
  .remotion {
    padding: 40px 0 0;
    color: var(--site-ink);
  }

  h3 {
    margin: 0;
    font-size: 34px;
    line-height: 36px;
    letter-spacing: -0.04em;
    font-weight: 400;
  }

  p {
    margin: 16px 0 0;
    opacity: 0.7;
    font-size: 20px;
    line-height: 24px;
    letter-spacing: -0.03em;
  }

  @media (min-width: 810px) {
    h3 {
      font-size: 40px;
      line-height: 42px;
    }

    p {
      font-size: 24px;
      line-height: 28.8px;
    }
  }

  @media (min-width: 1200px) {
    .remotion {
      padding: 0;
    }

    h3 {
      font-size: 46px;
      line-height: 46px;
    }
  }
</style>
