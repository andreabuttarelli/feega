declare module 'virtual:changelog-entries' {
  const entries: { date: string; title: string; items: string[] }[];
  export default entries;
}

declare module '*.html?raw' {
  const html: string;
  export default html;
}

declare module '*.sh?raw' {
  const script: string;
  export default script;
}

declare const __FEEGA_VERSION__: string;
declare const __OG_IMAGE_VERSION__: string;
