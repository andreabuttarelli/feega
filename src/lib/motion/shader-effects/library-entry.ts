import { createGpuUniformsMap, isWebGPUSupported, rootPassthrough, shaderRendererGPU } from 'shaders/core';
import { createSharedDevice } from 'shaders/js';
import { componentDefinition as MeshGradient } from 'shaders/core/MeshGradient';
import { componentDefinition as FlowingGradient } from 'shaders/core/FlowingGradient';
import { componentDefinition as Aurora } from 'shaders/core/Aurora';
import { componentDefinition as Plasma } from 'shaders/core/Plasma';
import { componentDefinition as Swirl } from 'shaders/core/Swirl';
import { componentDefinition as SimplexNoise } from 'shaders/core/SimplexNoise';
import { componentDefinition as FilmGrain } from 'shaders/core/FilmGrain';
import { componentDefinition as FlutedGlass } from 'shaders/core/FlutedGlass';
import { componentDefinition as LiquidMetal } from 'shaders/core/LiquidMetal';
import { componentDefinition as BrushedMetal } from 'shaders/core/BrushedMetal';
import { componentDefinition as Chrome } from 'shaders/core/Chrome';
import { componentDefinition as Godrays } from 'shaders/core/Godrays';
import { componentDefinition as LensFlare } from 'shaders/core/LensFlare';
import { componentDefinition as LightLeak } from 'shaders/core/LightLeak';
import { componentDefinition as Vignette } from 'shaders/core/Vignette';
import { componentDefinition as WaveDistortion } from 'shaders/core/WaveDistortion';
import { componentDefinition as ChromaticAberration } from 'shaders/core/ChromaticAberration';
import { componentDefinition as IrisWipe } from 'shaders/core/IrisWipe';
import { componentDefinition as NoiseDissolve } from 'shaders/core/NoiseDissolve';
import { componentDefinition as RippleWipe } from 'shaders/core/RippleWipe';
import { componentDefinition as ZoomBlur } from 'shaders/core/ZoomBlur';
import { componentDefinition as ProgressiveBlur } from 'shaders/core/ProgressiveBlur';
import { componentDefinition as CursorRipples } from 'shaders/core/CursorRipples';
import { componentDefinition as ChromaFlow } from 'shaders/core/ChromaFlow';
import { componentDefinition as ImageTexture } from 'shaders/core/ImageTexture';
import { mountShader, type Core, type Definition, type Library, type Size } from './adapter';
import { libraryProps, shaderTree } from './preset';
import { SHADER_EFFECTS } from './catalogue';

const DEFINITIONS: Record<string, Definition> = { MeshGradient, FlowingGradient, Aurora, Plasma, Swirl, SimplexNoise, FilmGrain, FlutedGlass, LiquidMetal, BrushedMetal, Chrome, Godrays, LensFlare, LightLeak, Vignette, WaveDistortion, ChromaticAberration, IrisWipe, NoiseDissolve, RippleWipe, ZoomBlur, ProgressiveBlur, CursorRipples, ChromaFlow, ImageTexture } as unknown as Record<string, Definition>;

const LIBRARY: Library = {
  renderer: () => shaderRendererGPU() as unknown as Core,
  definition: (type) => DEFINITIONS[type],
  uniforms: (definition, values, id) => createGpuUniformsMap(definition as never, values, id),
  root: rootPassthrough as unknown as Definition
};

let shared: ReturnType<typeof createSharedDevice> | null = null;

export const supported = async () => Boolean(await isWebGPUSupported());
export const tree = shaderTree;
export const props = libraryProps;
export const effects = SHADER_EFFECTS;
export const notices = ['shaders 4.0.4, Copyright (c) 2026 Shader Effects Inc., MIT licence'];

export async function mount(canvas: HTMLCanvasElement, node: Parameters<typeof mountShader>[2], size: Size) {
  return mountShader(LIBRARY, canvas, node, size, (await (shared ??= createSharedDevice())) ?? undefined);
}
