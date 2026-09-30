import type { Db } from '$lib/server/db/client';
import type { GenMedium, GenParams } from '$lib/canvas/gen-node';
import { findAsset, insertAsset, type Asset } from '$lib/server/repos/assets';
import {
  AUDIO_JOB_PREFIX,
  claimRun,
  completeRun,
  createRun,
  expireRun,
  failRun,
  listNodeRuns,
  queuedAudioRuns,
  queuedVideoRuns,
  queuedWiroRuns,
  releaseClaim,
  retryClaim,
  runningRuns,
  setExternalJob,
  setRunPrompt,
  WIRO_JOB_PREFIX,
  type NodeRun
} from '$lib/server/repos/node-runs';
import { DataCheck, findNode, patchNodeData, writeNodeData } from '$lib/server/repos/canvas';
import type { Actor } from '$lib/server/repos/actor';
import { signMediaPaths } from './sign-media';
import { composePrompt } from '$lib/canvas/compose-prompt';
import { textRequest } from '$lib/canvas/text-request';
import { resolveNodeModel } from './node-model';
import { finishAudioJob, runAudio, type AudioScope } from './audio-run';
import { audioOperationOf, defaultAudioModel } from '$lib/canvas/audio-operations';
import type { UpstreamInputs } from '$lib/canvas/upstream-inputs';
import { WIRO_ID_PREFIX } from '$lib/server/wiro-catalogue';

/**
 * FAR GIRARE UN NODO DELLA TELA, SULLO SCHEMA NUOVO.
 *
 * Il giro è un `node_runs` con dentro il prompt e il modello COPIATI: il nodo cambia mentre si
 * guarda il risultato di ieri, e la storia deve raccontare con cosa è stato fatto davvero.
 * L'uscita atterra su `assets` — compreso il testo, che nel disegno di prima non aveva dove
 * depositarsi — e `output_asset_id` è il legame che sopravvive a una ricarica.
 *
 *   click  →  node_runs(running)  →  genera  →  assets  →  node_runs(done)
 *
 * Un clip non torna pronto: `external_job_id` resta sulla riga e il cron la riprende. Il claim
 * atomico è lì per quello — due tick sovrapposti pagherebbero due volte.
 */
const ONE_RENDER = 1;

export type StartRun = {
  orgId: string;
  projectId: string;
  canvasId: string;
  nodeId: string;
  userId: string;
  medium: GenMedium;
  prompt: string;
  model: string | null;
  params: GenParams;
  expectedVersion: number;
  /** Assente = il click di una persona. Un agente passa `kind: 'agent'` e la sua chiave. */
  actor?: Actor;
  /** Un'iterazione di loop (`loop.ts`): quale item di ogni `list` a monte questo giro vede,
   *  invece della lista intera — la stessa mappa che `upstreamInputsFor` accetta. Assente = un
   *  giro ordinario, ogni `list` a monte si comporta come un filo `fixed`. */
  iterateSelection?: Record<string, number>;
};

export type RunOutcome =
  | { kind: 'done'; run: NodeRun; asset: Asset }
  | { kind: 'queued'; run: NodeRun }
  | { kind: 'refused'; error: string }
  | { kind: 'conflict' };

async function depositText(db: Db, input: StartRun, text: string): Promise<Asset> {
  return insertAsset(db, {
    orgId: input.orgId,
    projectId: input.projectId,
    type: 'text',
    source: 'generated',
    content: text,
    mimeType: 'text/plain',
    sourceNodeId: input.nodeId
  });
}

async function depositImage(db: Db, input: StartRun, media: { storage_path?: string; mime: string | null; width: number | null; height: number | null; bytes?: number; ai_marked?: boolean }): Promise<Asset | null> {
  if (!media.storage_path) {
    return null;
  }

  return insertAsset(db, {
    orgId: input.orgId,
    projectId: input.projectId,
    type: 'image',
    source: 'generated',
    url: media.storage_path,
    mimeType: media.mime,
    width: media.width,
    height: media.height,
    bytes: media.bytes ?? null,
    sourceNodeId: input.nodeId,
    aiMarked: media.ai_marked
  });
}

async function depositVideo(
  db: Db,
  scope: { orgId: string; projectId: string; nodeId: string },
  media: { url: string; durationSeconds: number | null; aiMarked?: boolean }
): Promise<Asset> {
  return insertAsset(db, {
    orgId: scope.orgId,
    projectId: scope.projectId,
    type: 'video',
    source: 'generated',
    url: media.url,
    mimeType: 'video/mp4',
    durationS: media.durationSeconds,
    sourceNodeId: scope.nodeId,
    aiMarked: media.aiMarked
  });
}

/**
 * Il giro compiuto entra in storia e prende la vetrina.
 *
 * PRIMA LA STORIA, POI LA VETRINA: se la seconda scrittura fallisce resta un giro registrato che
 * il nodo non mostra — recuperabile. Il contrario perderebbe il legame fra il nodo e quel che ha
 * fatto, che è la cosa che nessuna ricerca a mano in una libreria ricostruisce.
 */
async function land(db: Db, input: StartRun, run: NodeRun, asset: Asset, costUsd?: number | null): Promise<RunOutcome> {
  await completeRun(db, { orgId: input.orgId, runId: run.id, assetId: asset.id, costUsd });

  const shown = await showRunState(db, input, { running: false, runId: run.id, refId: asset.id, error: null, outputUncensored: false });

  if (!shown) {
    return { kind: 'conflict' };
  }
  return { kind: 'done', run: { ...run, status: 'done', outputAssetId: asset.id }, asset };
}

