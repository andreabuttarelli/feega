import type { SupportItem } from './support';
import type { AcpAgent, AcpId } from './host/ai/acp-agents';
import type { AgentEvent, ConfigView, ModeView } from './host/ai/agent-session';
import type { Item } from './host/ai/transcript';
import type { Policy } from './host/ai/permission-policy';
import type { LiveEditAsk } from '@feega/live-edit/live-ask';
import type { Place } from '@feega/live-edit/move-node';
import type { AddKind, AddPlace } from '@feega/live-edit/add-node';
import type { WrapTag } from '@feega/live-edit/wrap-node';
import type { LoopMove } from '@feega/live-edit/move-loop-item';
import type { Usage } from '@feega/live-edit/move-usage';
import type { StructureOp } from '@feega/live-edit/structure';
import type { Scope } from '@feega/live-edit/scoped-rule';
import type { PageTarget } from '@feega/live-edit/page-rule';
import type { ElementState } from '@feega/live-edit/element-state';
import type { EventHandler } from '@feega/live-edit/event-handlers';
import type { GoAsk } from '@feega/live-edit/go-action';
import type { LinkEdit, LinkRead } from '@feega/live-edit/link-edit';
import type { OffsetSide } from '@feega/live-edit/authored-offsets';
import type { Breakpoints } from '@feega/live-edit/breakpoints';
import type { Theme } from '@feega/live-edit/themes';
import type { Scales } from '@feega/live-edit/theme-scales';
import type { CloudComment, CloudRevisions, CommentDraft } from './host/cloud-api';
import type { DiffFile } from './host/diff-preview';
import type { Catalog } from '@feega/plugin-api/external';
import type { Proposal } from '@feega/plugin-api/protocol';
import type { Point, Present, VisitorRole } from '../../packages/share-protocol/src/frame';
import type { ReportFacts, SettingKey, SettingValue, Settings } from './settings';

export enum IconSource {
  Library = 'library',
  IconMcp = 'iconmcp'
}

export type IconHit = { name: string; label?: string; source: IconSource; svg?: string };

export type Rect = { x: number; y: number; width: number; height: number };

export type Source = { file: string; line: number; col: number };

export type Author = { userId: string; name: string };

export enum ImpactKind {
  Local = 'local',
  Component = 'component',
  Unknown = 'unknown'
}

export type UsageSite = { file: string; line: number };

export type Impact = { kind: ImpactKind.Local } | { kind: ImpactKind.Component; name: string; files: UsageSite[] } | { kind: ImpactKind.Unknown; reason: string };

export type ImpactAsk = { at: string } & Partial<EditAsk>;

export enum Gate {
  Ask = 'ask',
  Apply = 'apply'
}

export type Pick = {
  source: Source;
  component: Source | null;
  tag: string;
  rect: Rect;
  styles: Record<string, string>;
  inherited?: Record<string, string>;
  classes: string;
  rem: number;
  viewport: number;
  ownText: boolean;
  inlineText: boolean;
  elements: number;
  name: string;
  parentWidth: number;
  instances: number;
  instanceIndex: number;
  usage: { index: number; count: number };
  classCount: number;
  ancestors: { source: Source; name: string }[];
  inner?: string;
  page?: PageTarget;
  attributes?: { name: string; value: string }[];
  variables?: { name: string; value: string }[];
  markup?: string;
  states?: string[];
};

export enum Move {
  Parent = 'parent',
  Child = 'child',
  Next = 'next',
  Previous = 'previous'
}

export enum Styling {
  Tailwind = 'tailwind',
  Css = 'css'
}

export type EditAsk = LiveEditAsk & { css?: Record<string, string>; scope?: Scope; inner?: string; page?: PageTarget; state?: ElementState; breakpoint?: string; theme?: string };

export enum ServerState {
  Detecting = 'detecting',
  Installing = 'installing',
  Starting = 'starting',
  Running = 'running',
  Reloading = 'reloading',
  Restarting = 'restarting',
  Stopped = 'stopped'
}

export enum ServerAction {
  Start = 'start',
  Restart = 'restart',
  Stop = 'stop',
  ReloadPage = 'reload-page',
  ClearCache = 'clear-cache',
  ShowLogs = 'show-logs',
  ChangeCommand = 'change-command',
  RestartUnderFeega = 'restart-under-feega',
  Cancel = 'cancel',
  ChooseApp = 'choose-app'
}

