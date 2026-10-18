import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const shell = readFileSync('src/lib/components/motion/MotionEditorShell.svelte', 'utf8');
const settings = readFileSync('src/lib/components/motion/CompositionSettings.svelte', 'utf8');

describe('the editor asks the frame kind table before drawing a video control', () => {
  it('the transport bar with its timecode is drawn only when the table allows it', () => {
    const at = shell.indexOf('<div class="group transport"');

    expect(shell.lastIndexOf('{#if controlShown(doc, VideoControl.Transport)}', at)).toBeGreaterThan(shell.lastIndexOf('</div>', at));
  });

  it('the Design / Motion switch is drawn only when the table allows it', () => {
    const at = shell.indexOf('<div class="mode-switch"');

    expect(shell.slice(at - 80, at)).toContain('{#if controlShown(doc, VideoControl.EditMode)}');
  });

  it('the timeline is gone when the table says so', () => {
    expect(shell).toContain('class:gone={!controlShown(doc, VideoControl.Timeline)}');
  });

  it('play from the keyboard asks the table too', () => {
    expect(shell).toContain('[Command.TogglePlay]: () => (playing = controlShown(doc, VideoControl.Playback) && !playing)');
  });

  it('a still frame keeps a toggle back to motion in its properties', () => {
    expect(settings).toContain('data-testid="still"');
  });
});