async function showRunState(
  db: Db,
  input: { orgId: string; nodeId: string; actor?: Actor },
  patch: Record<string, unknown>
): Promise<boolean> {
  const written = await patchNodeData(db, {
    orgId: input.orgId,
    nodeId: input.nodeId,
    patch,
    check: DataCheck.None,
    actor: input.actor
  }).catch(() => null);
  return written?.outcome === 'written';
}

/**
 * IL PROMPT DAVVERO MANDATO AL FORNITORE, SOLO SU IMAGE/VIDEO E SOLO SE `params.enhancePrompt` È
 * ACCESO — mai sul testo, che non ha craft di prompting. `enhancePrompt` (`prompt-enhance.ts`)
 * verifica già da sé la propria riscrittura (soggetti persi, testo leggibile chiesto, aspect ratio
 * dichiarato) e non rifiuta mai: torna `changed:false` col motivo. Un rigetto della rete non deve
 * comunque fermare un giro che ha già pagato la lettura dell'upstream — l'originale resta buono.
 */
async function enhancedPromptFor(input: StartRun, prompt: string): Promise<string> {
  if (!input.params.enhancePrompt || !input.model) {
    return prompt;
  }
  if (input.medium !== 'image' && input.medium !== 'video') {
    return prompt;
  }

  const model = input.model;
  const { enhancePrompt } = await import('$lib/server/prompt-enhance');
  const { withOrgContext } = await import('$lib/server/ai-log');
  try {
    const out = await withOrgContext(input.orgId, () => enhancePrompt({ prompt, model }));
    return out.prompt || prompt;
  } catch {
    return prompt;
  }
}

async function giveUp(db: Db, input: StartRun, run: NodeRun, message: string): Promise<void> {
  await failRun(db, { orgId: input.orgId, runId: run.id, error: message }).catch(() => {});

  await showRunState(db, input, { running: false, runId: run.id, error: message });
}

const AUDIO_NOT_CONFIGURED = 'elevenlabs_not_configured';

function audioScopeOf(input: StartRun): AudioScope {
  return { orgId: input.orgId, projectId: input.projectId, nodeId: input.nodeId, userId: input.userId, actor: input.actor };
}

async function runAudioNode(db: Db, input: StartRun, run: NodeRun, upstream: UpstreamInputs, text: string): Promise<RunOutcome> {
  const { configuredAudioProvider } = await import('$lib/server/elevenlabs-config');
  const provider = configuredAudioProvider();
  if (!provider) {
    await giveUp(db, input, run, AUDIO_NOT_CONFIGURED);
    return { kind: 'refused', error: AUDIO_NOT_CONFIGURED };
  }

  try {
    const [audioUrls, videoUrls] = await Promise.all([
      signMediaPaths(db, upstream.referenceAudioUrls),
      signMediaPaths(db, upstream.referenceVideoUrls)
    ]);
    const out = await runAudio(db, provider, {
      scope: audioScopeOf(input),
      operation: audioOperationOf(input.params),
      model: input.model ?? defaultAudioModel(audioOperationOf(input.params)),
      params: input.params,
      text,
      audioUrls,
      videoUrls
    });

    if (out.kind === 'refused') {
      await giveUp(db, input, run, out.error);
      return out;
    }
    if (out.kind === 'job') {
      await setExternalJob(db, { orgId: input.orgId, runId: run.id, externalJobId: out.jobId });
      return { kind: 'queued', run: { ...run, externalJobId: out.jobId } };
    }
    return land(db, input, run, out.asset, out.costUsd);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'audio_failed';
    await giveUp(db, input, run, message);
    return { kind: 'refused', error: message };
  }
}

type ProviderRun = (db: Db, input: StartRun, run: NodeRun, upstream: UpstreamInputs, prompt: string) => Promise<RunOutcome>;

const WIRO_IMAGE_PATHS: Readonly<Record<string, (upstream: UpstreamInputs) => string[]>> = {
  image: (upstream) => upstream.referenceImageUrls,
  video: (upstream) => [...new Set([upstream.startFrameUrl, ...upstream.referenceImageUrls].filter((u): u is string => Boolean(u)))]
};

async function runWiroNode(db: Db, input: StartRun, run: NodeRun, upstream: UpstreamInputs, prompt: string): Promise<RunOutcome> {
  const [{ wiroRunDeps }, { startWiroRun }, { upstreamProvenance }, { projectModeOf }] = await Promise.all([
    import('$lib/server/wiro-config'),
    import('./wiro-run'),
    import('./likeness-guard'),
    import('$lib/server/uncensored-workspace/workspace-server')
  ]);
  const node = await findNode(db, { orgId: input.orgId, nodeId: input.nodeId }).catch(() => null);
  const [imageUrls, lastFrame, provenance] = await Promise.all([
    signMediaPaths(db, WIRO_IMAGE_PATHS[input.medium]?.(upstream) ?? []),
    signMediaPaths(db, upstream.endFrameUrl ? [upstream.endFrameUrl] : []),
    upstreamProvenance(db, { orgId: input.orgId, canvasId: input.canvasId, nodeId: input.nodeId, data: node?.data ?? {} })
  ]);

  const out = await startWiroRun(wiroRunDeps(db), {
    scope: audioScopeOf(input),
    mode: await projectModeOf(db, input),
    modelId: input.model ?? '',
    prompt,
    params: input.params,
    imageUrls,
    lastFrameUrl: lastFrame[0] ?? null,
    provenance
  });
  if (out.kind === 'refused') {
    await giveUp(db, input, run, out.error);
    return out;
  }
  await setExternalJob(db, { orgId: input.orgId, runId: run.id, externalJobId: out.jobId });
  return { kind: 'queued', run: { ...run, externalJobId: out.jobId } };
}

