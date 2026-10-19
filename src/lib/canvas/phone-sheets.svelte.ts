export enum PhoneSheetKind {
  Layers = 'layers',
  Chat = 'chat',
  Insert = 'insert'
}

export class PhoneSheets {
  shown = $state<PhoneSheetKind | null>(null);

  toggle(kind: PhoneSheetKind) {
    this.shown = this.shown === kind ? null : kind;
  }

  close(kind: PhoneSheetKind) {
    if (this.shown === kind) {
      this.shown = null;
    }
  }
}

export const phoneSheets = new PhoneSheets();
