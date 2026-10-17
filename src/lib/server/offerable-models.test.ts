import { beforeEach, describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

const { testEnv } = vi.hoisted(() => ({ testEnv: {} as Record<string, string | undefined> }));
vi.mock('$env/dynamic/private', () => ({ env: testEnv }));

beforeEach(() => {
  testEnv.WIRO_API_KEY = 'wiro-test-key';
  delete testEnv.KIE_API_KEY;
});
import { GPT_IMAGE_2_MODEL, NANO_BANANA_PRO_MODEL, QWEN3_PRO_MODEL } from '$lib/image-models';
import { SEEDANCE_25_MODEL, OPENROUTER_UPSCALE_MODEL, KLING_3_VIDEO_MODEL } from '$lib/video-models';
import { mediaModelSlot } from '$lib/media-model-slots';
import { offerableModels, offerableSlotChoices } from './offerable-models';

function fakeAdmin(
  rows: {
    id: string;
    catalogue: string;
    input_modalities: string[];
    output_modalities: string[];
    supported_parameters?: string[];
    supported_resolutions?: string[];
    param_schema?: Record<string, unknown>;
    pricing?: unknown;
  }[]
) {
  type Query = { eq: (col: string, value: string) => Query; order: () => Query; limit: () => Query; then: (resolve: (v: { data: unknown[]; error: null }) => unknown) => unknown };
  const query = (matching: typeof rows): Query => ({
    eq: (col, value) => query(matching.filter((r) => (r as Record<string, unknown>)[col] === undefined || (r as Record<string, unknown>)[col] === value)),
    order: () => query(matching),
    limit: () => query(matching),
    then: (resolve) => resolve({ data: matching, error: null })
  });
  const admin = {
    from: (table: string) => ({ select: () => query(table === 'ai_models' ? rows : []) })
  } as unknown as SupabaseClient;
  return admin;
}

describe('the 3D models a node can pick', () => {
  it('offers a reviewed model with its price per run and only the settings we curated', async () => {
    const admin = fakeAdmin([
      {
        id: 'wiro/microsoft/trellis-2',
        catalogue: 'model3d',
        input_modalities: ['image'],
        output_modalities: ['model3d'],
        provider: 'wiro',
        wire_spec: { owner: 'microsoft', project: 'trellis-2', fields: { images: ['inputImage'] } },
        param_schema: {
          pipeline_type: { type: 'enum', values: ['512', '1024_cascade', '1536_cascade'] },
          texture_size: { type: 'enum', values: ['1024', '2048'] }
        },
        pricing: { lines: [{ inputs: { pipeline_type: '512' }, usd: 0.25, method: 'cpr' }] }
      } as never
    ]);

    const [trellis] = (await offerableModels(admin, 'model3d')).choices;

    expect(trellis.pricedInputs).toEqual([{ inputs: { pipeline_type: '512' }, credits: expect.any(Number) }]);
    expect(trellis.params?.map((p) => [p.name, p.label])).toEqual([['pipeline_type', 'Resolution']]);
  });
});

describe('offerableModels — cosa un nodo può davvero scegliere', () => {
  it('un modello sincronizzato CON i nostri fatti di integrazione è offerto', async () => {
    const admin = fakeAdmin([
      { id: 'openai/gpt-image-2', catalogue: 'image', input_modalities: ['text', 'image'], output_modalities: ['image'] }
    ]);

    const out = await offerableModels(admin, 'image');

    expect(out.synced).toBe(true);
    expect(out.choices.map((c) => c.id)).toContain(GPT_IMAGE_2_MODEL);
  });

  it('a synced Wiro row is offered through its own provider choice, flag included', async () => {
    const admin = fakeAdmin([
      {
        id: 'wiro/wiro-partners/z-image-uncensored',
        catalogue: 'image',
        input_modalities: ['text'],
        output_modalities: ['image'],
        provider: 'wiro',
        uncensored: true,
        wire_spec: { owner: 'wiro-partners', project: 'z-image-uncensored', fields: { prompt: 'prompt', images: [] } },
        pricing: { lines: [{ inputs: {}, usd: 0.02, method: 'cpr' }] }
      } as never
    ]);

    const out = await offerableModels(admin, 'image');

    expect(out.choices).toContainEqual(
      expect.objectContaining({ id: 'wiro/wiro-partners/z-image-uncensored', providerLabel: 'Wiro', uncensored: true })
    );
  });

  it('offers a model only kie serves as its own choice, but never a kie row that is a cheaper route of another model', async () => {
    testEnv.KIE_API_KEY = 'kie-test-key';
    const admin = fakeAdmin([
      { id: 'kie/grok-imagine/text-to-video', catalogue: 'video', input_modalities: ['text'], output_modalities: ['video'], provider: 'kie', wire_spec: { model: 'grok-imagine/text-to-video', fields: { prompt: 'prompt', images: [] } } } as never,
      { id: 'kie/nano-banana-2', catalogue: 'video', input_modalities: ['text'], output_modalities: ['video'], provider: 'kie', wire_spec: { model: 'nano-banana-2', discountFor: 'nano-banana-2', fields: { prompt: 'prompt', images: [] } } } as never
    ]);

    const ids = (await offerableModels(admin, 'video')).choices.map((c) => c.id);

    expect(ids).toContain('kie/grok-imagine/text-to-video');
    expect(ids).not.toContain('kie/nano-banana-2');
  });

  it('hides a model whose published schema no node request can satisfy', async () => {
    const admin = fakeAdmin([
      {
        id: 'wiro/wiro/train-flux-lora',
        catalogue: 'image',
        input_modalities: ['text'],
        output_modalities: ['image'],
        provider: 'wiro',
        wire_spec: { owner: 'wiro', project: 'train-flux-lora', fields: { prompt: 'prompt', images: [] }, unrunnable: 'required_field_without_default' }
      } as never
    ]);

    const out = await offerableModels(admin, 'image');

    expect(out.choices.map((c) => c.id)).not.toContain('wiro/wiro/train-flux-lora');
  });

  it('hides a provider whose key is missing instead of offering a model that cannot run', async () => {
    delete testEnv.WIRO_API_KEY;
    const admin = fakeAdmin([
      {
        id: 'wiro/alibaba/qwen-image-3-0-pro',
        catalogue: 'image',
        input_modalities: ['text'],
        output_modalities: ['image'],
        provider: 'wiro',
        wire_spec: { owner: 'alibaba', project: 'qwen-image-3-0-pro', fields: { prompt: 'prompt', images: [] } }
      } as never
    ]);

    const out = await offerableModels(admin, 'image');

    expect(out.choices.map((c) => c.id)).not.toContain('wiro/alibaba/qwen-image-3-0-pro');
  });

  it('ogni immagine offerta porta un unitCredits — il prezzo che il bottone "Genera" mostra', async () => {
    const admin = fakeAdmin([
      {
        id: 'openai/gpt-image-2',
        catalogue: 'image',
        input_modalities: ['text', 'image'],
        output_modalities: ['image'],
        pricing: { endpoints: [{ provider: 'openai', lines: [{ billable: 'output_image', unit: 'image', cost_usd: 0.03 }] }] }
      }
    ]);

    const out = await offerableModels(admin, 'image');

    const choice = out.choices.find((c) => c.id === GPT_IMAGE_2_MODEL);
    expect(choice?.unitCredits).toBe(6);
  });

  it('un modello nuovo a prezzo fisso mostra la preview senza uno spec locale', async () => {
    const admin = fakeAdmin([
      {
        id: 'meta/muse-image',
        catalogue: 'image',
        input_modalities: ['text'],
        output_modalities: ['image'],
        pricing: { endpoints: [{ provider: 'meta', lines: [{ billable: 'output_image', unit: 'image', cost_usd: 0.035 }] }] }
      }
    ]);

    const out = await offerableModels(admin, 'image');

    expect(out.choices.find((choice) => choice.id === 'meta/muse-image')?.unitCredits).toBe(7);
  });

  it('più provider usano il prezzo minimo senza fissare il provider', async () => {
    const admin = fakeAdmin([
      {
        id: 'meta/muse-image',
        catalogue: 'image',
        input_modalities: ['text'],
        output_modalities: ['image'],
        pricing: {
          endpoints: [
            { provider: 'a', lines: [{ billable: 'output_image', unit: 'image', cost_usd: 0.03 }] },
            { provider: 'b', lines: [{ billable: 'output_image', unit: 'image', cost_usd: 0.05 }] }
          ]
        }
      }
    ]);

    const out = await offerableModels(admin, 'image');

    expect(out.choices.find((choice) => choice.id === 'meta/muse-image')?.unitCredits).toBe(6);
  });

  it('un prezzo a consumo è dichiarato variabile invece di sparire', async () => {
    const admin = fakeAdmin([
      {
        id: 'openai/gpt-image-2',
        catalogue: 'image',
        input_modalities: ['text'],
        output_modalities: ['image'],
        pricing: {
          endpoints: [{ provider: 'openai', lines: [{ billable: 'output_image', unit: 'token', cost_usd: 0.00003 }] }]
        }
      }
    ]);

    const out = await offerableModels(admin, 'image');
    const choice = out.choices.find((candidate) => candidate.id === 'gpt-image-2');

    expect(choice?.unitCredits).toBeUndefined();
    expect(choice?.variableCredits).toBe(true);
  });

  it('un provider variabile rende variabile anche un modello con un altro provider a prezzo fisso', async () => {
    const admin = fakeAdmin([
      {
        id: 'meta/muse-image',
        catalogue: 'image',
        input_modalities: ['text'],
        output_modalities: ['image'],
        pricing: {
          endpoints: [
            { provider: 'a', lines: [{ billable: 'output_image', unit: 'image', cost_usd: 0.03 }] },
            { provider: 'b', lines: [{ billable: 'output_image', unit: 'token', cost_usd: 0.00003 }] }
          ]
        }
      }
    ]);

    const choice = (await offerableModels(admin, 'image')).choices.find((candidate) => candidate.id === 'meta/muse-image');

    expect(choice?.unitCredits).toBeUndefined();
    expect(choice?.variableCredits).toBe(true);
  });

  it('un riferimento a pagamento rende il costo variabile', async () => {
    const admin = fakeAdmin([
      {
        id: 'meta/muse-image',
        catalogue: 'image',
        input_modalities: ['text', 'image'],
        output_modalities: ['image'],
        pricing: {
          endpoints: [{
            provider: 'a',
            lines: [
              { billable: 'output_image', unit: 'image', cost_usd: 0.03 },
              { billable: 'input_reference', unit: 'image', cost_usd: 0.01 }
            ]
          }]
        }
      }
    ]);

    const choice = (await offerableModels(admin, 'image')).choices.find((candidate) => candidate.id === 'meta/muse-image');

    expect(choice?.unitCredits).toBeUndefined();
    expect(choice?.variableCredits).toBe(true);
  });

  it('una variante 2k segue la risoluzione omonima anche se il catalogo non è ordinato', async () => {
    const admin = fakeAdmin([
      {
        id: 'bytedance-seed/seedream-5-0-pro',
        catalogue: 'image',
        input_modalities: ['text', 'image'],
        output_modalities: ['image'],
        supported_resolutions: ['2K', '1K'],
        pricing: {
          endpoints: [{
            provider: 'seed',
            lines: [
              { billable: 'output_image', unit: 'image', cost_usd: 0.045 },
              { billable: 'output_image', unit: 'image', cost_usd: 0.09, variant: '2k' }
            ]
          }]
        }
      }
    ]);

    const out = await offerableModels(admin, 'image');
    const choice = out.choices.find((candidate) => candidate.id === 'seedream-5-pro');

    expect(choice?.unitCredits).toBe(9);
    expect(choice?.creditOverrides).toEqual({ resolution: { '2K': 18 } });
  });

  it('una variante usa il provider meno caro senza fissarlo', async () => {
    const admin = fakeAdmin([
      {
        id: 'bytedance-seed/seedream-5-0-pro',
        catalogue: 'image',
        input_modalities: ['text', 'image'],
        output_modalities: ['image'],
        supported_resolutions: ['1K', '2K'],
        pricing: {
          endpoints: [
            {
              provider: 'a',
              lines: [
                { billable: 'output_image', unit: 'image', cost_usd: 0.04 },
                { billable: 'output_image', unit: 'image', cost_usd: 0.1, variant: '2k' }
              ]
            },
            {
              provider: 'b',
              lines: [
                { billable: 'output_image', unit: 'image', cost_usd: 0.03 },
                { billable: 'output_image', unit: 'image', cost_usd: 0.08, variant: '2k' }
              ]
            }
          ]
        }
      }
    ]);

    const choice = (await offerableModels(admin, 'image')).choices.find(
      (candidate) => candidate.id === 'seedream-5-pro'
    );

    expect(choice?.unitCredits).toBe(6);
    expect(choice?.creditOverrides).toEqual({ resolution: { '2K': 16 } });
  });

  it('il minimo per risoluzione considera solo provider che la supportano', async () => {
    const admin = fakeAdmin([
      {
        id: 'bytedance-seed/seedream-5-0-pro',
        catalogue: 'image',
        input_modalities: ['text'],
        output_modalities: ['image'],
        supported_resolutions: ['1K', '2K'],
        pricing: {
          endpoints: [
            {
              provider: 'cheap-1k',
              parameters: { resolution: { values: ['1K'] } },
              lines: [{ billable: 'output_image', unit: 'image', cost_usd: 0.03 }]
            },
            {
              provider: 'costly-2k',
              parameters: { resolution: { values: ['2K'] } },
              lines: [{ billable: 'output_image', unit: 'image', cost_usd: 0.08 }]
            }
          ]
        }
      }
    ]);

    const choice = (await offerableModels(admin, 'image')).choices.find(
      (candidate) => candidate.id === 'seedream-5-pro'
    );

    expect(choice?.creditOverrides).toEqual({ resolution: { '1K': 6, '2K': 16 } });
  });

  it('un modello sincronizzato SENZA una riga di integrazione nostra è offerto comunque, con la resa prudente', async () => {
    // Un id che l'API immagini pubblica ma che non abbiamo mai integrato (nessuno spec in
    // image-models.ts lo referenzia): l'app segue OpenRouter (CLAUDE.md), non lo scarta perché
    // non l'abbiamo scritto a mano — 1:1 soltanto e nessun prezzo finché non lo misuriamo.
    const admin = fakeAdmin([
      { id: 'meta/muse-image', catalogue: 'image', input_modalities: ['text'], output_modalities: ['image'] }
    ]);

    const out = await offerableModels(admin, 'image');

    const choice = out.choices.find((c) => c.id === 'meta/muse-image');
    expect(choice).toBeDefined();
    expect(choice?.aspectRatios).toEqual(['1:1']);
    expect(choice?.unitCredits).toBeUndefined();
  });

  it('ogni modello immagine offre esattamente le sue risoluzioni sincronizzate, non un gradino condiviso', async () => {
    // Misurato live contro /images/models il 2026-09-25: Seedream 5 Lite non fa 1K, Seedream 5
    // Pro non fa 4K, Nano Banana 2 fa anche 512 — tre liste diverse per tre modelli diversi.
    const admin = fakeAdmin([
      {
        id: 'bytedance-seed/seedream-5-0-lite',
        catalogue: 'image',
        input_modalities: ['text', 'image'],
        output_modalities: ['image'],
        supported_parameters: ['resolution', 'aspect_ratio', 'n', 'input_references', 'seed'],
        supported_resolutions: ['2K', '4K']
      },
      {
        id: 'bytedance-seed/seedream-5-0-pro',
        catalogue: 'image',
        input_modalities: ['text', 'image'],
        output_modalities: ['image'],
        supported_parameters: ['resolution', 'aspect_ratio', 'n', 'input_references', 'seed'],
        supported_resolutions: ['1K', '2K']
      },
      {
        id: 'google/gemini-3.1-flash-image',
        catalogue: 'image',
        input_modalities: ['text', 'image'],
        output_modalities: ['image', 'text'],
        supported_parameters: ['resolution', 'aspect_ratio', 'n', 'input_references'],
        supported_resolutions: ['512', '1K', '2K', '4K']
      }
    ]);

    const out = await offerableModels(admin, 'image');

    const lite = out.choices.find((c) => c.id === 'seedream-5-lite');
    const pro = out.choices.find((c) => c.id === 'seedream-5-pro');
    const nanoBanana2 = out.choices.find((c) => c.id === 'nano-banana-2');

    expect(lite?.resolutions).toEqual(['2K', '4K']);
    expect(lite?.resolutions).not.toContain('1K');
    expect(pro?.resolutions).toEqual(['1K', '2K']);
    expect(pro?.resolutions).not.toContain('4K');
    expect(nanoBanana2?.resolutions).toEqual(['512', '1K', '2K', '4K']);
  });

  it('un modello immagine SENZA risoluzioni sincronizzate non offre il selettore (i GPT Image, che usano "quality")', async () => {
    const admin = fakeAdmin([
      {
        id: 'openai/gpt-image-2',
        catalogue: 'image',
        input_modalities: ['text', 'image'],
        output_modalities: ['image'],
        supported_parameters: ['aspect_ratio', 'quality', 'n', 'input_references'],
        supported_resolutions: []
      }
    ]);

    const out = await offerableModels(admin, 'image');

    const choice = out.choices.find((c) => c.id === GPT_IMAGE_2_MODEL);
    expect(choice?.resolutions).toBeUndefined();
  });

  it('un fatto di integrazione nostro SENZA una riga sincronizzata non è offerto', async () => {
    // La tabella non ha ALCUNA riga per l'id sul quale GPT Image 2 è mappato: la regola del
    // prodotto vale anche quando il sync è dietro, non solo quando manca del tutto.
    const admin = fakeAdmin([
      { id: 'google/gemini-3-pro-image', catalogue: 'image', input_modalities: ['text', 'image'], output_modalities: ['image'] }
    ]);

    const out = await offerableModels(admin, 'image');

    expect(out.choices.map((c) => c.id)).not.toContain(GPT_IMAGE_2_MODEL);
    expect(out.choices.map((c) => c.id)).toContain(NANO_BANANA_PRO_MODEL);
  });

  it('una tabella vuota è uno stato leggibile, non un crash: synced false e zero scelte', async () => {
    const admin = fakeAdmin([]);

    const out = await offerableModels(admin, 'image');

    expect(out.synced).toBe(false);
    expect(out.choices).toEqual([]);
  });

  it('il video si risolve dal listino /videos/models, non da output_modalities su /models', async () => {
    const admin = fakeAdmin([
      {
        id: 'bytedance/seedance-2.5',
        catalogue: 'video',
        input_modalities: ['text', 'image', 'audio'],
        output_modalities: ['video']
      }
    ]);

    const out = await offerableModels(admin, 'video');

    expect(out.synced).toBe(true);
    expect(out.choices.map((c) => c.id)).toContain(SEEDANCE_25_MODEL);
  });

  it('un video sincronizzato ma senza integrazione nostra resta fuori — es. Qwen esiste solo come immagine', async () => {
    const admin = fakeAdmin([
      { id: 'qwen/qwen-image-3-pro', catalogue: 'video', input_modalities: ['text'], output_modalities: ['video'] }
    ]);

    const out = await offerableModels(admin, 'video');

    expect(out.choices.map((c) => c.id)).not.toContain(QWEN3_PRO_MODEL);
  });

  it('un modello video con integrazione ma senza riga sincronizzata resta fuori', async () => {
    const admin = fakeAdmin([]);

    const out = await offerableModels(admin, 'video');

    expect(out.choices.map((c) => c.id)).not.toContain(OPENROUTER_UPSCALE_MODEL);
  });

  it('ogni scelta porta le modalità di ingresso sincronizzate — la tela le usa per disegnare le porte', async () => {
    const admin = fakeAdmin([
      { id: 'openai/gpt-image-2', catalogue: 'image', input_modalities: ['text', 'image'], output_modalities: ['image'] }
    ]);

    const out = await offerableModels(admin, 'image');
    const choice = out.choices.find((c) => c.id === GPT_IMAGE_2_MODEL);

    expect(choice?.inputModalities).toEqual(['text', 'image']);
  });

  it('ogni scelta porta un id e un nome leggibile', async () => {
    const admin = fakeAdmin([
      { id: 'openai/gpt-image-2', catalogue: 'image', input_modalities: ['text', 'image'], output_modalities: ['image'] }
    ]);

    const out = await offerableModels(admin, 'image');

    for (const choice of out.choices) {
      expect(choice.id).toBeTruthy();
      expect(choice.label).toBeTruthy();
    }
  });
});

describe('offerableSlotChoices — i sei mestieri delle settings, filtrati sui modelli offribili', () => {
  it('uno slot immagine offre solo modelli sincronizzati', async () => {
    const admin = fakeAdmin([
      { id: 'openai/gpt-image-2', catalogue: 'image', input_modalities: ['text', 'image'], output_modalities: ['image'] }
    ]);

    const out = await offerableSlotChoices(admin, mediaModelSlot('imageModel')!);

    expect(out.synced).toBe(true);
    expect(out.choices.map((c) => c.id)).toEqual([GPT_IMAGE_2_MODEL]);
  });

  it('uno slot video offre solo modelli sincronizzati CHE fanno quel ruolo', async () => {
    // Kling fa 'motion'; Seedance 2.5 no — un modello sincronizzato ma del ruolo sbagliato resta
    // fuori dallo slot, anche se compare nel catalogo video generale.
    const admin = fakeAdmin([
      { id: 'bytedance/seedance-2.5', catalogue: 'video', input_modalities: ['text', 'image'], output_modalities: ['video'] },
      { id: 'kwaivgi/kling-v3.0-pro', catalogue: 'video', input_modalities: ['text', 'image'], output_modalities: ['video'] }
    ]);

    const out = await offerableSlotChoices(admin, mediaModelSlot('videoMotionModel')!);

    expect(out.choices.map((c) => c.id)).toEqual([KLING_3_VIDEO_MODEL]);
    expect(out.choices.map((c) => c.id)).not.toContain(SEEDANCE_25_MODEL);
  });
});

describe('offerableModels video — durata e risoluzione', () => {
  it('un video offerto porta ogni secondo dentro la finestra del proprio modello', async () => {
    const admin = fakeAdmin([
      { id: 'bytedance/seedance-2.5', catalogue: 'video', input_modalities: ['text', 'image'], output_modalities: ['video'] }
    ]);

    const out = await offerableModels(admin, 'video');

    const choice = out.choices.find((c) => c.id === SEEDANCE_25_MODEL);
    expect(choice?.durationOptions).toEqual(Array.from({ length: 27 }, (_, i) => i + 4));
  });

  it('un video offerto porta le SUE risoluzioni sincronizzate, non un elenco condiviso', async () => {
    const admin = fakeAdmin([
      {
        id: 'bytedance/seedance-2.5',
        catalogue: 'video',
        input_modalities: ['text', 'image'],
        output_modalities: ['video'],
        supported_resolutions: ['480p', '720p']
      }
    ]);

    const out = await offerableModels(admin, 'video');

    const choice = out.choices.find((c) => c.id === SEEDANCE_25_MODEL);
    expect(choice?.resolutions).toEqual(['480p', '720p']);
  });

  it('happyhorse non offre 480p: la riga sincronizzata dichiara solo 720p/1080p (regressione cb1de6e2)', async () => {
    const admin = fakeAdmin([
      {
        id: 'alibaba/happyhorse-1.0',
        catalogue: 'video',
        input_modalities: ['text', 'image'],
        output_modalities: ['video'],
        supported_resolutions: ['720p', '1080p']
      }
    ]);

    const out = await offerableModels(admin, 'video');

    const choice = out.choices.find((c) => c.id === 'alibaba/happyhorse-1.0');
    expect(choice?.resolutions).toEqual(['720p', '1080p']);
    expect(choice?.resolutions).not.toContain('480p');
  });

  it('un video senza spec offre le durate che la sua riga dichiara, non il pavimento di prodotto', async () => {
    const admin = fakeAdmin([
      {
        id: 'alibaba/wan-2.6',
        catalogue: 'video',
        input_modalities: ['text', 'image'],
        output_modalities: ['video'],
        supported_resolutions: ['720p', '1080p'],
        param_schema: { duration: { type: 'enum', values: ['5', '10'] } }
      }
    ]);

    const out = await offerableModels(admin, 'video');

    const choice = out.choices.find((c) => c.id === 'alibaba/wan-2.6');
    expect(choice?.durationOptions).toEqual([5, 10]);
    expect(choice?.minDuration).toBe(5);
    expect(choice?.maxDuration).toBe(10);
  });

  it('una riga sincronizzata senza supported_resolutions ripiega sul tetto misurato del trasporto', async () => {
    const admin = fakeAdmin([
      {
        id: 'bytedance/seedance-2.5',
        catalogue: 'video',
        input_modalities: ['text', 'image'],
        output_modalities: ['video'],
        supported_resolutions: []
      }
    ]);

    const out = await offerableModels(admin, 'video');

    const choice = out.choices.find((c) => c.id === SEEDANCE_25_MODEL);
    expect(choice?.resolutions).toEqual(['480p', '720p']);
  });
});

describe('offerableModels video — un id senza spec è offerto con la resa prudente', () => {
  it('non sparisce dal menu: 9:16 soltanto, nessun prezzo', async () => {
    const admin = fakeAdmin([
      { id: 'wan/wan-3.0', catalogue: 'video', input_modalities: ['text'], output_modalities: ['video'] }
    ]);

    const out = await offerableModels(admin, 'video');

    const choice = out.choices.find((c) => c.id === 'wan/wan-3.0');
    expect(choice).toBeDefined();
    expect(choice?.aspectRatios).toEqual(['9:16']);
    expect(choice?.unitCredits).toBeUndefined();
  });

  it('non entra in nessuno slot delle Settings: il ruolo che sa fare resta ignoto', async () => {
    const admin = fakeAdmin([
      { id: 'wan/wan-3.0', catalogue: 'video', input_modalities: ['text'], output_modalities: ['video'] }
    ]);

    const slot = mediaModelSlot('videoModel')!;
    const out = await offerableSlotChoices(admin, slot);

    expect(out.choices.map((c) => c.id)).not.toContain('wan/wan-3.0');
  });
});

describe('offerableModels — params dal param_schema sincronizzato', () => {
  it('un GPT Image con quality/background nello schema li porta come params, non aspect_ratio', async () => {
    const admin = fakeAdmin([
      {
        id: 'openai/gpt-image-2',
        catalogue: 'image',
        input_modalities: ['text', 'image'],
        output_modalities: ['image'],
        param_schema: {
          aspect_ratio: { type: 'enum', values: ['1:1', '16:9'] },
          quality: { type: 'enum', values: ['auto', 'low', 'medium', 'high'] }
        }
      }
    ]);

    const out = await offerableModels(admin, 'image');

    const choice = out.choices.find((c) => c.id === GPT_IMAGE_2_MODEL);
    expect(choice?.params).toEqual([
      { name: 'quality', label: 'Quality', kind: 'enum', values: ['auto', 'low', 'medium', 'high'] }
    ]);
  });

  it('un modello senza param_schema porta params vuoti', async () => {
    const admin = fakeAdmin([
      { id: 'openai/gpt-image-2', catalogue: 'image', input_modalities: ['text', 'image'], output_modalities: ['image'] }
    ]);

    const out = await offerableModels(admin, 'image');

    const choice = out.choices.find((c) => c.id === GPT_IMAGE_2_MODEL);
    expect(choice?.params).toEqual([]);
  });

  it('generate_audio non entra nei params: ha già il campo "audio" dedicato', async () => {
    const admin = fakeAdmin([
      {
        id: 'bytedance/seedance-2.5',
        catalogue: 'video',
        input_modalities: ['text'],
        output_modalities: ['video'],
        param_schema: { generate_audio: { type: 'boolean' }, seed: { type: 'boolean' } }
      }
    ]);

    const out = await offerableModels(admin, 'video');

    const choice = out.choices.find((c) => c.id === SEEDANCE_25_MODEL);
    expect(choice?.params).toEqual([{ name: 'seed', label: 'Seed', kind: 'boolean' }]);
  });
});