const GENERATION_PROVIDERS: ReadonlyArray<{ prefix: string; run: ProviderRun }> = [{ prefix: WIRO_ID_PREFIX, run: runWiroNode }];

function providerRunOf(medium: GenMedium, model: string | null): ProviderRun | null {
  if (medium === 'text' || !model) {
    return null;
  }
  return GENERATION_PROVIDERS.find((p) => model.startsWith(p.prefix))?.run ?? null;
}

async function screenStandardRun(db: Db, input: StartRun, texts: Array<string | null | undefined>) {
  const { screenModelInput } = await import('$lib/server/moderation/model-input');
  const { ModerationProfile } = await import('$lib/server/moderation/profiles');
  return screenModelInput(db, {
    profile: ModerationProfile.Standard,
    texts,
    scope: { orgId: input.orgId, userId: input.userId, projectId: input.projectId, nodeId: input.nodeId, model: input.model, actor: input.actor }
  });
}

export async function runGenNode(db: Db, requested: StartRun): Promise<RunOutcome> {
  const pick = await resolveNodeModel(requested.medium, requested.model, requested.params);
  if (!pick.ok) {
    return { kind: 'refused', error: pick.error };
  }
  const input: StartRun = { ...requested, model: pick.model };

  const { generationRefusal } = await import('$lib/server/uncensored-workspace/workspace-server');
  const refusal = await generationRefusal(db, { orgId: input.orgId, projectId: input.projectId, userId: input.userId, model: input.model });
  if (refusal) {
    return { kind: 'refused', error: refusal };
  }

  const run = await createRun(db, {
    orgId: input.orgId,
    nodeId: input.nodeId,
    prompt: input.prompt,
    model: input.model,
    params: input.params,
    actorKind: input.actor?.kind ?? 'user',
    actorId: input.actor?.id ?? input.userId
  });

  const priorNode = await findNode(db, { orgId: input.orgId, nodeId: input.nodeId });

  // `...priorNode.data` prima delle chiavi nuove: senza, il `refId` di un giro riuscito prima
  // sparisce nell'istante in cui `running` si accende, e se il giro nuovo fallisce non c'è più un
  // `prior` che lo riporti indietro — l'immagine buona è persa per un giro che non ha prodotto
  // niente.
  const marked = await writeNodeData(db, {
    orgId: input.orgId,
    nodeId: input.nodeId,
    expectedVersion: input.expectedVersion,
    actor: input.actor,
    data: {
      ...priorNode?.data,
      prompt: input.prompt,
      model: input.model,
      params: input.params,
      running: true,
      runId: run.id
    }
  });
  if (marked.outcome === 'conflict') {
    await failRun(db, { orgId: input.orgId, runId: run.id, error: 'conflict' }).catch(() => {});
    return { kind: 'conflict' };
  }

  // QUEL CHE LA TELA COLLEGA, DENTRO QUEL CHE SI MANDA AL MODELLO. Una lettura sola, prima dei tre
  // rami: `upstream-inputs.ts` è pura logica testata da sé (`upstream-inputs.test.ts`), e questa è
  // l'unica riga che la fa parlare col database di questo giro — vedi `upstream.ts`.
  const { upstreamInputsFor } = await import('$lib/server/canvas/upstream');
  const upstream = await upstreamInputsFor(db, {
    orgId: input.orgId,
    canvasId: input.canvasId,
    nodeId: input.nodeId,
    model: input.model,
    medium: input.medium,
    iterateSelection: input.iterateSelection
  });

  // UN MODELLO SPARITO DA `ai_models` FERMA IL GIRO PRIMA DI SPENDERE — mai dopo aver chiesto al
  // provider, che lo scoprirebbe comunque pagando la latenza. `giveUp` è la chiusura giusta: il
  // `refId` del giro precedente resta, solo `running`/`error` cambiano — il nodo mostra l'alert,
  // non perde il suo ultimo risultato.
  if (upstream.blocked) {
    await giveUp(db, input, run, upstream.blocked);
    return { kind: 'refused', error: upstream.blocked };
  }

  const textInput = input.medium === 'text' ? textRequest(upstream.text, input.prompt) : null;
  const prompt = textInput?.user ?? composePrompt(input.medium, upstream.text, input.prompt);
  const providerRun = providerRunOf(input.medium, input.model);

  if (!providerRun) {
    const screened = await screenStandardRun(db, input, [prompt, textInput?.system]);
    if (!screened.ok) {
      await giveUp(db, input, run, screened.error);
      return { kind: 'refused', error: screened.error };
    }
  }

  if (input.medium === 'audio') {
    return runAudioNode(db, input, run, upstream, prompt);
  }

  // NÉ IL PROPRIO PROMPT NÉ UN TESTO A MONTE: solo ORA si sa che non c'è niente da mandare al
  // modello — prima di questa riga `upstream.text` non era ancora stato letto. Il messaggio è
  // lo stesso che il client mostra (`gen-history.ts::BLOCKED`, "Scrivi cosa vuoi"), la stessa
  // regola in un posto solo, non due verità che possono divergere.
  if (!prompt.trim()) {
    await giveUp(db, input, run, 'prompt_required');
    return { kind: 'refused', error: 'prompt_required' };
  }

  const sentPrompt = await enhancedPromptFor(input, prompt);
  if (sentPrompt !== prompt) {
    await setRunPrompt(db, { orgId: input.orgId, runId: run.id, prompt: sentPrompt });
  }

  if (providerRun) {
    return providerRun(db, input, run, upstream, sentPrompt);
  }

  try {
    if (input.medium === 'text') {
      const { llmText } = await import('$lib/server/llm');
      const { withOrgContext, billedUsdInScope } = await import('$lib/server/ai-log');
      const [imageUrls, videoUrls, audioUrls] = await Promise.all([
        signMediaPaths(db, upstream.referenceImageUrls),
        signMediaPaths(db, upstream.referenceVideoUrls),
        signMediaPaths(db, upstream.referenceAudioUrls)
      ]);
      const { text, costUsd } = await withOrgContext(input.orgId, async () => {
        const result = await llmText({
          prompt,
          system: textInput?.system || undefined,
          model: input.model ?? undefined,
          label: 'canvas.text',
          upstream: { imageUrls, videoUrls, audioUrls }
        });
        return { text: result.text, costUsd: billedUsdInScope() ?? null };
      });
      const asset = await depositText(db, input, text);
      return land(db, input, run, asset, costUsd);
    }

    if (input.medium === 'image') {
      const { generateImagesWithoutBrand } = await import('$lib/server/media-generate');
      const { offerableModels } = await import('$lib/server/offerable-models');
      const { extraParamsOf } = await import('$lib/canvas/model-params');
      const declared = input.model
        ? (await offerableModels(db, 'image')).choices.find((c) => c.id === input.model)?.params ?? []
        : [];
      const out = await generateImagesWithoutBrand(db as never, {
        orgId: input.orgId,
        userId: input.userId,
        prompt: sentPrompt,
        model: input.model ?? undefined,
        count: ONE_RENDER,
        aspectRatio: input.params.aspectRatio as never,
        resolution: input.params.resolution,
        // Un solo riferimento: `ImageJob.baseMediaId` è un campo, non una lista — anche quando il
        // modello ne accetterebbe di più (`upstream.referenceImageUrls`, dal catalogo in
        // `graph.ts`). Il tetto vero sta lì; qui si spedisce solo quel che il trasporto sa portare.
        baseMediaId: upstream.referenceImageUrl ?? undefined,
        referenceImageUrls: await signMediaPaths(db, upstream.pickedImageUrls),
        params: extraParamsOf(input.params as unknown as Record<string, unknown>, declared)
      });
      if (!out.ok) {
        const message = 'reason' in out && out.reason ? `${out.error}: ${out.reason}` : out.error;
        await giveUp(db, input, run, message);
        return { kind: 'refused', error: message };
      }

      const generated = out.media[0];
      const asset = generated ? await depositImage(db, input, generated) : null;
      if (!asset) {
        const message = generated?.storage_path === undefined
          ? 'store_failed: the render carried no storage path to deposit'
          : 'store_failed';
        await giveUp(db, input, run, message);
        return { kind: 'refused', error: message };
      }
      return land(db, input, run, asset, out.costUsd);
    }

    const { generateVideoWithoutBrand } = await import('$lib/server/media-generate');
    const { offerableModels } = await import('$lib/server/offerable-models');
    const { extraParamsOf } = await import('$lib/canvas/model-params');
    const [referenceImageUrls, referenceVideoUrls, referenceAudioUrls, lastFrame, videoDeclared] = await Promise.all([
      signMediaPaths(db, upstream.referenceImageUrls),
      signMediaPaths(db, upstream.referenceVideoUrls),
      signMediaPaths(db, upstream.referenceAudioUrls),
      signMediaPaths(db, upstream.endFrameUrl ? [upstream.endFrameUrl] : []),
      input.model
        ? offerableModels(db, 'video').then((m) => m.choices.find((c) => c.id === input.model)?.params ?? [])
        : Promise.resolve([])
    ]);
    const out = await generateVideoWithoutBrand({
      orgId: input.orgId,
      userId: input.userId,
      prompt: sentPrompt,
      model: input.model ?? undefined,
      aspectRatio: input.params.aspectRatio as never,
      durationSeconds: input.params.duration,
      resolution: input.params.resolution,
      baseMediaId: upstream.startFrameUrl ?? undefined,
      lastFrameUrl: lastFrame[0],
      // `audio` è il campo che il toolbar scrive (ModelChoice.generateAudio, il suo controllo
      // dedicato — mai in `modelParamsOf`, v. l'esclusione in `model-params.ts`): il nome sul
      // filo che OpenRouter dichiara è `generate_audio`, non lo stesso token.
      params: {
        ...extraParamsOf(input.params as unknown as Record<string, unknown>, videoDeclared),
        ...(typeof input.params.audio === 'boolean' ? { generate_audio: input.params.audio } : {})
      },
      referenceImageUrls,
      referenceVideoUrls,
      referenceAudioUrls
    });
    if (!out.ok) {
      await giveUp(db, input, run, out.error);
      return { kind: 'refused', error: out.error };
    }

    await setExternalJob(db, { orgId: input.orgId, runId: run.id, externalJobId: out.jobId });
    return { kind: 'queued', run: { ...run, externalJobId: out.jobId } };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'render_failed';
    await giveUp(db, input, run, message);
    return { kind: 'refused', error: message };
  }
}

