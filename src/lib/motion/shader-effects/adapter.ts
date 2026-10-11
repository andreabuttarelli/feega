import type { ShaderNode } from './preset';

export type Definition = { name: string; fragment: unknown; props: Record<string, { default?: unknown }> };

export type Core = {
  initialize: (options: { canvas: HTMLCanvasElement; observeElement: boolean; forceFullFrameRate: boolean; gpu?: { device: unknown; adapter: unknown } }) => Promise<void>;
  registerNode: (id: string, fragment: unknown, parentId: string | null, metadata: unknown, uniforms: unknown, definition: Definition) => void;
  updateUniformValue: (id: string, key: string, value: unknown) => void;
  setFrameLocked: (locked: boolean) => void;
  renderSyntheticFrame: (deltaSeconds: number, options?: { waitForGpu?: boolean }) => Promise<void>;
  stopAnimation: () => void;
  startAnimation: () => void;
  beginRecordingResolution: (width: number, height: number, ratio: number) => () => void;
  getFailureReason: () => string | null;
  cleanup: () => void;
};

export type Library = {
  renderer: () => Core;
  definition: (type: string) => Definition | undefined;
  uniforms: (definition: Definition, values: Record<string, unknown>, id: string) => unknown;
  root: Definition;
};

export type Size = { width: number; height: number };

export type MountedShader = {
  seek: (time: number, props: Record<string, unknown>) => void;
  play: () => void;
  failure: () => string | null;
  destroy: () => void;
};

const ROOT = 'preset-root';
const PINNED_RATIO = 1;

function register(lib: Library, core: Core, node: ShaderNode, parentId: string, order: number) {
  const definition = lib.definition(node.type);
  if (!definition) {
    throw new Error(`shader effect ${node.type} is not in the library`);
  }

  const defaults = Object.fromEntries(Object.entries(definition.props).map(([key, prop]) => [key, prop.default]));
  const uniforms = lib.uniforms(definition, { ...defaults, ...node.props }, node.id);
  core.registerNode(node.id, definition.fragment, parentId, { blendMode: 'normal', renderOrder: order, id: node.id }, uniforms, definition);
  node.children.forEach((child, i) => register(lib, core, child, node.id, i));
}

export async function mountShader(lib: Library, canvas: HTMLCanvasElement, tree: ShaderNode, size: Size, gpu?: { device: unknown; adapter: unknown }): Promise<MountedShader> {
  const core = lib.renderer();
  await core.initialize({ canvas, observeElement: false, forceFullFrameRate: true, gpu });
  core.registerNode(ROOT, lib.root.fragment, null, null, {}, lib.root);
  register(lib, core, tree, ROOT, 0);
  core.stopAnimation();
  core.beginRecordingResolution(size.width, size.height, PINNED_RATIO);

  return {
    seek: (time, props) => {
      for (const [key, value] of Object.entries(props)) {
        core.updateUniformValue(tree.id, key, value);
      }
      core.setFrameLocked(false);
      core.setFrameLocked(true);
      void core.renderSyntheticFrame(time, { waitForGpu: false });
    },
    play: () => core.startAnimation(),
    failure: () => core.getFailureReason(),
    destroy: () => core.cleanup()
  };
}
