import { DOING_MAX, type CanvasMark, type CanvasPeer } from './canvas-presence';
import { colourOf, initialOf } from './frame-presence';

export enum AgentShape {
  Circle = 'circle',
  Square = 'square',
  Hexagon = 'hexagon',
  Diamond = 'diamond',
  Blob = 'blob'
}

export const AGENT_SHAPES: readonly AgentShape[] = Object.values(AgentShape);

export type AgentIdentity = { id: string; name: string };

export type AgentAvatar = { shape: AgentShape; colour: string; initial: string };

export type AgentBox = { id: string; x: number; y: number; w: number; h: number };

const MAX_SELECTION = 200;
const SPREAD = 0.4;
const SPREAD_STEPS = 40;

const hashOf = (text: string) => [...text].reduce((h, c) => (h * 33 + c.charCodeAt(0)) >>> 0, 5381);

export function agentAvatar(id: string, name: string): AgentAvatar {
  return { shape: AGENT_SHAPES[hashOf(id) % AGENT_SHAPES.length], colour: colourOf(id), initial: initialOf(name) };
}

function unionOf(boxes: AgentBox[]): AgentBox {
  const left = Math.min(...boxes.map((b) => b.x));
  const top = Math.min(...boxes.map((b) => b.y));
  const right = Math.max(...boxes.map((b) => b.x + b.w));
  const bottom = Math.max(...boxes.map((b) => b.y + b.h));
  return { id: '', x: left, y: top, w: right - left, h: bottom - top };
}

const fractionOf = (seed: number) => 0.5 - SPREAD / 2 + ((seed % SPREAD_STEPS) / SPREAD_STEPS) * SPREAD;

export function agentMark(agent: AgentIdentity, work: { boxes: AgentBox[]; doing: string }, at: number): CanvasMark {
  const area = unionOf(work.boxes);
  const seed = hashOf(agent.id);
  const cursor = { x: area.x + area.w * fractionOf(seed), y: area.y + area.h * fractionOf(seed >>> 8) };
  return {
    sessionId: agent.id,
    userId: agent.id,
    name: agent.name,
    cursor,
    selection: work.boxes.map((b) => b.id).slice(0, MAX_SELECTION),
    live: [],
    view: null,
    presenting: false,
    chat: null,
    agent: { doing: work.doing.slice(0, DOING_MAX) },
    at
  };
}

export const agentsOf = (peers: readonly CanvasPeer[]): CanvasPeer[] => peers.filter((p) => p.agent);