export type ServerInfo = { url: string; framework: string; command: string; pid: number | null; port: number; attached: boolean; startedAt: number; lastError: string; keptMinutes: number };

export type Wiring = { link: LinkRead | null; events: EventHandler[]; routes: string[]; offsets: OffsetSide[] };

export type ColourPick = { css: string; token?: string };

export type FontChoice = { family: string; google: boolean };

export type MissingFont = { family: string; fallback: string; declared: boolean };

export type Palette = { document: string[]; tokens: { name: string; value: string }[]; fonts: string[]; missing: MissingFont[] };

export enum PluginCall {
  Project = 'project',
  Source = 'source',
  Propose = 'propose',
  Fetch = 'fetch'
}

export type PluginAsk = { call: PluginCall.Project } | { call: PluginCall.Source; at: string } | { call: PluginCall.Propose; proposal: Proposal } | { call: PluginCall.Fetch; url: string };

export type PluginResult = { ok: true; value: unknown } | { ok: false; reason: string };

export type LibraryEntry = { id: string; name: string; description: string; category: string; tags: string[]; tier: string; page: string };

export enum Mode {
  Design = 'design',
  Navigate = 'navigate'
}

export enum ToHost {
  Ready = 'ready',
  Edit = 'edit',
  Impact = 'impact',
  Undo = 'undo',
  Open = 'open',
  Picked = 'picked',
  Restart = 'restart',
  External = 'external',
  Prefs = 'prefs',
  Setting = 'setting',
  Move = 'move',
  Structure = 'structure',
  StructureMany = 'structure-many',
  Detach = 'detach',
  AddImage = 'add-image',
  Server = 'server',
  Redo = 'redo',
  Font = 'font',
  FontReplace = 'font-replace',
  FontLoad = 'font-load',
  SaveVariable = 'save-variable',
  Revert = 'revert',
  Diff = 'diff',
  SourceControl = 'source-control',
  AttachUrl = 'attach-url',
  AddPlugin = 'add-plugin',
  IconSwap = 'icon-swap',
  IconMarkup = 'icon-markup',
  IconGet = 'icon-get',
  IconSearch = 'icon-search',
  IconPreviews = 'icon-previews',
  SignIn = 'sign-in',
  CancelSignIn = 'cancel-sign-in',
  SignOut = 'sign-out',
  OnboardingDone = 'onboarding-done',
  OnboardingStep = 'onboarding-step',
  Support = 'support',
  SkillHintDismiss = 'skill-hint-dismiss',
  SkillHintNever = 'skill-hint-never',
  ImageChoose = 'image-choose',
  ImageUpload = 'image-upload',
  Wiring = 'wiring',
  Link = 'link',
  Attribute = 'attribute',
  Go = 'go',
  Selected = 'selected',
  Context = 'context',
  Copy = 'copy',
  Comments = 'comments',
  CommentAdd = 'comment-add',
  CommentResolve = 'comment-resolve',
  RevisionPublish = 'revision-publish',
  ShareStart = 'share-start',
  ShareStop = 'share-stop',
  ShareKick = 'share-kick',
  ShareRole = 'share-role',
  LibraryList = 'library-list',
  LibraryInsert = 'library-insert',
  Plugin = 'plugin',
  PluginEnable = 'plugin-enable',
  PluginRemove = 'plugin-remove',
  PluginInstall = 'plugin-install',
  PreviewReady = 'preview-ready',
  Cursor = 'cursor',
  AiList = 'ai-list',
  AiStart = 'ai-start',
  AiSend = 'ai-send',
  AiCancel = 'ai-cancel',
  AiAnswer = 'ai-answer',
  AiMode = 'ai-mode',
  AiConfig = 'ai-config',
  AiPolicy = 'ai-policy',
  AiOpen = 'ai-open',
  AiRename = 'ai-rename',
  AiDelete = 'ai-delete',
  AiRetry = 'ai-retry',
  Usage = 'usage'
}

export enum WebviewUsage {
  CopyForAgent = 'copy_for_agent',
  FocusOpened = 'focus_opened',
  FocusPropsChanged = 'focus_props_changed',
  FocusVariantsShown = 'focus_variants_shown',
  StateSwitch = 'state_switch',
  BreakpointSwitch = 'breakpoint_switch',
  ErrorWebview = 'error_webview'
}

