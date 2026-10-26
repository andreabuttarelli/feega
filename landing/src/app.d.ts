declare module 'virtual:changelog-entries' {
  const entries: { date: string; title: string; items: string[] }[];
  export default entries;
}

declare module '*.html?raw' {
  const html: string;
  export default html;
}
