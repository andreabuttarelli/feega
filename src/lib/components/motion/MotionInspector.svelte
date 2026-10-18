<script lang="ts">
  import { localStore } from '$lib/browser-storage';
  import { setMotionPath } from '$lib/motion/path-ops';
  import IconButton from './IconButton.svelte';
  import { Action } from '$lib/motion/actions';
  import { duckUnder, voicesOver } from '$lib/motion/duck';
  import { PULSE_PROPS, pulseWithMusic } from '$lib/motion/pulse';
  import type { AudioAnalysis } from '$lib/motion/audio-analysis';
  import { AssetKind, COMPONENTS, Control, TrackKind } from '$lib/motion/components';
  import { DEPTH, Space } from '$lib/motion/camera';
  import { setClipDepth } from '$lib/motion/camera-ops';
  import { ParentOpacity, parentChoices } from '$lib/motion/parent';
  import { setParent, setParentOpacity } from '$lib/motion/parent-ops';
  import { findClip } from '$lib/motion/doc';
  import { TRANSITION_KINDS, type Edge } from '$lib/motion/design';
  import { resolveColor, type BrandTokens } from '$lib/motion/brand';
  import type { MotionClip, MotionDoc } from '$lib/motion/doc';
  import { EditMode, designWarning, editIn } from '$lib/motion/edit-mode';
  import { InspectorTab, clipFieldGroups, keyAt, keyedField, toggleKey, valueAt, type Field } from '$lib/motion/inspector';
  import { setMask, setProps, setTiming, setTrackMatte, setTransform, setTransition, Side, type OpResult } from '$lib/motion/timeline';
  import { MASK_KINDS, MASK_KIND_IDS, MATTES, MaskKind, Matte, Needs, newMask, type Mask } from '$lib/motion/mask';
  import { ANIMATABLE, Source, isAnimatable, TRANSFORM, ValueKind, type AnimProp, type KeyValue } from '$lib/motion/keyframes';
  import NumberField from './NumberField.svelte';
  import Dial from './Dial.svelte';
  import InspectorSection from './InspectorSection.svelte';
  import { onMount, type Snippet } from 'svelte';
  import { FieldKind, clockText, parseClock } from '$lib/motion/number-field';
  import { DIAL_KEYS, Part, SECTION_TITLE, Section, Typed, fieldLook, fieldSection, flipSection, isOpen as sectionOpen, readSections, sectionSummary, shadowed, shows, uiHidden, transformSection, type SectionState } from '$lib/motion/inspector-sections';
  import { PropertiesView, sectionsFor } from '$lib/motion/properties-view';
  import { clipName as layerName, setClipFlags } from '$lib/motion/organize';
  import { Flip, flipPatch } from '$lib/motion/layer-props';
  import { YES_NO, Answer, answerOf } from '$lib/motion/segments';
  import FlipHorizontal from '@lucide/svelte/icons/flip-horizontal-2';
  import FlipVertical from '@lucide/svelte/icons/flip-vertical-2';
  import ColorField from './ColorField.svelte';
  import Plus from '@lucide/svelte/icons/plus';
  import Eye from '@lucide/svelte/icons/eye';
  import EyeOff from '@lucide/svelte/icons/eye-off';
  import { IconButton as ShellIconButton, Menu, MenuContent, MenuItem, MenuTrigger } from '$lib/components/ui/shell';
  import { hasSegments, segmentsOf } from '$lib/motion/segments';
  import SegmentedField from './SegmentedField.svelte';
  import FamilyIcon from './FamilyIcon.svelte';
  import { CLIP_FAMILIES, familyOf } from '$lib/motion/track-style';
  import { KeyMark } from '$lib/motion/timeline-layers';
  import type { LayoutStore } from '$lib/motion/editor-layout';
  import CodeEditor from './CodeEditor.svelte';
  import MarkedLines from './MarkedLines.svelte';
  import FillStack from './FillStack.svelte';
  import { FILLED, elementFills } from '$lib/motion/fill/elements';
  import { FILL_LABEL, FILL_TYPES, addFill } from '$lib/motion/fill/model';
  import { Adder } from './stack-adder';
  import StrokeStack from './StrokeStack.svelte';
  import { STROKED, elementStrokes } from '$lib/motion/stroke/elements';
  import { addStroke, sidesShown } from '$lib/motion/stroke/model';
  import { MarkedField, markedField } from '$lib/motion/poster-lines';
  import { componentLabel } from '$lib/motion/poster-parts';
  import FontPicker from './FontPicker.svelte';
  import LutPicker from './LutPicker.svelte';
  import TextPathSection from './TextPathSection.svelte';
  import AutoLayoutSection from './AutoLayoutSection.svelte';
  import { registerFont, setFont } from '$lib/motion/fonts/ops';
  import type { CatalogueFont } from '$lib/motion/fonts/model';
  import { withParams } from '$lib/motion/custom/params';
  import type { CustomSource } from '$lib/motion/custom/component';
  import { setExpression } from '$lib/motion/expression/ops';
  import { EFFECTS, EFFECT_ALPHA, EFFECT_KINDS, editedParams, type EffectKind } from '$lib/motion/effects/registry';
  import SidePopover from '$lib/components/ui/shell/SidePopover.svelte';
  import { addEffect, removeEffect, setEffect } from '$lib/motion/effects/ops';
  import { effectKey } from '$lib/motion/effects/model';
  import { MODIFIERS, MODIFIER_KINDS, type ModifierKind } from '$lib/motion/shape/modifiers';
  import { addModifier, morphHere, removeModifier, setModifier, setPath, shapePath, type ShapeParams } from '$lib/motion/shape/ops';
  import { PRESET as SHAPE_PRESET, SHAPE_PRESETS, applyShapePreset, type ShapePreset } from '$lib/motion/shape/presets';
  import { SHAPE_KINDS, ShapeKind, modifierKey, type Modifier } from '$lib/motion/shape/schema';
  import { cornerRadii, withCorner } from '$lib/motion/shape/geometry';
  import { SELECTOR_SHAPES, animatorKey, type SelectorShape } from '$lib/motion/text-animators/model';
  import { TEXT_COMPONENTS, TEXT_PRESETS, applyPreset as applyTextPreset, removeAnimator, setAnimator, type TextPreset } from '$lib/motion/text-animators/ops';
  import { BLEND_MODES, blendLabel, type BlendMode } from '$lib/motion/blend';
  import { setBlendMode } from '$lib/motion/blend-ops';
  import { setClipsBlur } from '$lib/motion/motion-blur-ops';
  import { expressionErrors, expressionValue } from '$lib/motion/expression/bake';
  import { propsOwner, sliderOf, toShown, toStored, type Ranged } from '$lib/motion/units';
  import { BOUNDS, PHYSICS, PHYSICS_KEYS, PHYSICS_PRESET, PHYSICS_PRESETS, type Bounds, type PhysicsKey, type PhysicsPreset } from '$lib/motion/physics/model';
  import { applyPhysicsPreset, setPhysics } from '$lib/motion/physics/ops';
  import { LinkUse, MediaKind, acceptOf, itemOfPick, pickOfItem } from '$lib/motion/media/pick';
  import MediaPicker from './MediaPicker.svelte';
  import MediaListField from './MediaListField.svelte';
  import type { MediaUploader } from './media-upload';


  type Asset = { id: string; kind: AssetKind; label: string; previewUrl: string; seconds?: number | null };

  let {
    doc,
    analyses = {},
    clip,
    tokens,
    assets,
    frame,
    previousSource = () => null,
    composeHref = null,
    tab = $bindable<InspectorTab>(InspectorTab.Properties),
    onchange,
    onuploadfont,
    upload = null,
    onopen,
    focus = null,
    shared = [],
    sharedWith = 0,
    partFill = null,
    lead,
    mode = EditMode.Motion
  }: {
    doc: MotionDoc;
    analyses?: Record<string, AudioAnalysis>;
    clip: MotionClip;
    tokens: BrandTokens;
    assets: Asset[];
    frame: number;
    previousSource?: (name: string) => CustomSource | null;
    composeHref?: string | null;
    tab?: InspectorTab;
    onchange: (doc: MotionDoc, summary: string) => void;
    onuploadfont?: (file: File) => Promise<string | null>;
    upload?: MediaUploader | null;
    onopen?: (comp: string) => void;
    focus?: readonly string[] | null;
    shared?: readonly string[];
    sharedWith?: number;
    partFill?: Snippet | null;
    lead?: Snippet;
    mode?: EditMode;
  } = $props();

  function leaveOnEscape(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      (e.currentTarget as HTMLTextAreaElement).blur();
    }
  }

  const ANCHOR_STOPS = [0, 0.5, 1] as const;
  const CORNER_NAMES = ['Top-left', 'Top-right', 'Bottom-right', 'Bottom-left'] as const;
  const PERCENT = 100;
  const CORNER_PERCENT_MAX = 50;
  const KEY_STATE = { On: 'on', Lane: 'lane', None: 'none' } as const;
  const MARK: Record<(typeof KEY_STATE)[keyof typeof KEY_STATE], KeyMark> = { [KEY_STATE.On]: KeyMark.Here, [KEY_STATE.Lane]: KeyMark.Animated, [KEY_STATE.None]: KeyMark.None };
  const EDGE_GLYPH: Record<Side, string> = { [Side.In]: '↗', [Side.Out]: '↘' };
  const DEFAULT_EDGE_FRAMES = 12;

  const family = $derived(familyOf(clip.component));
  let sections = $state<SectionState>({});

  onMount(() => {
    sections = readSections(localStore());
  });

  const toggleSection = (section: Section) => (sections = flipSection(sections, family, section, localStore()));
  const segmented = (field: Field) => field.control === Control.Select && hasSegments(field.key);
  const inGrid = (field: Field) => field.control === Control.Range && fieldLook(field.key).short !== null;
  const afterDot = (prop: AnimProp) => prop.label.split(' · ')[1] ?? prop.label;

  function grow(area: HTMLTextAreaElement) {
    area.style.height = 'auto';
    area.style.height = `${area.scrollHeight}px`;
  }

  let error = $state('');
  const voices = $derived(voicesOver(doc, clip.id));
  const pulsable = $derived(PULSE_PROPS.filter((p) => isAnimatable(clip.component, p)));
  let voice = $state('');

  function duck() {
    const voiceId = voices.includes(voice) ? voice : voices[0];
    const assetId = String(findClip(doc, voiceId)?.clip.props.assetId ?? '');
    commit(duckUnder(doc, clip.id, voiceId, analyses[assetId]?.speech ?? null), 'Ducked the music');
  }

  const transformKeys = $derived(new Set(ANIMATABLE[clip.component].filter((p) => p.source === Source.Transform).map((p) => p.key)));
  const typed = $derived(clipFieldGroups(doc, clip).some((g) => g.fields.some((f) => f.control === Control.Font)) ? Typed.Yes : Typed.No);
  const fields = $derived(
    clipFieldGroups(doc, clip)
      .flatMap((g) => g.fields)
      .filter((f) => !uiHidden(f.key))
      .filter((f) => !focus || focus.includes(f.key))
      .filter((f) => !shadowed(f.key, (clip.props as Record<string, unknown>)[f.key], f.fallback, transformKeys))
  );
  const sharedFields = $derived(
    clipFieldGroups(doc, clip)
      .flatMap((g) => g.fields)
      .filter((f) => !uiHidden(f.key) && shared.includes(f.key))
  );
  const animated = $derived(withParams(doc, clip));
  const customName = $derived(clip.component === 'Custom' ? String(clip.props.name) : null);
  const spec = $derived(COMPONENTS[clip.component]);
  const transformProps = $derived(focus ? [] : ANIMATABLE[clip.component].filter((p) => p.source === Source.Transform && p.key !== 'anchorX' && p.key !== 'anchorY'));
  const layoutProps = $derived(transformProps.filter((p) => transformSection(p.key) === Section.Layout));
  const threeDProps = $derived(transformProps.filter((p) => transformSection(p.key) === Section.ThreeD));
  const layerProps = $derived(transformProps.filter((p) => transformSection(p.key) === Section.Layer && p.key !== 'opacity'));
  const opacityProp = $derived(transformProps.find((p) => p.key === 'opacity') ?? null);
  const hasChildren = $derived(doc.tracks.some((t) => t.clips.some((c) => c.parent === clip.id)));
  const flip = (axis: Flip) => commit(setTransform(doc, clip.id, flipPatch({ scaleX: Number(shown('scaleX') ?? 1), scaleY: Number(shown('scaleY') ?? 1) }, axis)), 'Flipped the layer');
  const dialProps = $derived(transformProps.filter((p) => DIAL_KEYS.has(p.key)));
  const fieldsIn = (section: Section) => fields.filter((f) => fieldSection(f, typed) === section);
  const sceneProps = $derived(ANIMATABLE[clip.component].filter((p) => p.source === Source.Scene));
  const maskProps = $derived(ANIMATABLE[clip.component].filter((p) => p.source === Source.Mask));
  const NO_MASK = 'none';
  const pictures = $derived(assets.filter((a) => a.kind === 'image'));
  const resolve = (v: string) => resolveColor(v, tokens);
  const managedSummary = (v: unknown) => `${Array.isArray(v) ? v.length : Object.keys(v ?? {}).length} set`;

  function commit(result: OpResult, summary: string) {
    if (!result.ok) {
      error = result.error;
      return;
    }
    error = '';
    onchange(result.doc, summary);
  }

  function setProp(field: Field, value: unknown) {
    if (keyedField(clip.component, field.key, animated.params)) {
      animate(field.key, value as KeyValue);
      return;
    }
    commit(setProps(doc, clip.id, { [field.key]: value }), `Edited ${field.label.toLowerCase()}`);
  }

  function pickFont(field: Field, family: string, catalogue: CatalogueFont[]) {
    if (clip.component !== 'Custom') {
      commit(setFont(doc, clip.id, { family }, catalogue), `Set the font to ${family}`);
      return;
    }
    const registered = registerFont(doc, family, catalogue);
    commit(registered.ok ? setProps(registered.doc, clip.id, { [field.key]: family }) : registered, `Set ${field.label.toLowerCase()} to ${family}`);
  }

  function setClock(key: 'from' | 'durationInFrames', text: string) {
    const frames = parseClock(text, doc.fps);
    if (frames === null) {
      return;
    }
    commit(setTiming(doc, clip.id, { [key]: frames }), 'Changed timing');
  }

  function setEdge(side: Side, edge: Partial<Edge>) {
    const current = side === Side.In ? clip.transitionIn : clip.transitionOut;
    commit(setTransition(doc, clip.id, side, { ...current, ...edge }), 'Changed transition');
  }

  function setEdgeClock(side: Side, text: string) {
    const frames = parseClock(text, doc.fps);
    if (frames !== null) {
      setEdge(side, { durationInFrames: frames });
    }
  }

  function animate(key: string, value: KeyValue) {
    commit(editIn(mode, doc, clip, key, value, frame), `Edited ${key}`);
  }

  const warning = $derived(designWarning(mode, clip));

  function applyPhysicsOf(select: HTMLSelectElement) {
    const preset = select.value as PhysicsPreset;
    select.value = '';
    if (preset) {
      commit(applyPhysicsPreset(doc, clip.id, preset), `Applied ${PHYSICS_PRESET[preset].label.toLowerCase()} physics`);
    }
  }

  function setPhysicsValue(key: PhysicsKey, value: number) {
    commit(setPhysics(doc, clip.id, { [key]: Math.min(PHYSICS[key].max, Math.max(PHYSICS[key].min, value)) }), `Changed physics ${PHYSICS[key].label.toLowerCase()}`);
  }

  const NO_PARENT = '';

  function clipName(id: string): string {
    const other = findClip(doc, id)?.clip;
    return other ? `${COMPONENTS[other.component].label} · ${id}` : id;
  }

  const faults = $derived(Object.fromEntries(expressionErrors(doc, analyses).filter((f) => f.clipId === clip.id).map((f) => [f.key, f.error])));
  const DEFAULT_EXPRESSION = 'value';

  function toggleExpression(key: string) {
    const off = clip.expressions[key] !== undefined;
    commit(setExpression(doc, clip.id, key, off ? null : DEFAULT_EXPRESSION), off ? `Removed the ${key} expression` : `Added a ${key} expression`);
  }

  function editExpression(key: string, source: string) {
    commit(setExpression(doc, clip.id, key, source), `Edited the ${key} expression`);
  }

  function expressionNow(key: string): string {
    try {
      return String(Math.round(expressionValue(doc, clip.id, key, clip.from + Math.max(0, frame - clip.from), analyses) * 1000) / 1000);
    } catch {
      return '—';
    }
  }

  let draggedEffect = $state<string | null>(null);
  const effectParams = (effectId: string) => animated.params.filter((p) => p.source === Source.Effect && p.key.startsWith(`${effectKey(effectId, '')}`));
  const alphaKeyOf = (effect: { id: string; kind: EffectKind }) => (EFFECT_ALPHA[effect.kind] ? effectKey(effect.id, EFFECT_ALPHA[effect.kind]!.alpha) : null);
  const effectRows = (effect: { id: string; kind: EffectKind }) => {
    const edited = new Set(editedParams(effect.kind).map((p) => effectKey(effect.id, p.key)));
    return effectParams(effect.id).filter((p) => edited.has(p.key));
  };
  let openEffect = $state<string | null>(null);
  let effectHeads = $state<Record<string, HTMLElement>>({});
  let effectsRoot = $state<HTMLElement | null>(null);

  const animatorRows = (id: string) => animated.params.filter((p) => p.source === Source.Animator && p.key.startsWith(animatorKey(id, '')));
  const TEXT_PRESET_SECONDS = 1;

  function addTextPreset(select: HTMLSelectElement) {
    const preset = select.value as TextPreset;
    select.value = '';
    if (preset) {
      commit(applyTextPreset(doc, clip.id, preset, { start: Math.max(0, frame - clip.from), duration: TEXT_PRESET_SECONDS * doc.fps }, crypto.randomUUID().slice(0, 8)), `Added ${preset}`);
    }
  }

  const addEffectOf = (kind: EffectKind) => commit(addEffect(doc, clip.id, kind, crypto.randomUUID().slice(0, 8)), `Added ${EFFECTS[kind].label.toLowerCase()}`);

  const shapeModifiers = $derived(clip.component === 'Shape' ? ((clip.props.modifiers as Modifier[]) ?? []) : []);
  const shapeMorphs = $derived(clip.component === 'Shape' ? ((clip.props.morphs as string[]) ?? []) : []);
  const modifierParams = (id: string) => animated.params.filter((p) => p.source === Source.Modifier && p.key.startsWith(modifierKey(id, '')));

  function addModifierOf(select: HTMLSelectElement) {
    const kind = select.value as ModifierKind;
    select.value = '';
    if (kind) {
      commit(addModifier(doc, clip.id, kind, crypto.randomUUID().slice(0, 8)), `Added ${MODIFIERS[kind].label.toLowerCase()}`);
    }
  }

  function addMorphOf(select: HTMLSelectElement) {
    const kind = select.value as ShapeKind;
    select.value = '';
    if (kind) {
      commit(morphHere(doc, clip.id, kind, frame), `Morphed to ${kind}`);
    }
  }

  function applyShapePresetOf(select: HTMLSelectElement) {
    const preset = select.value as ShapePreset;
    select.value = '';
    if (preset) {
      commit(applyShapePreset(doc, clip.id, preset, () => crypto.randomUUID().slice(0, 8)), `Applied the ${SHAPE_PRESET[preset].label.toLowerCase()} preset`);
    }
  }

  function convertToPath() {
    commit(setPath(doc, clip.id, shapePath(clip.props as unknown as ShapeParams)), 'Converted the shape to a path');
  }

  function dropEffect(index: number) {
    if (draggedEffect) {
      commit(setEffect(doc, clip.id, draggedEffect, { index }), 'Reordered effects');
    }
    draggedEffect = null;
  }

  function toggle(key: string) {
    commit(toggleKey(doc, clip, key, frame, resolve), 'Toggled a keyframe');
  }

  function keyState(key: string) {
    if (keyAt(clip, key, frame)) {
      return KEY_STATE.On;
    }
    return clip.keyframes[key]?.length ? KEY_STATE.Lane : KEY_STATE.None;
  }

  function pickMask(kind: string) {
    if (kind === NO_MASK) {
      commit(setMask(doc, clip.id, null), 'Removed the mask');
      return;
    }
    const picture = (clip.props as { assetId?: string | null }).assetId;
    const asset = pictures.find((a) => a.id === picture)?.id ?? pictures[0]?.id ?? null;
    commit(setMask(doc, clip.id, newMask(kind as MaskKind, asset)), 'Added a mask');
  }

  function editMask(mask: Mask, patch: Partial<Mask>) {
    commit(setMask(doc, clip.id, { ...mask, ...patch }), 'Edited the mask');
  }

  const shown = (key: string) => valueAt(animated, key, frame, resolve);
  const numberShown = (prop: AnimProp) => toShown(clip.component, prop.key, Math.round(Number(shown(prop.key)) * 1000) / 1000, doc);
  const stored = (key: string, v: number) => toStored(clip.component, key, v, doc);
  const slider = (p: Ranged) => sliderOf(clip.component, p, doc);
  const depthRange = $derived(slider({ key: 'depth', ...DEPTH }));
  const fieldRange = (field: Field): Ranged => ({ key: field.key, min: field.min ?? 0, max: field.max ?? 0, step: field.step ?? 1 });
  const fieldShown = (field: Field) => toShown(propsOwner(clip.component), field.key, Number(value(field)), doc);
  const fieldStored = (field: Field, v: number) => toStored(propsOwner(clip.component), field.key, v, doc);
  const fieldSlider = (field: Field) => sliderOf(propsOwner(clip.component), fieldRange(field), doc);
  const value = (field: Field) => (keyedField(clip.component, field.key, animated.params) ? shown(field.key) : (clip.props as Record<string, unknown>)[field.key]);

  const pulseShown = $derived(pulsable.length > 0 && shows(Part.Pulse, family) && doc.tracks.some((t) => t.clips.some((c) => c.component === 'Audio')));
  const visual = $derived(spec.track === TrackKind.Visual);

  const view = $derived(focus ? PropertiesView.Part : PropertiesView.Clip);
  const has: Record<Section, boolean> = $derived({
    [Section.Content]: fieldsIn(Section.Content).length > 0,
    [Section.Layout]: layoutProps.length > 0 || fieldsIn(Section.Layout).length > 0,
    [Section.Layer]: layerProps.length > 0 || fieldsIn(Section.Layer).length > 0 || (visual && !focus),
    [Section.Fill]: !!partFill || fieldsIn(Section.Fill).length > 0,
    [Section.Stroke]: fieldsIn(Section.Stroke).length > 0,
    [Section.Text]: fieldsIn(Section.Text).length > 0,
    [Section.Timing]: true,
    [Section.Shape]: clip.component === 'Shape',
    [Section.Animate]: visual || TEXT_COMPONENTS.has(clip.component) || pulseShown || (voices.length > 0 && shows(Part.Ducking, family)) || fieldsIn(Section.Animate).length > 0 || !!(clip.keyframes.x?.length && clip.keyframes.y?.length),
    [Section.Effects]: visual && clip.component !== 'Null',
    [Section.ThreeD]: threeDProps.length > 0 || sceneProps.length > 0 || fieldsIn(Section.ThreeD).length > 0 || visual,
    [Section.Parent]: visual || maskProps.length > 0
  });

  const SECTION_ACTIONS: Partial<Record<Section, Snippet>> = $derived({ [Section.Effects]: addEffectMenu, ...(FILLED[clip.component] ? { [Section.Fill]: addFillMenu } : {}), ...(STROKED[clip.component] ? { [Section.Stroke]: addStrokeButton } : {}) });

  const BODIES: Record<Section, Snippet> = $derived({
    [Section.Content]: contentBody,
    [Section.Layout]: layoutBody,
    [Section.Layer]: layerBody,
    [Section.Fill]: fillBody,
    [Section.Stroke]: strokeBody,
    [Section.Text]: textBody,
    [Section.Timing]: timingBody,
    [Section.Shape]: shapeBody,
    [Section.Animate]: animateBody,
    [Section.Effects]: effectsBody,
    [Section.ThreeD]: threeDBody,
    [Section.Parent]: parentBody
  });