export type WebviewUsageDims = Partial<{ variant: string; mode: string; control: string; prop_count: number; state: string; breakpoint: string; error_class: string; area: string }>;

export type ChangeRow = { id: number; at: string; prop: string; value: string; scope: string; files: string[]; time: number; by?: string };

export type Prefs = { size: string; custom: number | null; barClosed: boolean; route?: string; anchor?: string; barWidth?: number; leftWidth?: number; leftClosed?: boolean; layers?: Record<string, { hidden: string[]; locked: string[] }> };

export type ChatRow = { id: string; agent: AcpId; title: string; updatedAt: number; running: boolean };

export enum AdapterState {
  Installing = 'installing',
  Ready = 'ready',
  Failed = 'failed'
}

export type AdapterRow = { agent: AcpId; label: string; state: AdapterState; reason?: string };

export enum AiState {
  Idle = 'idle',
  Starting = 'starting',
  Ready = 'ready',
  Busy = 'busy'
}

export enum ToView {
  App = 'app',
  Status = 'status',
  Edited = 'edited',
  Pick = 'pick',
  Change = 'change',
  Server = 'server',
  Settings = 'settings',
  History = 'history',
  IconResults = 'icon-results',
  IconPreview = 'icon-preview',
  Account = 'account',
  Onboarding = 'onboarding',
  Support = 'support',
  Agents = 'agents',
  SkillHint = 'skill-hint',
  ImageSaved = 'image-saved',
  Wiring = 'wiring',
  Comments = 'comments',
  Share = 'share',
  Library = 'library',
  Plugin = 'plugin',
  Plugins = 'plugins',
  Reload = 'reload',
  Impact = 'impact',
  Preview = 'preview',
  Peers = 'peers',
  AiAgents = 'ai-agents',
  AiState = 'ai-state',
  AiEvent = 'ai-event',
  AiPolicy = 'ai-policy',
  AiChats = 'ai-chats',
  AiChat = 'ai-chat',
  Adapters = 'adapters'
}

export enum ShareState {
  Idle = 'idle',
  Starting = 'starting',
  Live = 'live'
}

export enum OnboardingStep {
  Welcome = 'welcome',
  Agent = 'agent',
  Agents = 'agents',
  SignIn = 'sign_in',
  Support = 'support'
}

export enum AgentId {
  ClaudeCode = 'claude-code',
  Cursor = 'cursor',
  Codex = 'codex',
  Windsurf = 'windsurf',
  Copilot = 'copilot',
  Gemini = 'gemini'
}

export enum OnboardingOutcome {
  Finished = 'finished',
  Skipped = 'skipped'
}

export enum Onboarding {
  Pending = 'pending',
  Seen = 'seen'
}

export enum AccountState {
  SignedOut = 'signed-out',
  Waiting = 'waiting',
  SignedIn = 'signed-in',
  Cancelled = 'cancelled'
}

