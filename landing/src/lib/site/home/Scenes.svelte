<section class="scenes">
  {#each ['scene-1', 'scene-2'] as image (image)}
    <div class="frame">
      <img src="/site/home/{image}.webp" alt="" width="1536" height="1024" loading="lazy" decoding="async" />
    </div>
  {/each}
</section>

<style>
  .scenes {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    padding: 0 12px 100px;
  }

  .frame {
    overflow: hidden;
    aspect-ratio: 726 / 583;
  }

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transform: scale(1.3);
  }

  @media (min-width: 810px) {
    .scenes {
      gap: 40px;
      padding: 0 20px 193px;
    }
  }
</style>
