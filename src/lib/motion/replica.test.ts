import { describe, expect, it } from 'vitest';
import { FORMATS, MotionFormat, newMotionDoc } from './doc';
import { addClip } from './timeline';
import { REPLICA_BRIEF, VideoKind, asksReplica, kindTools, replicaCanvas, replicaFormat, kindOf, lockBreach, replicaSource } from './replica';

describe('a request to recreate a reference video', () => {
  it.each(['Recreate this video as faithfully as possible', 'replicate it', 'remake this one', 'ricrea questo video', 'Recrea este vídeo', 'refais cette vidéo'])('"%s" asks for a replica', (message) => {
    expect(asksReplica(message)).toBe(true);
  });

  it('a new video inspired by nothing is not a replica', () => {
    expect(asksReplica('Make a launch teaser for our app')).toBe(false);
  });

  it('only a turn carrying a video reference makes a replica of it, and it stays one', () => {
    expect(replicaSource({ message: 'Recreate this video', videoId: 'v-1', replicaOf: undefined })).toBe('v-1');
    expect(replicaSource({ message: 'Recreate this video', videoId: undefined, replicaOf: undefined })).toBeNull();
    expect(replicaSource({ message: 'Build the video from the script.', videoId: undefined, replicaOf: 'v-1' })).toBe('v-1');
    expect(kindOf('v-1')).toBe(VideoKind.Replica);
    expect(kindOf(null)).toBe(VideoKind.Standard);
  });
});

describe('the replica takes the reference canvas', () => {
  it('a 16:9 reference gives a 16:9 video, not the 9:16 default (live test: Cautiva came out portrait)', () => {
    expect(replicaFormat({ width: 1920, height: 1080 })).toBe(MotionFormat.Landscape);
    expect(replicaFormat({ width: 1280, height: 720 })).toBe(MotionFormat.Landscape);
    expect(replicaFormat({ width: 720, height: 1280 })).toBe(MotionFormat.Vertical);
    expect(replicaFormat({ width: 1000, height: 1000 })).toBe(MotionFormat.Square);
    expect(replicaFormat({ width: 1080, height: 1350 })).toBe(MotionFormat.Portrait);
  });

  it('an empty doc gets the reference format and duration', () => {
    const doc = newMotionDoc(MotionFormat.Vertical);
    const out = replicaCanvas(doc, { format: MotionFormat.Landscape, durationS: 10.1 });

    expect(out?.width).toBe(FORMATS[MotionFormat.Landscape].width);
    expect(out?.height).toBe(FORMATS[MotionFormat.Landscape].height);
    expect(out?.durationInFrames).toBe(Math.round(10.1 * doc.fps));
  });

  it('a doc already built is left alone', () => {
    const blank = newMotionDoc(MotionFormat.Vertical);
    const added = addClip(blank, { component: 'Title', from: 0, durationInFrames: 30, props: { text: 'Hi' } }, 'a');
    if (!added.ok) {
      throw new Error(added.error);
    }

    expect(replicaCanvas(added.doc, { format: MotionFormat.Landscape, durationS: 10 })).toBeNull();
  });

  it('the brief asks for scene-by-scene fidelity and no empty span', () => {
    ['scene by scene', 'hex', 'condensed', 'transition', 'camera', 'black', 'reference frames'].forEach((word) => expect(REPLICA_BRIEF.toLowerCase()).toContain(word));
  });
});

describe('a replica is drawn from the reference, never from the kit (live test: Cautiva and the SaaS remake both started from list_templates, add_template and add_shot)', () => {
  const names = ['list_templates', 'get_template', 'add_template', 'set_template_fields', 'list_shots', 'add_shot', 'add_ui', 'ui_morph_reel', 'apply_layout', 'apply_text_preset', 'add_clip', 'set_props', 'recreate_ui', 'view_frames'];

  it('the template, shot, kit-UI and preset tools are not offered', () => {
    expect(kindTools(VideoKind.Replica, names)).toEqual(['add_clip', 'set_props', 'recreate_ui', 'view_frames']);
  });

  it('a standard video keeps them all', () => {
    expect(kindTools(VideoKind.Standard, names)).toEqual(names);
  });
});

describe('a replica is built one scene at a time: earlier scenes are locked', () => {
  const blank = { ...newMotionDoc(MotionFormat.Landscape), durationInFrames: 300 };
  const first = (() => {
    const added = addClip(blank, { component: 'Title', from: 0, durationInFrames: 90, props: { text: 'CAUTIVA' } }, 'one');
    if (!added.ok) {
      throw new Error(added.error);
    }
    return added.doc;
  })();
  const span = { from: 90, to: 150 };
  const add = (doc: typeof first, from: number, id: string) => {
    const added = addClip(doc, { component: 'Title', from, durationInFrames: 30, props: { text: id } }, id);
    if (!added.ok) {
      throw new Error(added.error);
    }
    return added.doc;
  };

  it('adding a clip inside the current scene is allowed', () => {
    expect(lockBreach(first, add(first, 100, 'two'), span)).toBeNull();
  });

  it('touching a clip of an earlier scene is refused', () => {
    const edited = { ...first, tracks: first.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => ({ ...c, props: { text: 'CAUTIVAR' } })) })) };

    expect(lockBreach(first, edited, span)).toMatch(/one.*locked/);
  });

  it('removing a clip of an earlier scene is refused', () => {
    const removed = { ...first, tracks: first.tracks.map((t) => ({ ...t, clips: [] })) };

    expect(lockBreach(first, removed, span)).toMatch(/one/);
  });

  it('a new clip outside the current scene is refused', () => {
    expect(lockBreach(first, add(first, 200, 'later'), span)).toMatch(/later/);
  });
});
