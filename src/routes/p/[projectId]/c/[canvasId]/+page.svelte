<script lang="ts">
  import { MediaOrigin } from '$lib/canvas/download';
  /**
   * LA TELA.
   *
   * LO STATO DEI NODI VIVE QUI, IN UN POSTO SOLO (`nodes`), e non è una comodità: fra il gesto e
   * la risposta del server c'è sempre un nodo che esiste solo sullo schermo, e ricaricare i dati
   * a ogni salvataggio farebbe sparire e ricomparire quel che si sta scrivendo. Il server è la
   * verità all'apertura; da lì in poi comanda questa lista. Chi ascolterà `postgres_changes` ha
   * una lista sola da toccare, non tre sparse.
   *
   * IL DISEGNO È DI `CanvasFlow`, che è già scritto e già provato: panning, zoom, selezione col
   * riquadro, il menù del doppio clic e il rifiuto di una linea mentre il puntatore è in aria.
   * Qui si fa l'altra metà — quale riga sta dietro una tile, e cosa si scrive quando cambia.
   */
  import { onCanvasReveal } from '$lib/canvas/canvas-reveal';
  import { keepSame } from '$lib/canvas/snapshot-keep';
  import { AssetSize, sized } from '$lib/canvas/asset-url';
  import TieredImage from '$lib/components/canvas/TieredImage.svelte';
  import { createWriteQueue } from '$lib/canvas/write-queue';
  import { canvasActionUrl } from '$lib/canvas/canvas-action-url';
  import { baseOf, diffNodeData } from '$lib/canvas/node-patch';
  import { SaveFailure, adoptIdleRows, failureOf, saveMessage, writeWithRetry, type ActionAnswer, type WriteOutcome } from '$lib/canvas/node-save';
  import { createUndoStack } from '$lib/canvas/undo-stack';
  import type { Gesture, UndoItem } from '$lib/canvas/undo-plan';
  import { buildMoveGesture, checkMoveGesture, inverseMoveGesture, type MoveGesture } from '$lib/canvas/move-gesture';
  import { connectCanvas } from '$lib/realtime/canvas-channel';
  import type { PresencePeer } from '$lib/realtime/presence-peers';
  import { createSupabaseBrowserClient } from '$lib/supabase/client';
  import { deserialize } from '$app/forms';
  import { invalidate } from '$app/navigation';
  import { CANVAS_LIST_DEPENDENCY } from '$lib/canvas/canvas-list';
  import { formatCredits } from '$lib/components/credit-amount-format';
  import { untrack } from 'svelte';
  import CanvasFlow from '$lib/components/canvas/CanvasFlow.svelte';
  import GenNode from '$lib/components/canvas/GenNode.svelte';
  import IframeNode from '$lib/components/canvas/IframeNode.svelte';
  import DocNode from '$lib/components/canvas/DocNode.svelte';
  import ProductsNode from '$lib/components/canvas/ProductsNode.svelte';
  import SocialFeedNode from '$lib/components/canvas/SocialFeedNode.svelte';
  import InfluencerNode from '$lib/components/canvas/InfluencerNode.svelte';
  import EmptyNode from '$lib/components/canvas/EmptyNode.svelte';
  import { isNodeType } from '$lib/canvas/node-data';
  import UploadedNode from '$lib/components/canvas/UploadedNode.svelte';
  import ListNode from '$lib/components/canvas/ListNode.svelte';
  import SelectNode from '$lib/components/canvas/SelectNode.svelte';
  import NodeDownload from '$lib/components/canvas/NodeDownload.svelte';
  import NodeReferences from '$lib/components/canvas/NodeReferences.svelte';
  import AudioControls, { type VoiceChoice } from '$lib/components/canvas/AudioControls.svelte';
  import AudioPlayer from '$lib/components/canvas/AudioPlayer.svelte';
  import { referencesOf } from '$lib/canvas/node-references';
  import EffectsNode from '$lib/components/canvas/EffectsNode.svelte';
  import EffectsEditor from '$lib/components/canvas/EffectsEditor.svelte';
  import CompositionNode from '$lib/components/canvas/CompositionNode.svelte';
  import CalendarNode from '$lib/components/canvas/CalendarNode.svelte';
  import { calendarData, calendarOf, CalendarScope, type CalendarNode as CalendarNodeState } from '$lib/canvas/calendar-node';
  import { calendarError, type CalendarBrand, type CalendarPost } from '$lib/canvas/calendar-posts';
  import { plannedInstant } from '$lib/calendar/period-grid';
  import { DropVerdict, dayUnderPointer, type PointerPoint } from '$lib/canvas/canvas-drop';
  import { inputChanged } from '$lib/canvas/effects/editor';
  import { upstreamMedia } from '$lib/canvas/effects-node';
  import type { EffectStep } from '$lib/canvas/effects';
  import { upstreamImageRefs } from '$lib/canvas/composition-node';
  import type { CompositionNode as CompositionNodeState } from '$lib/canvas/composition-node';
  import { listFeedingSelect } from '$lib/canvas/select-node';
  import { productItem, socialPostItem } from '$lib/canvas/select-sources';
  import { feedFiltersOf, filterPosts, filterProducts, productFiltersOf } from '$lib/canvas/source-filters';
  import { hasInspector, inspectorOf } from '$lib/canvas/node-inspector';
  import SourceSettingsFrame from '$lib/components/canvas/SourceSettingsFrame.svelte';
  import {
    listConnectors,
    listKindOf,
    listValues,
    wiredKindOf,
    wiresInto,
    type ListItem,
    type ListItemKind,
    type ListNode as ListNodeState,
    type ListValues,
    type WiredListSource
  } from '$lib/canvas/list-node';
  import { verdictForUpload, canvasUploadPrefix } from '$lib/canvas/upload-kind';
  import { isUploadedNodeRow, uploadedNodeOf } from '$lib/canvas/uploaded-node';
  import { genNodeSize, startRun, unlockRun, type GenNode as GenNodeState, type GenMedium, type ModelChoice } from '$lib/canvas/gen-node';
  import { hasUpstreamText } from '$lib/canvas/upstream-inputs';
  import { effectiveModel } from '$lib/canvas/default-models';
  import { nearestVideoDuration } from '$lib/video-models';
  import { snapResolution } from '$lib/canvas/gen-node';
  import { snapDynamicParams } from '$lib/canvas/model-params';
  import { type IframeNode as IframeNodeState } from '$lib/canvas/iframe-node';
  import { shareUrlOf } from '$lib/canvas/doc-node';
  import { nodeSize } from '$lib/canvas/node-size';
  import { grownTextNodeHeight } from '$lib/canvas/text-node-grow';
  import { scrollGuard } from '$lib/canvas/scroll-guard';
  import { loadTextViewMode, storeTextViewMode, type TextViewMode } from '$lib/canvas/text-view-mode';
  import { renderDocHtml } from '$lib/canvas/doc-render';
  import '$lib/styles/doc-prose.css';
  import { producedRuns } from '$lib/canvas/gen-history';
  import { runQuoteOf, type RunQuote } from '$lib/canvas/run-quote';
  import { type Addable } from '$lib/canvas/addable';
  import type { FilledNodeDrag } from '$lib/canvas/drag-payload';
  import { tileNode } from '$lib/canvas/connect-rules';
  import { planDelete } from '$lib/canvas/delete-plan';
  import { connectorsFor, orphanedByModelChange, type ConnectorType, type GenerativeNodeKind, connectorsForNode } from '$lib/canvas/connectors';
  import { portsOf } from '$lib/canvas/node-ports';
  import { needsUncensoredConfirm } from '$lib/canvas/uncensored-switch';
  import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
  import { planConnectSelection, type ConnectSource } from '$lib/canvas/connect-selection-plan';
  import {
    docData,
    docOf,
    frameData,
    frameOf,
    genData,
    genOf,
    influencerOf,
    listData,
    listOf,
    newNodeRow,
    productsOf,
    selectData,
    selectOf,
    effectsOf,
    effectsData,
    compositionOf,
    compositionData,
    socialFeedOf
  } from '$lib/canvas-node-data';
  import {
    isCanvasEdgeKind,
    type CanvasEdgeKind,
    type FlowEdge,
    type WireMode
  } from '$lib/canvas-edges';
  import { loopAffordance, type LoopSourceNode } from '$lib/canvas/loop-axes';
  import type { CanvasNodeRecord, Connection } from '$lib/server/repos/canvas';
  import type { Product } from '$lib/server/repos/products';
  import type { SocialPost } from '$lib/server/repos/social-posts';
  import { openSheet } from '$lib/canvas/sheet-nav';
  import { promotePath, canvasSelection } from '$lib/canvas/promote-sheet';
  import { billingPath } from '$lib/billing-path';

  let { data } = $props();
  type TextCostEstimate = { inputTokens: number; outputTokens: number; variableInput: boolean; revision: string };
  let textCostEstimates = $state<Record<string, TextCostEstimate>>({});
  let voices = $state<VoiceChoice[]>([]);
  let voicesError = $state<string | null>(null);
  let voicesLoading = false;

  async function loadVoices() {
    if (voicesLoading) {
      return;
    }
    voicesLoading = true;
    const result = await post('audio_voices', {});
    const found = (result?.voices as VoiceChoice[] | undefined) ?? [];
    voices = found;
    voicesError = found.length ? null : 'No voices available';
  }

  function handlePromote(ids: string[]) {
    void openSheet(data.projectId, promotePath(ids));
  }

  type CalendarState = { posts: CalendarPost[] | null; brands: CalendarBrand[]; error: string | null; busy: boolean };
  const CALENDAR_REFRESH_MS = 60_000;
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  let calendars = $state<Record<string, CalendarState>>({});

  function calendarStateOf(id: string): CalendarState {
    return calendars[id] ?? { posts: null, brands: [], error: null, busy: false };
  }

  function patchCalendar(id: string, patch: Partial<CalendarState>) {
    calendars = { ...calendars, [id]: { ...calendarStateOf(id), ...patch } };
  }

  function answerError(answer: ActionAnswer): string {
    const detail = (answer.data ?? {}) as { error?: unknown; message?: string; deliveries?: { error?: string }[] };
    const reasons = (detail.deliveries ?? []).map((d) => d.error).filter(Boolean).join(', ');
    return calendarError(detail.error, reasons || undefined);
  }

  async function loadCalendar(calendar: CalendarNodeState) {
    const answer = await send('calendar_posts', { scope: calendar.scope, brand_id: calendar.brandId ?? '' });
    if (answer.type !== 'success') {
      patchCalendar(calendar.id, { posts: [], error: answerError(answer) });
      return;
    }
    const result = answer.data as { posts: CalendarPost[]; brands: CalendarBrand[] };
    patchCalendar(calendar.id, { posts: result.posts, brands: result.brands, error: null });
  }

  function calendarNodes(): CalendarNodeState[] {
    return nodes.map((n) => calendarOf(n)).filter((c): c is CalendarNodeState => c !== null);
  }

  function refreshCalendars() {
    for (const calendar of calendarNodes()) {
      void loadCalendar(calendar);
    }
  }

  const calendarQueries = $derived(calendarNodes().map((c) => `${c.id}:${c.scope}:${c.brandId ?? ''}`).join('|'));

  $effect(() => {
    void calendarQueries;
    untrack(refreshCalendars);
  });

  $effect(() => {
    const timer = setInterval(refreshCalendars, CALENDAR_REFRESH_MS);
    window.addEventListener('focus', refreshCalendars);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', refreshCalendars);
    };
  });

  async function moveDraft(calendar: CalendarNodeState, post: CalendarPost, dayKey: string) {
    patchCalendar(calendar.id, { busy: true });
    const answer = await send('plan_post', {
      post_id: post.id,
      planned_for: plannedInstant(dayKey, timeZone, post.plannedFor),
      expected_updated_at: post.updatedAt
    });
    patchCalendar(calendar.id, { busy: false, error: answer.type === 'success' ? null : answerError(answer) });
    await loadCalendar(calendar);
  }

  async function scheduleDraft(calendar: CalendarNodeState, post: CalendarPost) {
    patchCalendar(calendar.id, { busy: true });
    const answer = await send('schedule_post', { post_id: post.id });
    patchCalendar(calendar.id, { busy: false, error: answer.type === 'success' ? null : answerError(answer) });
    await loadCalendar(calendar);
  }

  function highlightDay(ids: string[], at: PointerPoint) {
    const target = dayUnderPointer(at, ids);
    for (const el of document.querySelectorAll('.is-node-drop')) {
      if (el !== target?.element) { el.classList.remove('is-node-drop'); }
    }
    target?.element.classList.add('is-node-drop');
  }

  function dropOnDay(ids: string[], at: PointerPoint): DropVerdict {
    const target = dayUnderPointer(at, ids);
    for (const el of document.querySelectorAll('.is-node-drop')) { el.classList.remove('is-node-drop'); }
    const calendar = target ? calendarNodes().find((c) => c.id === target.calendarId) : null;
    if (!target || !calendar) {
      return DropVerdict.Ignored;
    }
    void draftOnDay(calendar, ids, target.dayKey);
    return DropVerdict.Taken;
  }

  async function draftOnDay(calendar: CalendarNodeState, ids: string[], dayKey: string) {
    if (!calendar.brandId) {
      patchCalendar(calendar.id, { error: calendarError('brand_missing') });
      return;
    }
    patchCalendar(calendar.id, { busy: true });
    const answer = await send('create_post', {
      brand_id: calendar.brandId,
      node_id: ids,
      planned_for: plannedInstant(dayKey, timeZone, null)
    });
    patchCalendar(calendar.id, { busy: false, error: answer.type === 'success' ? null : answerError(answer) });
    await loadCalendar(calendar);
  }

  /** Una riga come la pagina la tiene: quel che il database ha, più dove sta sullo schermo. */
  type Tile = {
    id: string;
    type: string;
    displayName: string | null;
    data: Record<string, unknown>;
    saved: Record<string, unknown>;
    version: number;
    x: number;
    y: number;
    w: number;
    h: number;
    /** `node.size.height` così come sta in database, prima di ogni scelta di ripiego: `null`
     *  vuol dire "l'utente non ha mai ridimensionato a mano", il segnale che il nodo testo può
     *  crescere da solo (`grownTextNodeHeight`, `text-node-grow.ts`). */
    userHeight: number | null;
    /** Appena nata da un gesto di QUESTO client — `CanvasFlow`/`syncNodes` la selezionano, una
     *  volta sola. Mai vero da `refresh()`/dal primo carico: un inserimento realtime da un
     *  collega non deve rubare la selezione locale. */
    select?: boolean;
  };

  function sizeOf(node: CanvasNodeRecord): { w: number; h: number } {
    const { w, h } = nodeSize(node.type);
    return { w: node.size.width ?? w, h: node.size.height ?? h };
  }

  function toTile(node: CanvasNodeRecord, opts: { select?: boolean } = {}): Tile {
    return {
      id: node.id,
      type: node.type,
      displayName: node.displayName,
      data: node.data,
      saved: node.data,
      version: node.version,
      x: node.position.x,
      y: node.position.y,
      userHeight: node.size.height,
      select: opts.select,
      ...sizeOf(node)
    };
  }

  let nodes = $state<Tile[]>((data.nodes as CanvasNodeRecord[]).map((n) => toTile(n)));

  /**
   * QUANTO IL CONTENUTO DI UN NODO TESTO CHIEDE, misurato dal DOM — mai scritto in database, mai
   * la ragione per cui `write()` parte: solo lo schermo. `GenNode` lo riporta a ogni cambio
   * (`onmeasure`), `tiles` lo applica clampato (`grownTextNodeHeight`) finché l'utente non ha
   * ridimensionato a mano quel nodo — allora `Tile.userHeight` vince e questa mappa non conta più.
   */
  let grownHeights = $state<Record<string, number>>({});

  /**
   * RAW O MARKDOWN, PER NODO E PER CHI GUARDA — mai scritto sul nodo: due persone sullo stesso
   * testo possono leggerlo in due forme diverse, e non è uno stato del contenuto, è una
   * preferenza di lettura. `localStorage` (`text-view-mode.ts`, avvolto in try/catch) la porta
   * fra un'apertura e l'altra; questa mappa è solo la cache in RAM di quello storage per non
   * rileggerlo a ogni fotogramma.
   */
  let textViewModes = $state<Record<string, TextViewMode>>({});

  const clientStorage = typeof localStorage === 'undefined' ? undefined : localStorage;

  function textViewModeOf(nodeId: string): TextViewMode {
    return textViewModes[nodeId] ?? loadTextViewMode(clientStorage, nodeId);
  }

  function setTextViewMode(nodeId: string, mode: TextViewMode) {
    textViewModes[nodeId] = mode;
    storeTextViewMode(clientStorage, nodeId, mode);
  }

  /**
   * IL VERSO DI UNA LINEA STA SU `source_handle`. `nodes_connections` non ha una colonna per il
   * verso, e gli attacchi sono due — uno solo per lato — quindi quel campo è libero e porta
   * l'unica cosa che altrimenti si perderebbe: senza, riaprire la tela mostrerebbe ogni linea
   * tornata «nasce da», che è un dato falso scritto da nessuno.
   */
  function edgeKindOf(connection: Connection): CanvasEdgeKind {
    const handle = connection.sourceHandle ?? '';
    return isCanvasEdgeKind(handle) ? handle : 'derives_from';
  }

  function toEdge(connection: Connection): FlowEdge {
    const kind = edgeKindOf(connection);
    return {
      id: connection.id,
      source: connection.sourceNodeId,
      target: connection.targetNodeId,
      targetHandle: connection.targetHandle,
      kind,
      mode: connection.mode,
      ...(kind === 'groups_with' ? {} : { markerEnd: { type: 'arrowclosed' as const } })
    };
  }

  let edges = $state<FlowEdge[]>((data.connections as Connection[]).map(toEdge));

  function toGenRun(run: {
    id: string;
    outputAssetId: string | null;
    prompt: string | null;
    model: string | null;
    startedAt: string;
    text?: string | null;
  }) {
    return {
      id: run.id,
      mediaId: run.outputAssetId,
      prompt: run.prompt ?? '',
      model: run.model,
      createdAt: run.startedAt,
      text: run.text ?? null
    };
  }

  const runsByNode = $derived(
    Object.fromEntries(
      Object.entries((data.runs ?? {}) as Record<string, unknown[]>).map(([id, rows]) => [
        id,
        producedRuns((rows as Parameters<typeof toGenRun>[0][]).map(toGenRun))
      ])
    )
  );

  /**
   * SE UN NODO CHE PRODUCE HA UN TESTO A MONTE DA CONTARE COME PROMPT (CLAUDE.md: un'immagine
   * wired a un testo scritto è pronta anche senza un prompt suo). `sourceTextOf` legge lo stesso
   * testo che il server leggerebbe (`upstream.ts::sourceText`): il testo generato quando il nodo
   * l'ha già mostrato, altrimenti il suo prompt/contenuto mai girato — un nodo mai girato dà
   * comunque quel che c'è scritto, non sparisce dal giro a valle.
   */
  function sourceTextOf(node: Tile): string | null {
    if (node.type === 'doc') {
      const content = typeof node.data.content === 'string' ? node.data.content : '';
      return content.trim() ? content : null;
    }
    const refId = typeof node.data.refId === 'string' ? node.data.refId : null;
    const shown = refId ? (runsByNode[node.id] ?? []).find((r) => r.mediaId === refId)?.text : null;
    if (shown) return shown;
    const prompt = typeof node.data.prompt === 'string' ? node.data.prompt : '';
    return prompt.trim() ? prompt : null;
  }

  const hasUpstreamTextByNode = $derived.by(() => {
    const upstreamNodes = nodes.map((n) => ({ id: n.id, type: n.type, text: sourceTextOf(n) }));
    const upstreamEdges = edges.map((e) => ({ id: e.id, sourceNodeId: e.source, targetNodeId: e.target }));
    return Object.fromEntries(nodes.map((n) => [n.id, hasUpstreamText(upstreamNodes, upstreamEdges, n.id)]));
  });

  function textEstimateRevision(nodeId: string): string {
    return JSON.stringify(
      edges
        .filter((edge) => edge.target === nodeId)
        .sort((left, right) => left.id.localeCompare(right.id))
        .map((edge) => {
          const source = nodes.find((node) => node.id === edge.source);
          return [edge, source?.version, source?.data, source ? sourceTextOf(source) : null];
        })
    );
  }

  /** Quanti biglietti di loop sono ancora `queued` per nodo — non ancora reclamati da un tick.
   *  `data.runs` porta OGNI riga `node_runs`, biglietti compresi (`runsOf` non li filtra, sono
   *  righe come le altre): la stessa lista che alimenta `runsByNode`, letta prima che
   *  `toGenRun` scarti `status`/`params`, i due campi che dicono se una riga è un biglietto. */
  const loopQueuedByNode = $derived(
    Object.fromEntries(
      Object.entries((data.runs ?? {}) as Record<string, { status?: string; params?: { loop?: { phase?: string } } }[]>).map(
        ([id, rows]) => [id, rows.filter((r) => r.status === 'running' && r.params?.loop?.phase === 'queued').length]
      )
    )
  );

  /** L'output di ora di un nodo collegato a una lista, nella forma di un item — la stessa lettura
   *  che il server fa in `upstream.ts::wiredItem`: l'asset dell'ultimo giro, o `sourceTextOf`. */
  function wiredItemOf(n: Tile, kind: ListItemKind): ListItem | null {
    if (kind === 'text') {
      const text = sourceTextOf(n);
      return text ? { text } : null;
    }
    const refId = typeof n.data.refId === 'string' ? n.data.refId : null;
    return refId ? { asset_id: refId, url: `/p/${data.projectId}/c/${data.canvas.id}/assets/${refId}` } : null;
  }

  function wiredSourcesOf(listId: string): WiredListSource[] {
    const listEdges = edges.map((e) => ({ id: e.id, sourceNodeId: e.source, targetNodeId: e.target }));
    return wiresInto(listId, listEdges).flatMap((e) => {
      const source = nodes.find((n) => n.id === e.sourceNodeId);
      const kind = source ? wiredKindOf(source.type) : null;
      return source && kind ? [{ nodeId: source.id, kind, item: wiredItemOf(source, kind) }] : [];
    });
  }

  /** I valori di ogni `list`, via `listValues` — la stessa funzione del server: la tile, il loop e
   *  il `select` leggono questa mappa, mai `items` da soli. */
  const listValuesByNode = $derived(
    Object.fromEntries(
      nodes.flatMap((n) => {
        const list = listOf(n);
        return list ? [[n.id, listValues(list, wiredSourcesOf(n.id))]] : [];
      })
    ) as Record<string, ListValues>
  );

  const listPortsByNode = $derived(
    Object.fromEntries(
      nodes.flatMap((n) => {
        const list = listOf(n);
        return list ? [[n.id, listConnectors(listKindOf(list, wiredSourcesOf(n.id)))]] : [];
      })
    ) as Record<string, ConnectorType[]>
  );

  /** Ogni nodo, per id — la stessa lettura che `listFeedingSelect` chiede, minima apposta. */
  const nodesById = $derived(new Map(nodes.map((n) => [n.id, { id: n.id, type: n.type }])));

  /** Quanti item porta un nodo, qualunque sia la sua sorgente — una `list` conta i suoi valori
   *  risolti, `products`/`social_account_feed` contano le righe sincronizzate che la pagina ha già
   *  in mano (`data.products`/`data.socialPosts`, lette da `load`): la stessa tabella di
   *  `select-node.ts::SELECTABLE_SOURCE_TYPES`, qui applicata al conteggio invece che al filtro. */
  function itemCountOf(n: Tile): number {
    if (n.type === 'products') return shownProducts[n.id]?.length ?? 0;
    if (n.type === 'social_account_feed') return shownPosts[n.id]?.length ?? 0;
    return listValuesByNode[n.id]?.values.length ?? 0;
  }

  /** Ogni nodo, per id, con quanti item porta — la lettura che `loopAffordance` chiede per
   *  contare gli assi di un loop. */
  const loopSourceNodesById = $derived(
    new Map<string, LoopSourceNode>(nodes.map((n) => [n.id, { id: n.id, type: n.type, itemCount: itemCountOf(n) }]))
  );

  /** Se il bottone Loop si vede su un nodo, e con quante combinazioni — un filo `iterate` la
   *  cui sorgente porta >=2 valori (un asse), calcolato prima di aprire il pannello, non dopo. */
  const loopAffordanceByNode = $derived(
    Object.fromEntries(
      nodes.map((n) => [
        n.id,
        loopAffordance(
          n.id,
          edges.map((e) => ({ sourceNodeId: e.source, targetNodeId: e.target, mode: e.mode ?? 'fixed' })),
          loopSourceNodesById
        )
      ])
    )
  );

  /** Un `products`/`social_account_feed` come `ListNodeState` — la stessa forma che `SelectNode`
   *  già disegna per una `list`, con `productItem`/`socialPostItem` (`select-sources.ts`) a
   *  tradurre ogni riga sincronizzata in un item: la stessa tabella per tipo che `upstream.ts`
   *  usa lato server, qui applicata all'anteprima invece che alla generazione. */
  function syncedSourceListOf(source: { id: string; type: string }): ListNodeState {
    const rows = source.type === 'products' ? (shownProducts[source.id] ?? []).map(productItem) : (shownPosts[source.id] ?? []).map(socialPostItem);

    return {
      id: source.id,
      itemKind: rows.some((r) => r.mediaUrls.length) ? 'image' : 'text',
      items: rows.map((r) => ({ text: r.text ?? undefined, url: r.mediaUrls[0] }))
    };
  }

  /** La sorgente che alimenta un `select`, o null — `listFeedingSelect` sceglie il primo arco
   *  entrante la cui sorgente è in `SELECTABLE_SOURCE_TYPES`, la stessa disciplina di
   *  `upstream.ts::listFeeding`. */
  function upstreamListOf(selectId: string): ListNodeState | null {
    const upstreamEdges = edges.map((e) => ({ sourceNodeId: e.source, targetNodeId: e.target }));
    const source = listFeedingSelect(selectId, upstreamEdges, nodesById);
    if (!source) return null;
    if (source.type === 'products' || source.type === 'social_account_feed') return syncedSourceListOf(source);
    const values = listValuesByNode[source.id];
    return values ? { id: source.id, itemKind: values.itemKind, items: values.values.map((v) => v.item) } : null;
  }

  function upstreamEffectsMediaOf(effectsId: string) {
    return upstreamMedia(effectsId, edges, nodes);
  }

  function upstreamCompositionRefsOf(compositionId: string): string[] {
    return upstreamImageRefs(compositionId, edges, nodes);
  }

  function assetUrl(refId: string | null): string | null {
    return refId ? `/p/${data.projectId}/c/${data.canvas.id}/assets/${refId}` : null;
  }

  /** Da un nodo `list` al nodo che GENERA che lo tiene come proprio output di loop
   *  (`data.outputListNodeId`, `loop.ts::createOutputList`) — assente quando la lista non è mai
   *  stata l'output di un loop, e in quel caso non c'è "ritenta" da offrire: ritentare un item
   *  vuol dire rilanciare la STESSA generazione che l'ha prodotto, e senza il nodo che genera non
   *  c'è un prompt/modello da rilanciare. */
  const loopOutputByNode = $derived(
    Object.fromEntries(
      nodes
        .filter((n) => typeof n.data.outputListNodeId === 'string')
        .map((n) => [n.data.outputListNodeId as string, n.id])
    )
  );

  const mediumCatalogue = $derived(
    (data.catalogue ?? {
      text: { choices: [], synced: true },
      image: { choices: [], synced: false },
      video: { choices: [], synced: false },
      audio: { choices: [], synced: false }
    }) as Record<GenMedium, { choices: ModelChoice[]; synced: boolean; enhanceUnitCredits?: number }>
  );
  const catalogue = $derived(
    Object.fromEntries(
      Object.entries(mediumCatalogue).map(([medium, { choices }]) => [medium, choices])
    ) as Record<GenMedium, ModelChoice[]>
  );

  /**
   * IL CATALOGO E IL FEED SCARICATI, per nodo. Come `runsByNode`: `products`/`social_account_feed`
   * non portano il contenuto in `data.data` — vive in `products`/`social_posts` — quindi arriva
   * qui, letto dal server in `load` e riletto a ogni `refresh()`.
   */
  const productsByNode = $derived((data.products ?? {}) as Record<string, Product[]>);
  const socialPostsByNode = $derived((data.socialPosts ?? {}) as Record<string, SocialPost[]>);
  type InfluencerTile = { name: string; views: { id: string; label: string; url: string | null }[] };
  let influencersOverride = $state<Record<string, InfluencerTile> | null>(null);
  const influencersByNode = $derived(influencersOverride ?? ((data.influencers ?? {}) as Record<string, InfluencerTile>));

  const itemPortOf = (kind: string | undefined): ConnectorType => (kind === 'text' ? 'text' : 'images');

  function uncensoredModelOf(n: Tile): boolean {
    if (n.type !== 'text' && n.type !== 'image' && n.type !== 'video') {
      return false;
    }
    const model = typeof n.data.model === 'string' ? n.data.model : null;
    return catalogue[n.type]?.find((c) => c.id === model)?.uncensored === true;
  }

  function portsOfTile(n: Tile): { inputs: ConnectorType[] | undefined; output: ConnectorType | null } {
    if (!isNodeType(n.type)) {
      return { inputs: undefined, output: null };
    }
    const model = typeof n.data.model === 'string' ? n.data.model : null;
    return portsOf(n.type, {
      modelPorts: () => connectorsForNode(n.type as GenerativeNodeKind, model, catalogue[n.type as GenerativeNodeKind] ?? []),
      listPorts: () => listPortsByNode[n.id] ?? [],
      itemPort: () => itemPortOf(n.type === 'list' ? listValuesByNode[n.id]?.itemKind : upstreamListOf(n.id)?.itemKind),
      mediaKind: () => upstreamEffectsMediaOf(n.id)?.kind ?? (n.data.mediaKind === 'video' ? 'video' : 'image')
    });
  }

  /**
   * Quel che `CanvasFlow` disegna. `node` è ciò che serve a dire NO a un arco prima che nasca:
   * senza, `verdictBetween` non sa che tipo sia una tile e — per la sua regola, che è giusta —
   * lascia passare tutto.
   */
  function tileHeight(n: Tile): number {
    if (n.type !== 'text' || !(n.id in grownHeights)) return n.h;
    return grownTextNodeHeight(grownHeights[n.id], n.userHeight);
  }

  const tiles = $derived(
    nodes.map((n) => ({ n, ports: portsOfTile(n) })).map(({ n, ports }) => ({
      id: n.id,
      x: n.x,
      y: n.y,
      w: n.w,
      h: tileHeight(n),
      connectable: true,
      connectors: ports.inputs,
      output: ports.output,
      kind: n.type,
      displayName: n.displayName,
      inPost: data.nodeIdsInPost.includes(n.id),
      select: n.select,
      settings: hasInspector(n.type),
      minW: nodeSize(n.type).w,
      minH: nodeSize(n.type).h,
      node: n.type === 'effects'
        ? { id: n.id, kind: 'effects' as const, mediaKind: n.data.mediaKind === 'video' ? 'video' as const : 'image' as const }
        : tileNode({
        id: n.id,
        medium: n.type === 'iframe' || n.type === 'document' || n.type === 'doc' ? null : (n.type as 'text' | 'image' | 'video' | 'list' | 'select' | 'products' | 'social_account_feed'),
        model: typeof n.data.model === 'string' ? n.data.model : null,
        uncensored: uncensoredModelOf(n)
      })
    }))
  );

  /** `type`/`data` grezzi di ogni tile — la forma che `commonPropertiesOf` legge, per la barra
   *  della selezione: `tiles` porta già `node: CanvasNode`, un'astrazione diversa che non ha
   *  `model`/`params` come campi diretti. */
  const nodeSummaries = $derived(nodes.map((n) => ({ id: n.id, type: n.type, data: n.data })));

  function modelChoicesFor(type: 'text' | 'image' | 'video'): ModelChoice[] {
    return catalogue[type] ?? [];
  }

  let failed = $state<string | null>(null);
  let failedIsCreditsExhausted = $state(false);
  let peers = $state<PresencePeer[]>([]);
  let pending = 0;
  let snapshotVersion = 0;
  const enqueue = createWriteQueue();

  /**
   * LO STACK DI QUESTA SCHEDA — non dell'utente, non del database: `undo-stack.ts` lo dice in
   * testa al file, e vale anche qui. Un gesto entra dopo che il server l'ha già scritto (mai
   * prima: annullare un gesto che il server ha rifiutato annullerebbe qualcosa che non è mai
   * successo), con l'inversa già in mano — `before`/`after` che il server ha appena restituito, o
   * che il client teneva già per costruire la richiesta.
   *
   * `StackEntry` PORTA I DUE MONDI: un `Gesture` che passa dal server (`undo`, sotto) e un
   * `MoveGesture` che non lo tocca mai — la posizione è last-write-wins, senza `canvas_events`, e
   * la sua domanda ("è ancora dov'era?") è `checkMoveGesture`, non `checkGesture`. Un'unica
   * cronologia, non due stack separati: creare un nodo dopo averne spostato un altro e poi
   * annullare due volte deve disfare la creazione e poi lo spostamento, nell'ordine vero.
   */
  type StackEntry = { source: 'server'; gesture: Gesture } | { source: 'move'; gesture: MoveGesture };
  const undoStack = createUndoStack<StackEntry>();

  /** Ogni scrittura che passa da `undo` (server) spinge qui, mai `undoStack.push` diretto — la
   *  busta `{ source: 'server', … }` sta in un posto solo. */
  function pushGesture(gesture: Gesture) {
    undoStack.push({ source: 'server', gesture });
  }

  let productsOverride = $state<Record<string, Product[]> | null>(null);
  let socialPostsOverride = $state<Record<string, SocialPost[]> | null>(null);
  const products = $derived(productsOverride ?? productsByNode);
  const socialPosts = $derived(socialPostsOverride ?? socialPostsByNode);
  const shownProducts = $derived(
    Object.fromEntries(
      nodes.filter((n) => n.type === 'products').map((n) => [n.id, filterProducts(products[n.id] ?? [], productFiltersOf(n.data.filters))])
    ) as Record<string, Product[]>
  );
  const shownPosts = $derived(
    Object.fromEntries(
      nodes
        .filter((n) => n.type === 'social_account_feed')
        .map((n) => [n.id, filterPosts(socialPosts[n.id] ?? [], feedFiltersOf(n.data.filters))])
    ) as Record<string, SocialPost[]>
  );

  let selectedIds = $state<string[]>([]);

  function selectionChanged(ids: string[]) {
    selectedIds = ids;
  }

  $effect(() => {
    canvasSelection.set(selectedIds);
    return () => canvasSelection.set([]);
  });

  async function refresh() {
    const version = ++snapshotVersion;
    const snapshot = await post('snapshot', {});
    if (!snapshot) {
      return;
    }
    if (pending || version !== snapshotVersion) {
      nodes = adoptIdleRows(nodes, snapshot.nodes as CanvasNodeRecord[], enqueue.busy);
      return;
    }
    const now = Date.now();
    nodes = keepSame(nodes, (snapshot.nodes as CanvasNodeRecord[]).map((n) => toTile(n)), now);
    edges = keepSame(edges, (snapshot.connections as Connection[]).map(toEdge), now);
    productsOverride = keepSame(products, (snapshot.products ?? {}) as Record<string, Product[]>, now);
    socialPostsOverride = keepSame(socialPosts, (snapshot.socialPosts ?? {}) as Record<string, SocialPost[]>, now);
    influencersOverride = keepSame(influencersByNode, (snapshot.influencers ?? {}) as Record<string, InfluencerTile>, now);
  }

  $effect(() => {
    snapshotVersion += 1;
    nodes = (data.nodes as CanvasNodeRecord[]).map((n) => toTile(n));
    edges = (data.connections as Connection[]).map(toEdge);
    const user = data.session?.user;
    if (!user) { return; }
    return connectCanvas({
      client: createSupabaseBrowserClient(),
      canvasId: data.canvas.id,
      projectId: data.projectId,
      peer: { userId: user.id, name: user.email ?? 'Utente', avatar: null,
        path: `/p/${data.projectId}/c/${data.canvas.id}`, threadId: null },
      onChange: () => { void refresh(); },
      onReconnect: () => { void refresh(); },
      onCanvasList: () => { void invalidate(CANVAS_LIST_DEPENDENCY); },
      onPeers: (value) => { peers = value; },
      onError: () => { failed = 'Connessione in tempo reale interrotta'; }
    });
  });

  $effect(() => onCanvasReveal(() => { void refresh(); }));

  const READ_ACTIONS = new Set(['snapshot', 'estimate_text_cost', 'calendar_posts', 'audio_voices']);

  function formOf(fields: Record<string, string | number | File | string[]>): FormData {
    const body = new FormData();
    for (const [key, value] of Object.entries(fields)) {
      if (Array.isArray(value)) {
        for (const item of value) { body.append(key, item); }
        continue;
      }
      body.set(key, value instanceof File ? value : String(value));
    }
    return body;
  }

  async function send(
    action: string,
    fields: Record<string, string | number | File | string[]>
  ): Promise<ActionAnswer> {
    let res: Response;
    try {
      res = await fetch(canvasActionUrl({ projectId: data.projectId, canvasId: data.canvas.id }, action), {
        method: 'POST',
        headers: { 'x-sveltekit-action': 'true' },
        body: formOf(fields)
      });
    } catch (cause) {
      console.warn(`canvas action ${action}: network`, cause);
      return { type: 'network' };
    }

    const text = await res.text();
    try {
      return deserialize(text) as ActionAnswer;
    } catch {
      console.warn(`canvas action ${action}: unreadable ${res.status}`, text.slice(0, 500));
      return { type: 'error', status: res.status };
    }
  }

  function announce(action: string, reason: SaveFailure, detail: unknown) {
    console.warn(`canvas action ${action} failed: ${reason}`, detail);
    failedIsCreditsExhausted = reason === SaveFailure.Credits;
    failed = saveMessage(reason, (detail ?? {}) as { message?: string });
  }

  function report(action: string, result: ActionAnswer) {
    announce(action, failureOf(result), result.data ?? result);
  }

  async function post(
    action: string,
    fields: Record<string, string | number | File | string[]>
  ): Promise<Record<string, unknown> | null> {
    const mutating = !READ_ACTIONS.has(action);
    if (mutating) { pending += 1; snapshotVersion += 1; }
    try {
      const result = await send(action, fields);
      if (result.type !== 'success') {
        report(action, result);
        return null;
      }

      if (mutating) { failed = null; failedIsCreditsExhausted = false; }
      return (result.data ?? null) as Record<string, unknown> | null;
    } finally {
      if (mutating) { pending -= 1; snapshotVersion += 1; }
    }
  }

  /**
   * UN FILE VA DRITTO NELLO STORAGE DAL BROWSER, e solo il percorso arriva al server: lo stesso
   * schema di `StudioPage.svelte::handleImageUpload`, per la stessa ragione — un video o un
   * documento normale supera facilmente il corpo che un'azione SvelteKit regge su Vercel.
   *
   * Il nodo nasce SOLO quando la riga torna, come `create`: niente tile senza riga dietro.
   */
  const supabase = createSupabaseBrowserClient();

  async function upload(file: File) {
    const verdict = verdictForUpload(file.type, file.name, file.size);
    if (!verdict.ok) {
      failed = verdict.why;
      return;
    }

    const path = `${canvasUploadPrefix(data.orgId, data.projectId)}${crypto.randomUUID()}-${file.name}`;
    const up = await supabase.storage
      .from('canvas-assets')
      .upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false });
    if (up.error) {
      failed = up.error.message;
      return;
    }

    const result = await post('upload', {
      path, file_name: file.name, mime_type: file.type, bytes: file.size, x: 0, y: 0
    });
    const created = result?.node as CanvasNodeRecord | undefined;
    if (created) { nodes = [...nodes.filter((node) => node.id !== created.id), toTile(created, { select: true })]; }
  }

  async function uploadToLibrary(file: File): Promise<string | null> {
    const path = `${canvasUploadPrefix(data.orgId, data.projectId)}${crypto.randomUUID()}-${file.name}`;
    const up = await supabase.storage.from('canvas-assets').upload(path, file, { contentType: file.type, upsert: false });
    if (up.error) {
      failed = up.error.message;
      return null;
    }

    const result = await post('upload', {
      path, file_name: file.name, mime_type: file.type, bytes: file.size, into: 'library'
    });
    const asset = result?.asset as { id?: string } | undefined;
    return asset?.id ?? null;
  }

  let effectsEditorId = $state<string | null>(null);
  const effectsEditing = $derived.by(() => {
    const row = effectsEditorId ? nodes.find((n) => n.id === effectsEditorId) : null;
    return row ? effectsOf(row) : null;
  });

  let compositionEditorId = $state<string | null>(null);
  let CompositionEditorComponent = $state<typeof import('$lib/components/canvas/CompositionEditor.svelte').default | null>(null);
  const compositionEditing = $derived.by(() => {
    const row = compositionEditorId ? nodes.find((n) => n.id === compositionEditorId) : null;
    return row ? compositionOf(row) : null;
  });

  async function openCompositionEditor(id: string) {
    compositionEditorId = id;
    if (!CompositionEditorComponent) {
      const module = await import('$lib/components/canvas/CompositionEditor.svelte');
      CompositionEditorComponent = module.default;
    }
  }

  async function saveComposition(id: string, next: CompositionNodeState): Promise<boolean> {
    const current = nodes.find((node) => node.id === id);
    if (!current) { return false; }
    const wanted = compositionData(next) as Record<string, unknown>;
    const patch = diffNodeData(current.data, wanted, Object.keys(wanted));
    const out = await saveNode(id, patch, baseOf(current.saved, patch));
    if (!out.ok) {
      return false;
    }
    const written = out.node;
    nodes = nodes.map((node) => (node.id === id ? { ...node, data: written.data, saved: written.data, version: written.version } : node));
    return true;
  }

  /**
   * L'esportazione della composizione (video o immagine) segue lo stesso schema di `upload()`:
   * il file va dritto in `canvas-assets` dal browser, e solo il percorso arriva al server perché
   * un MP4 supera facilmente il corpo che un'azione SvelteKit regge su Vercel. `into: 'library'`
   * registra l'asset senza creare un nodo — la riga che riceve il `refId` è già quella del nodo
   * `composition` che sta esportando.
   */
  async function uploadCompositionExport(file: Blob, extension: 'mp4' | 'webm' | 'png'): Promise<string | null> {
    const mimeType = extension === 'png' ? 'image/png' : extension === 'webm' ? 'video/webm' : 'video/mp4';
    const path = `${canvasUploadPrefix(data.orgId, data.projectId)}${crypto.randomUUID()}-export.${extension}`;
    const up = await supabase.storage.from('canvas-assets').upload(path, file, { contentType: mimeType, upsert: false });
    if (up.error) {
      failed = up.error.message;
      return null;
    }

    const result = await post('upload', {
      path, file_name: `export.${extension}`, mime_type: mimeType, bytes: file.size, into: 'library'
    });
    const asset = result?.asset as { id?: string } | undefined;
    return asset?.id ?? null;
  }

  async function saveCompositionExportRefId(id: string, refId: string): Promise<boolean> {
    return write(id, { refId });
  }

  async function applyEffects(id: string, steps: EffectStep[], _output: Blob | null = null): Promise<boolean> {
    const source = upstreamEffectsMediaOf(id);
    if (!source) {
      return false;
    }

    const current = effectsEditing;
    if (!current) {
      return false;
    }
    const saved = await write(id, effectsData({ ...current, effects: steps, sourceRefId: source.refId, mediaKind: source.kind }));
    if (!saved) {
      return false;
    }

    const result = await post('apply_effects', { node_id: id });
    const written = result?.node as CanvasNodeRecord | undefined;
    if (!written) {
      return false;
    }
    nodes = nodes.map((node) => node.id === id ? toTile(written) : node);
    return true;
  }

  function sizeForAddable(what: Addable): { w: number; h: number } {
    return nodeSize(what);
  }

  /** Un `node.create` di un nodo appena nato: l'inversa è un soft-delete, `checkGesture` la sa già. */
  function createGesture(node: CanvasNodeRecord): Gesture {
    return { items: [{ kind: 'node.create', nodeId: node.id, after: { type: node.type, position: node.position, data: node.data } }] };
  }

  async function create(what: Addable, at: { x: number; y: number }) {
    const { w, h } = sizeForAddable(what);

    const res = await post('create', {
      type: what,
      x: at.x - w / 2,
      y: at.y - h / 2,
      data: JSON.stringify(newNodeRow(what))
    });

    const created = (res?.node ?? null) as CanvasNodeRecord | null;
    if (!created) {
      return;
    }

    nodes = [...nodes.filter((node) => node.id !== created.id), toTile(created, { select: true })];
    pushGesture(createGesture(created));
    if (created.type === 'influencer') {
      void refresh();
    }
  }

  /**
   * UN NODO CHE NASCE GIÀ PIENO — trascinato dalla libreria degli asset o dai brand, non dal menù
   * del doppio clic. Stessa forma di `create`, ma `type`/`data` arrivano dal trascinamento e non
   * da `newNodeRow`: il server li rivalida comunque (`validateNodeData`), perché un payload che
   * viaggia nel `dataTransfer` del browser non è meno un input esterno di un form.
   */
  async function createFilled(drag: FilledNodeDrag, at: { x: number; y: number }) {
    const res = await post('create', {
      type: drag.type,
      x: at.x - drag.w / 2,
      y: at.y - drag.h / 2,
      data: JSON.stringify(drag.data)
    });

    const created = (res?.node ?? null) as CanvasNodeRecord | null;
    if (!created) {
      return;
    }

    nodes = [...nodes.filter((node) => node.id !== created.id), toTile(created, { select: true })];
    pushGesture(createGesture(created));
  }

  /**
   * SPOSTARE SI SCRIVE ALLA FINE DEL GESTO, non durante: `CanvasFlow` chiama qui su
   * `onNodeDragStop`, quindi un trascinamento è un `UPDATE` e non uno per fotogramma. Lo schermo
   * è già andato avanti da solo — la libreria muove il nodo mentre lo si trascina — e questa riga
   * porta la posizione dove vive davvero.
   */
  /**
   * FAR GIRARE UN NODO. `running` si accende SUBITO, prima di qualunque `await`: lo spinner non
   * deve aspettare un salvataggio precedente (un carattere digitato prima del clic, ancora in
   * coda) né la risposta del server. Il bottone si spegne di conseguenza (`canStartRun`).
   *
   * `enqueue` resta prima di leggere `before` e mandare la POST vera: scegliere un modello scrive
   * (`write`, sopra) e quella scrittura aggiorna `nodes[].version` in locale solo quando il
   * server risponde — scegliere e premere Genera di seguito, senza la pausa di una mano vera fra
   * i due gesti, altrimenti legge la versione di prima del giro e il server risponde 409 su un
   * prompt mai partito. Passare per la stessa coda del nodo mette la POST in fila dietro quella
   * scrittura invece di correrci contro — ma questo riguarda solo la POST, non lo spinner.
   */
  function runQuoteFor(ids: string[]): RunQuote | null {
    const row = ids.length === 1 ? nodes.find((n) => n.id === ids[0]) : undefined;
    const gen = row ? genOf(row) : null;
    if (!row || !gen) {
      return null;
    }

    const revision = textEstimateRevision(row.id);
    const estimate = textCostEstimates[row.id]?.revision === revision ? textCostEstimates[row.id] : undefined;
    const catalogueEntry = mediumCatalogue[gen.medium];

    return runQuoteOf({
      node: { ...gen, runs: runsByNode[row.id] ?? [] },
      choices: catalogueEntry.choices,
      hasUpstreamText: hasUpstreamTextByNode[row.id] ?? false,
      variableTextInput: estimate?.variableInput ?? (gen.medium === 'text' && revision !== '[]'),
      enhanceUnitCredits: catalogueEntry.enhanceUnitCredits,
      estimatedTextInputTokens: estimate?.inputTokens,
      estimatedTextOutputTokens: estimate?.outputTokens
    });
  }

  function runNode(id: string) {
    const row = nodes.find((n) => n.id === id);
    const gen = row ? genOf(row) : null;
    if (gen) {
      void run(id, gen);
    }
  }

  async function run(id: string, gen: GenNodeState) {
    if (gen.running) {
      return;
    }

    nodes = nodes.map((node) => (node.id === id ? { ...node, data: { ...node.data, ...genData(startRun(gen)) } } : node));

    await enqueue(id, async () => {});

    const before = nodes.find((node) => node.id === id);
    if (!before) {
      return;
    }

    pending += 1;

    const result = await post('run', {
      node_id: id,
      medium: gen.medium,
      prompt: gen.prompt,
      model: effectiveModel(gen.medium, gen.model, catalogue[gen.medium] ?? []) ?? '',
      params: JSON.stringify(gen.params),
      version: before.version
    });
    pending -= 1;

    if (!result) {
      // Il motivo VERO sta già scritto su `nodes.data` — `giveUp()` lo mette lì prima di
      // tornare. Un messaggio fisso qui lo coprirebbe con un «non riuscita» che non dice niente
      // di più di uno spinner che si ferma: `refresh()` lo riporta dal server, dove `GenNode` sa
      // già mostrarlo (`node.error`). Fino ad allora, lo stato ottimista si toglie da solo.
      nodes = nodes.map((node) => (node.id === id ? { ...node, data: { ...node.data, ...genData(unlockRun(gen)) } } : node));
      await refresh();
      void invalidate('app:credits');
      return;
    }

    await refresh();
    void invalidate('app:credits');
  }

  /**
   * IL LOOP: preventivo, poi conferma solo se serve, poi MESSA IN CODA — la stessa separazione di
   * `loop.ts`. Il preventivo (`loop_plan`) non spende, e chi guarda deve poter vedere quante
   * generazioni e quanti crediti PRIMA che il clic diventi irreversibile (CLAUDE.md). Sopra 50
   * combinazioni la conferma è nativa (`confirm()`): un modale su misura sarebbe più lavoro per
   * un percorso che, sopra la soglia, è già raro di suo.
   *
   * `run_loop` NON GIRA NIENTE — mette in coda e torna. Il progresso si vede nel nodo `list` di
   * output che compare accanto (item con `status: 'queued'` che diventano `done`/`failed` mano a
   * mano che il cron, ogni minuto, drena la coda): `refresh()` qui riporta quella lista appena
   * creata, e da lì in poi la realtime su `nodes`/`node_runs` (già pubblicata) aggiorna da sola.
   */
  async function runLoop(id: string) {
    const plan = await post('loop_plan', { node_id: id });
    if (!plan) return;

    const safety = plan.safety as { verdict: 'run' | 'confirm' | 'refuse'; count: number } | undefined;
    if (!safety || safety.verdict === 'refuse') {
      failed = `troppe combinazioni: dividi il loop`;
      return;
    }

    if (safety.verdict === 'confirm') {
      const cost = plan.cost as { total: number | null } | undefined;
      const costLabel = typeof cost?.total === 'number' ? `${formatCredits(cost.total)} crediti` : 'costo variabile';
      const ok = confirm(
        `Genera ${safety.count} combinazioni (${costLabel})? Verranno prodotte nei prossimi minuti, non subito.`
      );
      if (!ok) return;
    }

    await post('run_loop', { node_id: id, confirm: safety.verdict === 'confirm' ? '1' : '0' });
    await refresh();
    void invalidate('app:credits');
  }

  /** Ferma i biglietti non ancora reclamati da un tick — quelli già in corso finiscono, i
   *  risultati già pronti restano nella lista di output. */
  async function cancelLoopFor(id: string) {
    await post('cancel_loop', { node_id: id });
    await refresh();
  }

  /**
   * ESEGUI FLUSSO: stesso preventivo-poi-conferma del loop, ma su più nodi collegati invece di
   * una griglia di combinazioni. `run_workflow` mette in coda e torna: il cron
   * (`canvas/runs/tick`) drena i biglietti rispettando `dependsOn`, e la realtime su `nodes`
   * aggiorna da sola man mano che ognuno finisce.
   */
  let workflowId = $state<string | null>(null);
  let workflowNodeIds = $state<string[]>([]);

  async function runWorkflow(ids: string[]) {
    const plan = await post('workflow_plan', { node_id: ids });
    if (!plan) return;

    const ok = confirm(
      `${(plan.steps as unknown[]).length} passi, circa ${formatCredits(plan.estimatedCredits as number)} crediti. Avviare il flusso?`
    );
    if (!ok) return;

    const markRunning = (fn: (gen: GenNodeState) => GenNodeState) => {
      nodes = nodes.map((node) => {
        if (!ids.includes(node.id)) return node;
        const gen = genOf(node);
        return gen ? { ...node, data: { ...node.data, ...genData(fn(gen)) } } : node;
      });
    };

    markRunning(startRun);

    const result = await post('run_workflow', { node_id: ids });
    if (!result) {
      markRunning(unlockRun);
      return;
    }

    workflowId = result.workflowId as string;
    workflowNodeIds = ids;
    await refresh();
    void invalidate('app:credits');
  }

  const workflowRunning = $derived(
    workflowId !== null &&
      nodes.some((node) => workflowNodeIds.includes(node.id) && genOf(node)?.running)
  );

  $effect(() => {
    if (workflowId !== null && !workflowRunning) {
      workflowId = null;
      workflowNodeIds = [];
    }
  });

  async function stopWorkflow() {
    if (!workflowId) return;
    await post('cancel_workflow', { workflow_id: workflowId });
    workflowId = null;
    workflowNodeIds = [];
    await refresh();
  }

  /** Ritenta UN item fallito di una lista che è output di un loop — subito, non in coda
   *  (`loop.ts::retryLoopCombination`): il server rilegge i valori dell'iterazione dal biglietto
   *  originale in `node_runs`, questa funzione passa solo cosa identifica quale item. */
  async function retryLoopItem(listNodeId: string, list: ListNodeState, genNodeId: string, index: number) {
    const item = list.items[index];
    if (!item) return;

    await post('retry_loop_combo', {
      node_id: genNodeId,
      output_list_node_id: listNodeId,
      label: item.label ?? '',
      run_id: item.run_id ?? ''
    });
    await refresh();
    void invalidate('app:credits');
  }

  /**
   * SBLOCCARE UNA CORSA CHE NON TORNA. Ottimista come il trascinamento: subito spento sullo
   * schermo, e scritto solo alla fine — il nodo altrimenti resterebbe «in corso» a vita quando
   * il provider non risponde più o la scheda è stata chiusa a metà giro.
   */
  /** Rimettere in vetrina un giro di prima: lo decide il server, che sa quale asset è quel giro. */
  async function restore(id: string, gen: GenNodeState, runId: string) {
    const hit = (runsByNode[id] ?? []).find((r) => r.id === runId);
    if (hit?.mediaId) {
      nodes = nodes.map((node) =>
        node.id === id
          ? { ...node, data: { ...node.data, refId: hit.mediaId, running: false, error: null } }
          : node
      );
    }
    await post('restore', { node_id: id, run_id: runId });
    await refresh();
  }

  /**
   * SINCRONIZZARE UN NODO `products` O `social_account_feed`. Ottimista sullo stato — "sta
   * scaricando" appare subito — ma il risultato lo scrive il server: qui non c'è modo di sapere
   * quanti prodotti o post sono arrivati prima che risponda.
   */
  async function sync(id: string) {
    const before = nodes.find((node) => node.id === id);
    if (!before) { return; }

    nodes = nodes.map((node) => (node.id === id ? { ...node, data: { ...node.data, sync_status: 'running' } } : node));
    pending += 1;

    const result = await post('sync', { node_id: id, version: before.version });
    pending -= 1;

    if (!result) {
      await refresh();
      return;
    }

    await refresh();
  }

  async function unlock(id: string) {
    const before = nodes.find((node) => node.id === id);
    if (!before) {
      return;
    }

    const data = { ...before.data, running: false, error: null };
    nodes = nodes.map((node) => (node.id === id ? { ...node, data } : node));
    await write(id, data);
  }

  async function move(id: string, x: number, y: number) {
    const before = nodes.find((node) => node.id === id);
    nodes = nodes.map((n) => (n.id === id ? { ...n, x, y } : n));

    const result = await post('move', { node_id: id, x, y });
    if (!result && before) {
      nodes = nodes.map((node) => node.id === id ? { ...node, x: before.x, y: before.y } : node);
    }
  }

  /**
   * RIDIMENSIONARE: STESSA FORMA DI `move` — ottimista, last-write-wins, nessuna voce nello stack
   * di undo (lo spostamento non ne ha una propria sulla taglia, e `MoveGesture` porta solo
   * `x`/`y`). Scrive `userHeight`: da qui in poi `tileHeight` prende QUESTA misura, non più
   * quella calcolata da `grownTextNodeHeight` — un ridimensionamento a mano vince sulla crescita
   * automatica, la stessa regola già scritta in `text-node-grow.ts`.
   */
  async function resize(id: string, w: number, h: number) {
    const before = nodes.find((node) => node.id === id);
    nodes = nodes.map((n) => (n.id === id ? { ...n, w, h, userHeight: h } : n));

    const result = await post('resize', { node_id: id, width: w, height: h });
    if (!result && before) {
      nodes = nodes.map((node) => (node.id === id ? { ...node, w: before.w, h: before.h, userHeight: before.userHeight } : node));
    }
  }

  /**
   * IL CONTENUTO PASSA DALLA VERSIONE, e un conflitto non si ignora: il server risponde 409
   * quando qualcun altro ha scritto per primo, e qui si dice invece di credere di aver salvato.
   * La versione che torna sostituisce quella che si aveva, o la scrittura dopo fallirebbe uguale.
   */
  /**
   * UNA SCRITTURA PER GESTO, non per fotogramma: il client chiama qui quando il trascinamento
   * finisce. Il repository è last-write-wins apposta — due mani sullo stesso nodo si contendono
   * il puntatore, e nessuna delle due perde lavoro scritto.
   */
  async function share(id: string, on: boolean): Promise<{ url: string } | null> {
    const result = await post('share', { node_id: id, on: on ? 'true' : 'false' });
    if (!result) {
      return null;
    }

    nodes = nodes.map((node) =>
      node.id === id ? { ...node, data: { ...node.data, public: on } } : node
    );

    if (!on) {
      return { url: '' };
    }

    const url = shareUrlOf(window.location.origin, typeof result.path === 'string' ? result.path : null);
    return url ? { url } : null;
  }

  async function saveNode(id: string, patch: Record<string, unknown>, base: Record<string, unknown>): Promise<WriteOutcome> {
    pending += 1;
    snapshotVersion += 1;
    try {
      const out = await writeWithRetry({
        send: (changed, believed) =>
          send('write', { node_id: id, patch: JSON.stringify(changed), base: JSON.stringify(believed) }),
        reread: async () => {
          const snapshot = await send('snapshot', {});
          const rows = ((snapshot.data ?? {}) as { nodes?: CanvasNodeRecord[] }).nodes ?? [];
          return rows.find((node) => node.id === id)?.data ?? null;
        },
        patch,
        base
      });
      if (out.ok) {
        failed = null;
        failedIsCreditsExhausted = false;
        return out;
      }
      announce('write', out.reason, out.detail);
      return out;
    } finally {
      pending -= 1;
      snapshotVersion += 1;
    }
  }

  async function write(id: string, patch: Record<string, unknown>): Promise<boolean> {
    const current = nodes.find((node) => node.id === id);
    if (!current) { return false; }
    const next = { ...current.data, ...patch };
    const change = diffNodeData(current.data, next, Object.keys(patch));
    nodes = nodes.map((node) => node.id === id ? { ...node, data: next } : node);
    pending += 1;
    let saved = false;
    await enqueue(id, async () => {
      const before = nodes.find((node) => node.id === id);
      if (!before) { pending -= 1; return; }
      if (!Object.keys(change).length) {
        pending -= 1;
        saved = true;
        return;
      }
      const out = await saveNode(id, change, baseOf(before.saved, change));
      pending -= 1;
      if (!out.ok) {
        return;
      }
      saved = true;
      const written = out.node;
      nodes = nodes.map((node) => node.id === id ? { ...node, data: written.data, saved: written.data, version: written.version } : node);
      pushGesture({
        items: [
          {
            kind: 'node.update',
            nodeId: id,
            before: { data: current.data },
            after: { data: next },
            expectedVersion: current.version
          }
        ]
      });
      if (!pending) { void refresh(); }
    });
    return saved;
  }

  function changeGen(id: string, gen: GenNodeState, patch: Partial<GenNodeState>) {
    if (typeof patch.prompt === 'string') {
      const next = { ...textCostEstimates };
      delete next[id];
      textCostEstimates = next;
    }
    void write(id, genData({ ...gen, ...patch }));
  }

  async function estimateTextCost(id: string, prompt: string, model: string, revision: string) {
    const result = await post('estimate_text_cost', { node_id: id, prompt, model });
    const outputTokens = result?.estimatedOutputTokens;
    const systemTokens = result?.systemPromptTokens;
    const userTokens = result?.userPromptTokens;
    const current = nodes.find((node) => node.id === id);
    const currentGen = current ? genOf(current) : null;
    const currentModel = currentGen
      ? effectiveModel(currentGen.medium, currentGen.model, catalogue[currentGen.medium] ?? []) ?? ''
      : '';
    if (
      typeof outputTokens !== 'number' ||
      typeof systemTokens !== 'number' ||
      typeof userTokens !== 'number' ||
      currentGen?.prompt !== prompt ||
      currentModel !== model ||
      textEstimateRevision(id) !== revision
    ) {
      return;
    }

    textCostEstimates = {
      ...textCostEstimates,
      [id]: {
        inputTokens: systemTokens + userTokens,
        outputTokens,
        variableInput: result?.variableInput === true,
        revision
      }
    };
  }

  /**
   * Una linea NON si disegna prima che il server la restituisca: con un id inventato si finirebbe
   * per averla due volte appena la vera arriva. Il verso l'ha già scelto la tela guardando i due
   * estremi — `edgeKindsFor` — e qui si salva quello, non un `derives_from` fisso.
   */
  async function connect(source: string, target: string, kind: CanvasEdgeKind, targetHandle: ConnectorType | null) {
    const res = await post('connect', {
      source_node_id: source,
      target_node_id: target,
      kind,
      ...(targetHandle ? { target_handle: targetHandle } : {})
    });

    const created = (res?.connection ?? null) as Connection | null;
    if (!created) {
      return;
    }

    edges = [...edges.filter((edge) => edge.id !== created.id), toEdge(created)];
    pushGesture({
      items: [{ kind: 'edge.create', edgeId: created.id, sourceNodeId: created.sourceNodeId, targetNodeId: created.targetNodeId }]
    });
  }

  /**
   * "COLLEGA A NUOVO…": un nodo del tipo scelto nasce a destra della selezione, GIÀ CON UN
   * MODELLO — il primo del catalogo per quel medium — perché senza modello un nodo `image`/`video`
   * non ha porte (`portsOfTile`, sopra: `!choice` → `[]`), e il piano di collegamento
   * troverebbe zero connettori su un nodo appena nato. Il piano stesso (`planConnectSelection`) è
   * lo stesso che decide un collegamento a un nodo ESISTENTE (`connectExisting`, sotto): la
   * domanda "quale porta per quale sorgente" non cambia perché il bersaglio è appena nato.
   */
  async function connectNew(ids: string[], medium: GenMedium, at: { x: number; y: number }, prompt = '') {
    const sources: ConnectSource[] = nodes
      .filter((n) => ids.includes(n.id))
      .map((n) => ({ id: n.id, type: n.type }));
    if (!sources.length) { return; }

    const model = effectiveModel(medium, null, catalogue[medium] ?? []);
    const modalities = model ? { input: catalogue[medium].find((c) => c.id === model)?.inputModalities ?? [] } : { input: [] };

    const { w, h } = genNodeSize(medium);
    const created = await post('create', {
      type: medium,
      x: at.x - w / 2,
      y: at.y - h / 2,
      data: JSON.stringify({ ...newNodeRow(medium), model, ...(prompt ? { prompt } : {}) })
    });
    const node = (created?.node ?? null) as CanvasNodeRecord | null;
    if (!node) { return; }

    nodes = [...nodes.filter((n) => n.id !== node.id), toTile(node, { select: true })];
    const items: UndoItem[] = [{ kind: 'node.create', nodeId: node.id, after: { type: node.type, position: node.position, data: node.data } }];

    const plan = planConnectSelection({ sources, target: { kind: medium, modalities } });
    for (const wire of plan.wires) {
      const res = await post('connect', {
        source_node_id: wire.sourceId,
        target_node_id: node.id,
        kind: 'derives_from',
        target_handle: wire.connector
      });
      const connection = (res?.connection ?? null) as Connection | null;
      if (connection) {
        edges = [...edges.filter((e) => e.id !== connection.id), toEdge(connection)];
        items.push({ kind: 'edge.create', edgeId: connection.id, sourceNodeId: connection.sourceNodeId, targetNodeId: connection.targetNodeId });
      }
    }
    if (plan.rejected.length) {
      failed = `Non collegato: ${plan.rejected.map((r) => r.why).join('; ')}`;
    }
    pushGesture({ items });
  }

  /**
   * "COLLEGA A…": la stessa domanda di `connectNew`, su un nodo che c'è già — le sue porte vengono
   * dal SUO modello attuale, non da uno appena scelto.
   */
  async function connectExisting(ids: string[], targetId: string) {
    const target = nodes.find((n) => n.id === targetId);
    if (!target || (target.type !== 'text' && target.type !== 'image' && target.type !== 'video')) {
      failed = 'Questo nodo non riceve collegamenti';
      return;
    }

    const sources: ConnectSource[] = nodes
      .filter((n) => ids.includes(n.id) && n.id !== targetId)
      .map((n) => ({ id: n.id, type: n.type }));
    if (!sources.length) { return; }

    const model = typeof target.data.model === 'string' ? target.data.model : null;
    const choice = model ? catalogue[target.type]?.find((c) => c.id === model) : null;
    const modalities = { input: choice?.inputModalities ?? [] };

    const plan = planConnectSelection({ sources, target: { kind: target.type, modalities } });
    const items: UndoItem[] = [];
    for (const wire of plan.wires) {
      const res = await post('connect', {
        source_node_id: wire.sourceId,
        target_node_id: targetId,
        kind: 'derives_from',
        target_handle: wire.connector
      });
      const connection = (res?.connection ?? null) as Connection | null;
      if (connection) {
        edges = [...edges.filter((e) => e.id !== connection.id), toEdge(connection)];
        items.push({ kind: 'edge.create', edgeId: connection.id, sourceNodeId: connection.sourceNodeId, targetNodeId: connection.targetNodeId });
      }
    }
    if (plan.rejected.length) {
      failed = `Non collegato: ${plan.rejected.map((r) => r.why).join('; ')}`;
    }
    if (items.length) { pushGesture({ items }); }
  }

  let confirmingUncensoredSwitch = $state(false);
  let resolveUncensoredSwitch: ((ok: boolean) => void) | null = null;

  function confirmUncensoredSwitch(): Promise<boolean> {
    confirmingUncensoredSwitch = true;
    return new Promise((resolve) => {
      resolveUncensoredSwitch = resolve;
    });
  }

  function settleUncensoredSwitch(ok: boolean) {
    resolveUncensoredSwitch?.(ok);
    resolveUncensoredSwitch = null;
  }

  function onUncensoredSwitchConfirmed() {
    settleUncensoredSwitch(true);
  }

  $effect(() => {
    if (!confirmingUncensoredSwitch) {
      untrack(() => settleUncensoredSwitch(false));
    }
  });

  /**
   * LA BARRA DELLA SELEZIONE HA SCRITTO — un campo, applicato a ogni nodo selezionato, UNO o
   * MOLTI: con un nodo solo è la stessa funzione, non un percorso a parte, perché la domanda «un
   * arco cade con questo modello?» (`orphanedByModelChange`) vale uguale se il nodo scelto è uno
   * o cinque. La conferma va chiesta PRIMA, guardando OGNI nodo selezionato — cambiare modello e
   * scoprire dopo che un arco è appena sparito sarebbe la sorpresa che quella funzione esiste per
   * evitare.
   *
   * UN GESTO SOLO — quanti nodi cambiano e quanti fili cadono, la stessa regola con un nodo o con
   * cinque: annullarlo a metà (un nodo tornato al vecchio modello, un altro no, o un filo che non
   * è tornato) è peggio di non annullare niente.
   */
  async function commonChange(
    ids: string[],
    patch: {
      model?: string | null;
      aspectRatio?: string;
      duration?: number;
      resolution?: string;
      audio?: boolean;
      enhancePrompt?: boolean;
      repeat?: number;
      /** I campi dichiarati da `ai_models.param_schema` che il toolbar generico scrive — un solo
       *  bucket dinamico, invece di un campo esplicito per ogni nome di parametro possibile. */
      dynamicParams?: Record<string, unknown>;
    }
  ) {
    const chosen = nodes.filter((n) => ids.includes(n.id));
    if (!chosen.length) { return; }

    const droppedEdges: UndoItem[] = [];
    const clearedReferenceIds: string[] = [];

    if (patch.model !== undefined) {
      const uncensoredTargets = chosen.filter((n) => {
        if (n.type !== 'text' && n.type !== 'image' && n.type !== 'video') { return false; }
        const model = catalogue[n.type]?.find((c) => c.id === patch.model);
        const hasIncomingEdges = edges.some((e) => e.target === n.id);
        const hasReferences = referencesOf(n.data).length > 0;
        return needsUncensoredConfirm({ nextUncensored: model?.uncensored === true, hasIncomingEdges, hasReferences });
      });

      if (uncensoredTargets.length && !(await confirmUncensoredSwitch())) {
        return;
      }
      clearedReferenceIds.push(...uncensoredTargets.map((n) => n.id));

      const orphaned = chosen.flatMap((n) => {
        if (n.type !== 'text' && n.type !== 'image' && n.type !== 'video') { return []; }
        const model = catalogue[n.type]?.find((c) => c.id === patch.model);
        const nextConnectors = connectorsFor(n.type, { input: model?.inputModalities ?? [], uncensored: model?.uncensored });
        const wired: { edgeId: string; sourceNodeId: string; connector: ConnectorType }[] = edges
          .filter((e) => e.target === n.id && e.targetHandle)
          .map((e) => ({ edgeId: e.id, sourceNodeId: e.source, connector: e.targetHandle as ConnectorType }));
        return orphanedByModelChange(wired, nextConnectors);
      });

      if (orphaned.length && !uncensoredTargets.length && !confirm(`${orphaned.length} collegamento/i cadranno con questo modello. Continuare?`)) {
        return;
      }
      for (const drop of orphaned) {
        const item = await disconnect(drop.edgeId, false);
        if (item) { droppedEdges.push(item); }
      }
      for (const nodeId of clearedReferenceIds) {
        await write(nodeId, { references: [] });
      }
    }

    const { model, dynamicParams, ...params } = patch;
    const hasParams = Object.values(params).some((v) => v !== undefined) || !!dynamicParams;
    const items = chosen.map((n) => {
      const nextParams = { ...(n.data.params as Record<string, unknown>), ...params, ...dynamicParams };

      // Un modello nuovo può non fare più il gradino di durata o la risoluzione salvati: si
      // scivola al più vicino fra quelli che offre — mai una durata o un token di risoluzione che
      // quel modello rifiuta (`happyhorse-1.0` non fa 480p, `video_renders` cb1de6e2).
      if (model !== undefined && n.type === 'video') {
        const nextModel = catalogue.video?.find((c) => c.id === model);
        const options = nextModel?.durationOptions;
        const savedDuration = (n.data.params as Record<string, unknown> | undefined)?.duration;
        if (options?.length && typeof savedDuration === 'number') {
          nextParams.duration = nearestVideoDuration(options, savedDuration);
        }
        if (nextModel) {
          const savedResolution = (n.data.params as Record<string, unknown> | undefined)?.resolution as
            | string
            | undefined;
          const resolution = snapResolution(nextModel, savedResolution);
          if (resolution) {
            nextParams.resolution = resolution;
          } else {
            delete nextParams.resolution;
          }
        }
      }

      // Stesso scivolamento per l'immagine: Seedream 5 Lite offre [2K,4K], Seedream 5 Pro [1K,2K]
      // — una risoluzione salvata che il modello appena scelto non fa più va al suo default, mai
      // spedita così com'è.
      if (model !== undefined && n.type === 'image') {
        const nextModel = catalogue.image?.find((c) => c.id === model);
        if (nextModel) {
          const savedResolution = (n.data.params as Record<string, unknown> | undefined)?.resolution as
            | string
            | undefined;
          const resolution = snapResolution(nextModel, savedResolution);
          if (resolution) {
            nextParams.resolution = resolution;
          } else {
            delete nextParams.resolution;
          }
        }
      }

      // I campi dinamici (`quality`, `output_compression`…) seguono lo stesso scivolamento della
      // risoluzione, sul modello che dichiara loro: un nome che il modello nuovo non conosce più
      // sparisce, un valore fuori dal suo elenco scivola al primo valido — mai un token che il
      // provider appena scelto rifiuta.
      if (model !== undefined && (n.type === 'image' || n.type === 'video')) {
        const nextModel = catalogue[n.type]?.find((c) => c.id === model);
        const savedParams = (n.data.params as Record<string, unknown> | undefined) ?? {};
        const dynamic = nextParams as unknown as Record<string, unknown>;
        const snapped = snapDynamicParams(nextModel?.params ?? [], { ...savedParams, ...dynamic });
        for (const declared of nextModel?.params ?? []) {
          if (declared.name in snapped) {
            dynamic[declared.name] = snapped[declared.name];
          } else {
            delete dynamic[declared.name];
          }
        }
      }

      return {
        node_id: n.id,
        version: n.version,
        patch: hasParams || model !== undefined
          ? { ...(model !== undefined ? { model } : {}), params: nextParams }
          : patch
      };
    });

    const result = await post('batchWrite', { items: JSON.stringify(items) });
    const results = (result?.results ?? []) as { nodeId: string; outcome: string; node?: CanvasNodeRecord }[];
    const conflicts = results.filter((r) => r.outcome === 'conflict');
    if (conflicts.length) {
      failed = `${conflicts.length} nodo/i non salvati: modificati da qualcun altro nel frattempo`;
    }

    const written = results.filter((r) => r.outcome === 'written' && r.node).map((r) => r.node as CanvasNodeRecord);
    if (written.length) {
      const byId = new Map(written.map((n) => [n.id, n]));
      nodes = nodes.map((n) => (byId.has(n.id) ? toTile(byId.get(n.id)!) : n));
    }

    const writeItems: UndoItem[] = results
      .filter((r) => r.outcome === 'written' && r.node)
      .map((r) => {
        const before = chosen.find((n) => n.id === r.nodeId)!;
        const node = r.node as CanvasNodeRecord;
        return { kind: 'node.update', nodeId: r.nodeId, before: { data: before.data }, after: { data: node.data }, expectedVersion: before.version };
      });

    if (droppedEdges.length || writeItems.length) {
      pushGesture({ items: [...droppedEdges, ...writeItems] });
    }
  }

  /**
   * Una linea tolta sparisce subito e torna se il server rifiuta: l'attesa qui si vedrebbe.
   *
   * `recordUndo` È SPENTO quando chi chiama fa parte di un gesto più grande — il cambio di
   * modello di `commonChange`, sotto, che sgancia N fili come parte di UN SOLO Ctrl+Z: spingere
   * qui un gesto a testa lo spezzerebbe in N+1, e annullarne uno solo lascerebbe il modello
   * cambiato con un filo tornato e gli altri no.
   */
  async function disconnect(connectionId: string, recordUndo = true): Promise<UndoItem | null> {
    const removed = edges.find((e) => e.id === connectionId);
    if (!removed) {
      return null;
    }

    edges = edges.filter((e) => e.id !== connectionId);

    const done = await post('disconnect', { connection_id: connectionId });
    if (!done) {
      edges = [...edges, removed];
      return null;
    }

    const item: UndoItem = { kind: 'edge.delete', edgeId: removed.id, sourceNodeId: removed.source, targetNodeId: removed.target };
    if (recordUndo) { pushGesture({ items: [item] }); }
    return item;
  }

  /** Fisso o iterate — ottimista come ogni altro campo della linea: subito sullo schermo, e
   *  ripristinato se il server rifiuta (l'arco è caduto nel frattempo, o non è più di quest'org). */
  async function setEdgeMode(connectionId: string, mode: WireMode) {
    const before = edges.find((e) => e.id === connectionId)?.mode;
    edges = edges.map((e) => (e.id === connectionId ? { ...e, mode } : e));

    const done = await post('set_edge_mode', { connection_id: connectionId, mode });
    if (!done) {
      edges = edges.map((e) => (e.id === connectionId ? { ...e, mode: before } : e));
    }
  }

  /**
   * LE TILE TOLTE. `planDelete` dice cosa cade con loro — le linee verso un nodo che sparisce
   * resterebbero disegnate verso il vuoto fino al ricarico.
   *
   * Sparisce subito e torna se il server rifiuta: su una tela si lavora a gesti, e un nodo che
   * resta lì mezzo secondo dopo ⌫ fa premere ⌫ una seconda volta.
   */
  async function remove(ids: string[]) {
    const plan = planDelete({ ids, edges, undeletable: [] });
    if (plan.empty) {
      return;
    }

    const goneNodes = nodes.filter((n) => plan.itemIds.includes(n.id));
    const goneEdges = edges.filter((e) => plan.edgeIds.includes(e.id));

    nodes = nodes.filter((n) => !plan.itemIds.includes(n.id));
    edges = edges.filter((e) => !plan.edgeIds.includes(e.id));

    const done = await post('remove', {
      node_ids: plan.itemIds.join(','),
      connection_ids: plan.edgeIds.join(',')
    });
    if (!done) {
      nodes = [...nodes, ...goneNodes];
      edges = [...edges, ...goneEdges];
      return;
    }

    pushGesture({
      items: [
        ...goneEdges.map((e): UndoItem => ({ kind: 'edge.delete', edgeId: e.id, sourceNodeId: e.source, targetNodeId: e.target })),
        ...goneNodes.map((n): UndoItem => ({
          kind: 'node.delete',
          nodeId: n.id,
          before: { type: n.type, position: { x: n.x, y: n.y, z: 0 }, size: { width: n.w, height: n.h }, data: n.data, version: n.version }
        }))
      ]
    });
  }

  /**
   * ⌘D: duplica la selezione. Il server rilegge le righe VERE da `nodeIds` — la copia non fida
   * dello stato del client, che potrebbe avere una posizione o un contenuto non ancora salvato —
   * e restituisce nodi e linee già nati, pronti per lo stesso `toTile`/`toEdge` di ogni altra
   * creazione. Niente ottimismo qui: un duplicato che compare e poi sparisce (il server rifiuta)
   * è più confuso di un'attesa breve, e a differenza di un `move` non c'è "prima" a cui tornare.
   */
  /**
   * ⌘D/⌘V: UN GESTO SOLO, anche se sono N nodi e M archi nati insieme — annullarne metà (i nodi
   * tornano al vuoto ma un arco fra loro resta) è peggio di non annullare niente, la stessa
   * regola del cambio di modello che sgancia connessioni.
   */
  function createManyGesture(created: CanvasNodeRecord[], connected: Connection[]): Gesture {
    return {
      items: [
        ...created.map((n): UndoItem => ({ kind: 'node.create', nodeId: n.id, after: { type: n.type, position: n.position, data: n.data } })),
        ...connected.map((c): UndoItem => ({ kind: 'edge.create', edgeId: c.id, sourceNodeId: c.sourceNodeId, targetNodeId: c.targetNodeId }))
      ]
    };
  }

  async function duplicate(ids: string[]) {
    const result = await post('duplicate', { node_ids: ids.join(',') });
    const created = (result?.nodes ?? []) as CanvasNodeRecord[];
    const connected = (result?.connections ?? []) as Connection[];
    if (created.length) { nodes = [...nodes, ...created.map((n) => toTile(n, { select: true }))]; }
    if (connected.length) { edges = [...edges, ...connected.map(toEdge)]; }
    if (created.length) { pushGesture(createManyGesture(created, connected)); }
  }

  /**
   * ⌘C: gli APPUNTI SONO DI QUESTA TELA, in memoria — non del sistema operativo. Un `Ctrl+V` reale
   * del browser non saprebbe cosa incollare (che forma avrebbe un nodo `image` fuori da qui?), e
   * l'unico consumatore di questo copia è lo stesso ⌘V di `shortcuts.ts`. Portano `type`/`data`
   * intatti — l'incolla li rivalida comunque (`validateNodeData`, lato server) — e le posizioni
   * RELATIVE al centro della selezione: incollare altrove, o su un'altra tela della stessa org,
   * deve posare il gruppo dov'è il puntatore, non dov'era quando è stato copiato.
   */
  type Clipboard = {
    nodes: { type: string; data: Record<string, unknown>; dx: number; dy: number }[];
    edges: { sourceIndex: number; targetIndex: number; sourceHandle: string | null; targetHandle: string | null }[];
  };
  let clipboard = $state<Clipboard | null>(null);

  function copy(ids: string[]) {
    const chosen = nodes.filter((n) => ids.includes(n.id));
    if (!chosen.length) { return; }

    const indexOf = new Map(chosen.map((n, i) => [n.id, i]));
    const cx = chosen.reduce((sum, n) => sum + n.x, 0) / chosen.length;
    const cy = chosen.reduce((sum, n) => sum + n.y, 0) / chosen.length;

    clipboard = {
      nodes: chosen.map((n) => ({ type: n.type, data: n.data, dx: n.x - cx, dy: n.y - cy })),
      edges: edges
        .filter((e) => indexOf.has(e.source) && indexOf.has(e.target))
        .map((e) => ({
          sourceIndex: indexOf.get(e.source)!,
          targetIndex: indexOf.get(e.target)!,
          // Il verso viaggia su `source_handle` (vedi `connect`, sopra): `kind` è la stessa cosa
          // letta dal lato del client, che `toEdge` ha già tradotto all'ingresso.
          sourceHandle: e.kind,
          targetHandle: e.targetHandle ?? null
        }))
    };
  }

  /** ⌘V: quel che `copy` ha in mano, riposato attorno al punto dato — vuoto se non si è mai copiato. */
  async function paste(at: { x: number; y: number }) {
    if (!clipboard) { return; }

    const result = await post('paste', {
      nodes: JSON.stringify(clipboard.nodes.map((n) => ({ type: n.type, data: n.data, x: at.x + n.dx, y: at.y + n.dy }))),
      edges: JSON.stringify(clipboard.edges)
    });
    const created = (result?.nodes ?? []) as CanvasNodeRecord[];
    const connected = (result?.connections ?? []) as Connection[];
    if (created.length) { nodes = [...nodes, ...created.map((n) => toTile(n, { select: true }))]; }
    if (connected.length) { edges = [...edges, ...connected.map(toEdge)]; }
    if (created.length) { pushGesture(createManyGesture(created, connected)); }
  }

  /**
   * ⌘Z / ⇧⌘Z: UNA SOLA AZIONE SERVER PER ENTRAMBI — annullare un gesto e ripeterne uno annullato
   * sono la STESSA domanda a `undoGesture` (lato server): applica le inverse del gesto che riceve
   * e restituisce IL GESTO CHE ANNULLA QUELLO — che per un redo è di nuovo un gesto da poter
   * annullare, con la versione che QUESTA scrittura ha lasciato, non quella di prima. Per questo
   * chi chiama non rimette da sé il gesto appena tolto sul lato opposto: aspetta quello che il
   * server restituisce (`onAccepted`) e spinge quello.
   *
   * UN RIFIUTO (409, un collega ha toccato lo stesso nodo) NON SPINGE NIENTE: le premesse del
   * gesto sono già cadute, e rimetterlo in circolo lo farebbe fallire di nuovo nello stesso modo
   * — `failed` dice perché, in chiaro.
   */
  async function applyUndo(gesture: Gesture, onAccepted: (redo: Gesture) => void) {
    const result = await post('undo', { items: JSON.stringify(gesture.items) });
    if (!result) {
      failed = 'Annullamento non riuscito: riprova';
      return;
    }
    if (result.outcome !== 'undone') {
      const reason = typeof result.reason === 'string' ? result.reason : 'un altro ha già cambiato questo nodo';
      failed = `Annullamento saltato: ${reason}`;
      return;
    }
    await refresh();
    const redo = result.redo as Gesture | undefined;
    if (redo) { onAccepted(redo); }
  }

  /**
   * ANNULLARE UNO SPOSTAMENTO NON PASSA DAL SERVER — `moveNode` è last-write-wins, senza
   * `canvas_events`, quindi non c'è un `undo` a cui chiedere: la scrittura è la stessa `move()`
   * ordinaria, verso `before`. LA REGOLA DELL'ALTRO UTENTE È QUI, NON LATO SERVER: `nodes` è già
   * tenuto fresco dal canale realtime (`onChange` → `refresh()`), quindi la posizione ATTUALE che
   * `checkMoveGesture` guarda è quella vera, non quella che questa scheda ricordava. Se un collega
   * ha trascinato lo stesso nodo nel frattempo, la posizione fresca non è più `item.after`, e il
   * gesto — INTERO, non nodo per nodo — si rifiuta con lo stesso messaggio di un rifiuto server.
   */
  async function applyMoveUndo(gesture: MoveGesture, onAccepted: (redo: MoveGesture) => void) {
    const currentOf = (nodeId: string) => {
      const node = nodes.find((n) => n.id === nodeId);
      return node ? { x: node.x, y: node.y } : null;
    };

    const check = checkMoveGesture(gesture, currentOf);
    if (check.outcome === 'stale') {
      failed = `Annullamento saltato: ${check.reason}`;
      return;
    }

    for (const item of gesture.items) {
      await move(item.nodeId, item.before.x, item.before.y);
    }
    onAccepted(inverseMoveGesture(gesture));
  }

  async function undo() {
    const entry = undoStack.popUndo();
    if (!entry) { return; }
    if (entry.source === 'move') {
      await applyMoveUndo(entry.gesture, (redo) => undoStack.pushRedo({ source: 'move', gesture: redo }));
      return;
    }
    await applyUndo(entry.gesture, (redo) => undoStack.pushRedo({ source: 'server', gesture: redo }));
  }

  async function redo() {
    const entry = undoStack.popRedo();
    if (!entry) { return; }
    if (entry.source === 'move') {
      await applyMoveUndo(entry.gesture, (redo) => undoStack.pushUndo({ source: 'move', gesture: redo }));
      return;
    }
    await applyUndo(entry.gesture, (redo) => undoStack.pushUndo({ source: 'server', gesture: redo }));
  }

  /**
   * LA FINE DI UN TRASCINAMENTO: `before` viene da `nodes` COSÌ COM'ERA PRIMA di questa funzione
   * toccarlo — `move()`, chiamata dopo, scrive `after` sia sullo schermo che sul server, quindi
   * `before` va letto PRIMA di quel giro, non dentro. Un solo gesto per l'intero trascinamento,
   * anche quando sposta cinque tile insieme: annullarne una sola lascerebbe le altre quattro dove
   * un peer non le ha mai spostate.
   */
  async function moveEnd(moves: { id: string; x: number; y: number }[]) {
    const gesture = buildMoveGesture(
      moves.map((m) => ({ nodeId: m.id, after: { x: m.x, y: m.y } })),
      (nodeId) => {
        const node = nodes.find((n) => n.id === nodeId);
        return node ? { x: node.x, y: node.y } : null;
      }
    );
    if (!gesture) { return; }

    undoStack.push({ source: 'move', gesture });
  }

  /**
   * IL VERSO DI UNA LINEA CHE C'È GIÀ non si corregge: sta su `source_handle`, e cambiarlo vuol
   * dire riscrivere la riga — una funzione che il repository non ha. Finché non c'è, `onEdgeRetype`
   * resta staccato e la linea si toglie e si rifà: un menù che non salva è peggio del menù che
   * manca.
   *
   * I MODELLI ARRIVANO DAL CATALOGO del server (`canvasModelCatalogue`), un menù per medium:
   * il testo è l'intero listino del gateway, immagine e video portano i limiti del modello.
   * «Genera» resta spento finché non c'è chi esegue il giro (fase 3).
   */
