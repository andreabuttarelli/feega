import { GuideId } from '..';
import { CLICK_MS, Key, OFF, ON, type Script } from './script';

export const Target = {
  StateLabel: 'state-label',
  StateSelect: 'state-select',
  StateHover: 'state-item-1',
  ReachBadge: 'reach-badge',
  ReachTrigger: 'reach-trigger',
  BreakpointMd: 'reach-item-3',
  PaddingField: 'padding-field',
  PaddingLabel: 'padding-label',
  OffDot: 'off-dot',
  ScopeThis: 'scope-this',
  ScopeAll: 'scope-all',
  Detach: 'detach',
  Address: 'address',
  Theme: 'theme',
  FitLabel: 'fit-label',
  Fit: 'fit',
  FitContain: 'fit-item-1',
  SwatchFrame: 'swatch-frame',
  LibraryTabs: 'library-tabs',
  CardThumb: 'card-thumb-0',
  CardInsert: 'card-insert-0',
  ChangesTitle: 'changes-title',
  Undo: 'undo',
  Redo: 'redo',
  ShowDiff: 'show-diff'
} as const;

const REACH_AUTO = 'auto';
const REACH_MD = 'md';
const MENU_STATE = 'state';
const MENU_REACH = 'reach';
const MENU_FIT = 'fit';
const SCOPE_SHARED = 'shared';
const SCOPE_SOLO = 'solo';
const THEME_LIGHT = 'light';
const THEME_DARK = 'dark';
const COVER = 'cover';
const CONTAIN = 'contain';
const BLUE = '#3b82f6';
const ORANGE = '#f97316';
const PADDING_STEP = '12';
const PADDING_OFF_STEP = '13';
const PADDING_MD = '28';
const CARD_FIRST = '0';
const SCRUB_DX = 5;
const REACH_FOCUS = { x: 110, y: 222 };
const PADDING_FOCUS = { x: 110, y: 470 };

const click = { press: CLICK_MS } as const;

