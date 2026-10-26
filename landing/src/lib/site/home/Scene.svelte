<script lang="ts">
  let { image }: { image: string } = $props();
</script>

<section class="scene">
  <div class="frame">
    <img src="/site/home/{image}.webp" alt="" width="1536" height="1024" loading="lazy" />
  </div>
</section>

<style>
  .scene {
    max-width: 430px;
    margin: 0 auto;
    padding: 12px;
  }

  .frame {
    overflow: hidden;
    height: 450px;
  }

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transform: scale(1.3);
  }

  @media (min-width: 1200px) {
    .scene {
      max-width: 1500px;
      padding: 20px;
    }

    .frame {
      height: 855px;
    }

    img {
      transform: scale(1.1);
    }
  }
</style>
