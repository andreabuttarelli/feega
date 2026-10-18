import { describe, expect, it } from 'vitest';
import { COMPONENT_IDS, Control, type ComponentId } from './components';
import { customFields, fieldsOf } from './inspector';
import { PropFormat } from './custom/component';
import { BUILTIN_TEMPLATES } from './template/builtins';

const PICKERS: ReadonlySet<Control> = new Set([Control.Asset, Control.MediaItem, Control.MediaList, Control.Fills]);
const MEDIA_FORMATS: ReadonlySet<string | undefined> = new Set([PropFormat.Asset, PropFormat.Media, PropFormat.MediaItem]);
const RAW_HINT = /id or link|video:id/i;

const templateProps = BUILTIN_TEMPLATES.flatMap((entry) =>
  Object.entries(entry.template.doc.components).flatMap(([name, component]) => Object.entries(component.propsSchema.properties).map(([key, spec]) => ({ where: `${entry.id} ${name}.${key}`, spec, field: customFields({ type: 'object', properties: { [key]: spec } })[0] })))
);

describe('every media prop is edited with the media picker', () => {
  it('built-in components: a prop with an asset kind gets a picker', () => {
    const raw = COMPONENT_IDS.flatMap((id) => fieldsOf(id as ComponentId).filter((f) => f.assetKind && !PICKERS.has(f.control)).map((f) => `${id}.${f.key}`));

    expect(raw).toEqual([]);
  });

  it('template components: a media-format prop gets a picker', () => {
    const raw = templateProps.filter((p) => MEDIA_FORMATS.has(p.spec.format) && !PICKERS.has(p.field.control)).map((p) => p.where);

    expect(raw).toEqual([]);
  });

  it('template components: no text field still asks for an id or a link', () => {
    const raw = templateProps.filter((p) => RAW_HINT.test(p.spec.title ?? '')).map((p) => p.where);

    expect(raw).toEqual([]);
  });
});
