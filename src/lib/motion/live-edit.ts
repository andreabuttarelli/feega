export type LiveEditPort<T> = { show: (doc: T | null) => void; record: (doc: T, summary: string) => void };

export type LiveEdits<T> = {
  begin: () => void;
  edit: (doc: T, summary: string) => void;
  release: () => void;
  cancel: () => void;
};

export type LiveGesture = Pick<LiveEdits<unknown>, 'begin' | 'release' | 'cancel'>;

export function liveEdits<T>(port: LiveEditPort<T>): LiveEdits<T> {
  let live = false;
  let held: { doc: T; summary: string } | null = null;

  function end() {
    live = false;
    held = null;
    port.show(null);
  }

  return {
    begin() {
      live = true;
    },
    edit(doc, summary) {
      if (!live) {
        port.record(doc, summary);
        return;
      }
      held = { doc, summary };
      port.show(doc);
    },
    release() {
      if (!live) {
        return;
      }
      const last = held;
      end();
      if (last) {
        port.record(last.doc, last.summary);
      }
    },
    cancel() {
      if (live) {
        end();
      }
    }
  };
}

export type ColourDrag = {
  input: (value: string) => void;
  change: (value: string) => void;
  settle: () => void;
  cancel: () => void;
};

export function colourDrag(gesture: LiveGesture | null, apply: (value: string) => void): ColourDrag {
  let dragging = false;

  function settle() {
    if (dragging) {
      dragging = false;
      gesture?.release();
    }
  }

  return {
    input(value) {
      if (!gesture) {
        return;
      }
      if (!dragging) {
        dragging = true;
        gesture.begin();
      }
      apply(value);
    },
    change(value) {
      apply(value);
      settle();
    },
    settle,
    cancel() {
      if (dragging) {
        dragging = false;
        gesture?.cancel();
      }
    }
  };
}
