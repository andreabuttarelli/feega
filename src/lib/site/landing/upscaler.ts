const PAGE = 'https://www.feega.app/ai-video-upscaler';
const MEDIA = '/site/landing/ai-video-upscaler';

export const UPSCALER = {
  title: 'AI Video Upscaler – Upscale Video to 2× or 4K | feega',
  description:
    'Upscale a video to 2× or 4K with AI. Upload an MP4 up to 20 s, see the exact price before you run, compare before and after, download. FLUX Video Upscale.',
  cta: {
    href: 'https://oh.feega.app/app/upscale?utm_source=feega.app&utm_medium=seo&utm_campaign=ai-video-upscaler',
    label: 'Upscale a video →'
  },
  media: { before: `${MEDIA}/before-480p.mp4`, after: `${MEDIA}/after-2x.mp4`, poster: `${MEDIA}/poster.webp` },
  specs: [
    ['Input', 'MP4, up to 20 s, up to 50 MB, up to 2560×1440'],
    ['Output', '1.5× to 3× the source, up to 4K (3840×2160), max ~14.4 MP per frame. Same duration and aspect ratio, 24 fps, source audio kept'],
    ['Targets', '2×, or 4K (long edge 3840, capped at 3×)'],
    ['Modes', 'Precise (faces, products, text) · Creative (scenery, textures, AI clips)'],
    ['Speed', 'A few minutes for a short clip'],
    ['Price', 'Output megapixels × seconds: 480p→2× ≈ 25 credits/s, 720p→4K ≈ 55 credits/s, 1080p→4K ≈ 124 credits/s (Precise; Creative ×1.4). Exact quote before you run'],
    ['Labelling', 'Output marked AI-generated in the file metadata (IPTC trainedAlgorithmicMedia)']
  ],
  comparison: [
    ['', 'feega', 'Topaz Video', 'Browser upscalers (ArtPlayer, free.upscaler.video)', 'Canva / CapCut'],
    ['Runs', 'Cloud, from the browser', 'Desktop app / cloud', 'In your browser, nothing uploaded', 'Cloud'],
    ['Max length', '20 s', 'Long footage', 'Device-bound', 'Short free tier (Canva: 10 s, 10 MB)'],
    ['Up to', '4K', '4K+ and frame interpolation', '~2×', '4K'],
    ['Price', 'Per second, quote first', 'Subscription', 'Free', 'Free tier + plan'],
    ['Best for', 'Short social/ad clips, AI clips you keep editing', 'Long or archival footage, denoise, fps', 'Private, free, light upscale', 'Quick edits inside an editor']
  ],
  faq: [
    ['Is the AI video upscaler free?', 'No. An upscale costs credits per second of output, and the price is shown before you run it. A 2-second 480p clip upscaled 2× costs about 46 credits.'],
    ['Can it upscale video to 4K?', 'Yes. Choose 4K and the long edge goes to 3840 px, up to 3× the source: 1080p and 1440p reach full 4K, 720p reaches 3840×2160 at 3×, 480p stops at 2562×1440.'],
    ['Does it fix old or blurry footage?', 'It adds resolution and fine detail; Creative mode restores more texture. It does not remove heavy noise, stabilise shaky footage or colourise black-and-white video.'],
    ['How long can the video be?', 'Up to 20 seconds and 50 MB, MP4. Trim longer footage first.'],
    ['Is my video private? Is the result labelled as AI?', 'Uploads and results stay in your private project storage, visible only to your workspace. The upscaled file carries AI-generated metadata.']
  ],
  more: [
    ['/', 'feega home'],
    ['/3d-animation-maker', '3D Animation Maker'],
    ['/ai-commercial-maker', 'AI Commercial Maker'],
    ['/paper-cutout-animation', 'Paper Cutout Animation'],
    ['/claymation-ai', 'Claymation AI'],
    ['/80s-retro-video', '80s Retro VHS Video'],
    ['/anime-video-generator', 'Anime Video Generator'],
    ['/ai-video-styles', 'AI Video Styles'],
    ['/spotify-canvas-maker', 'Spotify Canvas Maker'],
    ['/ai-video-generator', 'AI Video Generator — make a clip, then upscale it'],
    ['/ai-node-editor', 'AI Node Editor']
  ]
} as const;

export function upscalerJsonLd(): string {
  const data = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'SoftwareApplication',
        name: 'feega AI Video Upscaler',
        applicationCategory: 'MultimediaApplication',
        operatingSystem: 'Web',
        url: PAGE,
        description: 'Upscale an MP4 clip of up to 20 seconds to 2x or 4K with FLUX Video Upscale, with a price quote before you run it.',
        offers: { '@type': 'Offer', priceCurrency: 'USD', description: 'Billed in credits per second of output.' },
        publisher: { '@type': 'Organization', name: 'feega', url: 'https://www.feega.app' }
      },
      {
        '@type': 'FAQPage',
        mainEntity: UPSCALER.faq.map(([name, text]) => ({ '@type': 'Question', name, acceptedAnswer: { '@type': 'Answer', text } }))
      },
      {
        '@type': 'VideoObject',
        name: 'AI video upscale example: 480p to 2x',
        description: 'Real FLUX Video Upscale output on feega: 854x480 to 1708x960. Big Buck Bunny (c) Blender Foundation, CC BY 3.0.',
        thumbnailUrl: `https://www.feega.app${UPSCALER.media.poster}`,
        contentUrl: `https://www.feega.app${UPSCALER.media.after}`,
        uploadDate: '2026-10-04',
        duration: 'PT2S'
      }
    ]
  };
  return `<script type="application/ld+json">${JSON.stringify(data)}</` + 'script>';
}
