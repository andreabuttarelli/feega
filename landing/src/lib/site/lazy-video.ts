const NEAR_VIEWPORT = '400px';

export function lazyPlay(video: HTMLVideoElement) {
  const observer = new IntersectionObserver(
    ([entry]) => {
      if (!entry.isIntersecting) {
        video.pause();
        return;
      }

      video.src ||= video.dataset.src ?? '';
      video.play().catch(() => {});
    },
    { rootMargin: NEAR_VIEWPORT }
  );
  observer.observe(video);

  return { destroy: () => observer.disconnect() };
}
