export const MARKETING_ORIGIN = 'https://feega.app';

const LANDING_PATHS: ReadonlySet<string> = new Set([
  '/changelog',
  '/ai-video-upscaler',
  '/ai-video-generator',
  '/ai-video-styles',
  '/claymation-ai',
  '/3d-animation-maker',
  '/ai-commercial-maker',
  '/paper-cutout-animation',
  '/80s-retro-video',
  '/anime-video-generator',
  '/spotify-canvas-maker',
  '/ai-node-editor',
  '/terms',
  '/acceptable-use',
  '/privacy',
  '/cookies',
  '/refunds',
  '/ai-transparency',
  '/dpa',
  '/subprocessors',
  '/legal-notice'
]);

export function marketingUrl(path: string): string {
  return `${MARKETING_ORIGIN}${path}`;
}

export function landingUrlFor(url: URL): string | null {
  const path = url.pathname.length > 1 ? url.pathname.replace(/\/$/, '') : url.pathname;
  if (!LANDING_PATHS.has(path)) {
    return null;
  }

  return `${marketingUrl(path)}${url.search}`;
}
