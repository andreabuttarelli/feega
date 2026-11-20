import { Launch } from './launch';
import { FEEGA_SERVER_HEADER } from './feega-server';

export enum Verdict {
  Silent = 'silent',
  FeegaServer = 'feega-server',
  OtherProject = 'other-project',
  Ours = 'ours'
}

const TIMEOUT_MS = 2000;
const HTTP_OK = 200;
const VITE_CLIENT = '/@vite/client';

type Probe = { status: number; headers: Headers };

const probe = (url: string): Promise<Probe | null> =>
  fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) }).then(
    (reply) => (reply.body?.cancel(), { status: reply.status, headers: reply.headers }),
    () => null
  );

type Proof = (origin: string, appRoot: string) => Promise<boolean>;

const viteServesProject: Proof = async (origin, appRoot) => {
  const client = await probe(`${origin}${VITE_CLIENT}`);
  if (client?.status !== HTTP_OK) {
    return true;
  }
  const file = `${origin}/@fs/${appRoot.replace(/\\/g, '/').replace(/^\//, '')}/package.json`;
  return (await probe(file))?.status === HTTP_OK;
};

const PROOF: Record<Launch, Proof> = {
  [Launch.Vite]: viteServesProject,
  [Launch.Next]: async () => true,
  [Launch.Script]: async () => true,
  [Launch.Command]: async () => true
};

export async function verdictOf(url: string, appRoot: string, launch: Launch): Promise<Verdict> {
  const answer = await probe(url);
  if (!answer) {
    return Verdict.Silent;
  }
  if (answer.headers.has(FEEGA_SERVER_HEADER)) {
    return Verdict.FeegaServer;
  }
  return (await PROOF[launch](new URL(url).origin, appRoot)) ? Verdict.Ours : Verdict.OtherProject;
}
