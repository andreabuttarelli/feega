import { describe, expect, it } from 'vitest';
import { redirectFor } from './host-redirects';

const SITE = 'https://www.feega.app';
const APP = 'https://oh.feega.app';

const at = (path: string, host = 'www.dalnulla.com') => redirectFor(new URL(`https://${host}${path}`));

describe('i domini che rimandano a feega.app', () => {
  it.each(['dalnulla.com', 'www.dalnulla.com', 'r.feega.app'])('%s va sul sito', (host) => {
    expect(at('/', host)).toBe(`${SITE}/`);
  });

  it('ignora maiuscole e porta', () => {
    expect(redirectFor(new URL('https://DalNulla.com:443/'))).toBe(`${SITE}/`);
  });

  it("l'app non rimanda da nessuna parte", () => {
    expect(redirectFor(new URL('https://oh.feega.app/login'))).toBeNull();
  });

  it('tiene la query string', () => {
    expect(at('/tools/ai-video-upscaler?utm_source=x')).toBe(`${SITE}/ai-video-upscaler?utm_source=x`);
  });

  it('una barra finale non cambia la destinazione', () => {
    expect(at('/tools/claymation-ai-generator/')).toBe(`${SITE}/claymation-ai`);
  });
});

describe('ogni vecchia pagina dalnulla con traffico ha una destinazione vera', () => {
  it.each([
    ['/tools/ai-video-upscaler', `${SITE}/ai-video-upscaler`],
    ['/pt/tools/ai-video-upscaler', `${SITE}/ai-video-upscaler`],
    ['/tools/3d-animation-maker', `${SITE}/3d-animation-maker`],
    ['/es/tools/3d-animation-maker', `${SITE}/3d-animation-maker`],
    ['/tools/ai-commercial-maker', `${SITE}/ai-commercial-maker`],
    ['/it/tools/ai-commercial-maker', `${SITE}/ai-commercial-maker`],
    ['/tools/paper-cutout-animation', `${SITE}/paper-cutout-animation`],
    ['/tools/80s-retro-video-maker', `${SITE}/80s-retro-video`],
    ['/es/tools/80s-retro-video-maker', `${SITE}/80s-retro-video`],
    ['/tools/anime-video-generator', `${SITE}/anime-video-generator`],
    ['/tools/claymation-ai-generator', `${SITE}/claymation-ai`],
    ['/de/tools/spotify-canvas-maker', `${SITE}/ai-video-styles`],
    ['/tools/explainer-video-ai', `${SITE}/ai-video-styles`],
    ['/fr/tools/horror-video-maker', `${SITE}/ai-video-styles`],
    ['/tools/un-tool-mai-visto', `${SITE}/ai-video-styles`],
    ['/it', `${SITE}/`], ['/it/tools/claymation-ai-generator', `${SITE}/claymation-ai`],
    ['/es/image-angles', `${SITE}/`], ['/es/tools/fantasy-video-maker', `${SITE}/ai-video-styles`],
    ['/app/generate-video', `${APP}/`],
    ['/app/node-editor', `${APP}/`],
    ['/sign-in', `${APP}/login`],
    ['/it/sign-in', `${APP}/login`],
    ['/fr/sign-in', `${APP}/login`],
    ['/pricing', `${SITE}/`],
    ['/privacy', `${SITE}/privacy`],
    ['/terms', `${SITE}/terms`],
    ['/cookie-policy', `${SITE}/cookies`],
    ['/docs/split-text-nodes', `${SITE}/`],
    ['/pt/docs/upscaler-nodes', `${SITE}/ai-video-upscaler`],
    ['/character-generator', `${SITE}/`],
    ['/free-background-remover', `${SITE}/`],
    ['/status', `${SITE}/`],
    ['/blog', `${SITE}/`]
  ])('%s → %s', (path, target) => {
    expect(at(path)).toBe(target);
  });
});
