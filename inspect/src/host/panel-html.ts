export type PanelAssets = { script: string; style: string; cspSource: string; nonce: string; theme?: PanelTheme };

export type PanelTheme = { bodyClass: string; variables: Record<string, string> };

const LOCAL_FRAMES = 'http://localhost:* http://127.0.0.1:*';
const LOCAL_SOCKETS = 'ws://localhost:* ws://127.0.0.1:*';

const themeStyle = (theme?: PanelTheme) =>
  theme ? `<style>:root{${Object.entries(theme.variables).map(([name, value]) => `${name}:${value}`).join(';')}}</style>\n` : '';

export function panelHtml({ script, style, cspSource, nonce, theme }: PanelAssets): string {
  const csp = [
    `default-src 'none'`,
    `frame-src 'self' ${LOCAL_FRAMES}`,
    `connect-src 'self' ${LOCAL_SOCKETS}`,
    `script-src 'nonce-${nonce}'`,
    `worker-src blob:`,
    `style-src ${cspSource} 'unsafe-inline' https://fonts.googleapis.com`,
    `font-src ${cspSource} https://fonts.gstatic.com`,
    `img-src ${cspSource} data:`
  ].join('; ');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="${style}">
${themeStyle(theme)}<title>Feega</title>
</head>
<body class="${theme?.bodyClass ?? ''}">
<div id="app"></div>
<script nonce="${nonce}" src="${script}"></script>
</body>
</html>`;
}
