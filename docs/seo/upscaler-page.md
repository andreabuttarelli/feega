# /ai-video-upscaler — page-1 rewrite (Framer, apply by hand)

Status: copy, blocks and JSON-LD ready. Not applied on Framer: the page is built from the
`v2-upscaler-*` nodes on page `s_35waTFe`; the rewrite adds a video slider, a specs table and a
comparison table, which is a layout change to review before it ships. **Never publish without
review.** The live page still says "up to 30 seconds": wrong, the model takes 20 s — fix first.

## SERP intent (2026-10-04, US results)

| Query | Who ranks | What the pages have | Intent |
|---|---|---|---|
| ai video upscaler | Topaz, ArtPlayer, Krea, Morph Studio, VanceAI, TensorPix, Wink | H1 = "AI Video Upscaler", upload box above the fold, before/after slider, 1080p/2K/4K targets, "free" in title | tool, do it now |
| video upscaler | same set + Canva, imgupscaler | same; Canva states hard limits (MP4, 10 MB, 10 s free) | tool |
| upscale video to 4k | Runway, Higgsfield, Topaz, CapCut, Adobe Firefly, Dzine, Vmake, HitPaw | "4K (3840×2160)" spelled out, 3 steps (upload → 4K → download), works on old/compressed footage | tool + how-to |
| video upscaler online free | imgupscaler, Canva, ArtPlayer, Morph, Picwand, free.upscaler.video, Vmake | "free", "no signup", "no watermark", browser-only/privacy claims | free tool |
| ai video enhancer | ElevenLabs, Airbrush, Cutout.pro, Picsart, Topaz, Wink | upscale + denoise + deblur + colour; broader than upscale | enhance (partly not served) |

Takeaways: every page-1 result is a tool page with a working upload and a real before/after.
None of ours had real examples. Honest gaps: we are not free and not unlimited (credits, 20 s,
mp4), we do no denoise/stabilise/colour/frame interpolation. Compete on: real output shown,
exact price per second before running, the clip lands in a workspace (canvas, social calendar).

## Meta

- Title (54): `AI Video Upscaler – Upscale Video to 2× or 4K | feega`
- Meta description (156): `Upscale a video to 2× or 4K with AI. Upload an MP4 up to 20 s, see the exact price before you run, compare before and after, download. FLUX Video Upscale.`
- URL unchanged: `/ai-video-upscaler`. Canonical `https://www.feega.app/ai-video-upscaler`.
- OG image: frame of `static/upscaler/sample-poster.webp` (real upscaled frame).

## Blocks, in order

### 1. Hero
- H1: `AI Video Upscaler`
- Intro (answer first): `feega upscales a video clip to 2× or 4K with FLUX Video Upscale. Upload an MP4 of up to 20 seconds, see the output size and the price before you run it, then compare before and after and download the sharper clip.`
- CTA: `Upscale a video →` → `https://oh.feega.app/app/upscale?utm_source=feega.app&utm_medium=landing&utm_campaign=ai-video-upscaler`
  (signed-out visitors go through login; the campaign cookie lands them on `/app/upscale`.)
- Under the CTA, small: `MP4 · up to 20 s · up to 1440p in · 4K out · from 25 credits per second`

### 2. Real example (before/after)
- Slider: `sample-before.mp4` (854×480, 2 s) vs `sample-after.mp4` (1708×960), both from
  `static/upscaler/` in the app repo — real output of one run on 2026-10-04 (2× precise,
  46 credits, $0.23). Upload both to Framer assets.
- Embed: `<video muted loop playsinline preload="none" poster="sample-poster.webp">` — lazy,
  poster first; no autoplay above the fold on mobile.
- Caption: `Real output: 854×480 → 1708×960 (2×, Precise). Big Buck Bunny © Blender Foundation, CC BY 3.0.`
- Alt / aria-label: `Before and after: a 480p animated forest clip and the same clip upscaled 2× by FLUX Video Upscale`
- Remove the current fake downscaled stills.

### 3. How it works (3 steps)
1. `Upload an MP4 or pick a video already in your project.`
2. `Choose 2× or 4K and Precise or Creative. The page shows the output size and the price.`
3. `Run it. In a few minutes compare before and after with the slider and download.`

### 4. Specs table
| | |
|---|---|
| Input | MP4, up to 20 s, up to 50 MB, up to 2560×1440 |
| Output | 1.5× to 3× the source, up to 4K (3840×2160), same duration and aspect ratio, 24 fps, source audio kept |
| Targets | 2×, or 4K (long edge 3840, capped at 3×) |
| Modes | Precise (faces, products, text) · Creative (scenery, textures, AI clips) |
| Speed | a few minutes for a short clip |
| Price | output megapixels × seconds: 480p→2× ≈ 25 credits/s, 720p→4K ≈ 55 credits/s, 1080p→4K ≈ 124 credits/s (Precise; Creative ×1.4). Exact quote before you run |
| Labelling | output marked AI-generated (IPTC `trainedAlgorithmicMedia` in the file metadata) |

