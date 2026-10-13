export enum PropertiesView {
  Frame = 'frame',
  Clip = 'clip',
  Part = 'part'
}

export function propertiesFor(selection: { clip: string | null; part: string | null }): PropertiesView {
  if (selection.clip === null) {
    return PropertiesView.Frame;
  }
  return selection.part === null ? PropertiesView.Clip : PropertiesView.Part;
}
