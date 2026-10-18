import { describe, expect, it } from 'vitest';
import { IDENTITY_3D, cssTransform, multiply, project, translation } from './matrix';

const BOX = { width: 200, height: 100 };

const point = (transform: string, x: number, y: number) => project(cssTransform(transform, BOX), x, y);

describe('cssTransform', () => {
  it('reads an empty or none transform as identity', () => {
    expect(cssTransform('', BOX)).toEqual(IDENTITY_3D);
    expect(cssTransform('none', BOX)).toEqual(IDENTITY_3D);
  });

  it('translates in px and in percent of its own box', () => {
    expect(point('translate(10px, 20px)', 0, 0)).toEqual([10, 20]);
    expect(point('translate(-50%, 10%)', 0, 0)).toEqual([-100, 10]);
    expect(point('translate3d(1px, 2px, 0px)', 0, 0)).toEqual([1, 2]);
  });

  it('rotates clockwise on screen, as CSS does', () => {
    const [x, y] = point('rotate(90deg)', 10, 0);
    expect(x).toBeCloseTo(0);
    expect(y).toBeCloseTo(10);
  });

  it('applies functions left to right like CSS', () => {
    const [x, y] = point('translate(100px, 0px) scale(2, 3)', 1, 1);
    expect([x, y]).toEqual([102, 3]);
  });

  it('reads matrix() as the six 2D coefficients', () => {
    expect(point('matrix(1, 0, 0, 1, 5, 6)', 1, 1)).toEqual([6, 7]);
  });

  it('foreshortens a rotateY under perspective', () => {
    const m = multiply(cssTransform('perspective(1000px)', BOX), cssTransform('rotateY(60deg)', BOX));
    const [near] = project(m, -100, 0);
    const [far] = project(m, 100, 0);
    expect(Math.abs(near)).toBeGreaterThan(Math.abs(far));
  });

  it('skews by the tangent of the angle', () => {
    const [x] = point('skew(45deg, 0deg)', 0, 10);
    expect(x).toBeCloseTo(10);
  });

  it('composes with a translation', () => {
    expect(project(multiply(translation(5, 5), cssTransform('scale(2)', BOX)), 1, 1)).toEqual([7, 7]);
  });
});
