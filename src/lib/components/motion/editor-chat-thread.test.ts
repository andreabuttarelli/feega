import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chatEndpoint } from '$lib/components/brand-agent/chat-endpoint';
import { chatSession } from '$lib/components/brand-agent/chat-session.svelte';

const shell = readFileSync(fileURLToPath(new URL('./MotionEditorShell.svelte', import.meta.url)), 'utf8');
const editorChat = shell.match(/<BarSlot [^\n]*\/>/)?.[0] ?? '';

describe('one chat: the editor Chat tab is the canvas thread', () => {
  it('the editor shows the one project right bar, never a chat of its own', () => {
    expect(editorChat).not.toBe('');
    expect(shell).not.toContain('<ChatPanel');
    expect(editorChat).not.toContain('motionNodeId');
  });

  it('it sends the open frame as context, so the canvas chat knows what "this" is', () => {
    expect(editorChat).toContain('context={openFrame}');
    expect(shell).toMatch(/const openFrame = \(\) => \(\{ canvasId: data\.canvas\.id, frame: \{ nodeId: data\.node\.id, selection: session\.selection, playhead/);
  });

  it('the sidebar and the editor share one live session, so a turn shows in both', () => {
    const sidebar = chatSession(chatEndpoint({ projectId: 'p-1' }));
    const editor = chatSession(chatEndpoint({ projectId: 'p-1' }));

    expect(editor).toBe(sidebar);
    expect(chatEndpoint({ projectId: 'p-1' })).toBe('/api/v1/projects/p-1/agent');
  });

  it('the old frame thread stays readable from the editor', () => {
    expect(shell).toContain('<FrameChatHistory historyUrl={agentUrl}');
  });
});
