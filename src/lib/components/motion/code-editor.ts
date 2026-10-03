import { EditorView, basicSetup } from 'codemirror';
import { Compartment, EditorState, type Extension } from '@codemirror/state';
import { javascript } from '@codemirror/lang-javascript';
import { css } from '@codemirror/lang-css';
import { html } from '@codemirror/lang-html';
import { unifiedMergeView } from '@codemirror/merge';

export enum CodeLanguage {
  Html = 'html',
  Css = 'css',
  Js = 'js',
  Json = 'json'
}

const LANGUAGE: Record<CodeLanguage, () => Extension> = {
  [CodeLanguage.Html]: () => html(),
  [CodeLanguage.Css]: () => css(),
  [CodeLanguage.Js]: () => javascript(),
  [CodeLanguage.Json]: () => javascript()
};

const THEME = EditorView.theme({
  '&': { fontSize: '12px', height: '100%' },
  '.cm-scroller': { fontFamily: "'Fragment Mono', ui-monospace, monospace" },
  '.cm-content': { padding: '6px 0' }
});

export type CodeView = {
  show: (text: string, language: CodeLanguage, original: string | null) => void;
  destroy: () => void;
};

export function mountCode(parent: HTMLElement, onEdit: (text: string) => void): CodeView {
  const language = new Compartment();
  const diff = new Compartment();
  let silent = false;

  const view = new EditorView({
    parent,
    state: EditorState.create({
      doc: '',
      extensions: [
        basicSetup,
        THEME,
        language.of([]),
        diff.of([]),
        EditorView.updateListener.of((u) => {
          if (u.docChanged && !silent) {
            onEdit(u.state.doc.toString());
          }
        })
      ]
    })
  });

  function show(text: string, lang: CodeLanguage, original: string | null) {
    silent = true;
    const effects = [language.reconfigure(LANGUAGE[lang]()), diff.reconfigure(original === null ? [] : unifiedMergeView({ original, mergeControls: false }))];
    const changes = text === view.state.doc.toString() ? undefined : { from: 0, to: view.state.doc.length, insert: text };
    view.dispatch({ changes, effects });
    silent = false;
  }

  return { show, destroy: () => view.destroy() };
}
