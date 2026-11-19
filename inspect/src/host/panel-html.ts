export type PanelAssets = { script: string; style: string; cspSource: string; nonce: string };

const LOCAL_FRAMES = 'http://localhost:* http://127.0.0.1:*';

export function panelHtml({ script, style, cspSource, nonce }: PanelAssets): string {
  const csp = [
    `default-src 'none'`,
    `frame-src ${LOCAL_FRAMES}`,
    `script-src 'nonce-${nonce}'`,
    `style-src ${cspSource} 'unsafe-inline'`,
    `font-src ${cspSource}`,
    `img-src ${cspSource} data:`
  ].join('; ');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="${style}">
<title>Feega Inspect</title>
</head>
<body>
<div id="app"></div>
<script nonce="${nonce}" src="${script}"></script>
</body>
</html>`;
}
