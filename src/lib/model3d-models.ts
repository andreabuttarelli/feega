import type { ModelParam } from '$lib/canvas/model-params';

export const MODEL3D_MIME = 'model/gltf-binary';

export const MODEL3D_MODELS = {
  trellis2: 'wiro/microsoft/trellis-2',
  hunyuan3d: 'wiro/tencent/hunyuan3d-2-1',
  pixal3d: 'wiro/tencentarc/pixal3d'
} as const;

export const DEFAULT_MODEL3D_MODEL = MODEL3D_MODELS.trellis2;

export const REVIEWED_MODEL3D_MODELS: ReadonlySet<string> = new Set(Object.values(MODEL3D_MODELS));

type Model3dSetting = { name: string; label: string; options: Readonly<Record<string, string>> };

const RESOLUTION_LABEL: Readonly<Record<string, string>> = { '512': '512', '1024_cascade': '1024', '1536_cascade': '1536' };

function resolution(values: readonly string[]): Model3dSetting {
  return { name: 'pipeline_type', label: 'Resolution', options: Object.fromEntries(values.map((v) => [v, RESOLUTION_LABEL[v]])) };
}

const MODEL3D_SETTINGS: Readonly<Record<string, readonly Model3dSetting[]>> = {
  [MODEL3D_MODELS.trellis2]: [resolution(['512', '1024_cascade', '1536_cascade'])],
  [MODEL3D_MODELS.pixal3d]: [resolution(['1024_cascade', '1536_cascade'])],
  [MODEL3D_MODELS.hunyuan3d]: [{ name: 'generate_texture', label: 'Textured', options: { true: 'On', false: 'Off' } }]
};

function settingsOf(modelId: string): readonly Model3dSetting[] {
  return MODEL3D_SETTINGS[modelId] ?? [];
}

export function model3dChoiceParams(modelId: string): ModelParam[] {
  return settingsOf(modelId).map((s) => ({
    name: s.name,
    label: s.label,
    kind: 'enum',
    values: Object.keys(s.options),
    optionLabels: s.options
  }));
}

export type Model3dParams = { ok: true; params: Record<string, string> } | { ok: false; error: string };

export function model3dParamsOf(modelId: string, saved: Record<string, unknown>): Model3dParams {
  const params: Record<string, string> = {};

  for (const setting of settingsOf(modelId)) {
    const values = Object.keys(setting.options);
    const value = saved[setting.name];
    if (value === undefined || value === null || value === '') {
      params[setting.name] = values[0];
      continue;
    }
    if (!values.includes(String(value))) {
      return { ok: false, error: `${setting.label} "${String(value)}" is not offered by this 3D model.` };
    }
    params[setting.name] = String(value);
  }

  return { ok: true, params };
}