### 5. Compared with other upscalers (honest)
| | feega | Topaz Video | Browser upscalers (ArtPlayer, free.upscaler.video) | Canva / CapCut |
|---|---|---|---|---|
| Runs | cloud, from the browser | desktop app / cloud | in your browser, nothing uploaded | cloud |
| Max length | 20 s | long footage | device-bound | short free tier (Canva: 10 s, 10 MB) |
| Up to | 4K | 4K+ and frame interpolation | ~2× | 4K |
| Price | per second, quote first | subscription | free | free tier + plan |
| Best for | short social/ad clips, AI-generated clips you keep editing | long or archival footage, denoise, fps | private, free, light upscale | quick edits inside an editor |

Line under the table: `For long films, denoising or frame-rate conversion, a desktop tool like Topaz is the better fit.`

### 6. FAQ (visible on page, mirrored in JSON-LD)
- **Is the AI video upscaler free?** No. An upscale costs credits per second of output, and the price is shown before you run it. A 2-second 480p clip upscaled 2× costs about 46 credits.
- **Can it upscale video to 4K?** Yes. Choose 4K and the long edge goes to 3840 px, up to 3× the source: 1080p and 1440p reach full 4K, 720p reaches 3840×2160 at 3×, 480p stops at 2562×1440.
- **Does it fix old or blurry footage?** It adds resolution and fine detail; Creative mode restores more texture. It does not remove heavy noise, stabilise shaky footage or colourise black-and-white video.
- **How long can the video be?** Up to 20 seconds and 50 MB, MP4. Trim longer footage first.
- **Is my video private? Is the result labelled as AI?** Uploads and results stay in your private project storage, visible only to your workspace. The upscaled file carries AI-generated metadata.

### 7. Related (internal links)
`/ai-video-generator` (make a clip, then upscale it) · `/ai-commercial-maker` · `/80s-retro-video`
· `/ai-node-editor`. From the home page: add "AI Video Upscaler" to the tools/features list
linking here.

## JSON-LD (page head, Framer custom code)

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      "name": "feega AI Video Upscaler",
      "applicationCategory": "MultimediaApplication",
      "operatingSystem": "Web",
      "url": "https://www.feega.app/ai-video-upscaler",
      "description": "Upscale an MP4 clip of up to 20 seconds to 2x or 4K with FLUX Video Upscale, with a price quote before you run it.",
      "offers": { "@type": "Offer", "priceCurrency": "USD", "description": "Billed in credits per second of output." },
      "publisher": { "@type": "Organization", "name": "feega", "url": "https://www.feega.app" }
    },
    {
      "@type": "FAQPage",
      "mainEntity": [
        { "@type": "Question", "name": "Is the AI video upscaler free?", "acceptedAnswer": { "@type": "Answer", "text": "No. An upscale costs credits per second of output, and the price is shown before you run it. A 2-second 480p clip upscaled 2x costs about 46 credits." } },
        { "@type": "Question", "name": "Can it upscale video to 4K?", "acceptedAnswer": { "@type": "Answer", "text": "Yes. Choose 4K and the long edge goes to 3840 px, up to 3x the source: 1080p and 1440p reach full 4K, 480p stops at 2562x1440." } },
        { "@type": "Question", "name": "Does it fix old or blurry footage?", "acceptedAnswer": { "@type": "Answer", "text": "It adds resolution and fine detail; Creative mode restores more texture. It does not remove heavy noise, stabilise shaky footage or colourise black-and-white video." } },
        { "@type": "Question", "name": "How long can the video be?", "acceptedAnswer": { "@type": "Answer", "text": "Up to 20 seconds and 50 MB, MP4." } },
        { "@type": "Question", "name": "Is my video private? Is the result labelled as AI?", "acceptedAnswer": { "@type": "Answer", "text": "Uploads and results stay in your private project storage, visible only to your workspace. The upscaled file carries AI-generated metadata." } }
      ]
    },
    {
      "@type": "VideoObject",
      "name": "AI video upscale example: 480p to 2x",
      "description": "Real FLUX Video Upscale output on feega: 854x480 to 1708x960.",
      "thumbnailUrl": "https://www.feega.app/upscaler/sample-poster.webp",
      "contentUrl": "https://www.feega.app/upscaler/sample-after.mp4",
      "uploadDate": "2026-10-04",
      "duration": "PT2S"
    }
  ]
}
</script>
```
(Update `thumbnailUrl`/`contentUrl` to the Framer asset URLs once uploaded.)

## Page speed
- Videos `preload="none"` + poster WebP (166 KB); `sample-after.mp4` is 3.9 MB — load on
  interaction or when in view.
- No autoplay on mobile; set width/height on the video wrapper (16:9) to avoid CLS.
