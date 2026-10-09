import { describe, expect, it } from 'vitest';
import { CHAT_PLACE, ChatPlace, DEFAULT_LAYOUT, Panel, SIDE_DEFAULT_PX, SIDE_MIN_PX, Side, TIMELINE_MIN_PX, Transport, Viewport, flip, readLayout, sheetFloor, sideWidth, timelineHeight, toggleSide, toggleTimeline, transportOf, viewportOf, writeLayout } from './editor-layout';
import { Detent } from './sheet-detents';

function memory() {
  const items = new Map<string, string>();
  return { getItem: (k: string) => items.get(k) ?? null, setItem: (k: string, v: string) => void items.set(k, v) };
}

const broken = {
  getItem: () => {
    throw new Error('blocked');
  },
  setItem: () => {
    throw new Error('blocked');
  }
};

describe('editor layout', () => {
  it('remembers closed panels and the timeline height', () => {
    const store = memory();
    const layout = { chat: Panel.Closed, inspector: Panel.Open, timeline: Panel.Closed, timelinePx: 420, side: Side.Properties, sidePx: 480 };

    writeLayout(store, layout);

    expect(readLayout(store)).toEqual(layout);
  });

  it('falls back to the default when storage is empty, blocked or garbled', () => {
    const garbled = memory();
    garbled.setItem('motion-editor-layout', '{"chat":"sideways","timelinePx":"tall"}');

    expect(readLayout(memory())).toEqual(DEFAULT_LAYOUT);
    expect(readLayout(broken)).toEqual(DEFAULT_LAYOUT);
    expect(readLayout(null)).toEqual(DEFAULT_LAYOUT);
    expect(readLayout(garbled)).toEqual(DEFAULT_LAYOUT);
    expect(() => writeLayout(broken, DEFAULT_LAYOUT)).not.toThrow();
  });

  it('a toggle flips a panel', () => {
    expect(flip(Panel.Open)).toBe(Panel.Closed);
    expect(flip(Panel.Closed)).toBe(Panel.Open);
  });

  it('the timeline never shrinks below its minimum nor leaves the preview without room', () => {
    expect(timelineHeight(50, 900)).toBe(TIMELINE_MIN_PX);
    expect(timelineHeight(400, 900)).toBe(400);
    expect(timelineHeight(5000, 900)).toBeLessThan(900);
    expect(timelineHeight(5000, 200)).toBe(TIMELINE_MIN_PX);
  });

  it('reads the window width as phone, tablet or desktop', () => {
    expect(viewportOf(390)).toBe(Viewport.Phone);
    expect(viewportOf(820)).toBe(Viewport.Tablet);
    expect(viewportOf(1180)).toBe(Viewport.Desktop);
    expect(viewportOf(1440)).toBe(Viewport.Desktop);
  });

  it('keeps the chat a column only on desktop: a drawer on tablet, a sheet on phone', () => {
    expect(CHAT_PLACE[Viewport.Desktop]).toBe(ChatPlace.Column);
    expect(CHAT_PLACE[Viewport.Tablet]).toBe(ChatPlace.Drawer);
    expect(CHAT_PLACE[Viewport.Phone]).toBe(ChatPlace.Sheet);
  });

  it('keeps the side column between its minimum and half the window', () => {
    expect(sideWidth(100, 1440)).toBe(SIDE_MIN_PX);
    expect(sideWidth(450.4, 1440)).toBe(450);
    expect(sideWidth(5000, 1440)).toBe(720);
    expect(sideWidth(5000, 500)).toBe(SIDE_MIN_PX);
    expect(SIDE_DEFAULT_PX).toBeGreaterThan(360);
  });

  it('a toggle shows its segment, and closes the column when that segment is already showing', () => {
    const open = { ...DEFAULT_LAYOUT, side: Side.Chat };

    expect(toggleSide(open, Side.Properties)).toMatchObject({ side: Side.Properties, chat: Panel.Open, inspector: Panel.Open });
    expect(toggleSide(open, Side.Chat)).toMatchObject({ side: Side.Chat, chat: Panel.Closed, inspector: Panel.Closed });
    expect(toggleSide({ ...open, chat: Panel.Closed, inspector: Panel.Closed }, Side.Chat)).toMatchObject({ chat: Panel.Open, inspector: Panel.Open });
  });

  it('the timeline starts shown, and a layout saved before it could hide keeps everything else', () => {
    const store = memory();
    store.setItem('motion-editor-layout', JSON.stringify({ chat: Panel.Closed, inspector: Panel.Closed, timelinePx: 420, side: Side.Chat, sidePx: 480 }));

    expect(DEFAULT_LAYOUT.timeline).toBe(Panel.Open);
    expect(readLayout(store)).toEqual({ chat: Panel.Closed, inspector: Panel.Closed, timeline: Panel.Open, timelinePx: 420, side: Side.Chat, sidePx: 480 });
  });

  it('hiding the timeline keeps its height for when it comes back', () => {
    const hidden = toggleTimeline({ ...DEFAULT_LAYOUT, timelinePx: 420 });

    expect(hidden).toMatchObject({ timeline: Panel.Closed, timelinePx: 420 });
    expect(toggleTimeline(hidden)).toMatchObject({ timeline: Panel.Open, timelinePx: 420 });
  });
});

describe('transport bar', () => {
  it('hides on phone while the agent sheet is half or full', () => {
    expect(transportOf(Viewport.Phone, Detent.Half)).toBe(Transport.Hidden);
    expect(transportOf(Viewport.Phone, Detent.Full)).toBe(Transport.Hidden);
  });

  it('shows on phone at peek or with the agent sheet closed', () => {
    expect(transportOf(Viewport.Phone, Detent.Peek)).toBe(Transport.Shown);
    expect(transportOf(Viewport.Phone, null)).toBe(Transport.Shown);
  });

  it('always shows off phone', () => {
    expect(transportOf(Viewport.Tablet, Detent.Full)).toBe(Transport.Shown);
    expect(transportOf(Viewport.Desktop, Detent.Half)).toBe(Transport.Shown);
  });

  it('lowers the sheet floor to the tabs when hidden', () => {
    expect(sheetFloor(Transport.Shown)).toBe(120);
    expect(sheetFloor(Transport.Hidden)).toBe(56);
  });
});
