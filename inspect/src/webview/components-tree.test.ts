import { describe, expect, it } from 'vitest';
import type { ComponentRow } from '../host/component-list';
import { NodeKind, buildTree, highlight, visibleNodes, type TreeNode } from './components-tree';

const row = (name: string, folder: string, uses = 0): ComponentRow => ({ name, folder, file: `src/${folder}/${name}.svelte`, uses });

const shape = (nodes: TreeNode[]): unknown[] => nodes.map((n) => (n.kind === NodeKind.Folder ? { [n.label]: shape(n.children) } : n.row.name));

describe('buildTree', () => {
  it('nests folders and puts components at the leaves', () => {
    const tree = buildTree([row('Button', 'lib/ui'), row('Card', 'lib'), row('Hero', '')], '');

    expect(shape(tree)).toEqual([{ lib: [{ ui: ['Button'] }, 'Card'] }, 'Hero']);
  });

  it('lists folders before components, each in alphabetical order', () => {
    const tree = buildTree([row('Zed', ''), row('Alpha', ''), row('Mid', 'b'), row('Mid2', 'a')], '');

    expect(shape(tree)).toEqual([{ a: ['Mid2'] }, { b: ['Mid'] }, 'Alpha', 'Zed']);
  });

  it('folds a chain of single-folder parents into one row', () => {
    const tree = buildTree([row('Question', 'lib/components/quiz'), row('Answer', 'lib/components/quiz')], '');

    expect(shape(tree)).toEqual([{ 'lib/components/quiz': ['Answer', 'Question'] }]);
  });

  it('keeps a folder that also holds components apart from its subfolder', () => {
    const tree = buildTree([row('Card', 'lib/components'), row('Question', 'lib/components/quiz')], '');

    expect(shape(tree)).toEqual([{ 'lib/components': [{ quiz: ['Question'] }, 'Card'] }]);
  });

  it('identifies a folded folder by its deepest path', () => {
    const [folder] = buildTree([row('Question', 'lib/components/quiz')], '');

    expect(folder.id).toBe('lib/components/quiz');
  });

  it('identifies a component by its file and name', () => {
    const [leaf] = buildTree([row('Hero', '')], '');

    expect(leaf.id).toBe('src//Hero.svelte::Hero');
  });

  it('keeps only matching components, ignoring case, and drops the empty folders', () => {
    const tree = buildTree([row('Button', 'lib/ui'), row('Card', 'lib/ui'), row('Hero', 'pages')], 'BUT');

    expect(shape(tree)).toEqual([{ 'lib/ui': ['Button'] }]);
  });

  it('keeps a whole folder when the search matches its path', () => {
    const tree = buildTree([row('Button', 'lib/ui'), row('Card', 'lib/ui'), row('Hero', 'pages')], 'lib/ui');

    expect(shape(tree)).toEqual([{ 'lib/ui': ['Button', 'Card'] }]);
  });

  it('folds again after the search removed the sibling folders', () => {
    const tree = buildTree([row('Button', 'lib/ui'), row('Hero', 'lib/pages')], 'button');

    expect(shape(tree)).toEqual([{ 'lib/ui': ['Button'] }]);
  });

  it('has nothing when nothing matches', () => {
    expect(buildTree([row('Button', 'lib')], 'zzz')).toEqual([]);
  });
});

describe('visibleNodes', () => {
  const tree = buildTree([row('Button', 'lib/ui'), row('Card', 'lib'), row('Hero', '')], '');

  it('shows only the top level while every folder is collapsed', () => {
    expect(visibleNodes(tree, new Set(), false).map((v) => [v.depth, v.node.id])).toEqual([[0, 'lib'], [0, 'src//Hero.svelte::Hero']]);
  });

  it('shows the children of an expanded folder, one level deeper', () => {
    const shown = visibleNodes(tree, new Set(['lib']), false);

    expect(shown.map((v) => [v.depth, v.node.id])).toEqual([[0, 'lib'], [1, 'lib/ui'], [1, 'src/lib/Card.svelte::Card'], [0, 'src//Hero.svelte::Hero']]);
  });

  it('records the parent folder of every row', () => {
    const shown = visibleNodes(tree, new Set(['lib']), false);

    expect(shown.map((v) => v.parent)).toEqual([null, 'lib', 'lib', null]);
  });

  it('expands every folder while searching', () => {
    expect(visibleNodes(tree, new Set(), true).map((v) => v.node.id)).toEqual(['lib', 'lib/ui', 'src/lib/ui/Button.svelte::Button', 'src/lib/Card.svelte::Card', 'src//Hero.svelte::Hero']);
  });
});

describe('highlight', () => {
  it('splits the text around the first match, ignoring case', () => {
    expect(highlight('QuizButton', 'but')).toEqual({ before: 'Quiz', hit: 'But', after: 'ton' });
  });

  it('has no hit when the text does not match or the query is empty', () => {
    expect(highlight('Card', 'zz')).toEqual({ before: 'Card', hit: '', after: '' });
    expect(highlight('Card', ' ')).toEqual({ before: 'Card', hit: '', after: '' });
  });
});
