import { describe, expect, it } from 'vitest';
import { createUndoStack } from './undo-stack';
import type { Gesture } from './undo-plan';

const gestureFor = (nodeId: string): Gesture => ({
  items: [{ kind: 'node.create', nodeId, after: { type: 'text' } }]
});

describe('createUndoStack: uno stack per scheda, undo e redo', async () => {
  it('non ha niente da annullare o rifare appena creato', async () => {
    const stack = createUndoStack<Gesture>();
    expect(stack.canUndo()).toBe(false);
    expect(stack.canRedo()).toBe(false);
    expect(await stack.popUndo()).toBeNull();
    expect(stack.popRedo()).toBeNull();
  });

  it('un push rende il gesto disponibile a popUndo, in ordine LIFO', async () => {
    const stack = createUndoStack<Gesture>();
    stack.push(gestureFor('a'));
    stack.push(gestureFor('b'));

    expect(await stack.popUndo()).toEqual(gestureFor('b'));
    expect(await stack.popUndo()).toEqual(gestureFor('a'));
    expect(stack.canUndo()).toBe(false);
  });

  it('popUndo NON sposta da solo nel redo: tocca a chi chiama, dopo la conferma del server', async () => {
    const stack = createUndoStack<Gesture>();
    stack.push(gestureFor('a'));

    await stack.popUndo();
    expect(stack.canRedo()).toBe(false);
  });

  it('pushRedo mette a disposizione di ⇧⌘Z il gesto che il SERVER ha restituito, non quello tolto', async () => {
    const stack = createUndoStack<Gesture>();
    stack.push(gestureFor('a'));

    const popped = (await stack.popUndo())!;
    const fromServer: Gesture = { items: [{ kind: 'node.delete', nodeId: 'a', before: popped.items[0] }] };
    stack.pushRedo(fromServer);

    expect(stack.canRedo()).toBe(true);
    expect(stack.popRedo()).toEqual(fromServer);
  });

  it('pushUndo, il simmetrico dopo un redo riuscito', async () => {
    const stack = createUndoStack<Gesture>();
    stack.push(gestureFor('a'));
    await stack.popUndo();
    stack.pushRedo(gestureFor('a'));

    const popped = stack.popRedo()!;
    stack.pushUndo(popped);

    expect(stack.canUndo()).toBe(true);
    expect(await stack.popUndo()).toEqual(popped);
  });

  it('un gesto nuovo svuota il redo: quel che era stato annullato non torna più con ⇧⌘Z', async () => {
    const stack = createUndoStack<Gesture>();
    stack.push(gestureFor('a'));
    await stack.popUndo();
    stack.pushRedo(gestureFor('a'));
    expect(stack.canRedo()).toBe(true);

    stack.push(gestureFor('b'));
    expect(stack.canRedo()).toBe(false);
    expect(stack.popRedo()).toBeNull();
  });

  it('a gesture still waiting for the server is undone as soon as it lands, not skipped', async () => {
    const stack = createUndoStack<string>();
    let land: (entry: string | null) => void = () => {};
    stack.push('before');
    stack.pushPending(new Promise((resolve) => (land = resolve)));

    expect(stack.canUndo()).toBe(true);
    const undone = stack.popUndo();
    land('moved out');

    expect(await undone).toBe('moved out');
    expect(await stack.popUndo()).toBe('before');
  });

  it('a gesture the server refused leaves nothing to undo in its place', async () => {
    const stack = createUndoStack<string>();
    stack.push('before');
    stack.pushPending(Promise.resolve(null));

    expect(await stack.popUndo()).toBe('before');
    expect(stack.canUndo()).toBe(false);
  });

  it('a pending gesture empties the redo like any new gesture', async () => {
    const stack = createUndoStack<string>();
    stack.pushRedo('a');
    stack.pushPending(Promise.resolve('b'));
    expect(stack.canRedo()).toBe(false);
  });
});
