import { tool, type Tool } from 'ai';
import { z } from 'zod';

export enum ToolFamily {
  Canvas = 'canvas',
  Generate = 'generate',
  Assets = 'assets',
  Gallery = 'gallery',
  Motion = 'motion',
  Frame = 'frame',
  Web = 'web',
  Brand = 'brand'
}

export enum ToolAccess {
  Read = 'read',
  Write = 'write',
  Spend = 'spend'
}

export type ToolRow = {
  name: string;
  family: ToolFamily;
  access: ToolAccess;
  summary: string;
  input: z.ZodType;
  run: (input: never, options: { toolCallId: string }) => Promise<unknown>;
  toModelOutput?: (result: { toolCallId: string; output: never }) => unknown;
};

export function toolsOf(rows: ToolRow[]): Record<string, Tool> {
  return Object.fromEntries(rows.map((row) => [row.name, tool({ description: row.summary, inputSchema: row.input, execute: row.run as never, ...(row.toModelOutput ? { toModelOutput: row.toModelOutput as never } : {}) })]));
}
