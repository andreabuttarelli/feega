import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { HOT_MODELS, hotDrag, hotTiles } from './hot-models';
import { IMAGE_MODEL_CHOICES } from '$lib/image-models';
import { VIDEO_MODEL_CHOICES, videoModelSpec } from '$lib/video-models';
import { MODEL3D_MODELS } from '$lib/model3d-models';
import { validateNodeData } from './node-data';
import type { ModelChoice } from './gen-node';

const WIRO_FIXTURE = JSON.parse(readFileSync('src/lib/server/wiro-catalogue.contract.fixture.json', 'utf8')) as { tool: { cleanslugowner: string; cleanslugproject?: string; cleanslug?: string }[] };
const WIRO_IDS = new Set(WIRO_FIXTURE.tool.map((t) => `wiro/${t.cleanslugowner}/${t.cleanslugproject ?? t.cleanslug}`));
const KNOWN = new Set<string>([...IMAGE_MODEL_CHOICES.map((m) => m.id), ...VIDEO_MODEL_CHOICES.map((m) => m.id), ...Object.values(MODEL3D_MODELS), ...WIRO_IDS]);

const choice = (id: string) => ({ id }) as ModelChoice;

describe('hot models', () => {
  it.each(HOT_MODELS)('$id exists in a real catalogue', ({ id }) => {
    expect(KNOWN.has(id) || videoModelSpec(id) !== undefined).toBe(true);
  });

  it('shows only the hot models the catalogue offers', () => {
    const offered = hotTiles((medium) => (medium === 'image' ? [choice('gpt-image-2')] : []));
    expect(offered.map((m) => m.id)).toEqual(['gpt-image-2']);
  });

  it('drags a node with the model already selected, valid for the server', () => {
    for (const hot of HOT_MODELS) {
      const drag = hotDrag(hot);
      expect(drag.data.model).toBe(hot.id);
      expect(validateNodeData(drag.type, drag.data).ok).toBe(true);
    }
  });
});