/**
 * RIPORTARE UN VIDEO IN CODA A `done`/`failed`: L'UNICA COSA CHE `runGenNode` NON FA DA SOLA.
 *
 * `runGenNode` per un video torna `queued` e ferma lì — il rendering vive dal fornitore, minuti
 * dopo la richiesta HTTP che l'ha chiesto. `submitAndTrackVideoRender` (dentro
 * `generateVideoWithoutBrand`) ha già scritto la STESSA sottomissione due volte: su `node_runs`
 * (qui, come `external_job_id`) e su `video_renders` (`task_id`, con tutto quel che serve a
 * finirla — risoluzione, opzioni di montaggio, quando è partita). Questa funzione non inventa un
 * secondo trasporto: legge quella riga per il task id e riusa `finishVideoRender`, lo stesso
 * motore che il riconciliatore dei brand usa già per `video_renders`.
 *
 *   node_runs(running, external_job_id) ──┐
 *                                          ├─→ video_renders(task_id) ──→ finishVideoRender
 *   depositVideo → assets ←────────────────┘                                    │
 *          │                                                          pending/done/failed
 *          └───────────────── showRunState / giveUp ←────────────────┘
 *
 * IL CLAIM (`claimRun` → `finishing`) VIENE PRIMA DI TUTTO — stesso motivo di `video-render-queue.ts`:
 * due tick sovrapposti non devono scaricare e fatturare la stessa clip due volte. Un «non è ancora
 * pronta» rilascia il claim SENZA toccare `attempts` — quasi ogni claim è proprio questo, e
 * contarlo trasformerebbe il tetto dei tentativi in una scadenza di pochi minuti, esattamente
 * l'errore che il commento in cima a `video-render-queue.ts` documenta già.
 */
