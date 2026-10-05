import { describe, expect, it } from 'vitest';
import { ANIMATABLE } from './keyframes';
import { COMPONENT_IDS } from './components';
import { fieldsOf } from './inspector';
import { CAMERA, CAMERA_KEYS, CAMERA_LANE } from './camera';
import { Unit, propsOwner, sliderOf, toShown, toStored, unitOf } from './units';

const PORTRAIT = { width: 1080, height: 1920 };
const MIN_STEPS = 20;
const MAX_STEPS = 5000;

describe('property units', () => {
  it('translate X is in px of the composition, a pixel per step, one width each way', () => {
    const x = ANIMATABLE.Shape.find((p) => p.key === 'x')!;

    expect(sliderOf('Shape', x, PORTRAIT)).toEqual({
      unit: Unit.Px,
      min: -1080,
      max: 1080,
      step: 1
    });
  });

  it('a stored fraction reads as px and a typed px writes back the same fraction', () => {
    expect(toShown('Shape', 'x', 0.25, PORTRAIT)).toBe(270);
    expect(toShown('Shape', 'y', 0.25, PORTRAIT)).toBe(480);
    expect(toStored('Shape', 'x', 270, PORTRAIT)).toBeCloseTo(0.25, 10);
  });

  it('scale and opacity are percent, rotation is degrees', () => {
    expect(toShown('Title', 'scale', 1.5, PORTRAIT)).toBe(150);
    expect(toShown('Title', 'opacity', 0.4, PORTRAIT)).toBe(40);
    expect(unitOf('Title', 'rotateZ')).toBe(Unit.Degrees);
    expect(toShown('Title', 'rotateZ', 45, PORTRAIT)).toBe(45);
  });

  it('a stroke or a type size is px of the short side', () => {
    expect(toShown('Shape', 'strokeWidth', 0.01, PORTRAIT)).toBe(10.8);
    expect(toShown('Title', 'size', 0.05, PORTRAIT)).toBe(54);
  });

  it('a custom component prop keeps its own numbers, its transform does not', () => {
    expect(unitOf('Custom', 'width')).toBeNull();
    expect(unitOf('Custom', 'x')).toBe(Unit.Px);
    expect(unitOf(propsOwner('Custom'), 'x')).toBeNull();
    expect(unitOf(propsOwner('Shape'), 'x')).toBe(Unit.Px);
  });

  it('every animatable slider has a with a unit has a sensible number of steps', () => {
    for (const id of COMPONENT_IDS) {
      for (const prop of ANIMATABLE[id].filter((p) => p.max > p.min)) {
        const s = sliderOf(id, prop, PORTRAIT);
        const steps = (s.max - s.min) / s.step;

        if (!s.unit) {
          continue;
        }

        expect(steps, `${id}.${prop.key}`).toBeGreaterThanOrEqual(MIN_STEPS);
        expect(steps, `${id}.${prop.key}`).toBeLessThanOrEqual(MAX_STEPS);
      }
    }
  });

  it('every inspector range field with a unit has a sensible number of steps', () => {
    for (const id of COMPONENT_IDS) {
      for (const field of fieldsOf(id).filter((f) => f.min !== undefined && f.max !== undefined && f.step)) {
        const s = sliderOf(
          id,
          {
            key: field.key,
            min: field.min!,
            max: field.max!,
            step: field.step!
          },
          PORTRAIT
        );
        const steps = (s.max - s.min) / s.step;

        if (!s.unit) {
          continue;
        }

        expect(steps, `${id}.${field.key}`).toBeGreaterThanOrEqual(MIN_STEPS);
        expect(steps, `${id}.${field.key}`).toBeLessThanOrEqual(MAX_STEPS);
      }
    }
  });

  it('the camera truck is px too', () => {
    for (const key of CAMERA_KEYS) {
      const s = sliderOf(CAMERA_LANE, { key, ...CAMERA[key] }, PORTRAIT);
      expect((s.max - s.min) / s.step, key).toBeLessThanOrEqual(MAX_STEPS);
    }
    expect(sliderOf(CAMERA_LANE, { key: 'x', ...CAMERA.x }, PORTRAIT).unit).toBe(Unit.Px);
  });
});
