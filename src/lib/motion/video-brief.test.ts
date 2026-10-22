import { describe, expect, it } from 'vitest';
import { BRIEF_PARAM, BRIEF_TEMPLATES, BriefKind, briefAttachmentIds, briefKind, briefMessage, briefName } from './video-brief';

describe('a brief typed on /app names its video and travels to the editor', () => {
  it('a URL names the video after its host', () => {
    expect(briefName('https://www.acme.com/pricing')).toBe('acme.com');
  });

  it('a description names the video after its first words', () => {
    expect(briefName('A launch teaser for our new running shoe, bold and fast')).toBe('A launch teaser for our new');
  });

  it('an empty brief keeps the default name', () => {
    expect(briefName('   ')).toBe('Untitled video');
  });

  it('attachments travel as asset ids', () => {
    expect(briefAttachmentIds(new URL(`http://x/p?${BRIEF_PARAM}=hi&attach=a1%2Ca2`))).toEqual(['a1', 'a2']);
  });

  it('a brief without files carries no attach param', () => {
    expect(briefAttachmentIds(new URL('http://x/p?brief=hi'))).toEqual([]);
  });

  it('every template is a brief ready to send', () => {
    expect(BRIEF_TEMPLATES.every((t) => t.brief.length > 0 && t.name.length > 0)).toBe(true);
  });

  it('the suggestions start a canvas, lowercase, with more than the three shown so they rotate', () => {
    expect(BRIEF_TEMPLATES.map((t) => t.name)).toEqual(expect.arrayContaining(['a launch poster series', 'an animated product teaser', 'moodboard to motion']));
    expect(BRIEF_TEMPLATES.length).toBeGreaterThan(3);
    expect(BRIEF_TEMPLATES.every((t) => t.name === t.name.toLowerCase())).toBe(true);
  });

  it('a bare URL is a site to read, anything else a brief', () => {
    expect(briefKind('acme.com')).toBe(BriefKind.Site);
    expect(briefKind(' https://www.acme.com/pricing ')).toBe(BriefKind.Site);
    expect(briefKind('A logo reveal for acme.com')).toBe(BriefKind.Text);
  });

  it('a site becomes the launch film request, a brief travels as typed', () => {
    expect(briefMessage('acme.com')).toBe('Make a launch film of https://acme.com');
    expect(briefMessage('https://acme.com/pricing')).toBe('Make a launch film of https://acme.com/pricing');
    expect(briefMessage('A logo reveal on black')).toBe('A logo reveal on black');
  });
});
