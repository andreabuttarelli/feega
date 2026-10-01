import { describe, expect, it } from 'vitest';
import { CoachStep, OnboardingStatus, chainOf, coachVisible, shouldStart, stepOf, type CoachGraph } from './coach';

const text = { id: 't', type: 'text', example: false };
const image = { id: 'i', type: 'image', example: false };
const video = { id: 'v', type: 'video', example: false };

const graph = (nodes: CoachGraph['nodes'], edges: CoachGraph['edges'] = []): CoachGraph => ({ nodes, edges });

describe('the coach advances only on what the user actually did', () => {
  it('starts by asking for a text node', () => {
    expect(stepOf(graph([]))).toBe(CoachStep.AddText);
  });

  it('a loose image is not the second step: it must hang off the text', () => {
    expect(stepOf(graph([text, image]))).toBe(CoachStep.AddImage);
    expect(stepOf(graph([text, image], [{ source: 't', target: 'i' }]))).toBe(CoachStep.AddVideo);
  });

  it('a video wired to the image completes the chain, then asks to run', () => {
    const chain = graph([text, image, video], [{ source: 't', target: 'i' }, { source: 'i', target: 'v' }]);
    expect(stepOf(chain)).toBe(CoachStep.Run);
    expect(chainOf(chain)).toEqual({ text: 't', image: 'i', video: 'v' });
  });

  it('a video wired to the text instead of the image does not count', () => {
    expect(stepOf(graph([text, image, video], [{ source: 't', target: 'i' }, { source: 't', target: 'v' }]))).toBe(CoachStep.AddVideo);
  });

  it('once the example results are shown, it offers the real run', () => {
    const ran = graph(
      [{ ...text, example: true }, { ...image, example: true }, { ...video, example: true }],
      [{ source: 't', target: 'i' }, { source: 'i', target: 'v' }]
    );
    expect(stepOf(ran)).toBe(CoachStep.Generate);
  });
});

describe('who sees the coach', () => {
  const fresh = { status: null, signupCampaign: null, nodeCount: 0, hasGenerated: false };

  it('a brand-new user without a campaign starts it', () => {
    expect(shouldStart(fresh)).toBe(true);
  });

  it('a user who came from a landing page gets the template instead', () => {
    expect(shouldStart({ ...fresh, signupCampaign: 'anime-video-generator' })).toBe(false);
  });

  it('a user who already built or generated something never starts it', () => {
    expect(shouldStart({ ...fresh, nodeCount: 1 })).toBe(false);
    expect(shouldStart({ ...fresh, hasGenerated: true })).toBe(false);
  });

  it('dismissed or completed is forever', () => {
    expect(shouldStart({ ...fresh, status: OnboardingStatus.Dismissed })).toBe(false);
    expect(coachVisible({ status: OnboardingStatus.Dismissed, hasGenerated: false })).toBe(false);
    expect(coachVisible({ status: OnboardingStatus.Completed, hasGenerated: false })).toBe(false);
  });

  it('an active coach disappears once anything is generated for real', () => {
    expect(coachVisible({ status: OnboardingStatus.Active, hasGenerated: false })).toBe(true);
    expect(coachVisible({ status: OnboardingStatus.Active, hasGenerated: true })).toBe(false);
  });
});