export type HostMessage =
  | { kind: ToHost.Ready }
  | { kind: ToHost.Edit; ask: EditAsk; gate?: Gate }
  | { kind: ToHost.Impact; id: number; ask: ImpactAsk }
  | { kind: ToHost.Undo }
  | { kind: ToHost.Open; at: Source }
  | { kind: ToHost.Picked; id: number; pick: Pick | null }
  | { kind: ToHost.Restart }
  | { kind: ToHost.External; url: string }
  | { kind: ToHost.Prefs; prefs: Prefs }
  | { kind: ToHost.Setting; key: SettingKey; value: SettingValue }
  | { kind: ToHost.Move; from: string; to: string; place: Place }
  | { kind: ToHost.Structure; op: StructureOp; at: string; to?: string; usage?: Usage; loop?: LoopMove; instance?: number; add?: { kind: AddKind; src?: string; place?: AddPlace }; wrap?: WrapTag }
  | { kind: ToHost.StructureMany; op: StructureOp; targets: { at: string; instance?: number }[]; wrap?: WrapTag }
  | { kind: ToHost.Detach; at: string; usage: string; which: { index: number; count: number } }
  | { kind: ToHost.AddImage; at: string; place?: AddPlace }
  | { kind: ToHost.Server; action: ServerAction }
  | { kind: ToHost.Redo }
  | { kind: ToHost.Font; ask: EditAsk; google: boolean }
  | { kind: ToHost.FontReplace; from: string; to: string; google: boolean }
  | { kind: ToHost.FontLoad; family: string }
  | { kind: ToHost.SaveVariable; ask: EditAsk; name: string }
  | { kind: ToHost.Revert; id: number | null }
  | { kind: ToHost.Diff; id: number }
  | { kind: ToHost.SourceControl }
  | { kind: ToHost.AttachUrl; url: string }
  | { kind: ToHost.AddPlugin }
  | { kind: ToHost.IconSwap; at: string; name: string }
  | { kind: ToHost.IconMarkup; at: string; markup: string; inner?: string }
  | { kind: ToHost.IconGet; at: string; name: string; size: number; stroke: number; inner?: string }
  | { kind: ToHost.IconSearch; id: number; query: string; at: string }
  | { kind: ToHost.IconPreviews; names: string[] }
  | { kind: ToHost.SignIn }
  | { kind: ToHost.CancelSignIn }
  | { kind: ToHost.SignOut }
  | { kind: ToHost.OnboardingDone; outcome: OnboardingOutcome }
  | { kind: ToHost.OnboardingStep; step: OnboardingStep }
  | { kind: ToHost.Support; item: SupportItem }
  | { kind: ToHost.SkillHintDismiss }
  | { kind: ToHost.SkillHintNever }
  | { kind: ToHost.ImageChoose }
  | { kind: ToHost.ImageUpload; name: string; data: string }
  | { kind: ToHost.Wiring; at: string; instance?: number }
  | { kind: ToHost.Link; at: string; edit: LinkEdit; instance?: number }
  | { kind: ToHost.Attribute; at: string; name: string; value: string }
  | { kind: ToHost.Go; at: string; ask: GoAsk }
  | { kind: ToHost.Selected; at: Source | null }
  | { kind: ToHost.Context; text: string | null }
  | { kind: ToHost.Copy; text: string }
  | { kind: ToHost.Comments }
  | { kind: ToHost.CommentAdd; draft: CommentDraft }
  | { kind: ToHost.CommentResolve; id: string }
  | { kind: ToHost.RevisionPublish; summary: string }
  | { kind: ToHost.ShareStart; name: string; canEdit: boolean }
  | { kind: ToHost.ShareStop }
  | { kind: ToHost.ShareKick; userId: string }
  | { kind: ToHost.ShareRole; userId: string; role: VisitorRole }
  | { kind: ToHost.LibraryList }
  | { kind: ToHost.LibraryInsert; id: string; at: string; place: AddPlace }
  | { kind: ToHost.Plugin; id: number; ask: PluginAsk }
  | { kind: ToHost.PluginEnable; id: string; enabled: boolean }
  | { kind: ToHost.PluginRemove; id: string }
  | { kind: ToHost.PluginInstall; source: string }
  | { kind: ToHost.PreviewReady }
  | { kind: ToHost.Cursor; at: Point | null }
  | { kind: ToHost.AiList }
  | { kind: ToHost.AiStart; agent: AcpId }
  | { kind: ToHost.AiSend; text: string; context: string | null }
  | { kind: ToHost.AiCancel }
  | { kind: ToHost.Usage; event: WebviewUsage; dims?: WebviewUsageDims }
  | { kind: ToHost.AiAnswer; id: string; optionId: string | null }
  | { kind: ToHost.AiMode; id: string }
  | { kind: ToHost.AiConfig; id: string; value: string }
  | { kind: ToHost.AiPolicy; policy: Policy }
  | { kind: ToHost.AiOpen; chat: string }
  | { kind: ToHost.AiRename; chat: string; title: string }
  | { kind: ToHost.AiDelete; chat: string }
  | { kind: ToHost.AiRetry };

export type Authored = HostMessage & { by?: Author };

