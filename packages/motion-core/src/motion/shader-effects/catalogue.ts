export enum ShaderCategory {
  Gradient = 'gradient',
  Noise = 'noise',
  Glass = 'glass',
  Metal = 'metal',
  Light = 'light',
  Distortion = 'distortion',
  Transition = 'transition',
  Blur = 'blur',
  Cursor = 'cursor'
}

export enum ShaderSource {
  Generator = 'generator',
  Filter = 'filter'
}

export enum ShaderPlay {
  Seekable = 'seekable',
  Live = 'live'
}

export enum ShaderEffectId {
  MeshGradient = 'mesh-gradient',
  FlowingGradient = 'flowing-gradient',
  Aurora = 'aurora',
  Plasma = 'plasma',
  Swirl = 'swirl',
  SimplexNoise = 'simplex-noise',
  FilmGrain = 'film-grain',
  FlutedGlass = 'fluted-glass',
  LiquidMetal = 'liquid-metal',
  BrushedMetal = 'brushed-metal',
  Chrome = 'chrome',
  Godrays = 'godrays',
  LensFlare = 'lens-flare',
  LightLeak = 'light-leak',
  Vignette = 'vignette',
  WaveDistortion = 'wave-distortion',
  ChromaticAberration = 'chromatic-aberration',
  IrisWipe = 'iris-wipe',
  NoiseDissolve = 'noise-dissolve',
  RippleWipe = 'ripple-wipe',
  ZoomBlur = 'zoom-blur',
  ProgressiveBlur = 'progressive-blur',
  CursorRipples = 'cursor-ripples',
  ChromaFlow = 'chroma-flow'
}

export type ShaderNumber = { label: string; min: number; max: number; step: number; fallback: number };

export type ShaderEffectSpec = {
  type: string;
  category: ShaderCategory;
  about: string;
  source: ShaderSource;
  play: ShaderPlay;
  numbers: Record<string, ShaderNumber>;
  colours: Record<string, string>;
  speed?: string;
  stops?: readonly string[];
};

const n = (label: string, min: number, max: number, step: number, fallback: number): ShaderNumber => ({ label, min, max, step, fallback });

const SPEED = (fallback: number, max = 4) => ({ speed: n('Speed', 0, max, 0.05, fallback) });

const PROGRESS = { progress: n('Progress', 0, 1, 0.01, 0.5) };

const generator = (type: string, category: ShaderCategory, about: string, numbers: Record<string, ShaderNumber>, colours: Record<string, string>, extra: Partial<ShaderEffectSpec> = {}): ShaderEffectSpec => ({
  type,
  category,
  about,
  source: ShaderSource.Generator,
  play: ShaderPlay.Seekable,
  numbers,
  colours,
  ...('speed' in numbers ? { speed: 'speed' } : {}),
  ...extra
});

const filter = (type: string, category: ShaderCategory, about: string, numbers: Record<string, ShaderNumber>, colours: Record<string, string> = {}, extra: Partial<ShaderEffectSpec> = {}): ShaderEffectSpec => ({
  ...generator(type, category, about, numbers, colours, extra),
  source: ShaderSource.Filter
});

