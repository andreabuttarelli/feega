export const FEEGA_SERVER_HEADER = 'x-feega-server';

export enum FeegaServer {
  Editor = 'editor',
  Proxy = 'proxy',
  Launcher = 'launcher'
}

export const feegaHeaders = (kind: FeegaServer) => ({ [FEEGA_SERVER_HEADER]: kind });
