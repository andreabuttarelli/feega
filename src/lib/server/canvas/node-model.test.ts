import { describe, expect, it } from 'vitest';
import { canvasNodeOf, connectVerdict } from './node-model';

describe('canvasNodeOf — una riga di nodes nel vocabolario di canConnect', () => {
  it('legge il medium dal type', () => {
    expect(canvasNodeOf({ type: 'text', data: {} })?.kind).toBe('text');
    expect(canvasNodeOf({ type: 'video', data: {} })?.kind).toBe('video');
  });

  it('legge l\'operazione di un nodo audio dai suoi params', () => {
    const node = canvasNodeOf({ type: 'audio', data: { params: { operation: 'voice_changer' } } });
    expect(node?.operation).toBe('voice_changer');
  });

  it('senza operazione salvata assume text to speech', () => {
    const node = canvasNodeOf({ type: 'audio', data: {} });
    expect(node?.operation).toBe('text_to_speech');
  });

  it('null per una riga assente', () => {
    expect(canvasNodeOf(null)).toBeNull();
  });
});

describe('connectVerdict — lo stesso canConnect della tela, lato server', () => {
  it('un testo verso un nodo audio in text to speech passa', () => {
    const source = { type: 'text', data: {} };
    const target = { type: 'audio', data: { params: { operation: 'text_to_speech' } } };
    expect(connectVerdict(source, target)).toBeNull();
  });

  it('un video verso lo stesso nodo si rifiuta, e nomina l\'operazione', () => {
    const source = { type: 'video', data: {} };
    const target = { type: 'audio', data: { params: { operation: 'text_to_speech' } } };
    const refusal = connectVerdict(source, target);
    expect(refusal).not.toBeNull();
    expect(refusal).toContain('text_to_speech');
  });

  it('lo stesso video verso un nodo in voice_changer passa', () => {
    const source = { type: 'video', data: {} };
    const target = { type: 'audio', data: { params: { operation: 'voice_changer' } } };
    expect(connectVerdict(source, target)).toBeNull();
  });

  it('una riga assente non rifiuta: non si sa abbastanza per dire no', () => {
    expect(connectVerdict(null, { type: 'audio', data: {} })).toBeNull();
  });
});
