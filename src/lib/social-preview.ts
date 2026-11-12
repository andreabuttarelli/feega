const IMAGE_SIZE = { width: 1200, height: 630 } as const;

export const SOCIAL_PREVIEW = {
  title: 'Feega: design inside your code with your agents and team',
  description: 'Feega: design inside your code with your agents and team. An open-source canvas to design, animate and generate, from your repo, Figma or any website.',
  image: 'https://feega.app/og.png',
  video: 'https://feega.app/og.mp4',
  alt: 'Feega: Design inside your code with your agents and team. An isometric canvas where code becomes a design, a layout gets a timeline and a prompt wires into image and video nodes.',
  ...IMAGE_SIZE
} as const;

export type PreviewTag = { key: 'property' | 'name'; id: string; content: string };

const og = (id: string, content: string | number): PreviewTag => ({ key: 'property', id, content: String(content) });
const twitter = (id: string, content: string): PreviewTag => ({ key: 'name', id, content });

export function previewTags(url: string, ownImage?: string | null): PreviewTag[] {
  const page = [og('og:site_name', 'Feega'), og('og:type', 'website'), og('og:url', url), og('og:title', SOCIAL_PREVIEW.title), og('og:description', SOCIAL_PREVIEW.description), twitter('twitter:card', 'summary_large_image')];
  if (ownImage) {
    return [...page, og('og:image', ownImage), twitter('twitter:image', ownImage)];
  }

  return [
    ...page,
    og('og:image', SOCIAL_PREVIEW.image),
    og('og:image:type', 'image/png'),
    og('og:image:width', SOCIAL_PREVIEW.width),
    og('og:image:height', SOCIAL_PREVIEW.height),
    og('og:image:alt', SOCIAL_PREVIEW.alt),
    og('og:video', SOCIAL_PREVIEW.video),
    og('og:video:secure_url', SOCIAL_PREVIEW.video),
    og('og:video:type', 'video/mp4'),
    og('og:video:width', SOCIAL_PREVIEW.width),
    og('og:video:height', SOCIAL_PREVIEW.height),
    twitter('twitter:image', SOCIAL_PREVIEW.image),
    twitter('twitter:image:alt', SOCIAL_PREVIEW.alt)
  ];
}
