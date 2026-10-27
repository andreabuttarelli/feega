import { loadSession } from '../lib/auth.ts';
import { cloudApi, figmaTokenApi, type CloudProviderId } from '../lib/cloud.ts';

async function token(): Promise<string> {
  const session = await loadSession();
  if (!session) {
    console.error('Session expired or missing. Run: feega login');
    process.exit(1);
  }
  return session.access_token;
}

export async function cmdCloud(projectId: string) {
  const { providers } = await cloudApi.providers(await token(), projectId);
  for (const p of providers) {
    const state = !p.configured ? 'not set up on this server' : p.connected ? 'connected' : 'not connected';
    console.log(`${p.provider}  ${p.label}: ${state}`);
  }
}

export async function cmdCloudFiles(projectId: string, provider: CloudProviderId, opts: { folder?: string; cursor?: string }) {
  const { entries, next } = await cloudApi.files(await token(), projectId, provider, opts);
  for (const e of entries) {
    const note = e.importable ? '' : '  (not importable)';
    console.log(`${e.folder ? 'dir ' : 'file'}  ${e.id}  ${e.name}${note}`);
  }
  if (next) {
    console.log(`more: --cursor ${next}`);
  }
}

export async function cmdCloudImport(projectId: string, provider: CloudProviderId, fileId: string, opts: { canvas?: string; x?: string; y?: string }) {
  const place = opts.canvas ? { canvasId: opts.canvas, x: Number(opts.x ?? 0), y: Number(opts.y ?? 0) } : undefined;
  const { asset } = await cloudApi.importFile(await token(), projectId, provider, { fileId, place });
  console.log(`Imported as asset ${asset.id}`);
}

export async function cmdCloudExport(projectId: string, provider: CloudProviderId, assetId: string, opts: { folder?: string; name?: string }) {
  await cloudApi.exportAsset(await token(), projectId, provider, { assetId, folder: opts.folder ?? '', name: opts.name });
  console.log('Exported.');
}

export async function cmdCloudDisconnect(projectId: string, provider: CloudProviderId) {
  const { revoked } = await cloudApi.disconnect(await token(), projectId, provider);
  console.log(revoked ? 'Disconnected and revoked at the provider.' : 'Disconnected. The provider did not confirm the revoke; remove feega there too.');
}

export async function cmdFigmaToken(projectId: string) {
  const { connected } = await figmaTokenApi.status(await token(), projectId);
  console.log(connected ? 'A Figma token is saved.' : 'No Figma token. Add one in Settings, Profile.');
}