</script>

<svelte:head><title>feega — {data.canvas.name}</title></svelte:head>

<div class="canvas">
  {#if peers.length}
    <div class="peers" aria-label="Persone sulla tela">{peers.map((peer) => peer.name).join(', ')}</div>
  {/if}
  {#if failed}
    <!-- Un salvataggio perso in silenzio si scopre alla prossima apertura, quando quel che si era
         scritto non c'è più e nessuno sa perché. -->
    <p class="warning" role="alert">
      {failed}
      {#if failedIsCreditsExhausted}
        <a href={billingPath(data.projectId)}>Buy credits</a>
      {/if}
    </p>
  {/if}
  {#if workflowRunning}
    <div class="workflow-chip" role="status">
      Flusso in corso
      <button type="button" onclick={stopWorkflow}>Ferma</button>
    </div>
  {/if}

  <ConfirmDialog
    bind:open={confirmingUncensoredSwitch}
    title="Uncensored model"
    body="Uncensored models don't accept references. Switching removes the incoming connections and picked references on this node."
    confirmLabel="Switch model"
    cancelLabel="Cancel"
    onConfirm={onUncensoredSwitchConfirmed}
  />

  <CanvasFlow
    actionUrl={(action: string) => canvasActionUrl({ projectId: data.projectId, canvasId: data.canvas.id }, action)}
    {tiles}
    {edges}
    onMove={move}
    onMoveEnd={moveEnd}
    onTileDragOver={highlightDay}
    onTileDrop={dropOnDay}
    onResize={resize}
    onConnect={connect}
    onDelete={remove}
    onEdgeDelete={disconnect}
    onEdgeModeChange={setEdgeMode}
    onCreate={create}
    onCreateFilled={createFilled}
    onUpload={upload}
    onDuplicate={duplicate}
    onPromote={handlePromote}
    onCopy={copy}
    onPaste={paste}
    onUndo={undo}
    onRedo={redo}
    onConnectNew={connectNew}
    onConnectExisting={connectExisting}
    onRunWorkflow={runWorkflow}
    {runQuoteFor}
    onRunNode={runNode}
    {nodeSummaries}
    {modelChoicesFor}
    catalogueSyncedFor={(type) => mediumCatalogue[type].synced}
    onPropertyChange={commonChange}
    onSelectionChange={selectionChanged}
  >
    {#snippet tile({ id, selected })}
      {@const row = nodes.find((n) => n.id === id)}
      {#if row}
        {@const gen = genOf(row)}
        {@const frame = frameOf(row)}
        {@const doc = docOf(row)}
        {@const catalog = productsOf(row)}
        {@const feed = socialFeedOf(row)}
        {@const influencer = influencerOf(row)}
        {@const list = listOf(row)}
        {@const select = selectOf(row)}
        {@const effects = effectsOf(row)}
        {@const composition = compositionOf(row)}
        {@const calendar = calendarOf(row)}
        {@const estimateRevision = textEstimateRevision(id)}
        {@const textCost = textCostEstimates[id]?.revision === estimateRevision ? textCostEstimates[id] : undefined}
        {@const uploaded = isUploadedNodeRow(row) ? uploadedNodeOf(row) : null}
        {#if uploaded}
          <UploadedNode
            node={{ ...uploaded, url: assetUrl(uploaded.assetId) ?? uploaded.url }}
            medium={row.type === 'video' ? 'video' : 'image'}
          />
        {:else if gen}
          <GenNode
            node={{ ...gen, runs: runsByNode[row.id] ?? [] }}
            choices={mediumCatalogue[gen.medium].choices}
            catalogueSynced={mediumCatalogue[gen.medium].synced}
            enhanceUnitCredits={mediumCatalogue[gen.medium].enhanceUnitCredits}
            estimatedTextInputTokens={textCost?.inputTokens}
            estimatedTextOutputTokens={textCost?.outputTokens}
            variableTextInput={textCost?.variableInput ?? (gen.medium === 'text' && estimateRevision !== '[]')}
            {estimateRevision}
            hasUpstreamText={hasUpstreamTextByNode[row.id] ?? false}
            loopQueued={loopQueuedByNode[row.id] ?? 0}
            loopVisible={loopAffordanceByNode[row.id]?.visible ?? false}
            loopCombinationCount={loopAffordanceByNode[row.id]?.combinationCount ?? 0}
            onchange={(patch) => changeGen(id, gen, patch)}
            onestimate={(prompt, model, revision) => void estimateTextCost(id, prompt, model ?? '', revision)}
            onrun={() => run(id, gen)}
            onrunloop={() => runLoop(id)}
            oncancelloop={() => cancelLoopFor(id)}
            onunlock={() => unlock(id)}
            onshow={(runId) => restore(id, gen, runId)}
            onmeasure={(contentHeight) => (grownHeights[id] = contentHeight)}
          >
            {#snippet result({ refId, text })}
              <!-- `/c/<tela>/assets/<id>` firma lo storage al volo: un URL firmato messo qui
                   scadrebbe in due ore, e una tela lasciata aperta tutto il giorno mostrerebbe
                   riquadri rotti. -->
              {#if row.data.outputUncensored === true}
                <span class="uncensored-output" data-testid="uncensored-output">Uncensored</span>
              {/if}
              <span class="ai-generated-mark" data-testid="ai-generated-mark">AI-generated</span>
              {#if gen.medium === 'text'}
                <div class="gen-text-wrap">
                  <div class="gen-text-toggle" role="group" aria-label="Vista del testo">
                    <button
                      type="button"
                      class:is-active={textViewModeOf(id) === 'markdown'}
                      onclick={() => setTextViewMode(id, 'markdown')}
                    >
                      Markdown
                    </button>
                    <button
                      type="button"
                      class:is-active={textViewModeOf(id) === 'raw'}
                      onclick={() => setTextViewMode(id, 'raw')}
                    >
                      Raw
                    </button>
                  </div>
                  {#if textViewModeOf(id) === 'markdown'}
                    <div class="gen-text gen-text-md doc-prose nodrag" use:scrollGuard>{@html renderDocHtml(text ?? '')}</div>
                  {:else}
                    <pre class="gen-text nodrag" use:scrollGuard>{text ?? ''}</pre>
                  {/if}
                </div>
              {:else if gen.medium === 'audio'}
                <AudioPlayer src={`/p/${data.projectId}/c/${data.canvas.id}/assets/${refId}`} cacheKey={refId} />
              {:else if gen.medium === 'video'}
                <!-- svelte-ignore a11y_media_has_caption -->
                <video src={`/p/${data.projectId}/c/${data.canvas.id}/assets/${refId}`} controls playsinline></video>
                <div class="gen-download">
                  <NodeDownload kind="video" sourceUrl={`/p/${data.projectId}/c/${data.canvas.id}/assets/${refId}`} nodeId={id} nodeType={gen.medium} origin={MediaOrigin.Generated} />
                </div>
              {:else}
                <TieredImage src={`/p/${data.projectId}/c/${data.canvas.id}/assets/${refId}`} nodeId={id} alt={gen.prompt} />
                <div class="gen-download">
                  <NodeDownload kind="image" sourceUrl={`/p/${data.projectId}/c/${data.canvas.id}/assets/${refId}`} nodeId={id} nodeType={gen.medium} origin={MediaOrigin.Generated} />
                </div>
              {/if}
            {/snippet}
            {#snippet references()}
              {#if gen.medium === 'audio'}
                <AudioControls
                  node={gen}
                  {voices}
                  {voicesError}
                  onparams={(params) => changeGen(id, gen, { params })}
                  onmodel={(model) => changeGen(id, gen, { model })}
                  onloadvoices={() => void loadVoices()}
                />
              {:else}
              <NodeReferences
                references={referencesOf(row.data)}
                catalogue={data.references.catalogue}
                media={data.references.media}
                assetUrl={(assetId) => sized(`/p/${data.projectId}/c/${data.canvas.id}/assets/${assetId}`, AssetSize.Thumb)}
                onchange={(next) => void write(id, { references: next })}
              />
              {/if}
            {/snippet}
          </GenNode>
        {:else if frame}
          <IframeNode node={frame} onchange={(patch) => write(id, frameData({ ...frame, ...patch }))} />
        {:else if doc}
          <DocNode
            node={doc}
            onchange={(patch) => write(id, docData({ ...doc, ...patch }))}
            onshare={(on) => share(id, on)}
          />
        {:else if catalog}
          <SourceSettingsFrame
            {selected}
            view={selected ? inspectorOf(row) : null}
            shown={shownProducts[id]?.length ?? 0}
            onfield={(patch) => write(id, patch)}
            onsync={() => sync(id)}
          >
            <ProductsNode node={catalog} products={shownProducts[id] ?? []} total={products[id]?.length ?? 0} />
          </SourceSettingsFrame>
        {:else if feed}
          <SourceSettingsFrame
            {selected}
            view={selected ? inspectorOf(row) : null}
            shown={shownPosts[id]?.length ?? 0}
            onfield={(patch) => write(id, patch)}
            onsync={() => sync(id)}
          >
            <SocialFeedNode node={feed} posts={shownPosts[id] ?? []} total={socialPosts[id]?.length ?? 0} />
          </SourceSettingsFrame>
        {:else if influencer}
          <InfluencerNode
            name={influencersByNode[id]?.name ?? 'Influencer'}
            views={influencersByNode[id]?.views ?? []}
          />
        {:else if list}
          <ListNode
            node={list}
            values={listValuesByNode[id]}
            onchange={(patch) => write(id, listData({ ...list, ...patch }))}
            onretry={loopOutputByNode[id] ? (index) => retryLoopItem(id, list, loopOutputByNode[id]!, index) : undefined}
          />
        {:else if select}
          <SelectNode
            node={select}
            list={upstreamListOf(id)}
            onchange={(patch) => write(id, selectData({ ...select, ...patch }))}
          />
        {:else if effects}
          {@const effectsInput = upstreamEffectsMediaOf(id)}
          <EffectsNode
            node={{ ...effects, mediaKind: effectsInput?.kind ?? effects.mediaKind }}
            imageUrl={assetUrl(effects.refId)}
            sourceImageUrl={assetUrl(effectsInput?.refId ?? effects.sourceRefId)}
            inputChanged={inputChanged(effects.sourceRefId, effectsInput?.refId ?? null)}
            onopeneditor={() => (effectsEditorId = id)}
          />
        {:else if composition}
          <CompositionNode
            node={composition}
            posterUrl={assetUrl(composition.refId)}
            mediaUrls={upstreamCompositionRefsOf(id).map((refId) => assetUrl(refId)).filter((url): url is string => url !== null).map((url) => sized(url, AssetSize.Px1024))}
            previewActive={compositionEditorId !== id}
            imageCount={upstreamCompositionRefsOf(id).length}
            onopeneditor={() => openCompositionEditor(id)}
          />
        {:else if calendar}
          {@const calState = calendarStateOf(id)}
          <CalendarNode
            node={calendar}
            posts={calState.posts}
            brands={calState.brands}
            error={calState.error}
            busy={calState.busy}
            {timeZone}
            mediaUrl={(assetId) => assetUrl(assetId)}
            onchange={(patch) => write(id, calendarData({ ...calendar, ...patch }))}
            onmove={(post, dayKey) => moveDraft(calendar, post, dayKey)}
            onschedule={(post) => scheduleDraft(calendar, post)}
            onedit={(post) => handlePromote(post.sourceNodeIds)}
            onrefresh={() => loadCalendar(calendar)}
          />
        {:else if isNodeType(row.type)}
          <EmptyNode type={row.type} />
        {/if}
      {/if}
    {/snippet}
  </CanvasFlow>

  {#if effectsEditing}
    {@const editingId = effectsEditing.id}
    {#key editingId}
      <EffectsEditor
        initialSteps={effectsEditing.effects}
        inputUrl={assetUrl(upstreamEffectsMediaOf(editingId)?.refId ?? null)}
        inputKind={upstreamEffectsMediaOf(editingId)?.kind ?? 'image'}
        onapply={(steps, output) => applyEffects(editingId, steps, output)}
        onclose={() => (effectsEditorId = null)}
      />
    {/key}
  {/if}

  {#if compositionEditing && CompositionEditorComponent}
    {@const editingId = compositionEditing.id}
    {#key editingId}
      <CompositionEditorComponent
        initial={compositionEditing}
        mediaUrls={upstreamCompositionRefsOf(editingId).map((refId) => assetUrl(refId)).filter((url) => url !== null)}
        onsave={(next) => saveComposition(editingId, next)}
        onupload={uploadCompositionExport}
        onwriterefid={(refId) => saveCompositionExportRefId(editingId, refId)}
        onclose={() => (compositionEditorId = null)}
      />
    {/key}
  {/if}
</div>

<style>
  .canvas {
    position: relative;
    flex: 1 1 auto;
    min-height: 0;
    height: 100%;
    overflow: hidden;
  }

  .gen-download {
    position: absolute;
    top: 6px;
    right: 6px;
    z-index: 5;
  }

  .gen-text-wrap {
    display: flex;
    flex-direction: column;
    align-self: stretch;
    width: 100%;
    height: 100%;
    min-height: 0;
  }

  .gen-text-toggle {
    display: flex;
    flex-shrink: 0;
    border-bottom: 1px solid var(--line, #e5e5e5);
    background: var(--paper, #fff);
  }
  .gen-text-toggle button {
    flex: 1;
    padding: 4px 8px;
    border: none;
    border-radius: 0;
    background: transparent;
    font-size: 10.5px;
    font-weight: 550;
    color: var(--ink-soft, #6e6e73);
    cursor: pointer;
  }
  .gen-text-toggle button.is-active {
    background: var(--paper-2, #f9f9f9);
    color: var(--ink, #1d1d1f);
  }
  .gen-text-toggle button + button {
    border-left: 1px solid var(--line, #e5e5e5);
  }

  .gen-text {
    flex: 1;
    width: 100%;
    min-height: 0;
    margin: 0;
    padding: 12px;
    overflow: auto;
    white-space: pre-wrap;
    font: inherit;
  }
  .gen-text-md {
    white-space: normal;
    font-size: 12px;
  }
  .gen-text-md :global(> :first-child) {
    margin-top: 0;
  }
  .gen-text-md :global(> :last-child) {
    margin-bottom: 0;
  }

  .peers { position: absolute; z-index: 10; right: 16px; top: 16px; }

  .warning {
    position: absolute;
    z-index: 10;
    top: 10px;
    left: 50%;
    transform: translateX(-50%);
    margin: 0;
    padding: 4px 10px;
    font-size: 12px;
    color: #c0392b;
    background: var(--paper, #fff);
    border: 1px solid var(--line-2, #d2d2d7);
    border-radius: 0;
  }

  .workflow-chip {
    position: absolute;
    z-index: 10;
    top: 10px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 10px;
    font-size: 12px;
    color: var(--ink, #1d1d1f);
    background: var(--paper, #fff);
    border: 1px solid var(--line-2, #d2d2d7);
    border-radius: 0;
  }
  .workflow-chip button {
    font: inherit;
    color: inherit;
    background: none;
    border: none;
    text-decoration: underline;
    cursor: pointer;
  }
  .ai-generated-mark {
    position: absolute;
    bottom: 6px;
    left: 6px;
    z-index: 2;
    padding: 0 4px;
    font-size: 0.625rem;
    line-height: 1rem;
    color: var(--paper, #fff);
    background: rgb(0 0 0 / 0.6);
    pointer-events: none;
  }
  .uncensored-output {
    position: absolute;
    top: 6px;
    left: 6px;
    z-index: 2;
    padding: 0 4px;
    font-size: 0.625rem;
    line-height: 1rem;
    color: var(--color-destructive);
    background: var(--color-background);
    border: 1px solid var(--color-destructive);
  }
</style>
