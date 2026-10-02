export const MODEL3D_MIME = 'model/gltf-binary';

export const MODEL3D_MODELS = {
  trellis2: 'wiro/microsoft/trellis-2',
  hunyuan3d: 'wiro/tencent/hunyuan3d-2-1',
  pixal3d: 'wiro/tencentarc/pixal3d'
} as const;

export const DEFAULT_MODEL3D_MODEL = MODEL3D_MODELS.trellis2;

export const REVIEWED_MODEL3D_MODELS: ReadonlySet<string> = new Set(Object.values(MODEL3D_MODELS));
