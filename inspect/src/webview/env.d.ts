declare module '*?worker&inline' {
  const Worker: new () => globalThis.Worker;
  export default Worker;
}

declare module '*?raw' {
  const text: string;
  export default text;
}
