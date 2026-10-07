import type { DeepState } from './loop';

export const DIRECTOR_TOOLS = ['analyze_site', 'use_brand', 'list_templates'];
export const ASSET_TOOLS = ['analyze_site', 'use_brand', 'capture_site', 'import_asset', 'generate_music', 'list_assets', 'analyze_audio', 'get_motion_doc'];

export function directorSystem(input: { styleLabel: string; styleRules: readonly string[]; frame: { width: number; height: number }; seconds: number }): string {
  return [
    `You are the director of a short motion video (${input.frame.width}×${input.frame.height}, about ${input.seconds} s unless the brief says otherwise), in the ${input.styleLabel} style. Another agent builds what you plan; a critic then watches the render and sends fixes back.`,
    'Read the brief, read the brand or the site it names (analyze_site, use_brand) and the scene library (list_templates, builtin:scene-*), then write the storyboard. Do not build anything.',
    'The storyboard is a table, one row per scene: start–end in seconds, the scene template, the exact on-screen text (real name, real claim, word for word from the site), the picture it shows (which screenshot and which crop), the movement, and the cut into the next scene. Then three short lists: the rhythm (scene lengths, where the beats land), the assets to prepare (site screenshots to capture, logo, pictures to import, the music to generate: genre, mood, tempo), and what must not happen.',
    'Make it something a client would pay for: the look of an Apple, Linear or Vercel launch film (few elements, huge type, the real product, a sober palette) with high energy. Kinetic typography on the beat, cuts every 1–2.5 s on the music, every scene moving (push-ins, pans, devices flying and turning in 3D, camera moves), speed ramps into the cuts, at least one match cut, and one clear wow peak about two thirds in. Never a slideshow, never a picture that holds still. A hook in the first second, an end card with the real website.',
    'Music is always there: plan the track (genre, mood, tempo in bpm) and write the beat grid into the rhythm list. Prefer a site capture (crisp 1920×1080 screenshots) to small og:images for any product UI.',
    `Style rules:\n${input.styleRules.map((r) => `- ${r}`).join('\n')}`
  ].join('\n\n');
}

export function assetsPrompt(input: { brief: string; storyboard: string }): string {
  return [
    `Brief:\n${input.brief}`,
    `Storyboard:\n${input.storyboard}`,
    'Prepare every asset this storyboard lists, and nothing else yet: capture_site for product screenshots, import_asset for the logo (svg first) and the pictures, generate_music for the music bed (always: instrumental, the length of the video, the tempo in bpm in the prompt), then analyze_audio on it. Call independent tools together. Skip what fails, never invent a url. Then answer with the asset ids, what each one shows, the music tempo and beats, and the music license when the tool returns one, one line each.'
  ].join('\n\n');
}

export function buildPrompt(input: { brief: string; storyboard: string; assets: string; fixes: string[]; iteration: number }): string {
  const first = [
    `Brief:\n${input.brief}`,
    `Storyboard (follow it):\n${input.storyboard}`,
    `Assets prepared:\n${input.assets || 'none'}`,
    'Build the whole video now with the tools: read the doc, set the length, insert the scenes of the storyboard in order and fill them, keep the music on and cut to its beats (cut_to_beat). Then add the energy: kinetic type on the beat, camera and device moves in every scene, speed ramps, the match cut and the wow peak the storyboard names. Give every scene the picture and the movement the storyboard names. Do not stop halfway: the video must be complete when you end. Answer with one line when done.'
  ];
  const again = [
    `Brief:\n${input.brief}`,
    `Storyboard:\n${input.storyboard}`,
    `Iteration ${input.iteration}. The critic watched the rendered video and asks for these fixes, most important first:\n- ${input.fixes.join('\n- ')}`,
    'Read the doc, then apply every fix with the tools. Change only what the fixes ask, keep what works. Answer with one line per fix: done, or why not.'
  ];
  return (input.fixes.length ? again : first).join('\n\n');
}

export function summaryPrompt(state: DeepState, brief: string): string {
  return [
    `Brief:\n${brief}`,
    `What happened, phase by phase:\n${state.notes.map((n) => `- ${n.phase} ${n.iteration ? `#${n.iteration}` : ''}: ${n.text}`).join('\n')}`,
    state.verdict ? `Last critique: score ${state.verdict.score}/10, ${state.verdict.pass ? 'passes' : 'still open'}: ${state.verdict.fixes.join('; ') || 'nothing left'}` : '',
    'Write the user a short summary in the language of the brief: what the video is now, how many review rounds it went through, what the last review still flags if anything. Plain sentences, no tool names.'
  ]
    .filter(Boolean)
    .join('\n\n');
}

export const BUILD_NOTE = 'This is a Deep job: you have time. Build carefully, scene by scene, and finish the whole video in this round. You cannot see frames here: a critic renders the video after you and sends the fixes.';
