# SEO landing pages, upscaler page and 404 rebuilt off Framer

Third step of moving www.feega.app off Framer.

- Ten landing pages (`/ai-video-generator`, `/ai-video-styles`, `/claymation-ai`,
  `/3d-animation-maker`, `/ai-commercial-maker`, `/paper-cutout-animation`, `/80s-retro-video`,
  `/anime-video-generator`, `/spotify-canvas-maker`, `/ai-node-editor`) share one template
  (`src/routes/(site)/[page=landing]`), content in `src/lib/site/landing/pages.json`, images
  self-hosted in `static/site/landing/`. Framer's mixed heading levels (title as h3, sections as
  h5, questions as h3) become h1/h2/h3.
- `/ai-video-upscaler` has its own page: before/after slider, specs, comparison table and its
  FAQ/Video JSON-LD; the example clips are self-hosted.
- 404 on the site host renders the site's 404 wall (`SiteNotFound`) from the root `+error.svelte`;
  the app keeps its own error page.
- Parity at 375–1920: landing pages 0.946–0.994 pixel match (≥0.987 within ±3px), upscaler
  0.943–0.980, 404 0.970–0.993.
