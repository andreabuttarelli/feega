import meshManifest from '@feega/plugin-mesh-gradient/manifest';
import MeshWorker from '@feega/plugin-mesh-gradient/worker?worker&inline';
import objectManifest from '@feega/plugin-object-3d/manifest';
import ObjectWorker from '@feega/plugin-object-3d/worker?worker&inline';
import type { WorkerLike } from './worker-sandbox';

export type BuiltIn = { manifest: unknown; worker: () => WorkerLike };

export const BUILT_IN: BuiltIn[] = [
  { manifest: meshManifest, worker: () => new MeshWorker() as unknown as WorkerLike },
  { manifest: objectManifest, worker: () => new ObjectWorker() as unknown as WorkerLike }
];
