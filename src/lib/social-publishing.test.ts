import { describe, expect, it } from 'vitest';
import {
  SocialPublishing,
  socialPublishingOf,
  routeRefused,
  visibleUnder,
  shownUnder,
  SOCIAL_PUBLISHING_SURFACE
} from './social-publishing';

describe('social publishing flag', () => {
  it('è spento quando la riga manca o non è accesa', () => {
    expect(socialPublishingOf(null)).toBe(SocialPublishing.Off);
    expect(socialPublishingOf(false)).toBe(SocialPublishing.Off);
    expect(socialPublishingOf(true)).toBe(SocialPublishing.On);
  });

  it.each([
    ['/p/[projectId]/calendar', ''],
    ['/p/[projectId]/ads', ''],
    ['/p/[projectId]/promote', ''],
    ['/p/[projectId]/promote', '?/propose_ad'],
    ['/p/[projectId]/settings/connected-accounts', ''],
    ['/p/[projectId]/settings/connect/[platform]', ''],
    ['/p/[projectId]/settings/facebook', ''],
    ['/(public)/docs/api/posts', ''],
    ['/api/v1/org/posts/[id]/deliveries', ''],
    ['/api/v1/brands/[slug]/social/connect', ''],
    ['/api/v1/brands/[slug]/publishing', ''],
    ['/api/v1/health/accounts/tick', ''],
    ['/p/[projectId]/c/[canvasId]', '?/create_post'],
    ['/p/[projectId]/c/[canvasId]', '?/calendar_posts'],
    ['/p/[projectId]/c/[canvasId]', '?/schedule_post'],
    ['/app/studio/[batchId]', '?/calendar']
  ])('con il flag spento rifiuta %s%s', (routeId, search) => {
    expect(routeRefused(SocialPublishing.Off, routeId, search)).toBe(true);
    expect(routeRefused(SocialPublishing.On, routeId, search)).toBe(false);
  });

  it.each([
    ['/p/[projectId]/c/[canvasId]', '?/run'],
    ['/p/[projectId]/c/[canvasId]', ''],
    ['/p/[projectId]/calendarx', ''],
    ['/api/v1/motion/agent', ''],
    ['/p/[projectId]/settings/project', ''],
    [null, '']
  ])('lascia passare %s%s', (routeId, search) => {
    expect(routeRefused(SocialPublishing.Off, routeId, search)).toBe(false);
  });

  it('nasconde dalla lista solo le voci di pubblicazione', () => {
    const items = ['text', 'calendar', 'motion'];
    expect(visibleUnder(SocialPublishing.Off, SOCIAL_PUBLISHING_SURFACE.addable, items)).toEqual(['text', 'motion']);
    expect(visibleUnder(SocialPublishing.On, SOCIAL_PUBLISHING_SURFACE.addable, items)).toEqual(items);
  });

  it('il bottone Promote della barra in alto esiste solo col flag acceso', () => {
    expect(shownUnder(SocialPublishing.Off, SOCIAL_PUBLISHING_SURFACE.topBarActions, 'promote')).toBe(false);
    expect(shownUnder(SocialPublishing.On, SOCIAL_PUBLISHING_SURFACE.topBarActions, 'promote')).toBe(true);
  });
});
