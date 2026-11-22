import { Framework } from '@feega/plugin-api/protocol';

export const COMPONENT_NAME = 'Scene3D';
export const SCENE_DIR = 'src/feega';
export const RUNTIME_FILE = `${SCENE_DIR}/mount-scene.ts`;
export const SCENE_MARKER = 'data-feega-scene';

export type Scene = { shape: string; material: string; lights: string; autorotate: string; follow: string; color: string; text: string; model: string; font: string; height: string };

export const DEFAULT_SCENE: Scene = { shape: 'cube', material: 'glass', lights: 'studio', autorotate: 'true', follow: 'true', color: '#ff5a1f', text: 'Feega', model: '', font: '', height: '' };

const PROPS = Object.keys(DEFAULT_SCENE) as (keyof Scene)[];

const DATA_ATTRIBUTE: Record<keyof Scene, string> = {
  shape: SCENE_MARKER,
  material: 'data-material',
  lights: 'data-lights',
  autorotate: 'data-autorotate',
  follow: 'data-follow',
  color: 'data-color',
  text: 'data-text',
  model: 'data-model',
  font: 'data-font',
  height: 'data-height'
};

export const attributeText = (scene: Scene) =>
  PROPS.filter((prop) => scene[prop] !== '')
    .map((prop) => `${prop}="${scene[prop]}"`)
    .join(' ');

export function sceneOf(attributes: { name: string; value: string }[]): Scene | null {
  const read = (name: string) => attributes.find((a) => a.name === name)?.value;
  const shape = read(SCENE_MARKER);
  if (shape === undefined) {
    return null;
  }
  return Object.fromEntries(PROPS.map((prop) => [prop, read(DATA_ATTRIBUTE[prop]) ?? DEFAULT_SCENE[prop]])) as Scene;
}

const FILL = 'width: 100%;';
const RATIO = '16 / 9';

const dataSvelte = PROPS.map((prop) => `${DATA_ATTRIBUTE[prop]}={${prop}}`).join(' ');
const dataVue = PROPS.map((prop) => `:${DATA_ATTRIBUTE[prop]}="${prop}"`).join(' ');
const dataAstro = PROPS.map((prop) => `${DATA_ATTRIBUTE[prop]}={${prop}}`).join(' ');
const dataReact = PROPS.map((prop) => `${DATA_ATTRIBUTE[prop]}={options.${prop}}`).join(' ');
const defaultsObject = (quote: string) => `{ ${PROPS.map((prop) => `${prop}: ${quote}${DEFAULT_SCENE[prop]}${quote}`).join(', ')} }`;

const svelte = () => `<script>
  import { onMount } from 'svelte';
  import { mountScene } from './mount-scene';

  let { ${PROPS.map((prop) => `${prop} = '${DEFAULT_SCENE[prop]}'`).join(', ')} } = $props();

  let host = $state();
  let scene;

  const options = $derived({ ${PROPS.join(', ')} });
  const box = $derived('${FILL}' + (height ? 'height:' + height + 'px' : 'aspect-ratio:${RATIO}'));

  $effect(() => {
    scene?.update(options);
  });

  onMount(() => {
    scene = mountScene(host, options);
    return () => scene.dispose();
  });
</script>

<div bind:this={host} class="feega-scene" ${dataSvelte} style={box}></div>
`;

const vue = (typescript: boolean) => `<script setup${typescript ? ' lang="ts"' : ''}>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { mountScene } from './mount-scene';

const props = defineProps({
${PROPS.map((prop) => `  ${prop}: { type: String, default: '${DEFAULT_SCENE[prop]}' }`).join(',\n')}
});

const host = ref${typescript ? '<HTMLElement | null>' : ''}(null);
let scene${typescript ? ': ReturnType<typeof mountScene> | null' : ''} = null;

onMounted(() => {
  scene = mountScene(host.value${typescript ? '!' : ''}, { ...props });
});

watch(props, () => scene?.update({ ...props }));

onBeforeUnmount(() => scene?.dispose());
</script>

<template>
  <div ref="host" class="feega-scene" ${dataVue} :style="{ width: '100%', ...(height ? { height: height + 'px' } : { aspectRatio: '${RATIO}' }) }"></div>
</template>
`;

const astro = () => `---
const { ${PROPS.map((prop) => `${prop} = '${DEFAULT_SCENE[prop]}'`).join(', ')} } = Astro.props;
---

<div class="feega-scene" ${dataAstro} style={'${FILL}' + (height ? 'height:' + height + 'px' : 'aspect-ratio:${RATIO}')}></div>

<script>
  import { mountScene } from './mount-scene';

  document.querySelectorAll<HTMLElement>('[${SCENE_MARKER}]').forEach((host) => {
    if (host.dataset.mounted) {
      return;
    }
    host.dataset.mounted = 'true';
    mountScene(host, {
      shape: host.dataset.feegaScene ?? '${DEFAULT_SCENE.shape}',
${PROPS.filter((prop) => prop !== 'shape')
  .map((prop) => `      ${prop}: host.dataset.${prop} ?? '${DEFAULT_SCENE[prop]}'`)
  .join(',\n')}
    });
  });
</script>
`;

const react = (typescript: boolean) => `'use client';

import { useEffect, useRef } from 'react';
import { mountScene${typescript ? ', type SceneOptions' : ''} } from './mount-scene';

const DEFAULTS${typescript ? ': SceneOptions' : ''} = ${defaultsObject("'")};

export default function ${COMPONENT_NAME}(props${typescript ? ': Partial<SceneOptions>' : ''}) {
  const host = useRef${typescript ? '<HTMLDivElement>' : ''}(null);
  const scene = useRef${typescript ? '<ReturnType<typeof mountScene> | null>' : ''}(null);
  const options = { ...DEFAULTS, ...props };

  useEffect(() => {
    scene.current = mountScene(host.current${typescript ? '!' : ''}, options);
    return () => scene.current?.dispose();
  }, []);

  useEffect(() => {
    scene.current?.update(options);
  }, [JSON.stringify(options)]);

  return <div ref={host} className="feega-scene" ${dataReact} style={{ width: '100%', ...(options.height ? { height: Number(options.height) } : { aspectRatio: '${RATIO}' }) }} />;
}
`;

export type Component = { file: string; source: string };

const COMPONENTS: Record<Framework, (typescript: boolean) => Component> = {
  [Framework.Svelte]: () => ({ file: `${SCENE_DIR}/${COMPONENT_NAME}.svelte`, source: svelte() }),
  [Framework.Vue]: (typescript) => ({ file: `${SCENE_DIR}/${COMPONENT_NAME}.vue`, source: vue(typescript) }),
  [Framework.Astro]: () => ({ file: `${SCENE_DIR}/${COMPONENT_NAME}.astro`, source: astro() }),
  [Framework.React]: (typescript) => ({ file: `${SCENE_DIR}/${COMPONENT_NAME}.${typescript ? 'tsx' : 'jsx'}`, source: react(typescript) })
};

export const componentFor = (framework: Framework, typescript: boolean): Component => COMPONENTS[framework](typescript);