const VIDEO_RECONCILE_LIMIT = 20;
const VIDEO_RUN_MAX_ATTEMPTS = 8;

type VideoRenderLookup = {
  id: string;
  task_id: string;
  model: string;
  prompt: string | null;
  duration_seconds: number | null;
  resolution: string | null;
  cover_url: string | null;
  persist_opts: unknown;
  submitted_at: string;
};

/**
 * `video_renders` non è nello schema tipizzato di `Db` — vive nella parte del database che
 * `finishVideoRender` interroga già passando un `SupabaseClient` non ristretto. Stesso confine
 * qui: il cast dichiara che questa singola query esce dal narrowing, non lo aggira altrove.
 */
async function findVideoRenderRow(db: Db, renderId: string): Promise<VideoRenderLookup | null> {
  const { data, error } = await (db as unknown as { from(table: string): any })
    .from('video_renders')
    .select('id, task_id, model, prompt, duration_seconds, resolution, cover_url, persist_opts, submitted_at')
    .eq('id', renderId)
    .maybeSingle();

  if (error) {
    throw error;
  }
  return (data as VideoRenderLookup | null) ?? null;
}

/**
 * `video_renders` ha il SUO riconciliatore (`reconcileVideoRenders`, `videos/render/work`), che
 * ogni minuto reclama e finisce la stessa riga per conto proprio. Il claim su `node_runs` protegge
 * SOLO da un secondo tick di QUESTO riconciliatore — non da quell'altro processo, che non tocca
 * `node_runs` per niente. Senza reclamare anche `video_renders` qui, i due tick possono chiamare
 * `finishVideoRender` sullo stesso job in parallelo: due righe `ai_calls`, due addebiti (pagato il
 * 25/09/2026, vedi LESSONS.md).
 *
 * `rendering → finishing`, stessa transizione e stesso significato di `video-render-queue.ts`:
 * zero righe aggiornate vuol dire che l'altro riconciliatore l'ha già presa, non un errore.
 */
async function claimVideoRenderRow(db: Db, renderId: string): Promise<boolean> {
  const { data, error } = await (db as unknown as { from(table: string): any })
    .from('video_renders')
    .update({ status: 'finishing', claimed_at: new Date().toISOString() })
    .eq('id', renderId)
    .eq('status', 'rendering')
    .select('id')
    .maybeSingle();

  if (error) {
    throw error;
  }
  return !!data;
}

/** Reso a `rendering`: il prossimo tick, di uno dei due riconciliatori, può riprovare. */
async function releaseVideoRenderClaim(db: Db, renderId: string): Promise<void> {
  await (db as unknown as { from(table: string): any })
    .from('video_renders')
    .update({ status: 'rendering', claimed_at: null })
    .eq('id', renderId)
    .eq('status', 'finishing')
    .then(undefined, () => {});
}

function toStartRunShape(run: NodeRun): StartRun {
  return {
    orgId: run.orgId,
    projectId: '',
    canvasId: '',
    nodeId: run.nodeId,
    userId: run.actorId ?? '',
    medium: 'video',
    prompt: run.prompt ?? '',
    model: run.model,
    params: (run.params ?? {}) as GenParams
  } as StartRun;
}

export type VideoReconcileOutcome = { checked: number; done: number; failed: number; pending: number };

