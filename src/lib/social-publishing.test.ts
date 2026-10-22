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
    '/p/[projectId]/ads',
    '/p/[projectId]/promote',
    '/p/[projectId]/settings/connected-accounts',
    '/p/[projectId]/settings/connect/[platform]',
    '/p/[projectId]/settings/facebook'
  ])('con il flag spento rifiuta %s', (routeId) => {
    expect(routeRefused(SocialPublishing.Off, routeId)).toBe(true);
    expect(routeRefused(SocialPublishing.On, routeId)).toBe(false);
  });

  it.each([
    '/p/[projectId]/c/[canvasId]',
    '/api/v1/motion/agent',
    '/p/[projectId]/settings/project',
    null
  ])('lascia passare %s', (routeId) => {
    expect(routeRefused(SocialPublishing.Off, routeId)).toBe(false);
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
