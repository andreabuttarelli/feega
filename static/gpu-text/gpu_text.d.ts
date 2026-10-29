/* tslint:disable */
/* eslint-disable */

export class TextCore {
    free(): void;
    [Symbol.dispose](): void;
    addFont(family: string, bytes: Uint8Array): number;
    axisRanges(font: number): Float32Array;
    axisTags(font: number): string;
    covers(font: number, code_point: number): boolean;
    layOut(text: string, family: string, weight: number, size: number, tracking: number, leading: number, spaces: WebSpaces, wrap: WebWrap, room: number): Float32Array;
    metrics(font: number, tags: string, values: Float32Array): Float32Array;
    constructor();
    outline(font: number, tags: string, values: Float32Array, glyph: number): Float32Array;
    shape(font: number, tags: string, values: Float32Array, text: string, ligatures: WebLigatures): Float32Array;
}

export enum WebLigatures {
    On = 0,
    Off = 1,
}

export enum WebSpaces {
    Collapse = 0,
    Keep = 1,
}

export enum WebWrap {
    Wrap = 0,
    NoWrap = 1,
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_textcore_free: (a: number, b: number) => void;
    readonly textcore_addFont: (a: number, b: number, c: number, d: number, e: number) => [number, number, number];
    readonly textcore_axisRanges: (a: number, b: number) => [number, number];
    readonly textcore_axisTags: (a: number, b: number) => [number, number];
    readonly textcore_covers: (a: number, b: number, c: number) => number;
    readonly textcore_layOut: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number) => [number, number];
    readonly textcore_metrics: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number];
    readonly textcore_new: () => number;
    readonly textcore_outline: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => [number, number];
    readonly textcore_shape: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number) => [number, number];
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
