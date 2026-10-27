import type { Stop, Usage } from './agent-loop';
import type { Taste } from './judge';
import type { VideoFacts } from './video-facts';

export type ArmResult = {
  name: string;
  stop: Stop;
  error: string | null;
  agentSeconds: number;
  renderSeconds: number;
  turns: number;
  toolCalls: number;
  toolCallsByName: Record<string, number>;
  toolErrors: number;
  usage: Usage;
  outputFile: string | null;
  video: VideoFacts | null;
  taste: Taste | null;
  success: boolean;
  notes: string[];
};

export type Report = { model: string; day: string; task: string; arms: ArmResult[]; judgeCostUsd: number; totalCostUsd: number };

const usd = (n: number) => `$${n.toFixed(3)}`;

const tasteMean = (t: Taste | null) => (t ? (Object.values(t).reduce((s, a) => s + a.score, 0) / Object.values(t).length).toFixed(1) : 'n/a');

const top = (by: Record<string, number>) =>
  Object.entries(by)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([k, v]) => `${k} x${v}`)
    .join(', ');

export function renderReport(r: Report): string {
  const cols = r.arms.map((a) => a.name);
  const row = (label: string, cell: (a: ArmResult) => string) => `| ${label} | ${r.arms.map(cell).join(' | ')} |`;
  const lines = [
    `# External agent comparison, ${r.day}`,
    '',
    `Task: ${r.task.split('\n')[0]}`,
    `Model, same for both arms: ${r.model}`,
    '',
    `| | ${cols.join(' | ')} |`,
    `|---|${cols.map(() => '---').join('|')}|`,
    row('success (file exists, 1920x1080, 9 s +-0.6)', (a) => (a.success ? 'yes' : 'no')),
    row('run ended by', (a) => a.stop + (a.error ? ` (${a.error.slice(0, 80)})` : '')),
    row('agent wall time', (a) => `${a.agentSeconds.toFixed(0)} s`),
    row('render wall time outside the agent', (a) => (a.renderSeconds ? `${a.renderSeconds.toFixed(0)} s` : 'in agent time')),
    row('turns', (a) => String(a.turns)),
    row('tool calls (errors)', (a) => `${a.toolCalls} (${a.toolErrors})`),
    row('input tokens (cached)', (a) => `${a.usage.promptTokens} (${a.usage.cachedTokens})`),
    row('output tokens', (a) => String(a.usage.completionTokens)),
    row('cost', (a) => usd(a.usage.costUsd)),
    row('output', (a) => a.outputFile ?? 'none'),
    row('video', (a) => (a.video ? `${a.video.width}x${a.video.height} ${a.video.fps} fps ${a.video.seconds} s ${(a.video.bytes / 1e6).toFixed(1)} MB` : 'n/a')),
    row('judge mean (1-10)', (a) => tasteMean(a.taste)),
    ...(['dynamism', 'hierarchy', 'density', 'premium', 'brandFidelity'] as const).map((axis) => row(`  ${axis}`, (a) => (a.taste ? `${a.taste[axis].score}: ${a.taste[axis].reason}` : 'n/a'))),
    '',
    `Judge cost ${usd(r.judgeCostUsd)}. Total spend ${usd(r.totalCostUsd)} of a ${usd(8)} cap.`,
    '',
    ...r.arms.flatMap((a) => [`## ${a.name}`, `Tools: ${top(a.toolCallsByName) || 'none'}`, ...a.notes.map((n) => `- ${n}`), '']),
    'The judge is one vision-model pass against 9 anchor stills (scripts/eval/motion-quality/anchors); read it as a rough signal, not a measurement.'
  ];
  return lines.join('\n');
}
