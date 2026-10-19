import { BlendMode } from '../blend';
import { ItemKind, type GroupItem, type Item } from './display-list';

function inherited(item: Item, group: GroupItem): Item {
  const masks = [...(group.masks ?? []), ...(item.masks ?? [])];
  const filters = [...(item.filters ?? []), ...(group.filters ?? [])];
  return {
    ...item,
    opacity: item.opacity * group.opacity,
    blur: item.blur + group.blur,
    blend: group.blend === BlendMode.Normal ? item.blend : group.blend,
    ...(masks.length ? { masks } : {}),
    ...(filters.length ? { filters, space: group.space ?? item.space } : {}),
    ...(group.matte ? { matte: group.matte } : {}),
    ...(group.scissor ? { scissor: group.scissor } : {}),
    ...(group.backdrop ? { backdrop: group.backdrop } : {})
  } as Item;
}

export function ungrouped(items: Item[]): Item[] {
  return items.flatMap((item) => (item.kind === ItemKind.Group ? ungrouped(item.items).map((inner) => inherited(inner, item)) : [item]));
}
