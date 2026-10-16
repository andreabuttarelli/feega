import { describe, expect, it } from 'vitest';
import fixture from './wiro-tool-list.fixture.json';
import { wiroModelRow } from './wiro-catalogue';
import { taskChoice } from './task-choice';
import { creditsForRun } from '$lib/canvas/gen-cost';

const rowOf = (title: string) => wiroModelRow(fixture.tool.find((t) => t.title === title)!, '2026-09-29T00:00:00.000Z')!;

describe('a synced Wiro row becomes a model choice', () => {
  it('groups under Wiro, carries the uncensored flag and the controls it declares, and takes no image', () => {
    const choice = taskChoice(rowOf('Wan 3.0 Uncensored Video Generator'));

    expect(choice).toMatchObject({
      id: 'wiro/wiro-partners/wan-3-0-uncensored',
      provider: 'wiro',
      providerLabel: 'Wiro',
      uncensored: true,
      resolutions: ['480p', '720p', '1080p'],
      durationOptions: [5, 10, 15, 20, 25, 30],
      minDuration: 5,
      maxDuration: 30,
      maxRefs: 0
    });
    expect(choice.aspectRatios).toContain('9:16');
    expect(choice.params?.map((p) => p.name)).toEqual(expect.arrayContaining(['audioEnabled', 'promptExtend']));
  });

  it('prices every setting combination in credits before the run', () => {
    const choice = taskChoice(rowOf('Wan 3.0 Uncensored Video Generator'));
    expect(creditsForRun({ medium: 'video', model: choice, params: { resolution: '720p', duration: 10 } })).toBe(200);
  });

  it('prices an image model by its extra setting', () => {
    const choice = taskChoice(rowOf('Z Image Uncensored (Wiro-Partners)'));
    expect(creditsForRun({ medium: 'image', model: choice, params: { promptExtend: 'false' } as never })).toBe(3);
  });
});
