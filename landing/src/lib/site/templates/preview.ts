import type { FontNeed, Template } from './template';

export const HEIGHT_MESSAGE = 'feega-preview-height';

const FONTS_ORIGIN = 'https://fonts.googleapis.com/css2';

const familyParam = (font: FontNeed) => `family=${font.family.replace(/ /g, '+')}:wght@${[...font.weights].sort((a, b) => a - b).join(';')}`;

export const fontsHref = (fonts: readonly FontNeed[]): string | undefined =>
  fonts.length === 0 ? undefined : `${FONTS_ORIGIN}?${fonts.map(familyParam).join('&')}&display=swap`;

export const fontsLinkTag = (fonts: readonly FontNeed[]): string | undefined => {
  const href = fontsHref(fonts);

  return href ? `<link rel="stylesheet" href="${href}" />` : undefined;
};

const PREVIEW_SCRIPT = `
const apply = () => { document.documentElement.dataset.theme = location.hash === '#light' ? 'light' : 'dark'; };
const report = () => parent.postMessage({ type: '${HEIGHT_MESSAGE}', height: Math.ceil(document.documentElement.getBoundingClientRect().height) }, '*');
apply();
addEventListener('hashchange', apply);
new ResizeObserver(report).observe(document.documentElement);
addEventListener('load', report);
`;

export function previewDocument(template: Template, parts: { markup: string; css: string }, tokensCss: string): string {
  const fonts = fontsHref(template.fonts);

  return `<!doctype html>
<html lang="en" data-theme="dark">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex" />
<title>${template.name} preview</title>
${fonts ? `<link rel="stylesheet" href="${fonts}" />` : ''}
<style>
${tokensCss}
html,body{margin:0}
body{background:var(--feega-bg)}
${parts.css}
</style>
</head>
<body>
${parts.markup}
<script>${PREVIEW_SCRIPT}</script>
</body>
</html>
`;
}