export const SCRIPTS: Readonly<Record<GuideId, Script>> = {
  [GuideId.States]: {
    duration: 6400,
    poster: 3800,
    rest: { target: Target.StateLabel, dx: 0, dy: 0 },
    initial: { [Key.Menu]: OFF, [Key.State]: 'Default', [Key.Chip]: OFF },
    steps: [
      { at: 900, target: Target.StateSelect, ...click, set: { [Key.Menu]: MENU_STATE } },
      { at: 2400, target: Target.StateHover, ...click, set: { [Key.Menu]: OFF, [Key.State]: 'Hover' } },
      { at: 2900, set: { [Key.Chip]: 'hover:bg-blue-600' } },
      { at: 4800, set: { [Key.Chip]: OFF } },
      { at: 5200, set: { [Key.State]: 'Default' } }
    ]
  },
  [GuideId.Breakpoints]: {
    duration: 7200,
    poster: 4600,
    rest: { target: Target.ReachBadge, dx: 0, dy: 0 },
    initial: { [Key.Menu]: OFF, [Key.Reach]: REACH_AUTO, [Key.Padding]: PADDING_STEP, [Key.Chip]: OFF },
    steps: [
      { at: 800, target: Target.ReachTrigger, ...click, set: { [Key.Menu]: MENU_REACH } },
      { at: 2300, target: Target.BreakpointMd, ...click, set: { [Key.Menu]: OFF, [Key.Reach]: REACH_MD } },
      { at: 2700, focus: PADDING_FOCUS },
      { at: 3500, target: Target.PaddingField },
      { at: 3900, set: { [Key.Padding]: PADDING_MD, [Key.Chip]: 'md:px-7' } },
      { at: 5600, set: { [Key.Chip]: OFF } },
      { at: 5900, focus: REACH_FOCUS, set: { [Key.Reach]: REACH_AUTO, [Key.Padding]: PADDING_STEP } }
    ]
  },
  [GuideId.Shared]: {
    duration: 6200,
    poster: 3600,
    rest: { target: Target.ScopeAll, dx: 0, dy: 0 },
    initial: { [Key.Scope]: SCOPE_SOLO, [Key.Chip]: OFF },
    steps: [
      { at: 900, target: Target.ScopeThis, ...click, set: { [Key.Scope]: SCOPE_SHARED } },
      { at: 2600, target: Target.Detach, ...click, set: { [Key.Scope]: SCOPE_SOLO, [Key.Chip]: 'ButtonHome.jsx' } },
      { at: 4900, set: { [Key.Chip]: OFF } }
    ]
  },
  [GuideId.Snap]: {
    duration: 7800,
    poster: 4200,
    rest: { target: Target.PaddingLabel, dx: 0, dy: 0 },
    initial: { [Key.Value]: PADDING_STEP, [Key.Dot]: OFF, [Key.Alt]: OFF, [Key.Chip]: OFF },
    steps: [
      { at: 800, target: Target.PaddingField, press: 1100 },
      { at: 1300, target: Target.PaddingField, dx: SCRUB_DX, travel: 400, set: { [Key.Value]: PADDING_OFF_STEP } },
      { at: 1750, set: { [Key.Value]: PADDING_STEP } },
      { at: 2400, set: { [Key.Alt]: ON } },
      { at: 3000, target: Target.PaddingField, travel: 600, press: 1300 },
      { at: 3300, target: Target.PaddingField, dx: SCRUB_DX, travel: 300, set: { [Key.Value]: PADDING_OFF_STEP, [Key.Dot]: ON } },
      { at: 3700, set: { [Key.Chip]: 'p-[13px]' } },
      { at: 4800, target: Target.OffDot, ...click, set: { [Key.Value]: PADDING_STEP, [Key.Dot]: OFF, [Key.Alt]: OFF, [Key.Chip]: 'p-3' } },
      { at: 6200, set: { [Key.Chip]: OFF } }
    ]
  },
  [GuideId.Themes]: {
    duration: 6200,
    poster: 3200,
    rest: { target: Target.Address, dx: 0, dy: 0 },
    initial: { [Key.Theme]: THEME_LIGHT, [Key.Chip]: OFF },
    steps: [
      { at: 900, target: Target.Theme, ...click, set: { [Key.Theme]: THEME_DARK } },
      { at: 1500, set: { [Key.Chip]: 'dark:bg-blue-400' } },
      { at: 3900, target: Target.Theme, ...click, set: { [Key.Theme]: THEME_LIGHT, [Key.Chip]: OFF } }
    ]
  },
  [GuideId.Attributes]: {
    duration: 7200,
    poster: 4400,
    rest: { target: Target.FitLabel, dx: 0, dy: 0 },
    initial: { [Key.Menu]: OFF, [Key.Fit]: COVER, [Key.Colour]: BLUE, [Key.Chip]: OFF },
    steps: [
      { at: 900, target: Target.Fit, ...click, set: { [Key.Menu]: MENU_FIT } },
      { at: 2300, target: Target.FitContain, ...click, set: { [Key.Menu]: OFF, [Key.Fit]: CONTAIN, [Key.Chip]: 'object-contain' } },
      { at: 3900, target: Target.SwatchFrame, ...click, set: { [Key.Colour]: ORANGE, [Key.Chip]: `--frame: ${ORANGE}` } },
      { at: 5500, set: { [Key.Fit]: COVER, [Key.Colour]: BLUE, [Key.Chip]: OFF } }
    ]
  },
  [GuideId.Library]: {
    duration: 6800,
    poster: 4000,
    rest: { target: Target.LibraryTabs, dx: 0, dy: 0 },
    initial: { [Key.Card]: OFF, [Key.Inserted]: OFF, [Key.Chip]: OFF },
    steps: [
      { at: 900, target: Target.CardThumb, set: { [Key.Card]: CARD_FIRST } },
      { at: 2300, target: Target.CardInsert, ...click, set: { [Key.Inserted]: ON } },
      { at: 2800, set: { [Key.Chip]: '<AnnouncementBar />' } },
      { at: 5200, set: { [Key.Card]: OFF, [Key.Inserted]: OFF, [Key.Chip]: OFF } }
    ]
  },
  [GuideId.Changes]: {
    duration: 7600,
    poster: 5000,
    rest: { target: Target.ChangesTitle, dx: 0, dy: 0 },
    initial: { [Key.Row]: ON, [Key.Diff]: OFF },
    steps: [
      { at: 900, target: Target.Undo, ...click, set: { [Key.Row]: OFF } },
      { at: 2400, target: Target.Redo, ...click, set: { [Key.Row]: ON } },
      { at: 3900, target: Target.ShowDiff, ...click, set: { [Key.Diff]: ON } },
      { at: 6000, set: { [Key.Diff]: OFF } }
    ]
  }
};