export const SHADER_EFFECTS: Record<ShaderEffectId, ShaderEffectSpec> = {
  [ShaderEffectId.MeshGradient]: generator('MeshGradient', ShaderCategory.Gradient, 'soft drifting swaths of four colours', { ...SPEED(0.6, 10), swirl: n('Swirl', -1, 1, 0.01, 0.3), variation: n('Variation', 0, 1, 0.01, 0.35), seed: n('Seed', 0, 100, 1, 0) }, { colorA: '#1a0533', colorB: '#6d2fd1', colorC: '#e04b9e', colorD: '#ffdf8e' }, { stops: ['colorA', 'colorB', 'colorC', 'colorD'] }),
  [ShaderEffectId.FlowingGradient]: generator('FlowingGradient', ShaderCategory.Gradient, 'liquid silk bands of four colours', { ...SPEED(1, 10), distortion: n('Distortion', 0, 2, 0.01, 0.5), seed: n('Seed', 0, 100, 1, 0) }, { colorA: '#0a0015', colorB: '#6b17e6', colorC: '#ff4d6a', colorD: '#ff6b35' }),
  [ShaderEffectId.Aurora]: generator('Aurora', ShaderCategory.Gradient, 'aurora curtains with vertical rays', { ...SPEED(3, 10), intensity: n('Intensity', 0, 100, 1, 80), waviness: n('Waviness', 0, 200, 1, 50) }, { colorA: '#a533f8', colorB: '#22ee88', colorC: '#1694e8' }),
  [ShaderEffectId.Plasma]: generator('Plasma', ShaderCategory.Noise, 'glowing plasma between two colours', { ...SPEED(1, 5), density: n('Density', 0, 4, 0.01, 2), intensity: n('Intensity', 0.1, 3, 0.01, 1.5), warp: n('Warp', 0, 1, 0.01, 0.4) }, { colorA: '#7018be', colorB: '#000000' }),
  [ShaderEffectId.Swirl]: generator('Swirl', ShaderCategory.Noise, 'layered noise swirling two colours', { ...SPEED(1, 5), detail: n('Detail', 0, 5, 0.01, 1), blend: n('Blend', 0, 100, 1, 50) }, { colorA: '#1275d8', colorB: '#e19136' }),
  [ShaderEffectId.SimplexNoise]: generator('SimplexNoise', ShaderCategory.Noise, 'organic noise field', { ...SPEED(1, 5), scale: n('Scale', -2, 5, 0.01, 2), contrast: n('Contrast', -2, 5, 0.01, 0), seed: n('Seed', 0, 100, 1, 0) }, { colorA: '#ffffff', colorB: '#000000' }),
  [ShaderEffectId.FilmGrain]: filter('FilmGrain', ShaderCategory.Noise, 'analog film grain over the source', { strength: n('Strength', 0, 1, 0.01, 0.5), bias: n('Bias', 0, 10, 0.1, 2) }),
  [ShaderEffectId.FlutedGlass]: filter('FlutedGlass', ShaderCategory.Glass, 'reeded glass refracting the source', { frequency: n('Flutes', 1, 20, 0.1, 10), refraction: n('Refraction', 0, 4, 0.01, 1.5), aberration: n('Aberration', 0, 1, 0.01, 0.2), angle: n('Angle', 0, 360, 1, 0) }),
  [ShaderEffectId.LiquidMetal]: generator('LiquidMetal', ShaderCategory.Metal, 'molten chrome sphere', { ...SPEED(0.5), turbulence: n('Turbulence', 0, 1.5, 0.01, 1), ripple: n('Ripple', 0.5, 8, 0.01, 4), scale: n('Scale', 0.1, 3, 0.01, 1) }, { lightColor: '#eef0f6', darkColor: '#141414' }),
  [ShaderEffectId.BrushedMetal]: generator('BrushedMetal', ShaderCategory.Metal, 'satin brushed metal sphere', { ...SPEED(0.4), roughness: n('Roughness', 0, 1, 0.01, 0.5), brushAngle: n('Brush angle', 0, 360, 1, 0), scale: n('Scale', 0.1, 3, 0.01, 1) }, { lightColor: '#e9ebef', darkColor: '#26282d' }),
  [ShaderEffectId.Chrome]: generator('Chrome', ShaderCategory.Metal, 'studio-lit mirror chrome sphere', { ...SPEED(0.5), curvature: n('Curvature', 0, 1, 0.01, 0.5), waviness: n('Waviness', 0, 1, 0.01, 0.15), scale: n('Scale', 0.1, 3, 0.01, 1) }, { tint: '#ffffff', warmColor: '#ffa94d', coolColor: '#82a7e6' }),
  [ShaderEffectId.Godrays]: generator('Godrays', ShaderCategory.Light, 'volumetric rays from the top-left corner', { ...SPEED(0.5, 2), density: n('Density', 0, 1, 0.01, 0.3), intensity: n('Intensity', 0, 1, 0.01, 0.8) }, { rayColor: '#4283fb' }),
  [ShaderEffectId.LensFlare]: generator('LensFlare', ShaderCategory.Light, 'camera lens flare with ghosts and halo', { ...SPEED(0.5, 3), intensity: n('Intensity', 0, 2, 0.01, 0.5), ghostIntensity: n('Ghosts', 0, 1, 0.01, 0.4), haloIntensity: n('Halo', 0, 1, 0.01, 0.4) }, {}),
  [ShaderEffectId.LightLeak]: filter('LightLeak', ShaderCategory.Light, 'warm film light leak over the source', { ...SPEED(1), intensity: n('Intensity', 0, 1, 0.01, 0.3), spread: n('Spread', 0.1, 1.5, 0.01, 0.55), flicker: n('Flicker', 0, 1, 0.01, 0.35) }, { colorHot: '#fff3c4', colorMid: '#ff7a2f', colorFringe: '#a63d8f' }),
  [ShaderEffectId.Vignette]: filter('Vignette', ShaderCategory.Light, 'darkened edges framing the centre', { radius: n('Radius', 0, 1.5, 0.01, 0.5), falloff: n('Falloff', 0.01, 1.5, 0.01, 0.5), intensity: n('Intensity', 0, 1, 0.01, 1) }, { color: '#000000' }),
  [ShaderEffectId.WaveDistortion]: filter('WaveDistortion', ShaderCategory.Distortion, 'waves rippling the source', { ...SPEED(1, 5), strength: n('Strength', 0, 1, 0.01, 0.3), frequency: n('Frequency', 0.1, 10, 0.1, 1), angle: n('Angle', 0, 360, 1, 0) }),
  [ShaderEffectId.ChromaticAberration]: filter('ChromaticAberration', ShaderCategory.Distortion, 'RGB split of the source', { strength: n('Strength', 0, 1, 0.01, 0.2), angle: n('Angle', 0, 360, 1, 0) }),
  [ShaderEffectId.IrisWipe]: filter('IrisWipe', ShaderCategory.Transition, 'wipes the source away through a growing circle: keyframe progress 1→0 to reveal it', { ...PROGRESS, feather: n('Feather', 0, 1, 0.01, 0.1) }),
  [ShaderEffectId.NoiseDissolve]: filter('NoiseDissolve', ShaderCategory.Transition, 'dissolves the source away through organic noise: progress 1→0 reveals it', { ...PROGRESS, scale: n('Scale', 0.5, 20, 0.1, 3), softness: n('Softness', 0, 1, 0.01, 0.25) }),
  [ShaderEffectId.RippleWipe]: filter('RippleWipe', ShaderCategory.Transition, 'wipes the source away in concentric rings: progress 1→0 reveals it', { ...PROGRESS, rings: n('Rings', 2, 40, 1, 8), feather: n('Feather', 0, 1, 0.01, 0.2) }),
  [ShaderEffectId.ZoomBlur]: filter('ZoomBlur', ShaderCategory.Blur, 'radial zoom blur from the centre', { intensity: n('Intensity', 0, 100, 1, 30), spiral: n('Spiral', -1, 1, 0.01, 0) }),
  [ShaderEffectId.ProgressiveBlur]: filter('ProgressiveBlur', ShaderCategory.Blur, 'blur growing across the frame', { intensity: n('Intensity', 0, 100, 1, 50), angle: n('Angle', 0, 360, 1, 0) }),
  [ShaderEffectId.CursorRipples]: filter('CursorRipples', ShaderCategory.Cursor, 'fluid ripples following the cursor (interactive embeds only)', { intensity: n('Intensity', 0, 20, 0.1, 10), radius: n('Radius', 0.1, 1, 0.01, 0.5) }, {}, { play: ShaderPlay.Live }),
  [ShaderEffectId.ChromaFlow]: generator('ChromaFlow', ShaderCategory.Cursor, 'liquid colour flow trailing the cursor (interactive embeds only)', { intensity: n('Intensity', 0.5, 1.5, 0.01, 1), radius: n('Radius', 0, 5, 0.01, 3) }, { baseColor: '#0066ff', upColor: '#00ff00', downColor: '#ff0000' }, { play: ShaderPlay.Live })
};

export const SHADER_EFFECT_IDS = Object.values(ShaderEffectId) as [ShaderEffectId, ...ShaderEffectId[]];

export const SEEKABLE_EFFECTS = SHADER_EFFECT_IDS.filter((id) => SHADER_EFFECTS[id].play === ShaderPlay.Seekable);

export const SHADER_TYPES = [...new Set([...SHADER_EFFECT_IDS.map((id) => SHADER_EFFECTS[id].type), 'MeshGradient', 'ImageTexture'])];

export function animatedKeys(spec: ShaderEffectSpec): string[] {
  return [...Object.keys(spec.numbers).filter((key) => key !== spec.speed), ...Object.keys(spec.colours)];
}
