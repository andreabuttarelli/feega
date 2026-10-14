import { describe, expect, it } from 'vitest';
import { NodeChrome, clipChrome, nodeChrome } from './selection-chrome';

const open = (selection: string[]) => ({ nodeId: 'm1', selection });

describe('one selection level at a time', () => {
  it('a node that is not selected wears nothing', () => {
    expect(nodeChrome('m1', false, null)).toEqual({
      ring: NodeChrome.None,
      handles: false
    });
  });

  it('the selected node wears the ring and the handles', () => {
    expect(nodeChrome('m1', true, null)).toEqual({
      ring: NodeChrome.Selected,
      handles: true
    });
    expect(nodeChrome('m1', true, open([]))).toEqual({
      ring: NodeChrome.Selected,
      handles: true
    });
  });

  it('with something picked inside its open frame, the node only shows it is open', () => {
    expect(nodeChrome('m1', true, open(['poster']))).toEqual({
      ring: NodeChrome.Editing,
      handles: false
    });
  });

  it('another open frame does not change this node', () => {
    expect(nodeChrome('m2', true, open(['poster']))).toEqual({
      ring: NodeChrome.Selected,
      handles: true
    });
  });
});

describe('the same rule one level down, inside the frame', () => {
  it('a selected clip wears handles until one of its parts is the selection', () => {
    expect(clipChrome(null)).toEqual({
      ring: NodeChrome.Selected,
      handles: true
    });
    expect(clipChrome('lines:1')).toEqual({
      ring: NodeChrome.Editing,
      handles: false
    });
  });
});
