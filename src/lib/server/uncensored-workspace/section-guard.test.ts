import { describe, expect, it } from 'vitest';
import { ProjectMode } from '$lib/project-mode';
import { sectionRefusal } from './section-guard';

describe('sections of an uncensored project', () => {
  it.each([
    ['/p/[projectId]/calendar', 'uncensored_not_publishable'],
    ['/p/[projectId]/promote', 'uncensored_not_publishable'],
    ['/p/[projectId]/ads/social', 'uncensored_not_publishable'],
    ['/p/[projectId]/influencers', 'uncensored_not_in_catalogue'],
    ['/p/[projectId]/c/[canvasId]', null],
    ['/p/[projectId]/settings/content', null]
  ])('%s → %s', (routeId, refusal) => {
    expect(sectionRefusal(ProjectMode.Uncensored, routeId)).toBe(refusal);
  });

  it('a standard project refuses no section', () => {
    expect(sectionRefusal(ProjectMode.Standard, '/p/[projectId]/calendar')).toBeNull();
  });
});