export async function reconcileVideoNodeRuns(db: Db): Promise<VideoReconcileOutcome> {
  const { rowToSubmitted } = await import('$lib/server/video-render-queue');
  const { finishVideoRender } = await import('$lib/server/video');
  const { withOrgContext, billedUsdInScope } = await import('$lib/server/ai-log');

  const queued = await queuedVideoRuns(db, { limit: VIDEO_RECONCILE_LIMIT });

  let checked = 0;
  let done = 0;
  let failed = 0;
  let pending = 0;

  for (const run of queued) {
    if (!run.externalJobId) continue;

    const claimed = await claimRun(db, { orgId: run.orgId, runId: run.id });
    if (!claimed) continue;
    checked += 1;

    const node = await findNode(db, { orgId: run.orgId, nodeId: run.nodeId }).catch(() => null);
    if (!node) {
      // Il nodo non c'è più: chiudere comunque il giro, non c'è dato nessuno da svegliare.
      await failRun(db, { orgId: run.orgId, runId: run.id, error: 'node_deleted' }).catch(() => {});
      failed += 1;
      continue;
    }

    const startRunShape: StartRun = { ...toStartRunShape(run), projectId: node.projectId, canvasId: node.canvasId };
    let claimedRenderId: string | null = null;

    try {
      const row = await findVideoRenderRow(db, run.externalJobId);
      if (!row) {
        await giveUp(db, startRunShape, { ...run, status: 'finishing' }, 'video_render_row_missing');
        failed += 1;
        continue;
      }

      // Reclamare la riga `video_renders` PRIMA di chiamare `finishVideoRender`: senza, l'altro
      // riconciliatore (`videos/render/work`) può finire lo stesso job nello stesso istante, e
      // ognuno addebita la sua riga `ai_calls`. Zero righe aggiornate = l'altro l'ha già presa:
      // si rilascia il claim su `node_runs` e si riprova al prossimo tick, come un `pending`.
      const claimedRender = await claimVideoRenderRow(db, row.id);
      if (!claimedRender) {
        await releaseClaim(db, { orgId: run.orgId, runId: run.id });
        pending += 1;
        continue;
      }
      claimedRenderId = row.id;

      const submitted = rowToSubmitted({
        id: row.id,
        brand_id: null,
        org_id: run.orgId,
        user_id: startRunShape.userId,
        post_id: null,
        thread_id: null,
        task_id: row.task_id,
        model: row.model,
        status: 'rendering',
        duration_seconds: row.duration_seconds,
        resolution: row.resolution,
        cover_url: row.cover_url,
        prompt: row.prompt,
        persist_opts: row.persist_opts as never,
        submitted_at: row.submitted_at,
        attempts: run.attempts,
        error: null
      });

      const outcome = await withOrgContext(run.orgId, () =>
        finishVideoRender(db as never, startRunShape.userId, submitted)
      );

      if (outcome.status === 'pending') {
        await releaseVideoRenderClaim(db, row.id);
        await releaseClaim(db, { orgId: run.orgId, runId: run.id });
        pending += 1;
        continue;
      }

      if (outcome.status === 'failed') {
        const exhausted = !outcome.retryable || run.attempts + 1 >= VIDEO_RUN_MAX_ATTEMPTS;
        if (!exhausted) {
          await releaseVideoRenderClaim(db, row.id);
          await retryClaim(db, { orgId: run.orgId, runId: run.id, attempts: run.attempts + 1, error: outcome.error });
          pending += 1;
          continue;
        }
        await giveUp(db, startRunShape, { ...run, status: 'finishing' }, outcome.error);
        failed += 1;
        continue;
      }

      const costUsd = billedUsdInScope() ?? null;
      const asset = await depositVideo(
        db,
        { orgId: run.orgId, projectId: node.projectId, nodeId: run.nodeId },
        { url: outcome.url, durationSeconds: outcome.durationSeconds, aiMarked: outcome.aiMarked }
      );
      await completeRun(db, { orgId: run.orgId, runId: run.id, assetId: asset.id, costUsd });
      await showRunState(db, startRunShape, { running: false, runId: run.id, refId: asset.id, error: null, outputUncensored: false });
      done += 1;
    } catch (error) {
      if (claimedRenderId) {
        await releaseVideoRenderClaim(db, claimedRenderId).catch(() => {});
      }
      const message = error instanceof Error ? error.message : 'video_reconcile_failed';
      const exhausted = run.attempts + 1 >= VIDEO_RUN_MAX_ATTEMPTS;
      if (!exhausted) {
        await retryClaim(db, { orgId: run.orgId, runId: run.id, attempts: run.attempts + 1, error: message }).catch(() => {});
        pending += 1;
        continue;
      }
      await giveUp(db, startRunShape, { ...run, status: 'finishing' }, message);
      failed += 1;
    }
  }

  return { checked, done, failed, pending };
}

const AUDIO_RECONCILE_LIMIT = 20;
const AUDIO_RUN_MAX_ATTEMPTS = 8;

