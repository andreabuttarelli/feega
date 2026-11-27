import brandManifest from '@feega/plugin-brand-logos/manifest';
import BrandWorker from '@feega/plugin-brand-logos/worker?worker&inline';
import gradientsManifest from '@feega/plugin-gradients/manifest';
import GradientsWorker from '@feega/plugin-gradients/worker?worker&inline';
import lucideManifest from '@feega/plugin-lucide/manifest';
import LucideWorker from '@feega/plugin-lucide/worker?worker&inline';
import meshManifest from '@feega/plugin-mesh-gradient/manifest';
import MeshWorker from '@feega/plugin-mesh-gradient/worker?worker&inline';
import objectManifest from '@feega/plugin-object-3d/manifest';
import ObjectWorker from '@feega/plugin-object-3d/worker?worker&inline';
import gradientManifest from '@feega/plugin-shadergradient/manifest';
import GradientWorker from '@feega/plugin-shadergradient/worker?worker&inline';
import type { WorkerLike } from './worker-sandbox';

export type BuiltIn = { manifest: unknown; worker: () => WorkerLike };

export const BUILT_IN: BuiltIn[] = [
  { manifest: meshManifest, worker: () => new MeshWorker() as unknown as WorkerLike },
  { manifest: objectManifest, worker: () => new ObjectWorker() as unknown as WorkerLike },
  { manifest: gradientManifest, worker: () => new GradientWorker() as unknown as WorkerLike },
  { manifest: lucideManifest, worker: () => new LucideWorker() as unknown as WorkerLike },
  { manifest: brandManifest, worker: () => new BrandWorker() as unknown as WorkerLike },
  { manifest: gradientsManifest, worker: () => new GradientsWorker() as unknown as WorkerLike }
];
