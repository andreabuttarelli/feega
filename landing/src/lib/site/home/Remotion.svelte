<script lang="ts">
  const LINES = ['Remotion is code: every tweak is a diff and a re-render.', 'Feega is a canvas: you see it live and drag it.'];
</script>

<section class="remotion site-wide">
  <h2>Why not Remotion?</h2>
  <p>{LINES[0]} <br />{LINES[1]}</p>
</section>

<style>
  .remotion {
    padding: 230px 12px 100px;
    color: #fff;
    text-align: center;
  }

  h2 {
    font-size: 50px;
    line-height: 45px;
    letter-spacing: -0.04em;
    font-weight: 400;
  }

  p {
    margin-top: 48px;
    color: rgba(255, 255, 255, 0.7);
    font-size: 24px;
    line-height: 28.8px;
    letter-spacing: -0.04em;
    white-space: pre-wrap;
  }

  @media (min-width: 810px) {
    .remotion {
      padding: 466px 0 150px;
    }

    h2 {
      font-size: 62px;
      line-height: 55.8px;
    }

    p {
      margin-top: 10px;
      font-size: 30px;
      line-height: 36px;
    }
  }

  @media (min-width: 1200px) {
    .remotion {
      padding: 366px 0 0;
    }

    h2 {
      font-size: 78px;
      line-height: 70.2px;
    }

    p {
      font-size: 38px;
      line-height: 45.6px;
    }
  }
</style>
