import { describe, expect, it } from 'vitest';
import { ProjectMode } from '$lib/project-mode';
import { sectionRefusal } from './section-guard';

describe('sections of an nsfw project', () => {
  it.each([
    ['/p/[projectId]/calendar', 'nsfw_not_publishable'],
    ['/p/[projectId]/promote', 'nsfw_not_publishable'],
    ['/p/[projectId]/ads/social', 'nsfw_not_publishable'],
    ['/p/[projectId]/influencers', 'nsfw_not_in_catalogue'],
    ['/p/[projectId]/c/[canvasId]', null],
    ['/p/[projectId]/settings/content', null]
  ])('%s → %s', (routeId, refusal) => {
    expect(sectionRefusal(ProjectMode.Nsfw, routeId)).toBe(refusal);
  });

  it('a standard project refuses no section', () => {
    expect(sectionRefusal(ProjectMode.Standard, '/p/[projectId]/calendar')).toBeNull();
  });
});