export async function reconcileAudioNodeRuns(db: Db): Promise<VideoReconcileOutcome> {
  const outcome: VideoReconcileOutcome = { checked: 0, done: 0, failed: 0, pending: 0 };
  const { configuredAudioProvider } = await import('$lib/server/elevenlabs-config');
  const provider = configuredAudioProvider();
  if (!provider) {
    return outcome;
  }

  for (const run of await queuedAudioRuns(db, { limit: AUDIO_RECONCILE_LIMIT })) {
    const claimed = await claimRun(db, { orgId: run.orgId, runId: run.id });
    if (!claimed || !run.externalJobId) {
      continue;
    }
    outcome.checked += 1;

    const node = await findNode(db, { orgId: run.orgId, nodeId: run.nodeId }).catch(() => null);
    if (!node) {
      await failRun(db, { orgId: run.orgId, runId: run.id, error: 'node_deleted' }).catch(() => {});
      outcome.failed += 1;
      continue;
    }

    const shape: StartRun = { ...toStartRunShape(run), medium: 'audio', projectId: node.projectId, canvasId: node.canvasId };
    const finishing: NodeRun = { ...run, status: 'finishing' };
    try {
      const progress = await finishAudioJob(db, provider, {
        externalJobId: run.externalJobId,
        model: run.model ?? defaultAudioModel('dubbing'),
        scope: audioScopeOf(shape)
      });

      if (progress.state === 'pending') {
        await releaseClaim(db, { orgId: run.orgId, runId: run.id });
        outcome.pending += 1;
        continue;
      }
      if (progress.state === 'failed') {
        await giveUp(db, shape, finishing, progress.error);
        outcome.failed += 1;
        continue;
      }

      await completeRun(db, { orgId: run.orgId, runId: run.id, assetId: progress.asset.id, costUsd: progress.costUsd });
      await showRunState(db, shape, { running: false, runId: run.id, refId: progress.asset.id, error: null, outputUncensored: false });
      outcome.done += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'audio_reconcile_failed';
      if (run.attempts + 1 < AUDIO_RUN_MAX_ATTEMPTS) {
        await retryClaim(db, { orgId: run.orgId, runId: run.id, attempts: run.attempts + 1, error: message }).catch(() => {});
        outcome.pending += 1;
        continue;
      }
      await giveUp(db, shape, finishing, message);
      outcome.failed += 1;
    }
  }

  return outcome;
}

const WIRO_RECONCILE_LIMIT = 20;
const WIRO_RUN_MAX_ATTEMPTS = 8;

export async function reconcileWiroNodeRuns(db: Db): Promise<VideoReconcileOutcome> {
  const outcome: VideoReconcileOutcome = { checked: 0, done: 0, failed: 0, pending: 0 };
  const [{ wiroRunDeps }, { finishWiroJob }, { projectModeOf }] = await Promise.all([
    import('$lib/server/wiro-config'),
    import('./wiro-run'),
    import('$lib/server/uncensored-workspace/workspace-server')
  ]);
  const deps = wiroRunDeps(db);

  for (const run of await queuedWiroRuns(db, { limit: WIRO_RECONCILE_LIMIT })) {
    const claimed = await claimRun(db, { orgId: run.orgId, runId: run.id });
    if (!claimed || !run.externalJobId) {
      continue;
    }
    outcome.checked += 1;

    const node = await findNode(db, { orgId: run.orgId, nodeId: run.nodeId }).catch(() => null);
    if (!node) {
      await failRun(db, { orgId: run.orgId, runId: run.id, error: 'node_deleted' }).catch(() => {});
      outcome.failed += 1;
      continue;
    }

    const shape: StartRun = { ...toStartRunShape(run), medium: node.type as GenMedium, projectId: node.projectId, canvasId: node.canvasId };
    const finishing: NodeRun = { ...run, status: 'finishing' };
    try {
      const mode = await projectModeOf(db, shape);
      const progress = await finishWiroJob(db, deps, { externalJobId: run.externalJobId, modelId: run.model ?? '', scope: audioScopeOf(shape), mode });

      if (progress.state === 'pending') {
        await releaseClaim(db, { orgId: run.orgId, runId: run.id });
        outcome.pending += 1;
        continue;
      }
      if (progress.state === 'failed') {
        await giveUp(db, shape, finishing, progress.error);
        outcome.failed += 1;
        continue;
      }

      await completeRun(db, { orgId: run.orgId, runId: run.id, assetId: progress.asset.id, costUsd: progress.costUsd });
      await showRunState(db, shape, { running: false, runId: run.id, refId: progress.asset.id, error: null, outputUncensored: progress.uncensored });
      outcome.done += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'wiro_reconcile_failed';
      if (run.attempts + 1 < WIRO_RUN_MAX_ATTEMPTS) {
        await retryClaim(db, { orgId: run.orgId, runId: run.id, attempts: run.attempts + 1, error: message }).catch(() => {});
        outcome.pending += 1;
        continue;
      }
      await giveUp(db, shape, finishing, message);
      outcome.failed += 1;
    }
  }

  return outcome;
}

export type RunWithText = NodeRun & { text: string | null };

/**
 * La storia di un nodo, dal più vecchio: la striscia sotto il risultato.
 *
 * Il testo generato viaggia CON il giro — un'immagine non ha nulla da portare, un sì. Senza,
 * il riquadro di un testo mostrerebbe un'icona e basta.
 */
export async function runsOf(db: Db, scope: { orgId: string; nodeId: string }): Promise<RunWithText[]> {
  const runs = await listNodeRuns(db, scope);
  return Promise.all(runs.map(async (run) => ({ ...run, text: await outputText(db, scope.orgId, run.outputAssetId) })));
}

async function outputText(db: Db, orgId: string, assetId: string | null): Promise<string | null> {
  if (!assetId) {
    return null;
  }
  const asset = await findAsset(db, { orgId, assetId });
  return asset?.content ?? null;
}

export { claimRun, completeRun, failRun };

