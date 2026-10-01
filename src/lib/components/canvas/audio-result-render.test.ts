import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import AudioResult from './AudioResult.svelte';
import { audioNodeFiles } from '$lib/canvas/download';

const page = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../../routes/p/[projectId]/c/[canvasId]/+page.svelte'), 'utf8');

function html(videoUrl: string | null, audioUrl: string | null): string {
  const files = audioNodeFiles({ nodeId: 'abcdef12', displayName: 'Promo', language: 'it', videoUrl, audioUrl });
  return render(AudioResult, { props: { nodeId: 'abcdef12', videoUrl, audioUrl, files } }).body;
}

describe('the audio node result', () => {
  it('a dubbed video shows the video, the audio track and one download menu', () => {
    const body = html('/assets/v', '/assets/a');

    expect(body).toContain('data-testid="dubbed-video"');
    expect(body).toContain('data-testid="audio-player"');
    expect(body.match(/aria-label="Download"/g)).toHaveLength(1);
    expect(body).not.toContain('Download audio');
  });

  it('an audio output shows the player and the download menu, no video', () => {
    const body = html(null, '/assets/a');

    expect(body).not.toContain('dubbed-video');
    expect(body).toContain('aria-label="Download"');
  });

  it('the canvas renders it for every audio node, with the files named after node and language', () => {
    expect(page).toMatch(/<AudioResult nodeId=\{id\} \{\.\.\.audioUrlsOf\(row\)\} files=\{audioFilesOf\(row, gen\.params\.targetLanguage/);
  });
});