export type ViewMessage =
  | { kind: ToView.App; url: string; styling: Styling; prefs: Prefs | null; route?: string; breakpoints: Breakpoints; themes: Theme[]; scales: Scales | null }
  | { kind: ToView.Server; state: ServerState; reason?: string; info?: ServerInfo }
  | { kind: ToView.Settings; values: Settings; facts: ReportFacts }
  | { kind: ToView.History; changes: ChangeRow[]; canUndo: boolean; canRedo: boolean }
  | { kind: ToView.Status; text: string }
  | { kind: ToView.Edited; ok: boolean; fromHistory?: boolean; reason?: string; written?: string; at?: Source; saved?: Source; note?: string; select?: Source }
  | { kind: ToView.Change; row: string; value: string }
  | { kind: ToView.Pick; id: number; x: number; y: number }
  | { kind: ToView.IconResults; id: number; library: string | null; hits: IconHit[]; error?: string }
  | { kind: ToView.IconPreview; name: string; svg: string | null }
  | { kind: ToView.Account; state: AccountState; email?: string }
  | { kind: ToView.Onboarding; state: Onboarding }
  | { kind: ToView.Support; done: SupportItem[] }
  | { kind: ToView.Agents; found: AgentId[] }
  | { kind: ToView.SkillHint; command: string }
  | { kind: ToView.ImageSaved; url: string }
  | { kind: ToView.Wiring; at: string; instance?: number; wiring: Wiring }
  | { kind: ToView.Comments; enabled: boolean; comments: CloudComment[]; review?: CloudRevisions; error?: string }
  | { kind: ToView.Share; state: ShareState; available: boolean; name: string; canEdit: boolean; url?: string; expiresAt?: string; visitors: Present[]; notice: boolean; error?: string }
  | { kind: ToView.Library; items: LibraryEntry[] }
  | { kind: ToView.Plugin; id: number; result: PluginResult }
  | { kind: ToView.Plugins; catalog: Catalog; canInstall: boolean }
  | { kind: ToView.Reload }
  | { kind: ToView.Impact; id: number; impact: Impact }
  | { kind: ToView.Preview; ask: EditAsk; reason: string; files: DiffFile[]; by?: Author }
  | { kind: ToView.Peers; peers: Present[] }
  | { kind: ToView.AiAgents; agents: AcpAgent[] }
  | { kind: ToView.AiState; state: AiState; agent?: AcpId; chat?: string }
  | { kind: ToView.AiEvent; event: AgentEvent; chat?: string }
  | { kind: ToView.AiPolicy; policy: Policy }
  | { kind: ToView.AiChats; chats: ChatRow[]; active: string | null }
  | { kind: ToView.Adapters; rows: AdapterRow[] }
  | { kind: ToView.AiChat; chat: string | null; agent?: AcpId; state: AiState; items: Item[]; modes: ModeView[]; mode: string | null; configs: ConfigView[] };

export const INSPECT = 'feega:inspect';
export const INSPECT_RESULT = 'feega:inspect:result';
export const PREVIEW = 'feega:preview';
export const PREVIEW_CLEAR = 'feega:preview:clear';
export const PREVIEW_CLEAR_ALL = 'feega:preview:clear-all';
export const PREVIEW_SETTLE = 'feega:preview:settle';
export const PREVIEW_SETTLED = 'feega:preview:settled';
export const LOCATION = 'feega:location';
export const BRIDGE_READY = 'feega:source-map:ready';
export const MODE = 'feega:mode';
export const HIDE = 'feega:hide';
export const PALETTE = 'feega:palette';
export const PALETTE_RESULT = 'feega:palette:result';
export const TREE = 'feega:tree';
export const TREE_RESULT = 'feega:tree:result';

export type LayerNode = { name: string; tag: string; display: string; direction: string; position: string; source: Source | null; component: boolean; count: number; instance: number; children: LayerNode[] };
export const SCROLL = 'feega:scroll';
export const SCROLLED = 'feega:scrolled';
export const REVEAL = 'feega:reveal';
export const FOCUS = 'feega:focus';
export const FOCUSED = 'feega:focused';
export const MOUNT_STATUS = 'feega:mount:status';
export const MOUNT_PROPS = 'feega:mount:props';
export const TEXT_EDIT = 'feega:text:edit';
export const TEXT_DONE = 'feega:text:done';
export const TEXT_RESTORE = 'feega:text:restore';
export const TRACK = 'feega:track';
export const TRACKED = 'feega:tracked';
export const LEAVE = 'feega:leave';
export const FORCE = 'feega:force';
export const THEME = 'feega:theme';

export enum Slot {
  Selected = 'selected',
  Hovered = 'hovered'
}

export const SOCKET_PATH = '/feega-host';

export const LOCAL_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1|\[::1\]):\d+$/;