/**
 * QUANTO PUÒ RESTARE `running` UN GIRO PRIMA CHE SIA UN GIRO PERSO, non un giro lento.
 *
 * Un'immagine sincrona (la funzione che la genera muore con la richiesta HTTP che la porta) e un
 * giro asincrono presso un fornitore (`external_job_id` scritto — ElevenLabs, Wiro, un video in
 * coda) non condividono lo stesso tetto: il primo non ha nessun processo che lo riprenda se la
 * richiesta muore a metà, il secondo sta ancora legittimamente lavorando dal lato del fornitore
 * ben oltre `maxDuration` di una richiesta HTTP. Una riga per genere, qui e in nessun altro punto:
 * il prossimo genere si aggiunge con una riga, non con un `if`.
 */
export const RUN_STALE_MS = 6 * 60_000;
const VIDEO_TIMEOUT_MS = 20 * 60_000;
const WIRO_IMAGE_TIMEOUT_MS = 10 * 60_000;
const WIRO_VIDEO_TIMEOUT_MS = 30 * 60_000;
const DUBBING_TIMEOUT_MS = 60 * 60_000;

type JobKind = 'sync' | 'video' | 'wiro_image' | 'wiro_video' | 'dubbing';

const JOB_TIMEOUTS_MS: Record<JobKind, number> = {
  sync: RUN_STALE_MS,
  video: VIDEO_TIMEOUT_MS,
  wiro_image: WIRO_IMAGE_TIMEOUT_MS,
  wiro_video: WIRO_VIDEO_TIMEOUT_MS,
  dubbing: DUBBING_TIMEOUT_MS
};

/**
 * IL GENERE DI UN GIRO SI LEGGE DALL'`external_job_id`, non da un campo dedicato: `wiro:` e
 * `elevenlabs:` sono i due fornitori con un riconciliatore proprio (`node-runs.ts`), e per Wiro
 * il genere fine (immagine o video) sta sul nodo che lo ospita — l'ID del task non lo dice.
 */
function jobKindOf(run: { externalJobId: string | null }, nodeType: string | null): JobKind {
  if (!run.externalJobId) {
    return 'sync';
  }
  if (run.externalJobId.startsWith(AUDIO_JOB_PREFIX)) {
    return 'dubbing';
  }
  if (run.externalJobId.startsWith(WIRO_JOB_PREFIX)) {
    return nodeType === 'video' ? 'wiro_video' : 'wiro_image';
  }
  return 'video';
}

export type ExpireOutcome = { expired: number };

const RUN_TIMED_OUT = 'timed out — the request that ran it never came back';

/**
 * UN BIGLIETTO DI LOOP (`loop.ts::enqueueLoop`, `node_runs.params.loop.phase === 'queued'`) NON È
 * PERSO PER LA SOLA ETÀ — è in attesa che `drainLoopQueue` lo reclami, e una coda lunga (fino a
 * 1000 combinazioni, drenate poche per tick) supera comodamente `RUN_STALE_MS`. Scambiarlo per un
 * giro perso lo chiuderebbe `expired` mentre aspettava solo il suo turno: il loop perderebbe
 * combinazioni non ancora partite, non solo quelle davvero bloccate. Un biglietto RECLAMATO
 * (`status: 'finishing'`) non passa comunque da questa funzione — `runningRuns` guarda solo
 * `status = 'running'` — quindi qui basta riconoscere la forma del biglietto ancora in coda.
 */
function isQueuedLoopTicket(run: { params: Record<string, unknown> }): boolean {
  const loop = run.params.loop;
  return Boolean(loop && typeof loop === 'object' && (loop as { phase?: unknown }).phase === 'queued');
}

const EXPIRE_SWEEP_LIMIT = 2000;

/**
 * UN GIRO SENZA VIA D'USCITA VIENE CHIUSO A MANO, DA FUORI — ma solo quando ha superato IL PROPRIO
 * tetto (`JOB_TIMEOUTS_MS`), non quello sincrono. Un giro asincrono ancora in coda presso il
 * fornitore non è mai "perso per età" sotto quel tetto: il poll che lo riporta a `running`
 * (`releaseClaim`/`retryClaim`, nei riconciliatori dedicati) è la prova che il fornitore lo dice
 * ancora in corso, e quel poll è quanto di più recente questa riga sa.
 *
 * `claimRun` prima di ogni scrittura: due tick sovrapposti — o questo tick e la richiesta
 * originale che in realtà sta ancora rispondendo — non devono chiudere la stessa riga due volte.
 * Zero righe dal claim vuol dire che è già stata presa, e si passa oltre senza toccare nulla.
 *
 * Il nodo torna a `running: false` con l'errore scritto: senza, la riga in `node_runs` direbbe la
 * verità e lo schermo continuerebbe a mentire — esattamente il difetto segnalato.
 */
export async function expireStuckRuns(db: Db): Promise<ExpireOutcome> {
  const now = Date.now();
  const running = (await runningRuns(db, { limit: EXPIRE_SWEEP_LIMIT })).filter((run) => !isQueuedLoopTicket(run));

  let expired = 0;
  for (const run of running) {
    const node = run.externalJobId ? await findNode(db, { orgId: run.orgId, nodeId: run.nodeId }).catch(() => null) : null;
    const kind = jobKindOf(run, node?.type ?? null);
    const cap = JOB_TIMEOUTS_MS[kind];
    if (now - new Date(run.startedAt).getTime() < cap) continue;

    const claimed = await claimRun(db, { orgId: run.orgId, runId: run.id });
    if (!claimed) continue;

    await expireRun(db, { orgId: run.orgId, runId: run.id, error: RUN_TIMED_OUT });

    await showRunState(db, run, { running: false, runId: run.id, error: RUN_TIMED_OUT });

    expired += 1;
  }

  return { expired };
}