</script>

<div class="inspector" data-testid="motion-inspector" data-side-edge style={`--hue: ${CLIP_FAMILIES[family].hue};`}>
  <header class="head" title={clip.id} data-testid="selection-head">
    <span class="icon"><FamilyIcon {family} /></span>
    <span class="name">{customName ? componentLabel(customName) : layerName(clip)}</span>
    <span class="kind">{customName ? 'Component' : spec.label}</span>
  </header>

  {#if customName}
    <div class="tabs" role="tablist">
      <button type="button" role="tab" aria-selected={tab === InspectorTab.Properties} class:on={tab === InspectorTab.Properties} onclick={() => (tab = InspectorTab.Properties)}>Properties</button>
      <button type="button" role="tab" aria-selected={tab === InspectorTab.Code} class:on={tab === InspectorTab.Code} onclick={() => (tab = InspectorTab.Code)} data-testid="code-tab-open">Code</button>
    </div>
  {/if}

  {#if warning}<p class="mode-warning" role="status" data-testid="design-animated-warning">{warning}</p>{/if}

  {#if customName && tab === InspectorTab.Code}
    <CodeEditor {doc} name={customName} previous={previousSource(customName)} {onchange} />
  {:else}
    {@render lead?.()}
    {#each sectionsFor(family, view, mode).filter((s) => has[s]) as section (section)}
      <InspectorSection actions={SECTION_ACTIONS[section]} title={SECTION_TITLE[section]} {section} summary={sectionSummary(section, clip, doc.fps)} open={sectionOpen(sections, family, section) || (!!focus && (fieldsIn(section).length > 0 || (section === Section.Fill && !!partFill)))} ontoggle={() => toggleSection(section)}>
        {@render BODIES[section]()}
      </InspectorSection>
    {/each}
    {#if sharedFields.length}
      <details class="shared" data-testid="part-shared">
        <summary>Shared with {sharedWith} {sharedWith === 1 ? 'part' : 'parts'}</summary>
        {#each sharedFields as field (field.key)}{@render fieldRow(field)}{/each}
      </details>
    {/if}
    {#if visual}<AutoLayoutSection {doc} {clip} {commit} />{/if}
  {/if}

  {#if error}<p class="error" role="alert">{error}</p>{/if}
</div>

{#snippet diamond(key: string)}
  <button type="button" class="key" data-mark={MARK[keyState(key)]} title="Keyframe at playhead" aria-label={`Keyframe ${key}`} aria-pressed={keyState(key) === KEY_STATE.On} onclick={() => toggle(key)}></button>
{/snippet}

{#snippet exprEditor(key: string)}
  {#if clip.expressions[key] !== undefined}
    <div class="expr" data-expression={key}>
      <div class="expr-head"><span>ƒ {key}</span><IconButton action={Action.Remove} size={14} label={`Remove the ${key} expression`} onclick={() => toggleExpression(key)} /></div>
      <textarea class="code" rows="2" spellcheck="false" aria-label={`${key} expression`} value={clip.expressions[key]} onchange={(e) => editExpression(key, e.currentTarget.value)}></textarea>
      {#if faults[key]}<p class="expr-error" role="alert">{faults[key]}</p>{:else}<output class="expr-now">= {expressionNow(key)}</output>{/if}
    </div>
  {/if}
{/snippet}

{#snippet animField(prop: AnimProp)}
  {@const look = fieldLook(prop.key, prop.source)}
  {@const range = slider(prop)}
  <NumberField
    label={look.short ?? prop.label}
    kind={look.short ? FieldKind.Glyph : FieldKind.Named}
    name={prop.label}
    value={numberShown(prop)}
    {range}
    unit={range.unit ?? look.unit}
    fill={look.fill}
    mark={MARK[keyState(prop.key)]}
    expression={clip.expressions[prop.key] !== undefined}
    onchange={(v) => animate(prop.key, stored(prop.key, v))}
    onkey={() => toggle(prop.key)}
    onexpression={() => toggleExpression(prop.key)}
  />
{/snippet}

{#snippet animGrid(props: AnimProp[])}
  <div class="grid2">
    {#each props as prop (prop.key)}
      {@const look = fieldLook(prop.key, prop.source)}
      <div class="grid-cell" class:wide={!look.short} data-prop={prop.key}>{@render animField(prop)}</div>
    {/each}
  </div>
  {#each props as prop (prop.key)}{@render exprEditor(prop.key)}{/each}
{/snippet}

{#snippet animList(props: AnimProp[], labelOf: (prop: AnimProp) => string)}
  {#each props as prop (prop.key)}
    <div class="stack" data-prop={prop.key}>{@render animField({ ...prop, label: labelOf(prop) })}</div>
    {@render exprEditor(prop.key)}
  {/each}
{/snippet}

{#snippet rangeField(field: Field)}
  {@const keyed = keyedField(clip.component, field.key, animated.params)}
  {@const look = fieldLook(field.key)}
  {@const range = fieldSlider(field)}
  <NumberField
    label={look.short ?? field.label}
    kind={look.short ? FieldKind.Glyph : FieldKind.Named}
    name={field.label}
    value={fieldShown(field)}
    {range}
    unit={range.unit ?? look.unit}
    fill={look.fill}
    mark={keyed ? MARK[keyState(field.key)] : null}
    expression={clip.expressions[field.key] !== undefined}
    onchange={(v) => setProp(field, fieldStored(field, v))}
    onkey={() => toggle(field.key)}
    onexpression={keyed ? () => toggleExpression(field.key) : undefined}
  />
{/snippet}

{#snippet fieldRow(field: Field)}
  {@const keyed = keyedField(clip.component, field.key, animated.params)}
  {#if field.control === Control.Range}
    <div class="stack" data-prop={field.key}>{@render rangeField(field)}</div>
    {#if keyed}{@render exprEditor(field.key)}{/if}
  {:else if field.control === Control.Fills}
    <div class="stack" data-prop={field.key}><FillStack fills={elementFills(clip.component, clip.props)} adder={Adder.Section} {assets} {tokens} {upload} onchange={(fills, summary) => commit(setProps(doc, clip.id, { fills }), summary)} /></div>
  {:else if field.control === Control.Strokes}
    <div class="stack" data-prop={field.key}><StrokeStack strokes={elementStrokes(clip.component, clip.props)} adder={Adder.Section} sided={sidesShown(clip.props.shape as ShapeKind)} short={Math.min(doc.width, doc.height)} {tokens} onchange={(strokes, summary) => commit(setProps(doc, clip.id, { strokes }), summary)} /></div>
  {:else if markedField(customName ?? '', field.key) === MarkedField.Hidden}
  {:else if markedField(customName ?? '', field.key) === MarkedField.Lines}
    <div class="stack"><MarkedLines {doc} {clip} {onchange} /></div>
  {:else if field.control === Control.Textarea}
    <div class="stack">
      <textarea id={`f-${field.key}`} class="content" aria-label={field.label} rows="3" value={String(value(field) ?? '')} onkeydown={leaveOnEscape} onchange={(e) => setProp(field, e.currentTarget.value)} oninput={(e) => grow(e.currentTarget)}></textarea>
    </div>
  {:else}
    <div class="line">
      <label for={`f-${field.key}`}>{field.label}</label>
      <div class="control">
        {#if field.control === Control.Text}
          <input id={`f-${field.key}`} type="text" value={String(value(field) ?? '')} onchange={(e) => setProp(field, e.currentTarget.value)} />
        {:else if field.control === Control.Select}
          <select id={`f-${field.key}`} value={String(value(field))} onchange={(e) => setProp(field, e.currentTarget.value)}>
            {#each field.options ?? [] as option (option)}<option value={option}>{option}</option>{/each}
          </select>
        {:else if field.control === Control.Toggle}
          <SegmentedField name={field.label} options={YES_NO} value={answerOf(value(field))} onchange={(v) => setProp(field, v === Answer.Yes)} />
        {:else if field.control === Control.Color}
          <ColorField id={`f-${field.key}`} name={field.label} value={value(field)} {tokens} onchange={(v) => setProp(field, v)} />
        {:else if field.control === Control.Asset}
          <MediaPicker label={field.label} value={typeof value(field) === 'string' && value(field) ? { kind: field.assetKind === AssetKind.Video ? MediaKind.Video : MediaKind.Image, assetId: String(value(field)) } : null} {assets} accept={acceptOf(field.assetKind)} links={LinkUse.Import} uploader={upload} onpick={(pick) => setProp(field, pick?.assetId ?? null)} />
        {:else if field.control === Control.MediaItem}
          <MediaPicker label={field.label} value={pickOfItem(value(field))} {assets} accept={acceptOf(field.assetKind)} links={LinkUse.Keep} uploader={upload} onpick={(pick) => setProp(field, itemOfPick(pick))} />
        {:else if field.control === Control.MediaList}
          <MediaListField label={field.label} value={value(field)} {assets} {upload} onchange={(list) => setProp(field, list)} />
        {:else if field.control === Control.Font}
          <FontPicker value={String(value(field))} fonts={doc.fonts} brand={tokens.fonts ?? []} onpick={(family, catalogue) => pickFont(field, family, catalogue)} onupload={onuploadfont} />
        {:else if field.control === Control.Comp}
          <div class="comp">
            <select id={`f-${field.key}`} value={String(value(field))} onchange={(e) => setProp(field, e.currentTarget.value)}>
              {#each Object.entries(doc.comps) as [id, comp] (id)}<option value={id}>{comp.name}</option>{/each}
            </select>
            <button type="button" data-testid="open-comp" disabled={!doc.comps[String(value(field))]} onclick={() => onopen?.(String(value(field)))}>Open</button>
          </div>
        {:else if field.control === Control.Corners}
          {@const radii = cornerRadii(Number(clip.props.roundness ?? 0), (value(field) as number[] | undefined) ?? [])}
          {@const split = ((value(field) as number[] | undefined) ?? []).length > 0}
          {#if split}
            <div class="corners" data-testid="corners">
              {#each CORNER_NAMES as name, i (name)}
                <input type="number" aria-label={`${name} radius`} data-corner={i} min="0" max={CORNER_PERCENT_MAX} step="1" value={Math.round(radii[i] * PERCENT)} onchange={(e) => setProp(field, withCorner(Number(clip.props.roundness ?? 0), radii, i, Number(e.currentTarget.value) / PERCENT))} />
              {/each}
            </div>
          {/if}
          <button type="button" class="split" data-testid="radius-per-corner" aria-pressed={split} onclick={() => setProp(field, split ? [] : radii)}>{split ? 'One radius' : 'Per corner'}</button>
        {:else if field.control === Control.Managed}
          <span class="managed">{managedSummary(value(field))}{#if composeHref} · <a href={composeHref}>Edit in Compositions</a>{/if}</span>
        {/if}
      </div>
      {#if keyed}{@render diamond(field.key)}{/if}
    </div>
  {/if}
{/snippet}

{#snippet groupFields(section: Section)}
  {@const list = fieldsIn(section)}
  {@const gridded = list.filter(inGrid)}
  {#each list.filter((f) => !inGrid(f) && !segmented(f)) as field (field.key)}{@render fieldRow(field)}{/each}
  {#if gridded.length}
    <div class="grid2">
      {#each gridded as field (field.key)}<div class="grid-cell" data-prop={field.key}>{@render rangeField(field)}</div>{/each}
    </div>
    {#each gridded as field (field.key)}{@render exprEditor(field.key)}{/each}
  {/if}
  {#each list.filter(segmented) as field (field.key)}
    <div class="line" data-prop={field.key}>
      <span class="label">{field.label}</span>
      <SegmentedField name={field.label} options={segmentsOf(field.key, field.options ?? [])} value={String(value(field))} onchange={(v) => setProp(field, v)} />
    </div>
  {/each}
{/snippet}

{#snippet contentBody()}
  {@render groupFields(Section.Content)}
{/snippet}

{#snippet fillBody()}
  {@render partFill?.()}
  {@render groupFields(Section.Fill)}
{/snippet}

{#snippet strokeBody()}
  {@render groupFields(Section.Stroke)}
{/snippet}

{#snippet textBody()}
  {@render groupFields(Section.Text)}
{/snippet}

{#snippet layoutBody()}
  {@render groupFields(Section.Layout)}
  {#if layoutProps.length}
    <div class="stackable" data-testid="transform-section">
      {@render animGrid(layoutProps)}
      <div class="line">
        <span class="label">Anchor</span>
        <div class="anchor" role="group" aria-label="Anchor">
          {#each ANCHOR_STOPS as ay (ay)}
            {#each ANCHOR_STOPS as ax (ax)}
              {@const on = (clip.transform.anchorX ?? TRANSFORM.anchorX.fallback) === ax && (clip.transform.anchorY ?? TRANSFORM.anchorY.fallback) === ay}
              <button type="button" class:on aria-label={`Anchor ${ax} ${ay}`} onclick={() => commit(setTransform(doc, clip.id, { anchorX: ax, anchorY: ay }), 'Moved the anchor')}></button>
            {/each}
          {/each}
        </div>
      </div>
    </div>
  {/if}
{/snippet}

{#snippet layerBody()}
  {#if visual && !focus}
    <div class="line layer-look" data-testid="layer-look">
      <select id="blend-mode" aria-label="Blend mode" data-testid="blend-select" value={clip.blend} onchange={(e) => commit(setBlendMode(doc, clip.id, e.currentTarget.value as BlendMode), 'Changed the blend mode')}>
        {#each BLEND_MODES as mode (mode)}<option value={mode}>{blendLabel(mode)}</option>{/each}
      </select>
      {#if opacityProp}
        <input class="opacity-slider" type="range" min="0" max="100" step="1" data-testid="opacity-slider" aria-label="Opacity slider" value={numberShown(opacityProp)} onchange={(e) => animate('opacity', stored('opacity', Number(e.currentTarget.value)))} />
        <div class="opacity-number">{@render animField(opacityProp)}</div>
      {/if}
    </div>
  {/if}
  {#if layerProps.length}<div class="stackable" data-testid="layer-transform">{@render animGrid(layerProps)}</div>{/if}
  {@render groupFields(Section.Layer)}
  {#if visual && !focus}
    <div class="line" data-testid="flip-section">
      <span class="label">Flip</span>
      <ShellIconButton label="Flip horizontal" data-testid="flip-horizontal" onclick={() => flip(Flip.Horizontal)}><FlipHorizontal /></ShellIconButton>
      <ShellIconButton label="Flip vertical" data-testid="flip-vertical" onclick={() => flip(Flip.Vertical)}><FlipVertical /></ShellIconButton>
    </div>
    {#if hasChildren}
      <div class="line" data-prop="clipContent">
        <span class="label">Clip content</span>
        <SegmentedField name="Clip content" options={YES_NO} value={answerOf(clip.clipContent)} onchange={(v) => commit(setClipFlags(doc, clip.id, { clipContent: v === Answer.Yes }), 'Changed clip content')} />
      </div>
    {/if}
    {#if doc.motionBlur.enabled}
      <div class="line" data-testid="clip-blur-section">
        <span class="label">Motion blur</span>
        <SegmentedField name="Motion blur" options={YES_NO} value={answerOf(clip.motionBlur)} onchange={(v) => commit(setClipsBlur(doc, [clip.id], v === Answer.Yes), 'Changed motion blur')} />
      </div>
    {/if}
  {/if}
{/snippet}

{#snippet timingBody()}
  <div class="grid2">
    <label class="clock"><span>In</span><input type="text" aria-label="Start" value={clockText(clip.from, doc.fps)} onchange={(e) => setClock('from', e.currentTarget.value)} /></label>
    <label class="clock"><span>Dur</span><input type="text" aria-label="Length" value={clockText(clip.durationInFrames, doc.fps)} onchange={(e) => setClock('durationInFrames', e.currentTarget.value)} /></label>
  </div>
  {#if shows(Part.Transitions, family)}
    {#each [Side.In, Side.Out] as side (side)}
      {@const edge = side === Side.In ? clip.transitionIn : clip.transitionOut}
      <div class="grid2 transition">
        <label class="clock">
          <span>{EDGE_GLYPH[side]}</span>
          <select aria-label={`Transition ${side}`} value={edge.kind} onchange={(e) => setEdge(side, { kind: e.currentTarget.value as Edge['kind'], durationInFrames: edge.durationInFrames || DEFAULT_EDGE_FRAMES })}>
            {#each TRANSITION_KINDS as kind (kind)}<option value={kind}>{kind}</option>{/each}
          </select>
        </label>
        <label class="clock"><span>Dur</span><input type="text" aria-label={`Transition ${side} duration`} value={clockText(edge.durationInFrames, doc.fps)} onchange={(e) => setEdgeClock(side, e.currentTarget.value)} /></label>
      </div>
    {/each}
  {/if}
{/snippet}

{#snippet shapeBody()}
  <div class="stackable" data-testid="shape-section">
    <div class="line">
      <span class="label">Path</span>
      {#if clip.props.shape !== ShapeKind.Path}
        <button type="button" class="link" data-testid="convert-to-path" onclick={convertToPath}>Convert to editable path</button>
      {:else}
        <span class="managed">Edit points on the preview with the pen tool.</span>
      {/if}
    </div>
    {#each shapeMorphs as _target, i (i)}
      <div class="line">
        <span class="label">Morph {i + 1}</span>
        <IconButton action={Action.Remove} size={14} label={`Remove morph target ${i + 1}`} onclick={() => commit(setProps(doc, clip.id, { morphs: shapeMorphs.filter((_, j) => j !== i) }), 'Removed a morph target')} />
      </div>
    {/each}
    <select class="add" aria-label="Morph to" data-testid="add-morph" title="Adds the shape and keys the morph from the playhead over one second" value="" onchange={(e) => addMorphOf(e.currentTarget)}>
      <option value="">Morph to…</option>
      {#each SHAPE_KINDS.filter((k) => k !== ShapeKind.Path) as kind (kind)}<option value={kind}>{kind}</option>{/each}
    </select>
    <select class="add" aria-label="Liquid preset" data-testid="shape-preset" value="" onchange={(e) => applyShapePresetOf(e.currentTarget)}>
      <option value="">Liquid preset…</option>
      {#each SHAPE_PRESETS as preset (preset)}<option value={preset} title={SHAPE_PRESET[preset].about}>{SHAPE_PRESET[preset].label}</option>{/each}
    </select>
    {#each shapeModifiers as modifier, i (modifier.id)}
      <div class="effect" class:off={!modifier.enabled} data-modifier={modifier.id}>
        <div class="effect-head">
          <label class="effect-name"><input type="checkbox" checked={modifier.enabled} aria-label={`Enable ${MODIFIERS[modifier.kind].label}`} onchange={(e) => commit(setModifier(doc, clip.id, modifier.id, { enabled: e.currentTarget.checked }), 'Toggled a modifier')} />{MODIFIERS[modifier.kind].label}</label>
          <IconButton action={Action.ItemUp} size={14} label="Move modifier up" disabled={i === 0} onclick={() => commit(setModifier(doc, clip.id, modifier.id, { index: i - 1 }), 'Reordered modifiers')} />
          <IconButton action={Action.ItemDown} size={14} label="Move modifier down" disabled={i === shapeModifiers.length - 1} onclick={() => commit(setModifier(doc, clip.id, modifier.id, { index: i + 1 }), 'Reordered modifiers')} />
          <IconButton action={Action.Remove} size={14} label={`Remove ${MODIFIERS[modifier.kind].label}`} onclick={() => commit(removeModifier(doc, clip.id, modifier.id), 'Removed a modifier')} />
        </div>
        {@render animList(modifierParams(modifier.id), afterDot)}
      </div>
    {/each}
    <select class="add" aria-label="Add modifier" data-testid="add-modifier" value="" onchange={(e) => addModifierOf(e.currentTarget)}>
      <option value="">Add modifier…</option>
      {#each MODIFIER_KINDS as kind (kind)}<option value={kind}>{MODIFIERS[kind].label}</option>{/each}
    </select>
  </div>
{/snippet}

{#snippet animateBody()}
  {#if TEXT_COMPONENTS.has(clip.component)}
    <div class="stackable" data-testid="text-animators-section">
      {#each clip.animators as animator, i (animator.id)}
        <div class="effect" data-animator={animator.id}>
          <div class="effect-head">
            <span class="effect-name">Animator {i + 1} · {animator.unit}</span>
            <select aria-label="Selector shape" value={animator.shape} onchange={(e) => commit(setAnimator(doc, clip.id, animator.id, { shape: e.currentTarget.value as SelectorShape }), 'Changed a text animator')}>
              {#each SELECTOR_SHAPES as shape (shape)}<option value={shape}>{shape}</option>{/each}
            </select>
            <IconButton action={animator.seed === null ? Action.Shuffle : Action.InOrder} size={14} onclick={() => commit(setAnimator(doc, clip.id, animator.id, { seed: animator.seed === null ? 1 : null }), 'Changed a text animator')} />
            <IconButton action={Action.Remove} size={14} label={`Remove animator ${i + 1}`} onclick={() => commit(removeAnimator(doc, clip.id, animator.id), 'Removed a text animator')} />
          </div>
          {@render animList(animatorRows(animator.id).filter((p) => p.kind === ValueKind.Number), afterDot)}
        </div>
      {/each}
      <select class="add" aria-label="Add text preset" data-testid="add-text-preset" value="" onchange={(e) => addTextPreset(e.currentTarget)}>
        <option value="">Add text animation…</option>
        {#each TEXT_PRESETS as preset (preset)}<option value={preset}>{preset}</option>{/each}
      </select>
    </div>
    <TextPathSection {doc} {clip} params={animated.params} row={animField} {commit} />
  {/if}
  {#if pulseShown}
    <div class="line" data-testid="pulse-section">
      <span class="label">Pulse with music</span>
      <div class="chips">
        {#each pulsable as prop (prop)}<button type="button" class="chip" data-pulse={prop} onclick={() => commit(pulseWithMusic(doc, clip.id, prop), `Pulsed ${prop} with the music`)}>{prop}</button>{/each}
      </div>
    </div>
  {/if}
  {#if voices.length && shows(Part.Ducking, family)}
    <div class="line" data-testid="duck-section">
      <span class="label">Ducking</span>
      <div class="control duck">
        <select aria-label="Voice-over" value={voice || voices[0]} onchange={(e) => (voice = e.currentTarget.value)}>
          {#each voices as id (id)}<option value={id}>{clipName(id)}</option>{/each}
        </select>
        <button type="button" class="secondary" data-testid="duck" onclick={duck}>Duck</button>
      </div>
    </div>
  {/if}
  {#if clip.keyframes.x?.length && clip.keyframes.y?.length}
    <div class="checks" data-testid="path-row">
      <label class="check"><input type="checkbox" checked={!!clip.path} onchange={(e) => commit(setMotionPath(doc, clip.id, { enabled: e.currentTarget.checked }), 'Toggled the motion path')} /> Motion path</label>
      {#if clip.path}
        <label class="check"><input type="checkbox" checked={clip.path.autoOrient} onchange={(e) => commit(setMotionPath(doc, clip.id, { autoOrient: e.currentTarget.checked }), 'Toggled auto-orient')} /> Auto-orient</label>
      {/if}
    </div>
  {/if}
  {#if visual}
    <div class="stackable" data-testid="physics-section">
      <div class="line">
        <label class="label" for="physics-preset">Physics</label>
        <select id="physics-preset" aria-label="Physics preset" data-testid="physics-preset" value="" onchange={(e) => applyPhysicsOf(e.currentTarget)}>
          <option value="">Physics preset…</option>
          {#each PHYSICS_PRESETS as preset (preset)}<option value={preset} title={PHYSICS_PRESET[preset].about}>{PHYSICS_PRESET[preset].label}</option>{/each}
        </select>
      </div>
      {#if clip.physics}
        {@const physics = clip.physics}
        {#each PHYSICS_KEYS as key (key)}
          <div class="stack" data-physics={key}>
            <NumberField label={PHYSICS[key].label} kind={FieldKind.Named} name={PHYSICS[key].label} value={physics[key]} range={PHYSICS[key]} onchange={(v) => setPhysicsValue(key, v)} />
          </div>
        {/each}
        <div class="line">
          <label class="label" for="physics-bounds">Bounces on</label>
          <select id="physics-bounds" value={physics.bounds} onchange={(e) => commit(setPhysics(doc, clip.id, { bounds: e.currentTarget.value as Bounds }), 'Changed physics bounds')}>
            {#each BOUNDS as bounds (bounds)}<option value={bounds}>{bounds}</option>{/each}
          </select>
        </div>
        <label class="check"><input type="checkbox" checked={physics.collide} onchange={(e) => commit(setPhysics(doc, clip.id, { collide: e.currentTarget.checked }), 'Toggled physics collisions')} />Collide with other clips</label>
        <button type="button" class="link" data-testid="physics-off" onclick={() => commit(setPhysics(doc, clip.id, null), 'Removed physics')}>Remove physics</button>
      {/if}
    </div>
  {/if}
  {@render groupFields(Section.Animate)}
{/snippet}

{#snippet addFillMenu()}
  <Menu>
    <MenuTrigger>
      {#snippet child({ props })}
        <ShellIconButton {...props} label="Add fill" data-testid="fill-add"><Plus /></ShellIconButton>
      {/snippet}
    </MenuTrigger>
    <MenuContent align="end">
      {#each FILL_TYPES as type (type)}<MenuItem label={FILL_LABEL[type]} onSelect={() => commit(setProps(doc, clip.id, { fills: addFill(elementFills(clip.component, clip.props), type) }), 'Add fill')} />{/each}
    </MenuContent>
  </Menu>
{/snippet}

{#snippet addStrokeButton()}
  <ShellIconButton label="Add stroke" data-testid="stroke-add" onclick={() => commit(setProps(doc, clip.id, { strokes: addStroke(elementStrokes(clip.component, clip.props)) }), 'Add stroke')}><Plus /></ShellIconButton>
{/snippet}

{#snippet addEffectMenu()}
  <Menu>
    <MenuTrigger>
      {#snippet child({ props })}
        <ShellIconButton {...props} label="Add effect" data-testid="add-effect"><Plus /></ShellIconButton>
      {/snippet}
    </MenuTrigger>
    <MenuContent align="end" class="max-h-[60vh] overflow-y-auto">
      {#each EFFECT_KINDS as kind (kind)}<MenuItem label={EFFECTS[kind].label} onSelect={() => addEffectOf(kind)} />{/each}
    </MenuContent>
  </Menu>
{/snippet}

{#snippet effectsBody()}
  <div class="stackable" data-testid="effects-section" bind:this={effectsRoot}>
    {#each clip.effects as effect, i (effect.id)}
      <div class="effect" class:off={!effect.enabled} role="listitem" draggable="true" data-effect={effect.id} ondragstart={() => (draggedEffect = effect.id)} ondragover={(e) => e.preventDefault()} ondrop={() => dropEffect(i)}>
        <div class="effect-head" class:open={openEffect === effect.id} data-open={openEffect === effect.id ? 'true' : undefined} bind:this={effectHeads[effect.id]}>
          <span class="grip" aria-hidden="true">⋮⋮</span>
          <ShellIconButton label={`${effect.enabled ? 'Hide' : 'Show'} ${EFFECTS[effect.kind].label}`} data-testid="effect-eye" onclick={() => commit(setEffect(doc, clip.id, effect.id, { enabled: !effect.enabled }), effect.enabled ? 'Hid an effect' : 'Showed an effect')}>{#if effect.enabled}<Eye />{:else}<EyeOff />{/if}</ShellIconButton>
          <button type="button" class="effect-name effect-open" data-testid="effect-open" aria-expanded={openEffect === effect.id} onclick={() => (openEffect = openEffect === effect.id ? null : effect.id)}>{EFFECTS[effect.kind].label}</button>
          <IconButton action={Action.Remove} size={14} label={`Remove ${EFFECTS[effect.kind].label}`} onclick={() => commit(removeEffect(doc, clip.id, effect.id), 'Removed an effect')} />
        </div>
        {#if openEffect === effect.id && effectHeads[effect.id]}
          <SidePopover anchor={effectHeads[effect.id]} within={effectsRoot} key={effect.id} title={EFFECTS[effect.kind].label} onclose={() => (openEffect = null)}>
            <div class="stackable" data-testid="effect-editor">
              {#if effect.kind === 'lut'}<LutPicker {doc} clipId={clip.id} {effect} {onchange} />{/if}
              {#each effectRows(effect) as prop (prop.key)}
                {#if prop.kind === ValueKind.Color}
                  {@const alphaKey = alphaKeyOf(effect)}
                  <div class="line" data-prop={prop.key}>
                    <span class="label">{afterDot(prop)}</span>
                    <div class="control"><ColorField name={prop.label} value={shown(prop.key)} {tokens} alpha={alphaKey ? Number(shown(alphaKey)) : null} onalpha={alphaKey ? (a) => animate(alphaKey, a) : undefined} onchange={(v) => animate(prop.key, resolve(v))} /></div>
                    {@render diamond(prop.key)}
                  </div>
                {:else}
                  {@render animList([prop], afterDot)}
                {/if}
              {/each}
              <div class="line">
                <span class="label">Order</span>
                <IconButton action={Action.ItemUp} size={14} label="Move effect up" disabled={i === 0} onclick={() => commit(setEffect(doc, clip.id, effect.id, { index: i - 1 }), 'Reordered effects')} />
                <IconButton action={Action.ItemDown} size={14} label="Move effect down" disabled={i === clip.effects.length - 1} onclick={() => commit(setEffect(doc, clip.id, effect.id, { index: i + 1 }), 'Reordered effects')} />
              </div>
            </div>
          </SidePopover>
        {/if}
      </div>
    {/each}
    {#if !clip.effects.length}<p class="hint">No effects. Add one with +.</p>{/if}
  </div>
{/snippet}

{#snippet threeDBody()}
  {#if dialProps.length}
    <div class="dials">
      {#each dialProps as prop (prop.key)}
        <div class="dial-cell"><Dial value={numberShown(prop)} label={prop.label} onchange={(v) => animate(prop.key, stored(prop.key, v))} /><span>{fieldLook(prop.key).short}</span></div>
      {/each}
    </div>
  {/if}
  {#if threeDProps.length}{@render animGrid(threeDProps)}{/if}
  {#if sceneProps.length}{@render animGrid(sceneProps)}{/if}
  {@render groupFields(Section.ThreeD)}
  {#if spec.track === TrackKind.Visual}
    <div class="stackable" data-testid="depth-section">
      <div class="stack">
        <NumberField label={DEPTH.label} kind={FieldKind.Named} name="Depth" value={clip.depth} range={depthRange} unit={depthRange.unit ?? ''} disabled={clip.space === Space.Screen} onchange={(v) => commit(setClipDepth(doc, clip.id, { depth: v }), 'Changed depth')} />
      </div>
      <label class="check"><input type="checkbox" data-testid="screen-space" checked={clip.space === Space.Screen} onchange={(e) => commit(setClipDepth(doc, clip.id, { space: e.currentTarget.checked ? Space.Screen : Space.World }), 'Changed space')} />Screen space: ignores the camera</label>
      {#if !doc.camera}<p class="hint">Depth shows once the video has a camera.</p>{/if}
    </div>
  {/if}
{/snippet}

{#snippet parentBody()}
  {#if spec.track === TrackKind.Visual}
    <div class="stackable" data-testid="parent-section">
      <div class="line">
        <label class="label" for="parent-select">Parent</label>
        <select id="parent-select" aria-label="Parent" data-testid="parent-select" value={clip.parent ?? NO_PARENT} onchange={(e) => commit(setParent(doc, clip.id, e.currentTarget.value === NO_PARENT ? null : e.currentTarget.value, { at: frame }), 'Changed the parent')}>
          <option value={NO_PARENT}>None</option>
          {#each parentChoices(doc, clip.id) as id (id)}<option value={id}>{clipName(id)}</option>{/each}
        </select>
      </div>
      {#if clip.parent}
        <label class="check"><input type="checkbox" data-testid="parent-opacity" checked={clip.parentOpacity === ParentOpacity.Inherit} onchange={(e) => commit(setParentOpacity(doc, clip.id, e.currentTarget.checked ? ParentOpacity.Inherit : ParentOpacity.Ignore), 'Changed opacity inheritance')} />Inherit the parent opacity</label>
      {/if}
    </div>
  {/if}
  {#if maskProps.length}
    <div class="stackable" data-testid="mask-section">
      <div class="line">
        <label class="label" for="mask-kind">Mask</label>
        <select id="mask-kind" data-testid="mask-kind" value={clip.mask?.kind ?? NO_MASK} onchange={(e) => pickMask(e.currentTarget.value)}>
          <option value={NO_MASK}>None</option>
          {#each MASK_KIND_IDS as kind (kind)}<option value={kind}>{MASK_KINDS[kind].label}</option>{/each}
        </select>
      </div>
      <div class="line">
        <label class="label" for="track-matte">Matte</label>
        <select id="track-matte" data-testid="track-matte" value={clip.matte} onchange={(e) => commit(setTrackMatte(doc, clip.id, e.currentTarget.value as Matte), 'Changed the track matte')}>
          {#each MATTES as matte (matte)}<option value={matte}>{matte === Matte.None ? 'None' : `${matte} of the clip above`}</option>{/each}
        </select>
      </div>
      {#if clip.mask}
        {@const mask = clip.mask}
        <label class="check"><input type="checkbox" checked={mask.invert} onchange={(e) => editMask(mask, { invert: e.currentTarget.checked })} />Invert</label>
        {#if MASK_KINDS[mask.kind].needs === Needs.Text}
          <div class="line"><label class="label" for="mask-text">Text</label><input id="mask-text" type="text" value={mask.text} onchange={(e) => editMask(mask, { text: e.currentTarget.value })} /></div>
        {:else if MASK_KINDS[mask.kind].needs === Needs.Asset}
          <div class="assets">
            {#each pictures as asset (asset.id)}
              <button type="button" class="asset" class:on={mask.assetId === asset.id} title={asset.label} onclick={() => editMask(mask, { assetId: asset.id })}><img src={asset.previewUrl} alt="" /></button>
            {:else}
              <span class="empty">No image assets on this canvas yet.</span>
            {/each}
          </div>
        {:else if MASK_KINDS[mask.kind].needs === Needs.Points}
          <p class="hint">Drag the points on the preview.</p>
        {/if}
        {@render animList(maskProps, (p) => p.label)}
      {/if}
    </div>
  {/if}
{/snippet}

<style>
  .inspector {
    display: flex;
    flex: 1 0 auto;
    flex-direction: column;
    font-size: var(--ui-text-xs);
  }

  .head {
    display: flex;
    align-items: center;
    gap: 8px;
    height: var(--ui-header-h);
    flex-shrink: 0;
    padding: 0 12px;
    border-bottom: 1px solid var(--ui-divider);
  }

  .icon {
    display: inline-grid;
    place-items: center;
    width: 24px;
    height: 24px;
    border-radius: var(--ui-radius-sm);
    background: color-mix(in srgb, var(--hue) 16%, transparent);
    color: var(--hue, var(--ui-icon-ink));
  }

  .name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: var(--ui-weight-semibold);
    font-size: var(--ui-type-title);
    letter-spacing: var(--ui-tracking-title);
  }

  .kind {
    flex-shrink: 0;
    color: var(--ui-ink-3);
  }

  .tabs {
    display: flex;
    gap: 2px;
    margin: 8px 12px 0;
    padding: 2px;
    border-radius: var(--ui-radius-md);
    background: var(--ui-input);
  }

  .tabs button {
    flex: 1;
    height: 24px;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: none;
    font: inherit;
    font-size: var(--ui-type-label);
    font-weight: var(--ui-weight-medium);
    color: var(--ui-text-secondary);
    cursor: pointer;
  }

  .tabs button.on {
    background: var(--ui-panel-raised);
    color: var(--ui-text);
    box-shadow: 0 1px 2px rgb(0 0 0 / 0.14);
  }

  .grid2 {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 6px;
  }

  .stackable {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 6px;
  }

  .dials {
    display: flex;
    gap: 12px;
    margin-bottom: 8px;
  }

  .dial-cell {
    display: flex;
    align-items: center;
    gap: 4px;
    font-family: var(--ui-mono);
    font-size: 10px;
    color: var(--ui-ink-3);
  }

  .grid2 .grid-cell.wide {
    grid-column: 1 / -1;
  }

  .line {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 28px;
  }

  .line > label,
  .line > .label {
    flex-shrink: 0;
    width: 88px;
    color: var(--ui-ink-2);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .line .control,
  .line > select,
  .line > input[type='text'] {
    flex: 1;
    min-width: 0;
  }

  .clock {
    display: flex;
    align-items: center;
    height: var(--ui-row);
    border-radius: var(--ui-radius-sm);
    background: var(--ui-input);
    border: 1px solid transparent;
  }

  .clock:hover {
    border-color: var(--ui-line-strong);
  }

  .clock:focus-within {
    border-color: var(--ui-accent);
  }

  .clock span {
    flex-shrink: 0;
    padding: 0 6px 0 8px;
    color: var(--ui-ink-3);
  }

  .clock input,
  .clock select {
    flex: 1;
    min-width: 0;
    height: 100%;
    padding: 0 2px;
    border: 0;
    background: transparent;
    font: inherit;
    font-variant-numeric: tabular-nums;
  }

  .clock input:focus,
  .clock select:focus {
    border: 0;
  }

  input[type='text'],
  textarea,
  select {
    box-sizing: border-box;
    width: 100%;
    height: 28px;
    padding: 0 8px;
    border: 1px solid transparent;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-input);
    color: var(--ui-ink);
    font: inherit;
  }

  textarea {
    height: auto;
    padding: 6px;
  }

  textarea.content {
    min-height: 56px;
    font-size: var(--ui-text-md);
    line-height: 1.35;
    resize: none;
    overflow: hidden;
  }

  input[type='text']:focus,
  textarea:focus,
  select:focus {
    outline: none;
    border-color: var(--ui-accent);
  }

  select.add {
    margin-top: 2px;
    border-style: dashed;
    color: var(--ui-ink-2);
  }

  .toggle {
    margin: 0;
  }

  .assets {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 4px;
    margin-bottom: 4px;
  }

  .asset {
    aspect-ratio: 1;
    border: 1px solid var(--ui-line);
    background: var(--ui-surface);
    overflow: hidden;
    font-size: 9px;
    padding: 2px;
    word-break: break-all;
  }

  .asset img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .asset.on {
    outline: 2px solid var(--ui-accent);
    outline-offset: 1px;
  }

  .empty {
    grid-column: 1 / -1;
    color: var(--ui-ink-3);
  }

  .comp {
    display: flex;
    gap: var(--ui-space-1);
  }

  .comp select {
    flex: 1;
    min-width: 0;
  }

  .comp button,
  .secondary {
    height: 28px;
    border: 1px solid var(--ui-line-strong);
    border-radius: var(--ui-radius-sm);
    background: var(--ui-bg);
    color: var(--ui-ink);
    padding: 0 var(--ui-space-2);
    font: inherit;
    cursor: pointer;
  }

  .comp button:hover:not(:disabled),
  .secondary:hover {
    background: var(--ui-hover);
  }

  .duck {
    display: flex;
    gap: 4px;
  }

  .corners {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: var(--ui-space-1);
  }

  .corners input {
    min-width: 0;
  }

  .managed {
    color: var(--ui-ink-2);
  }

  .managed a,
  .link {
    color: var(--ui-accent);
    text-decoration: none;
    background: none;
    border: 0;
    padding: 0;
    font: inherit;
    cursor: pointer;
  }

  .link:hover,
  .managed a:hover {
    text-decoration: underline;
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .chip {
    height: 22px;
    padding: 0 8px;
    border: 1px solid var(--ui-line-strong);
    background: var(--ui-bg);
    font-family: var(--ui-mono);
    font-size: 10px;
    color: var(--ui-ink-2);
  }

  .chip:hover {
    color: var(--ui-ink);
    background: var(--ui-hover);
  }

  .effect {
    display: grid;
    gap: 6px;
    padding: 8px;
    background: var(--ui-surface);
  }

  .effect.off {
    opacity: 0.55;
  }

  .effect-head {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .effect-head select {
    width: auto;
  }

  .effect-name {
    flex: 1;
    display: flex;
    gap: 6px;
    align-items: center;
    font-weight: 600;
  }
  .layer-look {
    gap: 6px;
  }
  .layer-look select {
    flex: 1;
    min-width: 0;
  }
  .opacity-slider {
    width: 56px;
    flex-shrink: 0;
    accent-color: var(--ui-accent);
  }
  .opacity-number {
    width: 124px;
    flex-shrink: 0;
  }
  @media (pointer: coarse) {
    .layer-look {
      flex-wrap: wrap;
    }
    .opacity-number {
      flex: 1 0 100%;
    }
  }
  .split {
    border: 0;
    background: none;
    color: var(--ui-text-2);
    font: inherit;
    cursor: pointer;
    white-space: nowrap;
  }
  .effect-open {
    min-width: 0;
    border: 0;
    background: none;
    padding: 0;
    color: inherit;
    font: inherit;
    font-weight: 600;
    text-align: left;
    cursor: pointer;
  }
  .effect-head.open {
    background: var(--ui-selected);
  }

  .grip {
    cursor: grab;
    color: var(--ui-ink-3);
  }

  .expr {
    display: grid;
    gap: 4px;
    margin: 0 0 8px;
    padding: 6px;
    border-left: 2px solid var(--ui-accent);
    background: var(--ui-surface);
  }

  .expr-head {
    display: flex;
    justify-content: space-between;
    font-family: var(--ui-mono);
    font-size: 10px;
    color: var(--ui-accent);
  }

  .expr-head button {
    border: 0;
    background: none;
    color: var(--ui-ink-3);
    cursor: pointer;
  }

  .expr .code {
    width: 100%;
    font-family: var(--ui-mono);
    font-size: 11px;
    resize: vertical;
  }

  .expr-error {
    color: var(--ui-danger);
    font-size: 11px;
    margin: 0;
  }

  .expr-now {
    font-family: var(--ui-mono);
    font-size: 10px;
    color: var(--ui-accent);
  }

  .key {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 16px;
    height: 26px;
    border: 0;
    background: none;
    cursor: pointer;
  }

  .key::before {
    content: '';
    width: 5px;
    height: 5px;
    transform: rotate(45deg);
    border: 1px solid var(--ui-ink-3);
    opacity: 0.5;
  }

  .line:hover .key::before,
  .key[data-mark='here']::before,
  .key[data-mark='animated']::before {
    opacity: 1;
  }

  .key[data-mark='here']::before {
    border-color: var(--ui-accent);
    background: var(--ui-accent);
  }

  .key[data-mark='animated']::before {
    border-color: var(--ui-accent);
    background: linear-gradient(135deg, var(--ui-accent) 50%, transparent 50%);
  }

  .anchor {
    display: grid;
    grid-template-columns: repeat(3, 8px);
    gap: 4px;
    padding: 4px;
    background: var(--ui-input);
  }

  .anchor button {
    width: 8px;
    height: 8px;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: var(--ui-divider-strong);
  }

  .anchor button.on {
    background: var(--ui-accent);
    border-color: var(--ui-accent);
  }

  .checks {
    display: flex;
    gap: 12px;
  }

  .check {
    display: flex;
    align-items: center;
    gap: 6px;
    min-height: 24px;
    color: var(--ui-ink-2);
  }

  .hint {
    margin: 0 0 8px;
    color: var(--ui-ink-3);
  }

  @media (pointer: coarse) {
    .line,
    .clock,
    .check {
      min-height: 44px;
    }

    .clock {
      height: 44px;
    }

    input[type='text'],
    select {
      height: 40px;
    }

    .key {
      width: 40px;
      height: 40px;
    }

    .grid2 {
      grid-template-columns: minmax(0, 1fr);
    }
  }

  .error {
    margin: 8px 12px;
    color: var(--ui-danger);
  }

  .shared {
    border-top: 1px solid var(--ui-line);
  }

  .shared > summary {
    padding: var(--ui-space-3) var(--ui-space-4);
    color: var(--ui-ink-2);
    font-size: var(--ui-text-xs);
    cursor: pointer;
  }

  .mode-warning {
    margin: 8px 12px;
    color: var(--ui-warn);
    font-size: var(--ui-text-sm);
  }
</style>
