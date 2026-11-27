<script lang="ts">
  import { ACTION_LABEL, actionsOf, serverLook } from './server-look';
  import ArrowLeft from '@lucide/svelte/icons/arrow-left';
  import ArrowRight from '@lucide/svelte/icons/arrow-right';
  import RotateCw from '@lucide/svelte/icons/rotate-cw';
  import ExternalLink from '@lucide/svelte/icons/external-link';
  import PanelRight from '@lucide/svelte/icons/panel-right';
  import PanelLeft from '@lucide/svelte/icons/panel-left';
  import Undo2 from '@lucide/svelte/icons/undo-2';
  import { LiveProp } from '@feega/live-edit/live-fields';
  import { ElementState } from '@feega/live-edit/element-state';
  import type { Styles } from './controls';
  import { untrack } from 'svelte';
  import { MOVES, Shortcut, isMac, isRedo, letterOf, needsBareFocus, shortcutOf, typingIn } from './selection-keys';
  import { Click, NONE, Surface, clickOf, contains, extend, keyOf, only, primary, refOf, siblingsOf, toggle, visibleRows, type Selection } from './selection';
  import type { SupportItem } from '../support';
  import { AccountState, type AgentId, Mode, Onboarding, OnboardingOutcome, OnboardingStep, Move, ServerAction, Slot, type ChangeRow, type FontChoice, type LayerNode, type LibraryEntry, type Palette, ServerState, type ServerInfo, Styling, ToHost, ToView, WebviewUsage, type AdapterRow, type Impact, type ImpactAsk, type Pick, type Prefs, type Source, type ViewMessage } from '../messages';
  import { fromHost, inVscode, toHost } from './host';
  import { imageSaved } from './image-file.svelte';
  import { iconDrawn, iconsFound } from './icon-search.svelte';
  import { pageBridge, sourceText } from './page-bridge';
  import Properties from './Properties.svelte';
  import BreakpointBar from './BreakpointBar.svelte';
  import ThemeBar from './ThemeBar.svelte';
  import { DEFAULT as DEFAULT_THEME_ENTRY, DEFAULT_THEME, type Theme } from '@feega/live-edit/themes';
  import { activeApply, stillThere, themeBadge, writtenTheme } from './theme-pick';
  import { DEFAULT_BREAKPOINTS, type Breakpoints } from '@feega/live-edit/breakpoints';
  import type { Scales } from '@feega/live-edit/theme-scales';
  import { FOLLOW, badgeText, reachItems, writeTarget } from './responsive';
  import { badgeOf } from './states';
  import Interactions from './Interactions.svelte';
  import Attributes from './Attributes.svelte';
  import { wiringState } from './wiring-state.svelte';
  import ClassesSection from './ClassesSection.svelte';
  import { classesState, classOfKey } from './classes-state.svelte';
  import { editingLabel, editTarget } from './class-view';
  import ModeSwitch from './ModeSwitch.svelte';
  import CloseButton from './CloseButton.svelte';
  import DockTab from './DockTab.svelte';
  import { dockedEdge, isDocked, slideAway, tabBox, type Docked } from './dock';
  import FeegaMenu from './FeegaMenu.svelte';
  import PluginBrowser from './PluginBrowser.svelte';
  import { cardsOf } from './plugin-browser';
  import OnboardingDialog from './Onboarding.svelte';
  import ServerPopover from './ServerPopover.svelte';
  import SharePanel from './SharePanel.svelte';
  import LayersTree from './LayersTree.svelte';
  import FocusTabs from './FocusTabs.svelte';
  import ComponentProps from './ComponentProps.svelte';
  import { propTally } from './focus-usage';
  import { applyAskOf } from './apply-plan';
  import { readAskOf, withUsage, type Mounted } from './usage-values';
  import { controlsOf, variantsOf, type PropControl, type PropValue } from './prop-controls';
  import { FocusMode } from './page-bridge';
  import { FocusKey, Scheme, View, focusKeyOf, focusOf, REAL_SIZE, rowFocus, schemeApplyOf, schemeOf, snapshotNoticeOf, stepZoom, themeOfScheme, wheelFactor, type Focus } from './focus';
  import { hasSourceInfo } from './source-info';
  import ChangesList from './ChangesList.svelte';
  import DeviceBar from './DeviceBar.svelte';
  import DeviceChrome from './DeviceChrome.svelte';
  import Redo2 from '@lucide/svelte/icons/redo-2';
  import { Scope } from '@feega/live-edit/scoped-rule';
  import { Tabs } from 'bits-ui';
  import { Tab } from './tabs';
  import { fontCss } from './fonts';
  import MissingFont from './MissingFont.svelte';
  import { SvelteSet } from 'svelte/reactivity';
  import { layerState, passThrough, type LayerFlag, type SavedLayers } from './layer-state';
  import { ClassFamily } from '@feega/live-edit/live-fields';
  import Breadcrumb from './Breadcrumb.svelte';
  import { SettingKey, type ReportFacts, type Settings } from '../settings';
  import { Group, ROWS, type Hint, type Row } from './controls';
  import { hintBoxes } from './hint-boxes';
  import { DropKind, dropOf, DROP_MESSAGES, type Drop } from './reorder';
  import { Place } from '@feega/live-edit/move-node';
  import { StructureOp } from '@feega/live-edit/structure';
  import StructureMenu from './StructureMenu.svelte';
  import ImpactLabel from './ImpactLabel.svelte';
  import PreviewBar from './PreviewBar.svelte';
  import { applyMessage, heldOf, muteMessage, type Held } from './preview-gate';
  import { detachState } from './detach';
  import LibraryPanel from './LibraryPanel.svelte';
  import NewPage from './NewPage.svelte';
  import { LIBRARY_DRAG_TYPE } from './library';
  import { agentContexts, commentContext, type AgentView } from './agent-context';
  import CommentsList from './CommentsList.svelte';
  import AiPanel from './AiPanel.svelte';
  import { browserAlerts, desktopBridge } from './alerts';
  import { answerAsk } from './agent-ask';
  import { ai, aiHeard } from './ai-state.svelte';
  import { withImpact } from './ai-context';
  import type { CloudComment, CloudRevisions, CommentDraft } from '../host/cloud-api';
  import { pinIdOf, pinSlot, pinsOf, sourceOfComment, threadsOf } from './comments';
  import { HOST_PEER, type Point, type Present } from '../../../packages/share-protocol/src/frame';
  import PeerLayer from './PeerLayer.svelte';
  import { peerIdOf, peerSlot, peerSourceOf, strangersOf } from './peers';
  import { AddKind, AddPlace } from '@feega/live-edit/add-node';
  import { WrapTag } from '@feega/live-edit/wrap-node';
  import { ADD_DRAG_TYPE, insertSpot, type InsertSpot } from './insert-drop';
  import { ADD_ITEMS, ADD_LOOP_ITEM, Command, LIBRARY_ID, LIBRARY_ITEM, menuFor, pickedOf } from './structure-menu';
  import { modeOfKey } from './modes';
  import { browseHistory } from './history';
  import { DEFAULT_ANCHOR, anchorBox, isAnchor, nearestAnchor, nextAnchor, type Anchor } from './anchors';
  import { PRESETS, SIZES, Size, Snap, fitOf, frameOf, savedSize, sizeForKey, snapped } from './sizes';
  import { breakpointOfSize } from './usage-report';
  import { Where } from '@feega/plugin-api/manifest';
  import type { Place as PluginPlace } from '@feega/plugin-api/protocol';
  import PluginSections from './PluginSections.svelte';
  import PluginOverlay from './PluginOverlay.svelte';
  import { createPlugins } from './plugins.svelte';
  import { selectionOf, sourceOfText } from './plugin-editor';
  import { addMenuItems, contextMenuItems, parseItemId, pluginDrop } from './plugin-menus';

  const SETTLE_MS = 1200;
  const BAR_DEFAULT_PX = 300;
  const BAR_MIN_PX = 240;
  const BAR_MAX_SHARE = 0.5;

  let url = $state('');
  let start = $state('');
  let route = $state('/');
  let address = $state('/');
  let attachAddress = $state('');
  let styling = $state(Styling.Tailwind);
  let breakpoints = $state<Breakpoints>(DEFAULT_BREAKPOINTS);
  let scales = $state<Scales | null>(null);
  let themes = $state<Theme[]>([DEFAULT_THEME_ENTRY]);
  let themeName = $state(DEFAULT_THEME);
  const writtenThemeName = $derived(writtenTheme(themeName));
  let reach = $state(FOLLOW);
  let server = $state(ServerState.Detecting);
  let restarting = $state(false);
  let serverReason = $state('');
  let serverInfo = $state<ServerInfo | null>(null);
  let bridged = $state(false);
  let mode = $state(Mode.Design);
  let editing = $state(false);
  let textPending: string | null = null;
  let hover = $state<Pick | null>(null);
  let picked = $state<Pick | null>(null);
  let selection = $state<Selection>(NONE);
  let others = $state<Pick[]>([]);
  const selectedKeys = $derived(new Set(selection.refs.map((r) => sourceText(r.source))));
  const selectionId = $derived(selection.refs.map(keyOf).join(' '));
  const several = $derived(selection.refs.length > 1);

  function setSingle(pick: Pick | null) {
    picked = pick;
    selection = pick ? only(refOf(pick.source, pick.instanceIndex)) : NONE;
  }

  async function applySelection(next: Selection) {
    selection = next;
    const head = primary(next);
    picked = head ? ((await bridge.again(head.source, head.instance)) ?? null) : null;
  }

  let othersAsked = 0;
  async function hydrateOthers() {
    const asked = ++othersAsked;
    const found = await Promise.all(selection.refs.slice(0, -1).map((r) => bridge.again(r.source, r.instance)));
    if (asked === othersAsked) {
      others = found.filter((p): p is Pick => p !== null);
    }
  }
  let elementState = $state(ElementState.Default);
  let baseline = $state<Styles | null>(null);
  const writtenState = $derived(elementState === ElementState.Default ? undefined : elementState);
  const TOAST_MS = 2500;
  let noSourceDismissed = $state(false);
  let toast = $state<string | null>(null);
  let toastTimer: ReturnType<typeof setTimeout> | undefined;
  function showToast(text: string) {
    toast = text;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (toast = null), TOAST_MS);
  }
  let frame = $state<HTMLIFrameElement | null>(null);
  let saved = $state<Source | null>(null);
  let problem = $state<{ text: string; at?: Source } | null>(null);
  let warning = $state('');
  let size = $state(Size.Full);
  let custom = $state<number | null>(null);
  let barClosed = $state(false);
  let stage = $state({ w: 0, h: 0 });
  let dragging = $state<{ x: number; width: number; side: number } | null>(null);
  let navTick = $state(0);
  let barWidth = $state(BAR_DEFAULT_PX);
  let viewW = $state(0);
  let sizing = $state<{ x: number; width: number } | null>(null);
  const barPx = $derived(barClosed ? 0 : Math.round(Math.min(Math.max(barWidth, BAR_MIN_PX), Math.max(BAR_MIN_PX, viewW * BAR_MAX_SHARE))));

  function grabEdge(e: PointerEvent) {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    sizing = { x: e.clientX, width: barPx };
  }

  function dragEdge(e: PointerEvent) {
    if (sizing) {
      barWidth = sizing.width + (sizing.x - e.clientX);
    }
  }

  function dropEdge() {
    if (sizing) {
      sizing = null;
      barWidth = barPx;
      savePrefs();
    }
  }
  let hint = $state<Hint | null>(null);
  let drag = $state<{ x: number; y: number; active: boolean } | null>(null);
  let drop = $state<Drop | null>(null);

  let tab = $state<string>(Tab.Properties);
  let share = $state<Extract<ViewMessage, { kind: ToView.Share }> | null>(null);
  let cloud = $state<{ enabled: boolean; comments: CloudComment[]; review: CloudRevisions; error: string }>({ enabled: false, comments: [], review: { status: 'open', revisions: [] }, error: '' });
  let composing = $state(false);
  let pinRects = $state<Record<string, Pick['rect'] | null>>({});
  let lostSlots = $state<Record<string, boolean>>({});
  let pinned = new Set<string>();
  let peers = $state<Present[]>([]);
  let peerRects = $state<Record<string, Pick['rect'] | null>>({});
  let tracking = new Map<string, string>();
  let lastPointAt = 0;
  const COMMENTS_POLL_MS = 15_000;
  const CURSOR_THROTTLE_MS = 50;
  const PIN_SIZE_PX = 20;
  const PIN_STACK_PX = 22;
  const pins = $derived(pinsOf(threadsOf(cloud.comments, false)));
  const openComments = $derived(pins.length);
  const cloudOn = $derived(Boolean(share?.available));
  let layers = $state<LayerNode[]>([]);
  let palette = $state<Palette>({ document: [], tokens: [], fonts: [], missing: [] });
  let skillHint = $state<string | null>(null);
  const dismissedFonts = new SvelteSet<string>();
  const fontNotice = $derived(palette.missing.find((m) => !dismissedFonts.has(m.family)) ?? null);
  let changes = $state<ChangeRow[]>([]);
  let canUndo = $state(false);
  let canRedo = $state(false);
  let scope = $state(Scope.Element);
  const classInfo = $derived(classOfKey(classesState.view, classesState.targetKey));
  const classTarget = $derived(classInfo ? editTarget(classInfo) : null);
  let layersOpen = $state<Record<string, boolean>>({ '(html):0:0': true, '(page):0:0': true });
  const layerDrag = $state<{ source: Source | null; name: string; component: boolean; parentFile: string | null; hint: { id: string; place: AddPlace } | null }>({ source: null, name: '', component: false, parentFile: null, hint: null });

  let hoverAsked = 0;
  async function hoverLayer(source: Source | null, instance: number) {
    const asked = ++hoverAsked;
    const found = source ? await bridge.again(source, instance) : null;
    if (asked === hoverAsked) {
      hover = found;
    }
  }

  $effect(() => {
    if (!picked) {
      return;
    }
    for (const a of picked.ancestors) {
      layersOpen[sourceText(a.source)] = true;
    }
    const id = sourceText(picked.source);
    queueMicrotask(() => document.querySelector(`[data-layer="${CSS.escape(id)}"]`)?.scrollIntoView({ block: 'nearest' }));
  });

  const LEFT_DEFAULT_PX = 260;
  let leftWidth = $state(LEFT_DEFAULT_PX);
  let leftClosed = $state(false);
  let leftSizing = $state<{ x: number; width: number } | null>(null);
  const leftPx = $derived(leftClosed ? 0 : Math.round(Math.min(Math.max(leftWidth, BAR_MIN_PX), Math.max(BAR_MIN_PX, viewW * BAR_MAX_SHARE))));
  const layerFlags = layerState({});
  let flagTick = $state(0);
  const hiddenNow = $derived((flagTick, new Set(layerFlags.of(route).hidden)));
  const lockedNow = $derived((flagTick, new Set(layerFlags.of(route).locked)));


  const SHOWN = '';

  function setHidden(source: Source, hide: boolean) {
    const display = hide ? 'none' : SHOWN;
    toHost({ kind: ToHost.Edit, ask: { at: sourceText(source), prop: LiveProp.Class, family: ClassFamily.Hidden, value: hide ? 'hidden' : '', css: { display }, scope } });
  }

  function toggleFlag(flag: LayerFlag, source: Source) {
    const on = layerFlags.toggle(flag, route, sourceText(source));
    if (flag === 'hidden') {
      setHidden(source, on);
    }
    flagTick++;
    savePrefs();
  }
  let anchor = $state<Anchor>(DEFAULT_ANCHOR);
  let docked = $state<Docked | null>(null);
  let bar = $state({ w: 0, h: 0 });
  let toolbarH = $state(0);
  let moving = $state<{ dx: number; dy: number; x: number; y: number } | null>(null);
  let settings = $state<Settings | null>(null);
  let facts = $state<ReportFacts | null>(null);
  let account = $state<{ state: AccountState; email?: string }>({ state: AccountState.SignedOut });
  let onboarding = $state(Onboarding.Seen);
  let support = $state<SupportItem[]>([]);
  let agents = $state<AgentId[]>([]);
  let adapters = $state<AdapterRow[]>([]);

  function finishOnboarding(outcome: OnboardingOutcome) {
    onboarding = Onboarding.Seen;
    toHost({ kind: ToHost.OnboardingDone, outcome });
  }

  const history = browseHistory();
  let savedPrefs = false;
  const fit = $derived(fitOf(size, custom, stage));
  const deviceFrame = $derived(frameOf(size));
  const target = $derived(writeTarget(reach, size !== Size.Full, breakpoints, fit.width));
  const reachBadge = $derived(badgeText(breakpoints, target, fit.width));
  $effect(() => {
    fit.width;
    untrack(() => {
      if (bridged) {
        bridge.tree();
        refresh();
      }
    });
  });
  const area = $derived({ x: leftPx, y: toolbarH + (focus ? tabsH : 0), w: stage.w, h: stage.h });
  const barAt = $derived(moving ? { x: moving.x, y: moving.y } : anchorBox(anchor, area, bar));
  const canBack = $derived((navTick, history.canBack()));
  const canForward = $derived((navTick, history.canForward()));

  const bridge = pageBridge(() => frame, {
    ready: (path, restored) => {
      if (restored) {
        showToast('Page reloaded · scroll and selection kept');
      }
      bridged = true;
      if (injected) {
        bridge.preview(injected.source, injected.css, injected.inner, injected.state);
      }
      toHost({ kind: ToHost.PreviewReady });
      server = ServerState.Running;
      restarting = false;
      visited(path);
      untrack(() => focus && ((reopening = true), bridge.focus(focus.source, viewing === View.Focus, focus.index)));
      untrack(() => viewing === View.Page && syncView());
    },
    focusReady: () => untrack(() => viewing === View.Focus && syncView()),
    moved: (path) => (visited(path), bridge.tree()),
    tree: (tree) => ((layers = tree), askPalette()),
    mounted: (status) => {
      mount = { controls: controlsOf(status.controls, status.props), values: status.props, touched: mount?.touched ?? [], dynamic: mount?.dynamic ?? [] };
      sendProps();
      askUsageProps();
    },
    zoomed: (zoom) => (zoomNow = zoom),
    focused: (count, mode, reason, detail, dark) => {
      pageDark = dark ?? false;
      snapshotNotice = mode === FocusMode.Snapshot ? snapshotNoticeOf(reason, detail) : null;
      if (mode === FocusMode.Snapshot) {
        mount = null;
      }
      if (count > 0) {
        reportFocusOpened(mode);
        reopening = false;
        return;
      }
      if (!reopening) {
        exitFocus();
      }
    },
    tracked: (slot, rect) => {
      const peer = peerIdOf(slot);
      if (peer) {
        peerRects[peer] = rect;
        return;
      }
      const pin = pinIdOf(slot);
      if (pin) {
        pinRects[pin] = rect;
        return;
      }
      lostSlots[slot] = rect === null;
      const target = slot === Slot.Selected ? picked : hover;
      if (target && rect) {
        target.rect = rect;
      }
    },
    palette: (p) => (palette = p),
    scrolled: () => {
      hover = null;
      refresh();
    },
    settled: (_source, unapplied) => {
      warning = unapplied.length ? `Saved, but ${unapplied.join(', ')} has no effect on this page` : '';
      refresh();
      bridge.tree();
    },
    textEnded: () => (editing = false),
    text: (source, text, was) => {
      editing = false;
      textPending = source;
      toHost({ kind: ToHost.Edit, ask: { at: source, prop: LiveProp.Text, value: text, was, instance: picked?.instanceIndex } });
    }
  });

  const plugins = createPlugins({
    pick: () => picked,
    preview: (source, css) => (css ? bridge.preview(source, css) : bridge.clear(source)),
    notify: showToast,
    send: toHost
  });

  $effect(() => {
    const selection = picked ? selectionOf(picked) : null;
    untrack(() => plugins.host.selectionChanged(selection));
  });

  function runPluginItem(id: string, target: Source | null, place: PluginPlace | null = null) {
    const item = parseItemId(id);
    if (item) {
      plugins.host.menu(item.plugin, item.item, target, place);
    }
    return item !== null;
  }

  function trackPins() {
    const wanted = new Set(pins.map((pin) => pin.id));
    for (const pin of pins) {
      if (!pinned.has(pin.id)) {
        bridge.track(pinSlot(pin.id), pin.source);
      }
    }
    for (const id of pinned) {
      if (!wanted.has(id)) {
        bridge.track(pinSlot(id), null);
        delete pinRects[id];
      }
    }
    pinned = wanted;
  }

  $effect(() => {
    pins;
    if (bridged) {
      untrack(trackPins);
    }
  });

  function trackPeers() {
    const wanted = new Map(peers.filter((peer) => peer.selection).map((peer) => [peer.userId, peer.selection!]));
    for (const [id, selection] of wanted) {
      const source = peerSourceOf(selection);
      if (source && tracking.get(id) !== selection) {
        bridge.track(peerSlot(id), source);
      }
    }
    for (const id of tracking.keys()) {
      if (!wanted.has(id)) {
        bridge.track(peerSlot(id), null);
        delete peerRects[id];
      }
    }
    tracking = wanted;
  }

  $effect(() => {
    peers;
    if (bridged) {
      untrack(trackPeers);
    }
  });

  function point(e: PointerEvent): Point | null {
    const now = Date.now();
    if (now - lastPointAt < CURSOR_THROTTLE_MS) {
      return null;
    }
    lastPointAt = now;
    return pagePoint(e);
  }

  function pointed(e: PointerEvent) {
    const at = point(e);
    at && toHost({ kind: ToHost.Cursor, at });
  }

  $effect(() => {
    if (!cloud.enabled) {
      return;
    }
    const timer = setInterval(() => toHost({ kind: ToHost.Comments }), COMMENTS_POLL_MS);
    return () => clearInterval(timer);
  });

  function startComment() {
    if (!picked) {
      return;
    }
    if (!cloud.enabled) {
      showToast('Comments need a shared session');
      return;
    }
    barClosed = false;
    tab = Tab.Comments;
    composing = true;
  }

  function sendComment(draft: CommentDraft) {
    toHost({ kind: ToHost.CommentAdd, draft });
    composing = false;
  }

  function heardStep(step: OnboardingStep) {
    toHost({ kind: ToHost.OnboardingStep, step });
    if (step === OnboardingStep.LocalAgents) {
      toHost({ kind: ToHost.AiList });
    }
  }

  function copyText(text: string) {
    toHost({ kind: ToHost.Copy, text });
    if (!inVscode) {
      void navigator.clipboard?.writeText(text);
    }
  }

  function copyComment(comment: CloudComment, replies: CloudComment[]) {
    const text = commentContext(comment, replies);
    if (inVscode) {
      toHost({ kind: ToHost.Copy, text });
    } else {
      void navigator.clipboard?.writeText(text);
    }
    showToast('Copied for your agent');
  }

  function openPin(id: string) {
    const thread = threadsOf(cloud.comments, true).find((t) => t.root.id === id);
    if (thread) {
      select(sourceOfComment(thread.root));
    }
    tab = Tab.Comments;
  }

  function visited(path: string) {
    route = path;
    address = path;
    history.visited(path);
    navTick++;
    savePrefs();
  }

  function reloadAfterRestart() {
    if (!url || !frame) {
      return;
    }
    frame.src = new URL(route, url).toString();
  }

  let injected: { source: Source; css: Record<string, string>; inner?: string; state?: ElementState } | null = null;

  function injectWritten(css: Record<string, string>) {
    if (!picked) {
      reloadAfterRestart();
      return;
    }
    injected = { source: picked.source, css, inner: picked.inner, state: writtenState };
    bridge.preview(injected.source, css, injected.inner, injected.state);
  }

  function go(path: string | null) {
    if (path === null || !url) {
      return;
    }
    bridge.leave();
    bridged = false;
    server = ServerState.Reloading;
    frame!.src = new URL(path, url).toString();
  }

  const pickedAt = $derived(picked ? `${sourceText(picked.source)}#${picked.instanceIndex}` : null);
  const hoverAt = $derived(hover ? `${sourceText(hover.source)}#${hover.instanceIndex}` : null);
  $effect(() => {
    if (bridged) {
      bridge.track(Slot.Selected, pickedAt === null ? null : untrack(() => picked!.source), untrack(() => picked?.instanceIndex));
    }
  });
  $effect(() => {
    pickedAt;
    toHost({ kind: ToHost.Selected, at: untrack(() => picked?.source) ?? null });
  });
  $effect(() => {
    if (bridged) {
      bridge.track(Slot.Hovered, hoverAt === null ? null : untrack(() => hover!.source), untrack(() => hover?.instanceIndex));
    }
  });

  $effect(() => {
    pickedAt;
    untrack(() => {
      if (elementState !== ElementState.Default) {
        elementState = ElementState.Default;
        baseline = null;
        bridge.force(null, ElementState.Default);
      }
    });
  });

  async function chooseState(next: ElementState) {
    if (!picked || next === elementState) {
      return;
    }
    toHost({ kind: ToHost.Usage, event: WebviewUsage.StateSwitch, dims: { state: next } });
    baseline = elementState === ElementState.Default ? { ...picked.styles } : baseline;
    elementState = next;
    bridge.force(picked.source, next);
    baseline = next === ElementState.Default ? null : baseline;
    picked = (await bridge.again(picked.source, picked.instanceIndex)) ?? picked;
  }

  function showTheme() {
    const plain = $state.snapshot(themes);
    const emulating = viewing === View.Focus && userScheme !== null;
    bridge.theme(plain.map((t) => t.apply), emulating ? schemeApplyOf(plain, themeName, userScheme!) : activeApply(plain, themeName));
    bridge.canvas(userScheme, transparentCanvas);
  }

  let userScheme = $state<Scheme | null>(null);
  let pageDark = $state(false);
  let transparentCanvas = $state(false);
  let zoomNow = $state(REAL_SIZE);
  const darkThemeName = $derived(themeOfScheme(themes, Scheme.Dark));
  const shownScheme = $derived(userScheme ?? (darkThemeName ? schemeOf(themes, themeName) : pageDark ? Scheme.Dark : Scheme.Light));

  function switchScheme(next: Scheme) {
    userScheme = next;
    const name = themeOfScheme(themes, next);
    if (darkThemeName && name) {
      chooseTheme(name);
      return;
    }
    showTheme();
  }

  function toggleTransparent() {
    transparentCanvas = !transparentCanvas;
    showTheme();
  }

  function wheelOnFocus(e: WheelEvent) {
    if (viewing === View.Focus && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      bridge.zoom({ mode: 'by', value: wheelFactor(e.deltaY) });
      return;
    }
    bridge.scroll(e.deltaX / fit.scale, e.deltaY / fit.scale);
  }

  function chooseTheme(name: string) {
    themeName = name;
    showTheme();
    refresh();
  }

  $effect(() => {
    selectionId;
    if (bridged) {
      untrack(hydrateOthers);
    }
  });

  function refresh() {
    if (several) {
      hydrateOthers();
    }
    if (picked) {
      bridge.again(picked.source, picked.instanceIndex).then((p) => (picked = p ?? picked));
    }
  }

  function savePrefs() {
    toHost({ kind: ToHost.Prefs, prefs: { size, custom, barClosed, route, anchor, dock: docked ?? undefined, barWidth, leftWidth, leftClosed, layers: layerFlags.saved() } });
  }

  function restore(prefs: Prefs | null) {
    if (!prefs) {
      return;
    }
    savedPrefs = true;
    size = savedSize(prefs.size);
    custom = prefs.custom;
    barClosed = prefs.barClosed;
    route = prefs.route ?? route;
    anchor = isAnchor(prefs.anchor) ? prefs.anchor : anchor;
    docked = isDocked(prefs.dock) ? prefs.dock : null;
    barWidth = prefs.barWidth ?? barWidth;
    leftWidth = prefs.leftWidth ?? leftWidth;
    leftClosed = prefs.leftClosed ?? leftClosed;
    for (const [r, flags] of Object.entries((prefs.layers ?? {}) as SavedLayers)) {
      flags.hidden.forEach((k) => layerFlags.toggle('hidden', r, k));
      flags.locked.forEach((k) => layerFlags.toggle('locked', r, k));
    }
    flagTick++;
  }

  const showChat = (chat: string) => {
    tab = Tab.Ai;
    barClosed = false;
    toHost({ kind: ToHost.AiOpen, chat });
  };
  const pageAlerts = browserAlerts(showChat, desktopBridge());

  const handlers: { [K in ToView]: (m: Extract<ViewMessage, { kind: K }>) => void } = {
    [ToView.App]: (m) => (restore(m.prefs), (route = m.route ?? route), (start = new URL(route, m.url).toString()), (url = m.url), (styling = m.styling), (breakpoints = m.breakpoints), (scales = m.scales), (themes = m.themes), (themeName = stillThere(m.themes.map((t) => t.name), themeName)), showTheme()),
    [ToView.History]: (m) => ((changes = m.changes), (canUndo = m.canUndo), (canRedo = m.canRedo)),
    [ToView.Settings]: (m) => {
      settings = m.values;
      facts = m.facts;
      const preset = m.values[SettingKey.DefaultSize] as Size;
      if (!savedPrefs && PRESETS.includes(preset)) {
        size = preset;
      }
    },
    [ToView.Server]: (m) => ((server = m.state), (restarting = restarting ? m.state !== ServerState.Stopped : m.state === ServerState.Restarting), (serverReason = m.reason ?? ''), (serverInfo = m.info ?? serverInfo)),
    [ToView.Reload]: () => reloadAfterRestart(),
    [ToView.PageCreated]: (m) => go(m.route),
    [ToView.Impact]: (m) => (m.id === impactId ? (impact = m.impact) : impact),
    [ToView.Preview]: (m) => (held = heldOf(m)),
    [ToView.PropsPreview]: (m) => (held = heldOf(m)),
    [ToView.UsageProps]: (m) => {
      if (mount && focus?.source.file === m.component) {
        mount = withUsage($state.snapshot(mount), m);
        sendProps();
      }
    },
    [ToView.Status]: (m) => (problem = { text: m.text }),
    [ToView.Edited]: (m) => {
      const unsavedText = textPending;
      textPending = null;
      if (!m.ok) {
        if (unsavedText) {
          bridge.restoreText(unsavedText);
        }
        problem = { text: m.reason ?? 'Not saved', at: m.at };
        saved = null;
        if (picked) {
          bridge.clear(picked.source, writtenState);
          refresh();
        }
        return;
      }
      held = null;
      problem = null;
      saved = m.saved ?? null;
      warning = m.note ?? '';
      injected = null;
      if (m.inject) {
        injectWritten(m.inject);
      }
      if (m.note) {
        showToast(m.note);
      }
      server = ServerState.Reloading;
      const created = m.select;
      setTimeout(() => {
        server = bridged ? ServerState.Running : server;
        if (created) {
          select(created);
        }
        if (m.fromHistory) {
          bridge.clearAll();
        }
        if (picked) {
          bridge.settle(picked.source, writtenState);
        }
      }, SETTLE_MS);
    },
    [ToView.Plugin]: (m) => plugins.answer(m.id, m.result),
    [ToView.Plugins]: (m) => plugins.sync(m.catalog, m.canInstall),
    [ToView.Account]: (m) => (account = { state: m.state, email: m.email }),
    [ToView.Share]: (m) => (share = m),
    [ToView.Peers]: (m) => (peers = share ? strangersOf(m.peers, HOST_PEER) : m.peers),
    [ToView.Library]: (m) => (libraryItems = m.items),
    [ToView.Comments]: (m) => (cloud = { enabled: m.enabled, comments: m.comments, review: m.review ?? cloud.review, error: m.error ?? '' }),
    [ToView.Onboarding]: (m) => (onboarding = m.state),
    [ToView.Support]: (m) => (support = m.done),
    [ToView.Agents]: (m) => (agents = m.found),
    [ToView.AiAgents]: aiHeard,
    [ToView.AiState]: aiHeard,
    [ToView.AiEvent]: aiHeard,
    [ToView.AiPolicy]: aiHeard,
    [ToView.Adapters]: (m) => (adapters = m.rows),
    [ToView.AiChats]: aiHeard,
    [ToView.Alert]: (m) => void pageAlerts.show(m.alert),
    [ToView.AlertClear]: (m) => pageAlerts.clear(m.chat),
    [ToView.ShowChat]: (m) => ((tab = Tab.Ai), (barClosed = false)),
    [ToView.AiChat]: aiHeard,
    [ToView.AgentAsk]: (m) => void answerAsk(m, { capture: shoot, context: () => (aiContext === null ? null : withImpact(aiContext, impact)) }).then(toHost),
    [ToView.SkillHint]: (m) => (skillHint = m.command),
    [ToView.IconResults]: (m) => iconsFound({ id: m.id, library: m.library, hits: m.hits, error: m.error ?? '' }),
    [ToView.IconPreview]: (m) => iconDrawn(m.name, m.svg),
    [ToView.ImageSaved]: (m) => (imageSaved.url = m.url),
    [ToView.Classes]: (m) => (classesState.view = m.view),
    [ToView.Wiring]: (m) => Object.assign(wiringState, { at: m.at, instance: m.instance, wiring: m.wiring }),
    [ToView.Pick]: (m) => bridge.at(m.x, m.y).then((pick) => (setSingle(pick), toHost({ kind: ToHost.Picked, id: m.id, pick }))),
    [ToView.Change]: (m) => {
      const row = ROWS.find((r) => r.name === m.row);
      if (row) {
        change(row, m.value);
      }
    }
  };

  fromHost((m) => (handlers[m.kind] as (m: ViewMessage) => void)(m));
  toHost({ kind: ToHost.Ready });

  function setMode(next: Mode) {
    mode = next;
    hover = null;
    bridge.mode(next);
  }

  const pagePoint = (e: MouseEvent) => ({ x: e.offsetX / fit.scale, y: e.offsetY / fit.scale });

  let hovering = false;
  function onMove(e: PointerEvent) {
    if (hovering) {
      return;
    }
    hovering = true;
    const { x, y } = pagePoint(e);
    bridge.at(x, y).then((p) => ((hover = p && passThrough(p, lockedNow) && sourceText(passThrough(p, lockedNow)!) === sourceText(p.source) ? p : null), (hovering = false)));
  }

  function grabBar(e: PointerEvent) {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    moving = { dx: e.clientX - barAt.x, dy: e.clientY - barAt.y, x: barAt.x, y: barAt.y };
  }

  function dragBar(e: PointerEvent) {
    if (moving) {
      moving = { ...moving, x: e.clientX - moving.dx, y: e.clientY - moving.dy };
    }
  }

  function dropBar() {
    if (!moving) {
      return;
    }
    docked = dockedEdge({ x: moving.x, y: moving.y }, area, bar);
    anchor = docked ? anchor : nearestAnchor({ x: moving.x, y: moving.y }, area, bar);
    moving = null;
    savePrefs();
  }

  function undock() {
    docked = null;
    savePrefs();
  }

  function onHandleKey(e: KeyboardEvent) {
    const next = nextAnchor(anchor, e.key);
    if (next !== anchor) {
      e.preventDefault();
      e.stopPropagation();
      anchor = next;
      savePrefs();
    }
  }

  const DRAG_SLOP_PX = 6;

  const inside = (p: { x: number; y: number }, r: Pick['rect']) => p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height;

  function pressOverlay(e: PointerEvent) {
    const at = pagePoint(e);
    if (picked && !several && inside(at, picked.rect)) {
      drag = { ...at, active: false };
    }
  }

  async function dragOverlay(e: PointerEvent) {
    if (!drag || !picked) {
      onMove(e);
      return;
    }
    const at = pagePoint(e);
    if (!drag.active && Math.hypot(at.x - drag.x, at.y - drag.y) < DRAG_SLOP_PX) {
      return;
    }
    drag = { ...drag, active: true };
    const target = await bridge.at(at.x, at.y);
    drop = target ? dropOf(picked, target, at) : null;
  }

  function releaseOverlay() {
    const done = drag?.active ? drop : null;
    const wasDrag = drag?.active ?? false;
    drag = null;
    drop = null;
    if (done && picked) {
      toHost(DROP_MESSAGES[done.kind](picked, done));
    }
    return wasDrag;
  }

  let menu = $state<{ x: number; y: number; where: Where.Layers | Where.Preview } | null>(null);

  async function onMenu(e: MouseEvent) {
    e.preventDefault();
    const hit = await hitAt(e);
    if (!hit || !contains(selection, refOf(hit.source, hit.instanceIndex))) {
      setSingle(hit);
    }
    menu = picked ? { x: e.clientX, y: e.clientY, where: Where.Preview } : null;
  }

  async function hitAt(e: MouseEvent): Promise<Pick | null> {
    const { x, y } = pagePoint(e);
    const hit = await bridge.at(x, y);
    const target = hit ? passThrough(hit, lockedNow) : null;
    return target && hit && sourceText(target) !== sourceText(hit.source) ? await bridge.again(target) : target ? hit : null;
  }

  async function onPick(e: MouseEvent) {
    if (releaseOverlay()) {
      return;
    }
    const hit = await hitAt(e);
    if (hit && clickOf(e, isMac, Surface.Preview) === Click.Toggle) {
      applySelection(toggle(selection, refOf(hit.source, hit.instanceIndex)));
      return;
    }
    setSingle(hit);
  }

  function onDouble(e: MouseEvent) {
    const { x, y } = pagePoint(e);
    editing = true;
    frame?.focus();
    bridge.editText(x, y);
  }

  function preview(row: Row, value: string) {
    if (picked) {
      bridge.preview(picked.source, row.preview(value), picked.inner, writtenState);
    }
  }

  const kebab = (style: Record<string, string>) => Object.fromEntries(Object.entries(style).map(([k, v]) => [k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`), v]));

  function askOf(row: Row, value: string, token?: string) {
    const { prop, side, family, value: written } = row.change(value);
    return { at: sourceText(picked!.source), prop, side, family, value: written, token, rem: picked!.rem, viewport: picked!.viewport, css: kebab(row.preview(value)), scope, cls: classTarget ?? undefined, inner: picked!.inner, page: picked!.page, state: writtenState, breakpoint: target, theme: writtenThemeName };
  }

  function change(row: Row, value: string, token?: string) {
    if (!picked) {
      return;
    }
    preview(row, value);
    toHost({ kind: ToHost.Edit, ask: askOf(row, value, token) });
  }

  function saveVar(row: Row, name: string, css: string) {
    if (picked) {
      toHost({ kind: ToHost.SaveVariable, ask: askOf(row, css), name });
      setTimeout(() => bridge.palette(), SETTLE_MS);
    }
  }

  function pickSize(next: Size) {
    toHost({ kind: ToHost.Usage, event: WebviewUsage.BreakpointSwitch, dims: { breakpoint: breakpointOfSize(next) } });
    size = next;
    savePrefs();
  }

  function startDrag(e: PointerEvent, side: number) {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragging = { x: e.clientX, width: fit.width, side };
    custom = fit.width;
    size = Size.Custom;
  }

  function resizeFrame(e: PointerEvent) {
    if (!dragging) {
      return;
    }
    custom = snapped(dragging.width + ((e.clientX - dragging.x) * 2 * dragging.side) / fit.scale, e.shiftKey ? Snap.Coarse : Snap.Magnet);
  }

  function endDrag() {
    if (dragging) {
      dragging = null;
      savePrefs();
    }
  }

  function toggleBar() {
    barClosed = !barClosed;
    savePrefs();
  }

  const typing = (e: KeyboardEvent) => typingIn(e.target as HTMLElement | null);

  async function select(source: Source, instance = 0) {
    bridge.reveal(source, instance);
    const found = await bridge.again(source, instance);
    if (found) {
      setSingle(found);
    }
  }

  function selectRow(source: Source, instance: number, e?: MouseEvent) {
    const ref = refOf(source, instance);
    const click = e ? clickOf(e, isMac, Surface.Layers) : Click.Single;
    const next: Record<Click, () => Selection | null> = {
      [Click.Single]: () => null,
      [Click.Toggle]: () => toggle(selection, ref),
      [Click.Range]: () => extend(selection, ref, visibleRows(layers, layersOpen))
    };
    const chosen = next[click]();
    if (chosen) {
      applySelection(chosen);
      return;
    }
    select(source, instance);
  }

  async function moveSelection(move: Move) {
    if (picked) {
      const moved = await bridge.move(picked.source, move);
      if (moved) {
        setSingle(moved);
      }
    }
  }

  async function selectParent() {
    const parent = picked ? await bridge.move(picked.source, Move.Parent) : null;
    setSingle(parent);
  }

  function selectSiblings() {
    const head = primary(selection);
    if (head) {
      applySelection({ refs: siblingsOf(layers, head), anchor: head });
    }
  }

  function moveLayer(from: Source, to: Source, place: Place) {
    if (place === Place.Inside) {
      toHost({ kind: ToHost.Structure, op: StructureOp.MoveInto, at: sourceText(from), to: sourceText(to) });
      return;
    }
    toHost({ kind: ToHost.Move, from: sourceText(from), to: sourceText(to), place });
  }

  function moveUsage(file: string, from: string, to: string, place: Place) {
    toHost({ kind: ToHost.Structure, op: StructureOp.MoveUsage, at: `${file}:1:1`, usage: { from, to, place } });
  }

  let addMenu = $state<{ x: number; y: number } | null>(null);
  let pluginsOpen = $state(false);
  let libraryOpen = $state(false);
  let libraryItems = $state<LibraryEntry[]>([]);

  function openLibrary() {
    libraryOpen = true;
    leftClosed = false;
    toHost({ kind: ToHost.LibraryList });
  }

  function insertLibrary(id: string, target: Source, place: AddPlace) {
    toHost({ kind: ToHost.LibraryInsert, id, at: sourceText(target), place });
  }

  function pickAdd(id: string) {
    if (runPluginItem(id, picked?.source ?? null)) {
      return;
    }
    if (id === LIBRARY_ID) {
      openLibrary();
      return;
    }
    if (id === StructureOp.AddItem) {
      restructure(StructureOp.AddItem);
      return;
    }
    addElement(id as AddKind);
  }

  function openAddMenu(x: number, y: number) {
    if (picked) {
      addMenu = { x, y };
    }
  }

  function insertElement(kind: AddKind, target: Source, place: AddPlace) {
    const at = sourceText(target);
    toHost(kind === AddKind.Image ? { kind: ToHost.AddImage, at, place } : { kind: ToHost.Structure, op: StructureOp.Add, at, add: { kind, place } });
  }

  function addElement(kind: AddKind, place = AddPlace.Auto) {
    if (picked) {
      insertElement(kind, picked.source, place);
    }
  }

  let addSpot = $state<InsertSpot | null>(null);
  let spotAsked = 0;

  const addDrag = (e: DragEvent) => (e.dataTransfer?.types.includes(ADD_DRAG_TYPE) || e.dataTransfer?.types.includes(LIBRARY_DRAG_TYPE)) ?? false;

  async function overAdd(e: DragEvent) {
    if (!addDrag(e)) {
      return;
    }
    e.preventDefault();
    const asked = ++spotAsked;
    const at = pagePoint(e);
    const target = await bridge.at(at.x, at.y);
    const owner = target?.ancestors.at(-1);
    const parent = owner ? await bridge.again(owner.source) : null;
    if (asked === spotAsked) {
      addSpot = target ? insertSpot(target, parent, at) : null;
    }
  }

  function dropAdd(e: DragEvent) {
    if (!addDrag(e)) {
      return;
    }
    e.preventDefault();
    spotAsked++;
    const kind = e.dataTransfer?.getData(ADD_DRAG_TYPE) as AddKind;
    const library = e.dataTransfer?.getData(LIBRARY_DRAG_TYPE);
    const spot = addSpot;
    addSpot = null;
    addMenu = null;
    if (library && spot) {
      insertLibrary(library, spot.target, spot.place);
      return;
    }
    const dropped = kind && spot ? pluginDrop(kind, spot) : null;
    if (dropped) {
      plugins.host.menu(dropped.plugin, dropped.item, dropped.target, dropped.place);
      return;
    }
    if (kind && spot) {
      insertElement(kind, spot.target, spot.place);
    }
  }

  async function openLayerMenu(source: Source, instance: number, at: { x: number; y: number }) {
    if (!contains(selection, refOf(source, instance))) {
      await select(source, instance);
    }
    menu = { x: at.x, y: at.y, where: Where.Layers };
  }

  function layerAdd(kind: AddKind, source: Source, place: AddPlace) {
    addMenu = null;
    insertElement(kind, source, place);
  }

  const targetsOf = () => selection.refs.map((r) => ({ at: sourceText(r.source), instance: r.instance }));

  function restructureMany(op: StructureOp, wrap?: WrapTag) {
    toHost({ kind: ToHost.StructureMany, op, targets: targetsOf(), wrap });
    if (op === StructureOp.Delete) {
      setSingle(null);
    }
  }

  function wrapWith(tag: WrapTag) {
    if (several) {
      restructureMany(StructureOp.Wrap, tag);
      return;
    }
    if (picked) {
      toHost({ kind: ToHost.Structure, op: StructureOp.Wrap, at: sourceText(picked.source), instance: picked.instanceIndex, wrap: tag });
    }
  }

  let mount = $state<Mounted | null>(null);
  let usageAsked = false;
  let showGrid = $state(false);
  let snapshotNotice = $state<string | null>(null);
  const variants = $derived(variantsOf(mount?.controls ?? []));

  function askUsageProps() {
    const ask = focus && !usageAsked ? readAskOf(focus) : null;
    if (ask) {
      usageAsked = true;
      toHost({ kind: ToHost.ReadProps, ask });
    }
  }

  function sendProps() {
    if (mount) {
      bridge.mountProps($state.snapshot(mount.values), showGrid ? $state.snapshot(variants.variants) : null);
    }
  }

  const propsChanged = propTally();
  let focusReported = false;

  function reportFocusOpened(mode: FocusMode) {
    if (focusReported) {
      return;
    }
    focusReported = true;
    toHost({ kind: ToHost.Usage, event: WebviewUsage.FocusOpened, dims: { variant: 'focus', mode } });
  }

  function reportPropsChanged() {
    propsChanged.drain().forEach((dims) => toHost({ kind: ToHost.Usage, event: WebviewUsage.FocusPropsChanged, dims }));
  }

  function setProp(name: string, value: PropValue | undefined) {
    if (!mount) {
      return;
    }
    const control = mount.controls.find((c) => c.name === name);
    if (control) {
      propsChanged.add(control.kind);
    }
    const { [name]: _, ...rest } = mount.values;
    mount = { ...mount, values: value === undefined ? rest : { ...rest, [name]: value }, touched: mount.touched.includes(name) ? mount.touched : [...mount.touched, name], dynamic: mount.dynamic.filter((d) => d !== name) };
    sendProps();
  }

  function setGrid(on: boolean) {
    showGrid = on;
    if (on) {
      toHost({ kind: ToHost.Usage, event: WebviewUsage.FocusVariantsShown });
    }
    sendProps();
  }

  let focus = $state<Focus | null>(null);

  const applyPlan = $derived(focus && mount ? applyAskOf({ focus, controls: mount.controls, values: mount.values, touched: mount.touched }) : null);

  function applyToPage() {
    if (applyPlan) {
      const { skipped: _skipped, ...ask } = $state.snapshot(applyPlan);
      toHost({ kind: ToHost.ApplyProps, ask });
    }
  }
  let viewing = $state(View.Page);
  let reopening = false;
  let tabsH = $state(0);

  function syncView() {
    bridge.mode(mode);
    showTheme();
    bridge.tree();
    bridge.palette();
    untrack(() => picked && elementState !== ElementState.Default && bridge.force(picked.source, elementState));
    refresh();
    bridge.track(Slot.Selected, untrack(() => picked?.source) ?? null, untrack(() => picked?.instanceIndex));
    bridge.track(Slot.Hovered, untrack(() => hover?.source) ?? null, untrack(() => hover?.instanceIndex));
    pinned.clear();
    trackPins();
    tracking.clear();
    trackPeers();
  }

  function showTab(next: View) {
    if (!focus || next === viewing) {
      return;
    }
    viewing = next;
    bridge.useFocus(next === View.Focus);
    bridge.focus(focus.source, next === View.Focus, focus.index);
    syncView();
  }

  function enterFocus(next: Focus | null) {
    if (!next) {
      return;
    }
    reportPropsChanged();
    focusReported = false;
    focus = next;
    viewing = View.Focus;
    reopening = false;
    mount = null;
    showGrid = false;
    snapshotNotice = null;
    usageAsked = false;
    userScheme = null;
    pageDark = false;
    transparentCanvas = false;
    bridge.useFocus(true);
    bridge.focus(next.source, true, next.index);
    bridge.zoom({ mode: 'set', value: REAL_SIZE });
  }

  function exitFocus() {
    if (!focus) {
      return;
    }
    reportPropsChanged();
    const wasFocused = viewing === View.Focus;
    focus = null;
    mount = null;
    showGrid = false;
    snapshotNotice = null;
    usageAsked = false;
    userScheme = null;
    pageDark = false;
    transparentCanvas = false;
    viewing = View.Page;
    bridge.useFocus(false);
    bridge.focus(null);
    if (wasFocused) {
      syncView();
    }
  }

  function detach() {
    if (picked?.component) {
      toHost({ kind: ToHost.Detach, at: sourceText(picked.source), usage: sourceText(picked.component), which: picked.usage });
    }
  }

  let impact = $state<Impact | null>(null);
  let impactId = 0;

  $effect(() => {
    void pickedAt;
    classesState.targetKey = null;
  });
  let held = $state<Held | null>(null);

  const impactAsk = $derived(
    picked ? { at: sourceText(picked.source), scope, cls: classTarget ?? undefined, inner: picked.inner, page: picked.page, state: writtenState, breakpoint: target, theme: writtenThemeName } : null
  );
  const impactKey = $derived(JSON.stringify(impactAsk));

  $effect(() => {
    held = null;
    const ask: ImpactAsk | null = JSON.parse(impactKey);
    if (!ask) {
      impact = null;
      return;
    }
    toHost({ kind: ToHost.Impact, id: ++impactId, ask });
  });

  function applyHeld() {
    if (held) {
      toHost(applyMessage(held));
      held = null;
    }
  }

  function cancelHeld() {
    held = null;
    if (picked) {
      bridge.clear(picked.source, writtenState);
      refresh();
    }
  }

  function muteHeld() {
    toHost(muteMessage());
    applyHeld();
  }

  function pickMenu(id: string) {
    if (runPluginItem(id, picked?.source ?? null)) {
      return;
    }
    const chosen = pickedOf(id);
    const run: Record<Command, () => void> = {
      [Command.Copy]: copyForAgent,
      [Command.Structure]: () => chosen.command === Command.Structure && restructure(chosen.op),
      [Command.Add]: () => chosen.command === Command.Add && addElement(chosen.kind, chosen.place),
      [Command.Wrap]: () => chosen.command === Command.Wrap && wrapWith(chosen.tag),
      [Command.Detach]: detach,
      [Command.Focus]: () => picked && viewing === View.Page && enterFocus(focusOf(picked))
    };
    run[chosen.command]();
  }

  let aiContext = $state<string | null>(null);

  const shoot = (selection: boolean) => bridge.capture(selection && picked ? picked.source : null, picked?.instanceIndex);

  async function agentText(): Promise<string | null> {
    if (!picked) {
      return null;
    }
    const picks = several ? (await Promise.all(selection.refs.map((r) => bridge.again(r.source, r.instance)))).filter((p): p is Pick => p !== null) : [picked];
    return agentContexts(picks, agentView());
  }

  const agentView = (): AgentView => ({
    route,
    width: Math.round(fit.width),
    breakpoint: size === Size.Full ? undefined : reachBadge,
    theme: themeName === DEFAULT_THEME ? undefined : themeName,
    state: elementState === ElementState.Default ? undefined : elementState,
    focus: focus && viewing === View.Focus ? { name: focus.name, source: focus.source } : undefined
  });

  async function copyForAgent() {
    toHost({ kind: ToHost.Usage, event: WebviewUsage.CopyForAgent });
    const text = await agentText();
    if (text === null) {
      return;
    }
    if (inVscode) {
      toHost({ kind: ToHost.Copy, text });
    } else {
      void navigator.clipboard?.writeText(text);
    }
    showToast('Copied for your agent');
  }

  $effect(() => {
    pickedAt;
    route;
    size;
    themeName;
    elementState;
    focus;
    viewing;
    void agentText().then((text) => (toHost({ kind: ToHost.Context, text }), (aiContext = text ?? agentContexts([], agentView()))));
  });

  function restructure(op: StructureOp) {
    if (several) {
      restructureMany(op);
      return;
    }
    if (!picked) {
      return;
    }
    toHost({ kind: ToHost.Structure, op, at: sourceText(picked.source), instance: picked.instanceIndex });
    if (op === StructureOp.Delete) {
      setSingle(null);
    }
  }

  function deleteRow(source: Source, instance: number) {
    if (several || (picked && sourceText(picked.source) === sourceText(source) && picked.instanceIndex === instance)) {
      restructure(StructureOp.Delete);
      return;
    }
    toHost({ kind: ToHost.Structure, op: StructureOp.Delete, at: sourceText(source), instance });
  }

  function pickFont(font: FontChoice) {
    if (!picked) {
      return;
    }
    const css = fontCss(font.family);
    bridge.preview(picked.source, { fontFamily: css });
    toHost({ kind: ToHost.Font, google: font.google, ask: { at: sourceText(picked.source), prop: LiveProp.Class, family: ClassFamily.FontFamily, value: `font-['${font.family.replace(/\s+/g, '_')}']`, css: { 'font-family': css }, rem: picked.rem, viewport: picked.viewport, scope, breakpoint: target, theme: writtenThemeName } });
  }

  const SHORTCUTS: Partial<Record<Shortcut, () => void>> = {
    [Shortcut.Delete]: () => restructure(StructureOp.Delete),
    [Shortcut.Duplicate]: () => restructure(StructureOp.Duplicate),
    [Shortcut.Wrap]: () => wrapWith(WrapTag.Div),
    [Shortcut.Unwrap]: () => restructure(StructureOp.Unwrap),
    [Shortcut.Siblings]: selectSiblings,
    [Shortcut.Copy]: copyForAgent,
    [Shortcut.Escape]: selectParent
  };

  const copying = () => Boolean(window.getSelection()?.toString());

  function runShortcut(e: KeyboardEvent, shortcut: Shortcut | null): boolean {
    const live = picked && mode === Mode.Design && !editing && !typing(e);
    if (!shortcut || !live || (needsBareFocus(shortcut) && e.target instanceof HTMLButtonElement) || (shortcut === Shortcut.Copy && copying())) {
      return false;
    }
    e.preventDefault();
    const move = MOVES[shortcut];
    if (move) {
      moveSelection(move);
      return true;
    }
    SHORTCUTS[shortcut]?.();
    return true;
  }

  const FONT_RECHECK_MS = 1500;
  const PALETTE_DEBOUNCE_MS = 400;
  let paletteTimer: ReturnType<typeof setTimeout> | undefined;

  function askPalette() {
    clearTimeout(paletteTimer);
    paletteTimer = setTimeout(() => bridge.palette(), PALETTE_DEBOUNCE_MS);
  }

  function replaceFont(from: string, to: FontChoice) {
    toHost({ kind: ToHost.FontReplace, from, to: to.family, google: to.google });
    setTimeout(() => bridge.palette(), FONT_RECHECK_MS);
  }

  function loadFont(family: string) {
    toHost({ kind: ToHost.FontLoad, family });
    setTimeout(() => bridge.palette(), FONT_RECHECK_MS);
  }

  const COMMENT_KEY = 'c';
  const HISTORY_LETTERS = new Set(['z', 'y']);

  function onKey(e: KeyboardEvent) {
    const cmd = e.metaKey || e.ctrlKey;
    const focusKey = cmd || typing(e) || editing ? null : focusKeyOf(e.key, { open: focus !== null, available: Boolean(picked?.component) && mode === Mode.Design && !several });
    if (focusKey) {
      e.preventDefault();
      focusKey === FocusKey.Exit ? exitFocus() : picked && enterFocus(focusOf(picked));
      return;
    }
    if (runShortcut(e, shortcutOf(e, isMac))) {
      return;
    }
    if (e.key === '/' && picked && mode === Mode.Design && !editing && !typing(e) && !cmd) {
      e.preventDefault();
      openAddMenu(window.innerWidth / 2, window.innerHeight / 3);
      return;
    }
    const shortcuts: Record<string, () => void> = {
      z: () => toHost({ kind: isRedo(e, isMac) ? ToHost.Redo : ToHost.Undo }),
      y: () => isRedo(e, isMac) && toHost({ kind: ToHost.Redo }),
      '\\': () => (e.shiftKey ? ((leftClosed = !leftClosed), savePrefs()) : toggleBar()),
      '|': () => ((leftClosed = !leftClosed), savePrefs()),
      h: () => e.shiftKey && picked && toggleFlag('hidden', picked.source),
      l: () => e.shiftKey && picked && toggleFlag('locked', picked.source),
      '[': () => go(history.back()),
      ']': () => go(history.forward()),
      r: () => go(route)
    };
    const letter = letterOf(e);
    if (cmd && shortcuts[letter] && !(letter === 'z' && typing(e))) {
      e.preventDefault();
      shortcuts[letter]();
      return;
    }
    if (cmd || typing(e)) {
      return;
    }
    if (cloudOn && letter === COMMENT_KEY && picked && mode === Mode.Design && !editing) {
      e.preventDefault();
      startComment();
      return;
    }
    const next = modeOfKey(letter);
    if (next) {
      setMode(next);
      return;
    }
    const preset = mode === Mode.Design ? sizeForKey(e.key) : null;
    if (preset) {
      pickSize(preset);
    }
  }

  const box = (p: Pick) => `left:${p.rect.x * fit.scale}px;top:${p.rect.y * fit.scale}px;width:${p.rect.width * fit.scale}px;height:${p.rect.height * fit.scale}px`;
  const GENERATED_CLASS = /^(s-[\w-]{6,}|svelte-[\w]+|[\w-]+_[\w-]+__[\w-]{5})$/;
  const authored = (classes: string) => classes.split(/\s+/).filter((c) => c && !GENERATED_CLASS.test(c)).join(' ');
  const fileName = (s: Source) => `${s.file.split('/').pop()}:${s.line}`;
</script>

<svelte:window onkeydown={onKey} />

<main bind:clientWidth={viewW} style={`grid-template-columns: ${leftPx}px minmax(0, 1fr) ${barPx}px; --bar: ${barPx}px; --left: ${leftPx}px`} class:sizing={sizing || leftSizing}>
  <aside class="left" class:closed={leftClosed}>
    {#if libraryOpen}
      <LibraryPanel items={libraryItems} canInsert={!!picked} oninsert={(id) => picked && insertLibrary(id, picked.source, AddPlace.After)} onclose={() => (libraryOpen = false)} />
    {:else}
    <header class="left-head">Layers<button type="button" class="add" title="Add an element (/)" aria-label="Add" data-testid="add-button" disabled={!picked} onclick={(e) => openAddMenu(e.clientX, e.clientY)}>+ Add</button></header>
    <div class="layers" role="tree" aria-label="Layers" data-testid="layers">
      <LayersTree nodes={layers} {picked} selected={selectedKeys} badge={badgeOf(elementState)} open={layersOpen} onselect={selectRow} onhover={hoverLayer} onopen={(at) => toHost({ kind: ToHost.Open, at })} onmove={moveLayer} onusage={moveUsage} dragging={layerDrag} hidden={hiddenNow} locked={lockedNow} ontoggle={toggleFlag} oncontext={openLayerMenu} onadd={layerAdd} onfocus={(node) => viewing === View.Page && enterFocus(rowFocus(node))} ondelete={deleteRow} />
    </div>
    {/if}
    {#if !leftClosed}<span class="edge-right" role="separator" aria-orientation="vertical" aria-label="Resize Layers" title="Drag to resize, double-click to reset" onpointerdown={(e) => ((e.currentTarget as HTMLElement).setPointerCapture(e.pointerId), (leftSizing = { x: e.clientX, width: leftPx }))} onpointermove={(e) => leftSizing && (leftWidth = leftSizing.width + (e.clientX - leftSizing.x))} onpointerup={() => leftSizing && ((leftSizing = null), (leftWidth = leftPx), savePrefs())} ondblclick={() => ((leftWidth = LEFT_DEFAULT_PX), savePrefs())}></span>{/if}
  </aside>
  <section class="view">
    <header class="toolbar" bind:clientHeight={toolbarH}>
      <FeegaMenu commands={plugins.commands} oncommand={(plugin, command) => plugins.host.command(plugin, command)} onplugins={() => (pluginsOpen = true)} values={settings} {facts} {account} {support} onaccount={(kind) => toHost({ kind })} onsupport={(item) => toHost({ kind: ToHost.Support, item })} onsetting={(key, value) => toHost({ kind: ToHost.Setting, key, value })} onlink={(link) => toHost({ kind: ToHost.External, url: link })} />
      <button type="button" class="icon" class:on={!leftClosed} title="Layers (⇧⌘\)" aria-label="Toggle Layers" data-testid="left-toggle" onclick={() => ((leftClosed = !leftClosed), savePrefs())}><PanelLeft size={15} /></button>
      <button type="button" class="icon" title="Back (⌘[)" disabled={!canBack} onclick={() => go(history.back())}><ArrowLeft size={15} /></button>
      <button type="button" class="icon" title="Forward (⌘])" disabled={!canForward} onclick={() => go(history.forward())}><ArrowRight size={15} /></button>
      <button type="button" class="icon" title="Reload (⌘R)" onclick={() => go(route)}><RotateCw size={14} /></button>
      <NewPage items={libraryItems} onopen={() => toHost({ kind: ToHost.LibraryList })} oncreate={(route, item) => toHost({ kind: ToHost.NewPage, route, item })} />
      <form class="address" onsubmit={(e) => (e.preventDefault(), go(address))}>
        <ServerPopover state={server} reason={serverReason} info={serverInfo} onopen={(link) => toHost({ kind: ToHost.External, url: link })} onaction={(action) => (action === ServerAction.ReloadPage ? go(route) : toHost({ kind: ToHost.Server, action }))} />
        <input bind:value={address} aria-label="Route" data-testid="address" spellcheck="false" />
      </form>
      <DeviceBar {size} {fit} onsize={pickSize} onwidth={(w) => ((custom = snapped(w)), (size = Size.Custom), savePrefs())} />
      {#each plugins.topBar as item (item.plugin + item.entry.id)}<button type="button" class="plugin-action" data-testid="plugin-action" onclick={() => plugins.host.action(item.plugin, item.entry.id)}>{item.entry.title}</button>{/each}
      {#if themes.length > 1}<ThemeBar {themes} choice={themeName} onchoose={chooseTheme} />{/if}
      {#if fit.scale < 1}<span class="zoom" data-testid="zoom">{Math.round(fit.scale * 100)}%</span>{/if}
      <button type="button" class="icon" title="Open in browser" onclick={() => toHost({ kind: ToHost.External, url: new URL(route, url).toString() })}><ExternalLink size={14} /></button>
      {#if share?.available}<SharePanel view={share} onstart={(name, canEdit) => toHost({ kind: ToHost.ShareStart, name, canEdit })} onstop={() => toHost({ kind: ToHost.ShareStop })} onkick={(userId) => toHost({ kind: ToHost.ShareKick, userId })} onrole={(userId, role) => toHost({ kind: ToHost.ShareRole, userId, role })} />{/if}
      <button type="button" class="icon" class:on={!barClosed} title="Properties (⌘\)" onclick={toggleBar} data-testid="bar-toggle"><PanelRight size={15} /></button>
    </header>
    {#if focus}<FocusTabs name={focus.name} {route} active={viewing} notice={snapshotNotice} scheme={shownScheme} onscheme={switchScheme} transparent={transparentCanvas} ontransparent={toggleTransparent} zoom={zoomNow} onzoom={(request) => bridge.zoom(request)} onstep={(direction) => bridge.zoom({ mode: 'set', value: stepZoom(zoomNow, direction) })} onselect={showTab} onclose={exitFocus} bind:height={tabsH} />{/if}

    <div class="backdrop" role="presentation" bind:clientWidth={stage.w} bind:clientHeight={stage.h} onpointermove={resizeFrame} onpointerup={endDrag}>
      <div class="frame" class:framed={size !== Size.Full} class:device={deviceFrame} style={`width:${fit.width * fit.scale}px;height:${fit.height * fit.scale}px${deviceFrame ? `;--bezel:${deviceFrame.bezel * fit.scale}px;--screen-radius:${deviceFrame.radius * fit.scale}px` : ''}`}>
        {#if url}<iframe bind:this={frame} src={start} title="App" data-testid="app-frame" style={`width:${fit.width}px;height:${fit.height}px;transform:scale(${fit.scale})`}></iframe>{/if}
        {#if deviceFrame}<DeviceChrome frame={deviceFrame} scale={fit.scale} landscape={fit.width > fit.height} />{/if}
        {#if restarting}<div class="restarting" data-testid="restarting" role="status"><span class="server-dot-inline amber"></span>Restarting dev server…</div>{/if}
        {#if mode === Mode.Design && bridged && !editing}
          <div class="overlay" role="presentation" onpointerdown={pressOverlay} onpointermove={(e) => (pointed(e), dragOverlay(e))} onpointerleave={() => ((hover = null), toHost({ kind: ToHost.Cursor, at: null }))} onclick={onPick} oncontextmenu={onMenu} ondragover={overAdd} ondragleave={() => (addSpot = null)} ondrop={dropAdd} ondblclick={onDouble} onwheel={wheelOnFocus}>
            {#if hover && !lostSlots[Slot.Hovered]}<div class="outline hover" style={box(hover)}></div>{/if}
            {#if addSpot}
              <div class="drop-line box" data-testid="add-outline" style={`left:${addSpot.outline.x * fit.scale - 1}px;top:${addSpot.outline.y * fit.scale - 1}px;width:${Math.max(2, addSpot.outline.w * fit.scale)}px;height:${Math.max(2, addSpot.outline.h * fit.scale)}px`}></div>
              {#if addSpot.place !== AddPlace.Child}<div class="drop-line" data-testid="add-line" style={`left:${addSpot.line.x * fit.scale - 1}px;top:${addSpot.line.y * fit.scale - 1}px;width:${Math.max(2, addSpot.line.w * fit.scale)}px;height:${Math.max(2, addSpot.line.h * fit.scale)}px`}></div>{/if}
            {/if}
            {#if drop}<div class="drop-line" class:box={drop.kind === DropKind.Inside} style={`left:${drop.line.x * fit.scale - 1}px;top:${drop.line.y * fit.scale - 1}px;width:${Math.max(2, drop.line.w * fit.scale)}px;height:${Math.max(2, drop.line.h * fit.scale)}px`}></div>{/if}
          {#if picked && hint}{#each hintBoxes(picked, hint) as area, i (i)}<div class="hint {hint.group}" style={`left:${area.x * fit.scale}px;top:${area.y * fit.scale}px;width:${area.w * fit.scale}px;height:${area.h * fit.scale}px`}></div>{/each}{/if}
          {#if picked}<PluginOverlay {plugins} {picked} scale={fit.scale} />{/if}
          {#each others as other (keyOf(refOf(other.source, other.instanceIndex)))}<div class="outline picked" data-testid="selected-outline" style={box(other)}></div>{/each}
          <PeerLayer {peers} rects={peerRects} scale={fit.scale} />
          {#if picked && !lostSlots[Slot.Selected]}<div class="outline picked" style={box(picked)}>{#if !(viewing === View.Focus && showGrid)}<span class="label"><Breadcrumb pick={picked} onselect={select} compact state={elementState} /></span>{/if}</div>{/if}
          {#each pins as pin (pin.id)}
            {@const rect = pinRects[pin.id]}
            {#if rect}
              <button type="button" class="pin" data-testid="comment-pin" title="Open comment" style={`left:${(rect.x + rect.width) * fit.scale - PIN_SIZE_PX / 2}px;top:${rect.y * fit.scale - PIN_SIZE_PX / 2 + pin.stack * PIN_STACK_PX}px`} onpointerdown={(e) => e.stopPropagation()} onclick={(e) => (e.stopPropagation(), openPin(pin.id))}>{pin.number}</button>
            {/if}
          {/each}
          </div>
        {/if}
        {#if size !== Size.Full}
          <span class="handle left" role="separator" aria-label="Resize" title="Drag to resize, Shift for 10px, double-click for Full" onpointerdown={(e) => startDrag(e, -1)} ondblclick={() => pickSize(Size.Full)}></span>
          <span class="handle right" role="separator" aria-label="Resize" title="Drag to resize, Shift for 10px, double-click for Full" onpointerdown={(e) => startDrag(e, 1)} ondblclick={() => pickSize(Size.Full)}></span>
          {#if dragging}<span class="width-label live">{fit.width} × {fit.height}</span>{/if}
        {/if}
      </div>

      {#if !url}
        <div class="server-card" data-testid="server-card" data-state={server}>
          <p class="server-label"><span class="server-dot-inline {serverLook(server).dot}"></span>{serverLook(server).label}</p>
          {#if serverReason}<pre class="server-reason">{serverReason}</pre>{/if}
          <div class="server-actions">
            {#each actionsOf(server, false) as action (action)}
              <button type="button" class="action" data-action={action} onclick={() => toHost({ kind: ToHost.Server, action })}>{ACTION_LABEL[action]}</button>
            {/each}
          </div>
          <form class="attach" onsubmit={(e) => (e.preventDefault(), attachAddress.trim() && toHost({ kind: ToHost.AttachUrl, url: attachAddress }))}>
            <input bind:value={attachAddress} aria-label="Dev server address" data-testid="attach-url" placeholder="http://localhost:5173" spellcheck="false" />
            <button type="submit" class="action">Attach to a running server</button>
          </form>
        </div>
      {/if}
      {#if bridged && !noSourceDismissed && !hasSourceInfo(layers)}
        <div class="notice nosource" data-testid="no-source">
          <span>This page has no source info</span>
          <CloseButton onclose={() => (noSourceDismissed = true)} />
          <button type="button" class="link" data-action="add-plugin" onclick={() => toHost({ kind: ToHost.AddPlugin })}>Add the Feega plugin</button>
          <button type="button" class="link" data-action={ServerAction.RestartUnderFeega} onclick={() => toHost({ kind: ToHost.Server, action: ServerAction.RestartUnderFeega })}>Let Feega start the server</button>
        </div>
      {/if}
      {#if pluginsOpen}<PluginBrowser cards={cardsOf(plugins.rows)} problems={plugins.problems} canInstall={plugins.canInstall} onenable={(id, enabled) => toHost({ kind: ToHost.PluginEnable, id, enabled })} onremove={(id) => toHost({ kind: ToHost.PluginRemove, id })} oninstall={(source) => toHost({ kind: ToHost.PluginInstall, source })} onlink={(link) => toHost({ kind: ToHost.External, url: link })} onclose={() => (pluginsOpen = false)} />{/if}
      {#if menu}<StructureMenu x={menu.x} y={menu.y} items={contextMenuItems(menuFor(selection.refs.length, detachState(picked)), plugins.contextMenu, menu.where)} onpick={pickMenu} onclose={() => (menu = null)} />{/if}
      {#if addMenu}<StructureMenu x={addMenu.x} y={addMenu.y} items={addMenuItems(picked && picked.instances > 1 ? [...ADD_ITEMS, ADD_LOOP_ITEM, LIBRARY_ITEM] : [...ADD_ITEMS, LIBRARY_ITEM], plugins.addMenu)} label="add" draggable={true} onpick={pickAdd} onclose={() => (addMenu = null)} />{/if}
      {#if skillHint}
        <div class="notice skillhint" data-testid="skill-hint">
          <span>Let your agent drive Feega: <code>{skillHint}</code></span>
          <button type="button" class="link" data-action="skill-hint-copy" onclick={() => toHost({ kind: ToHost.Copy, text: skillHint! })}>Copy command</button>
          <button type="button" class="link" data-action="skill-hint-never" onclick={() => (toHost({ kind: ToHost.SkillHintNever }), (skillHint = null))}>Don't show again</button>
          <button type="button" class="link" data-action="skill-hint-dismiss" onclick={() => (toHost({ kind: ToHost.SkillHintDismiss }), (skillHint = null))}>Dismiss</button>
          <CloseButton onclose={() => (toHost({ kind: ToHost.SkillHintDismiss }), (skillHint = null))} />
        </div>
      {/if}
      {#if fontNotice}
        <div class="notice missingfont" data-testid="font-notice">
          <MissingFont missing={fontNotice} project={palette.fonts.filter((name) => !palette.missing.some((m) => m.family === name))} onreplace={replaceFont} onload={loadFont} />
          <button type="button" class="link" onclick={() => dismissedFonts.add(fontNotice!.family)}>Dismiss</button>
          <CloseButton onclose={() => dismissedFonts.add(fontNotice!.family)} />
        </div>
      {/if}
      {#if toast}<div class="toast" role="status"><span>{toast}</span><CloseButton onclose={() => (toast = null)} /></div>{/if}
      <div class="float" class:moving class:docked={!!docked} inert={!!docked} style:--away={docked ? slideAway(docked.edge) : 'none'} bind:clientWidth={bar.w} bind:clientHeight={bar.h} style={`left:${barAt.x}px;top:${barAt.y}px`} data-anchor={anchor}>
        <button type="button" class="grip" title="Drag to move (arrow keys)" aria-label="Move the bar" onpointerdown={grabBar} onpointermove={dragBar} onpointerup={dropBar} onkeydown={onHandleKey}>
          <svg width="8" height="12" viewBox="0 0 8 12" aria-hidden="true">{#each [0, 1, 2] as row (row)}{#each [0, 1] as col (col)}<circle cx={2 + col * 4} cy={2 + row * 4} r="1.1" fill="currentColor" />{/each}{/each}</svg>
        </button>
        <ModeSwitch {mode} onmode={setMode} />
        <button type="button" class="icon" title="Undo (⌘Z)" disabled={!canUndo} onclick={() => toHost({ kind: ToHost.Undo })}><Undo2 size={14} /></button>
        <button type="button" class="icon" title="Redo (⇧⌘Z)" disabled={!canRedo} onclick={() => toHost({ kind: ToHost.Redo })}><Redo2 size={14} /></button>
      </div>

      {#if docked}<DockTab edge={docked.edge} box={tabBox(docked, area)} onrestore={undock} />{/if}

      {#if barClosed && picked}
        <button type="button" class="pill" onclick={toggleBar} data-testid="selection-pill">&lt;{picked.tag}&gt; {fileName(picked.source)} · Edit</button>
      {/if}

      {#if problem || saved || warning}
        <div class="notice" class:bad={problem} data-testid="status">
          {#if problem}
            <span>{problem.text}</span>
            {#if problem.at}<button type="button" class="link" onclick={() => toHost({ kind: ToHost.Open, at: problem!.at! })}>Open in editor</button>{/if}
          {:else}
            <button type="button" class="link" onclick={() => toHost({ kind: ToHost.Open, at: saved! })}>{saved ? `Saved to ${fileName(saved)}` : ''}</button>
            {#if warning}<span class="warn">{warning}</span>{/if}
          {/if}
          <CloseButton onclose={() => ((problem = null), (saved = null), (warning = ''))} />
        </div>
      {/if}
    </div>
  </section>

  <aside class="right" class:closed={barClosed}>
    {#if !barClosed}<span class="edge" role="separator" aria-orientation="vertical" aria-label="Resize Properties" title="Drag to resize, double-click to reset" onpointerdown={grabEdge} onpointermove={dragEdge} onpointerup={dropEdge} ondblclick={() => ((barWidth = BAR_DEFAULT_PX), savePrefs())}></span>{/if}
    <Tabs.Root bind:value={tab} class="tabs">
      <Tabs.List class="tab-list">
        <Tabs.Trigger value={Tab.Properties} class="tab">Properties</Tabs.Trigger>
        <Tabs.Trigger value={Tab.Changes} class="tab" data-testid="changes-tab">Changes{changes.length ? ` ${changes.length}` : ''}</Tabs.Trigger>
        {#if cloudOn}<Tabs.Trigger value={Tab.Comments} class="tab" data-testid="comments-tab">Comments{openComments ? ` ${openComments}` : ''}</Tabs.Trigger>{/if}
        <Tabs.Trigger value={Tab.Ai} class="tab" data-testid="ai-tab">AI</Tabs.Trigger>
        {#each plugins.sidePanel as panel (panel.plugin + panel.entry.id)}<Tabs.Trigger value={`plugin:${panel.plugin}/${panel.entry.id}`} class="tab" data-testid="plugin-tab">{panel.entry.title}</Tabs.Trigger>{/each}
      </Tabs.List>
      <Tabs.Content value={Tab.Properties}>
        {#if mount && viewing === View.Focus && mount.controls.length}
          <ComponentProps controls={mount.controls} values={mount.values} grid={showGrid} {variants} dynamic={mount.dynamic} apply={{ ready: Boolean(applyPlan), usage: Boolean(focus?.usage), skipped: applyPlan?.skipped ?? [] }} onchange={setProp} ongrid={setGrid} onapply={applyToPage} />
        {/if}
        {#if several}
          <div class="what" data-testid="multi-selection">
            <strong>{selection.refs.length} elements selected</strong>
            <span class="where">Editing styles works on one element at a time. <button type="button" class="link" data-testid="multi-keep-primary" onclick={() => picked && setSingle(picked)}>Keep only &lt;{picked?.tag}&gt;</button></span>
            <div class="multi-actions" data-testid="multi-actions">
              <button type="button" data-action="duplicate" onclick={() => restructure(StructureOp.Duplicate)}>Duplicate</button>
              <button type="button" data-action="wrap" onclick={() => wrapWith(WrapTag.Div)}>Wrap</button>
              <button type="button" data-action="unwrap" onclick={() => restructure(StructureOp.Unwrap)}>Unwrap</button>
              <button type="button" data-action="delete" onclick={() => restructure(StructureOp.Delete)}>Delete</button>
              <button type="button" data-action="copy" onclick={copyForAgent}>Copy for agent</button>
            </div>
          </div>
        {:else if picked}
          <div class="what" data-testid="selection">
            <Breadcrumb pick={picked} onselect={select} state={elementState} />
            <ImpactLabel {impact} instances={picked.instances} detachable={!classInfo && detachState(picked).show} detachReason={detachState(picked).reason} ondetach={detach} onopen={(at) => toHost({ kind: ToHost.Open, at })} />
            <span class="where">{#if picked.component}in {picked.component.file.split('/').pop()} · {/if}<button type="button" class="link" onclick={() => toHost({ kind: ToHost.Open, at: picked!.source })}>{picked.source.file.split('/').pop()}:{picked.source.line}</button> · <button type="button" class="link" data-testid="copy-for-agent" title="Copy file, selector and view for your coding agent" onclick={copyForAgent}>Copy for agent</button>{#if cloudOn} · <button type="button" class="link" data-testid="comment-start" title="Comment on this element (C)" onclick={startComment}>Comment</button>{/if}</span>
            {#if authored(picked.classes)}<code class="classes">{authored(picked.classes)}</code>{/if}
          </div>
          <BreakpointBar badge={reachBadge} theme={themeBadge(themeName)} items={reachItems(breakpoints)} choice={reach} onchoose={(id) => (reach = id)} />
          {#if classInfo}
            <div class="scope editing" data-testid="class-editing">
              <span class="editing-label">{editingLabel(classInfo)}</span>
              <button type="button" class="on" data-action="class-stop" onclick={() => (classesState.targetKey = null)}>This element</button>
            </div>
          {:else}
          <div class="scope" role="radiogroup" aria-label="Edit scope" data-testid="scope">
            <button type="button" class:on={scope === Scope.Element} onclick={() => (scope = Scope.Element)} title="Only this element (every instance of its component: {picked.instances})">This element{picked.instances > 1 ? ` ×${picked.instances}` : ''}</button>
            <button type="button" class:on={scope === Scope.Class} disabled={!picked.classCount || styling === Styling.Tailwind} onclick={() => (scope = Scope.Class)} title={styling === Styling.Tailwind ? 'Class scope needs CSS rules, not Tailwind' : `Every element with this class: ${picked.classCount}`}>All .{picked.classes.split(' ')[0] || 'class'}{picked.classCount ? ` (${picked.classCount})` : ''}</button>
          </div>
          {/if}
          {#if held}<PreviewBar {held} onapply={applyHeld} oncancel={cancelHeld} onmute={muteHeld} />{/if}
          <Properties pick={picked} {breakpoints} {scales} {palette} {elementState} {baseline} onstate={chooseState} onpreview={preview} onchange={change} onsavevar={saveVar} onhint={(h) => (hint = h)} onfont={pickFont} onfontreplace={replaceFont} onfontload={loadFont} onnotice={showToast} />
          <ClassesSection pick={picked} {changes} onselect={select} />
          <Attributes pick={picked} {palette} />
          <PluginSections {plugins} {palette} />
          <Interactions pick={picked} {changes} />
        {:else}
          <p class="empty">{bridged ? 'Click an element to edit it. Double-click text to rewrite it.' : 'The page has no Feega source map: element picking needs the feega-source-map plugin.'}</p>
        {/if}
      </Tabs.Content>
      <Tabs.Content value={Tab.Changes}>
        <ChangesList {changes} onselect={select} onopen={(at) => toHost({ kind: ToHost.Open, at })} ondiff={(id) => toHost({ kind: ToHost.Diff, id })} onrevert={(id) => toHost({ kind: ToHost.Revert, id })} onrevertall={() => toHost({ kind: ToHost.Revert, id: null })} onscm={() => toHost({ kind: ToHost.SourceControl })} />
      </Tabs.Content>
      {#each plugins.sidePanel as panel (panel.plugin + panel.entry.id)}
        <Tabs.Content value={`plugin:${panel.plugin}/${panel.entry.id}`}>
          <iframe class="plugin-panel" title={panel.entry.title} sandbox="allow-scripts" srcdoc={panel.entry.html}></iframe>
        </Tabs.Content>
      {/each}
      <Tabs.Content value={Tab.Ai}>
        <AiPanel context={aiContext === null ? null : withImpact(aiContext, impact)} tohost={toHost} capture={() => shoot(false)} />
      </Tabs.Content>
      <Tabs.Content value={Tab.Comments}>
        <CommentsList {cloud} {picked} {composing} onsubmit={(draft) => (draft.parentId ? toHost({ kind: ToHost.CommentAdd, draft }) : sendComment(draft))} oncancel={() => (composing = false)} onresolve={(id) => toHost({ kind: ToHost.CommentResolve, id })} onselect={select} oncopy={copyComment} onpublish={(summary) => toHost({ kind: ToHost.RevisionPublish, summary })} />
      </Tabs.Content>
    </Tabs.Root>
  </aside>
</main>

{#if onboarding === Onboarding.Pending}
  <OnboardingDialog {account} {support} {agents} local={ai.agents} {adapters} oncopy={copyText} onlink={(url) => toHost({ kind: ToHost.External, url })} onaccount={(kind) => toHost({ kind })} onsupport={(item) => toHost({ kind: ToHost.Support, item })} onstep={heardStep} ondone={finishOnboarding} />
{/if}

<style>
  main {
    --float-gap: 16px;
    --top-row: 40px;
    display: grid;
    height: 100vh;
    overflow: hidden;
    transition: grid-template-columns 200ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  .view {
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
  }

  .toolbar {
    display: flex;
    align-items: center;
    gap: 4px;
    height: var(--top-row);
    box-sizing: border-box;
    padding: 0 var(--ui-space-2);
    border-bottom: 1px solid var(--ui-divider);
    background: var(--ui-panel);
  }

  .icon {
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    flex: none;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: none;
    color: var(--ui-text-2);
    cursor: pointer;
  }

  .icon:hover:not(:disabled),
  .icon.on {
    background: var(--ui-input);
    color: var(--ui-text);
  }

  .icon:disabled {
    opacity: 0.35;
    cursor: default;
  }

  .address {
    display: flex;
    flex: 1;
    align-items: center;
    gap: var(--ui-space-2);
    min-width: 120px;
    height: 28px;
    padding: 0 var(--ui-space-2);
    border-radius: var(--ui-radius-full);
    background: var(--ui-input);
  }

  .address input {
    flex: 1;
    min-width: 0;
    border: 0;
    background: none;
    color: var(--ui-text);
    font: inherit;
    font-size: var(--ui-text-sm);
    outline: none;
  }

  .dot {
    width: 8px;
    height: 8px;
    flex: none;
    border-radius: var(--ui-radius-full);
  }

  .dot.grey {
    background: #8e8e93;
  }

  .dot.amber {
    background: #ff9f0a;
  }

  .dot.green {
    background: #30d158;
  }

  .dot.red {
    background: #ff453a;
  }

  .action,
  .device,
  .width {
    height: 24px;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-input);
    color: var(--ui-text);
    font: inherit;
    font-size: var(--ui-text-sm);
  }

  .width {
    width: 64px;
    padding: 0 6px;
  }

  .zoom {
    color: var(--ui-text-2);
    font-size: var(--ui-text-xs);
  }

  .backdrop {
    position: relative;
    display: flex;
    flex: 1;
    align-items: center;
    min-height: 0;
    justify-content: center;
    overflow: hidden;
    background: var(--ui-backdrop);
  }

  .frame {
    position: relative;
    flex: none;
    align-self: center;
    overflow: hidden;
    background: #fff;
  }

  .frame.framed {
    box-shadow: 0 0 0 1px var(--ui-divider), 0 8px 24px rgb(0 0 0 / 0.18);
  }

  .frame.device {
    border-radius: var(--screen-radius);
    box-shadow: 0 0 0 var(--bezel) #111, 0 0 0 calc(var(--bezel) + 1px) #3a3a3c, 0 12px 32px rgb(0 0 0 / 0.3);
  }

  iframe {
    display: block;
    border: 0;
    transform-origin: 0 0;
  }

  .plugin-action {
    height: 24px;
    padding: 0 8px;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-input);
    color: var(--ui-text);
    font: inherit;
    font-size: var(--ui-text-xs);
    cursor: pointer;
  }

  .plugin-panel {
    width: 100%;
    height: 100%;
    min-height: 240px;
    border: 0;
  }

  .overlay {
    position: absolute;
    inset: 0;
    cursor: crosshair;
  }

  .outline {
    position: absolute;
    pointer-events: none;
  }

  .pin {
    position: absolute;
    display: flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    width: 20px;
    height: 20px;
    padding: 0;
    border: 1.5px solid #fff;
    border-radius: var(--ui-radius-full);
    background: var(--ui-accent);
    color: #fff;
    font: inherit;
    font-size: 10px;
    font-weight: 600;
    cursor: pointer;
  }

  .hover {
    outline: 1px solid var(--ui-accent);
  }

  .picked {
    outline: 2px solid var(--ui-accent);
  }

  .add {
    margin-left: auto;
    padding: 0 8px;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-text);
    color: var(--ui-panel);
    font: inherit;
    font-size: var(--ui-text-xs);
    cursor: pointer;
  }

  .add:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .drop-line {
    position: absolute;
    background: var(--ui-accent);
    pointer-events: none;
  }

  .drop-line.box {
    background: color-mix(in srgb, var(--ui-accent) 12%, transparent);
    outline: 2px solid var(--ui-accent);
    outline-offset: -2px;
  }

  .hint {
    position: absolute;
    pointer-events: none;
  }

  .hint.padding {
    background: rgb(48 209 88 / 0.35);
  }

  .hint.margin {
    background: rgb(255 159 10 / 0.35);
  }

  .picked .label {
    position: absolute;
    top: -18px;
    left: -2px;
    max-width: 320px;
    padding: 0 4px;
    border-radius: var(--ui-radius-xs);
    background: var(--ui-accent);
    color: var(--ui-accent-ink);
    font-size: var(--ui-text-xs);
  }

  .handle {
    position: absolute;
    top: 50%;
    width: 8px;
    height: 40px;
    margin-top: -20px;
    border-radius: var(--ui-radius-full);
    background: var(--ui-line-strong);
    opacity: 0.7;
    cursor: col-resize;
  }

  .handle:hover {
    background: var(--ui-text-2);
    opacity: 1;
  }

  .handle.left {
    left: -12px;
  }

  .handle.right {
    right: -12px;
  }

  .toast {
    position: absolute;
    top: 12px;
    left: 50%;
    z-index: 3;
    transform: translateX(-50%);
    padding: 4px 10px;
    border-radius: var(--ui-radius-lg);
    background: var(--ui-float);
    box-shadow: 0 0 0 1px var(--ui-divider), 0 4px 12px rgb(0 0 0 / 0.15);
    color: var(--ui-text);
    font-size: var(--ui-text-xs);
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .width-label {
    position: absolute;
    top: 8px;
    left: 50%;
    transform: translateX(-50%);
    padding: 2px 6px;
    border-radius: var(--ui-radius-xs);
    background: var(--ui-float);
    color: var(--ui-text-2);
    font-size: var(--ui-text-xs);
  }

  .width-label.live {
    background: var(--ui-accent);
    color: var(--ui-accent-ink);
  }

  .float {
    position: fixed;
    z-index: 5;
    transition:
      left 180ms cubic-bezier(0.16, 1, 0.3, 1),
      top 180ms cubic-bezier(0.16, 1, 0.3, 1),
      transform 180ms cubic-bezier(0.16, 1, 0.3, 1),
      opacity 180ms ease,
      visibility 180ms;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px;
    border-radius: var(--ui-radius-lg);
    background: var(--ui-float);
    box-shadow: 0 0 0 1px var(--ui-divider), 0 8px 24px rgb(0 0 0 / 0.22);
    backdrop-filter: blur(12px);
  }

  .float.moving {
    transition: none;
  }

  .float.docked {
    visibility: hidden;
    opacity: 0;
    transform: var(--away);
    pointer-events: none;
  }

  .grip {
    display: grid;
    place-items: center;
    width: 16px;
    height: 28px;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: none;
    color: var(--ui-text);
    opacity: 0.5;
    cursor: grab;
    touch-action: none;
  }

  .float.moving .grip {
    cursor: grabbing;
  }

  .grip:focus-visible {
    opacity: 1;
    outline: 1px solid var(--ui-accent);
  }

  .pill {
    position: absolute;
    top: 12px;
    right: 12px;
    height: 28px;
    padding: 0 12px;
    border: 0;
    border-radius: var(--ui-radius-full);
    background: var(--ui-accent);
    color: var(--ui-accent-ink);
    font: inherit;
    font-size: var(--ui-text-sm);
    cursor: pointer;
  }

  .notice {
    position: absolute;
    bottom: 16px;
    left: 16px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    max-width: 280px;
    padding: 6px 10px;
    border-radius: var(--ui-radius-md);
    background: var(--ui-float);
    box-shadow: 0 0 0 1px var(--ui-divider);
    font-size: var(--ui-text-sm);
  }

  .notice :global(.close) {
    align-self: flex-end;
  }

  .notice.nosource {
    bottom: 64px;
  }

  .notice.skillhint {
    bottom: 176px;
  }

  .notice.missingfont {
    bottom: 120px;
  }

  .attach {
    display: flex;
    gap: 6px;
    justify-content: center;
  }

  .attach input {
    min-width: 0;
    padding: 4px 8px;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-float);
    box-shadow: 0 0 0 1px var(--ui-divider);
    color: inherit;
    font: inherit;
    font-size: var(--ui-text-sm);
  }

  .notice.bad {
    box-shadow: 0 0 0 1px #ff453a;
  }

  .warn {
    color: #ff9f0a;
  }

  .right :global(.tab-list) {
    display: flex;
    align-items: center;
    gap: 2px;
    box-sizing: border-box;
    height: var(--top-row);
    padding: 0 8px;
    border-bottom: 1px solid var(--ui-divider);
  }

  .right :global(.tab) {
    height: 26px;
    padding: 0 10px;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: none;
    color: var(--ui-text-2);
    font: inherit;
    font-size: var(--ui-text-sm);
    cursor: pointer;
  }

  .right :global(.tab[data-state='active']) {
    background: var(--ui-input);
    color: var(--ui-text);
  }

  .scope {
    display: flex;
    gap: 2px;
    height: 28px;
    box-sizing: border-box;
    margin: 8px 12px;
    padding: 2px;
    border-radius: var(--ui-radius-md);
    background: var(--ui-input);
  }

  .editing-label {
    flex: 1;
    align-self: center;
    padding: 0 8px;
    overflow: hidden;
    color: var(--ui-accent);
    font-size: var(--ui-text-xs);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .scope.editing button {
    flex: 0 0 auto;
    padding: 0 8px;
  }

  .scope button {
    flex: 1;
    height: 100%;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: none;
    color: var(--ui-text-2);
    font: inherit;
    font-size: var(--ui-text-xs);
    white-space: nowrap;
    cursor: pointer;
  }

  .scope button.on {
    background: var(--ui-thumb);
    color: var(--ui-thumb-ink);
  }

  .scope button:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .layers {
    padding: 4px 0;
  }

  main.sizing {
    transition: none;
    cursor: col-resize;
  }

  .edge {
    position: absolute;
    top: 0;
    bottom: 0;
    left: -2px;
    z-index: 6;
    width: 4px;
    cursor: col-resize;
  }

  .edge:hover {
    background: var(--ui-accent);
  }

  .left {
    position: relative;
    min-width: 0;
    overflow: hidden auto;
    border-right: 1px solid var(--ui-divider);
    background: var(--ui-panel);
  }

  .left.closed {
    border: 0;
  }

  .left-head {
    display: flex;
    align-items: center;
    box-sizing: border-box;
    height: var(--top-row);
    padding: 0 12px;
    border-bottom: 1px solid var(--ui-divider);
    color: var(--ui-text-2);
    font-size: var(--ui-text-xs);
    font-weight: 600;
  }

  .edge-right {
    position: absolute;
    top: 0;
    right: -2px;
    bottom: 0;
    z-index: 6;
    width: 4px;
    cursor: col-resize;
  }

  .edge-right:hover {
    background: var(--ui-accent);
  }

  .right {
    position: relative;
    min-width: 0;
    overflow: hidden auto;
    border-left: 1px solid var(--ui-divider);
    background: var(--ui-panel);
  }

  .right.closed {
    border: 0;
  }

  .what {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: var(--ui-space-4);
    border-bottom: 1px solid var(--ui-divider);
    font-size: var(--ui-text-sm);
  }

  .multi-actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--ui-space-2);
    margin-top: var(--ui-space-2);
  }

  .multi-actions button {
    height: 26px;
    padding: 0 var(--ui-space-3);
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-input);
    color: var(--ui-text);
    font: inherit;
    font-size: var(--ui-text-xs);
    cursor: pointer;
  }

  .multi-actions button:hover {
    background: color-mix(in srgb, var(--ui-accent) 22%, var(--ui-input));
  }

  .where {
    color: var(--ui-text-3);
    font-size: var(--ui-text-xs);
    overflow-wrap: anywhere;
  }

  .where .link {
    color: var(--ui-text-2);
    font-size: var(--ui-text-xs);
  }

  .link {
    padding: 0;
    border: 0;
    background: none;
    color: var(--ui-accent);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .classes {
    color: var(--ui-text-2);
    font-size: var(--ui-text-xs);
    word-break: break-word;
  }

  .restarting {
    position: absolute;
    inset: 0;
    z-index: 5;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    background: color-mix(in srgb, var(--ui-panel) 70%, transparent);
    backdrop-filter: blur(2px);
    color: var(--ui-text);
    font-size: var(--ui-text-sm);
    pointer-events: none;
  }
  .server-card {
    position: absolute;
    inset: 0;
    display: grid;
    place-content: center;
    gap: 8px;
    max-width: 420px;
    margin: auto;
    color: var(--ui-text);
    text-align: center;
  }

  .server-label {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    margin: 0;
    font-weight: 600;
  }

  .server-dot-inline {
    width: 8px;
    height: 8px;
    border-radius: var(--ui-radius-full);
  }

  .server-dot-inline.amber { background: #ff9f0a; }
  .server-dot-inline.red { background: #ff453a; }
  .server-dot-inline.green { background: #30d158; }
  .server-dot-inline.grey { background: #8e8e93; }

  .server-reason {
    margin: 0;
    color: var(--ui-text-2);
    white-space: pre-wrap;
    font-size: var(--ui-text-xs);
  }

  .server-actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 6px;
  }

  .empty {
    padding: var(--ui-space-4);
    color: var(--ui-text-2);
    font-size: var(--ui-text-sm);
  }
</style>
