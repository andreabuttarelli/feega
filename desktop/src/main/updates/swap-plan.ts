export enum StepKind {
  Move = 'move',
  Copy = 'copy',
  Remove = 'remove',
  Relaunch = 'relaunch'
}

export type Step =
  | { kind: StepKind.Move; from: string; to: string }
  | { kind: StepKind.Copy; from: string; to: string }
  | { kind: StepKind.Remove; path: string }
  | { kind: StepKind.Relaunch; path: string; pid: number };

export type SwapPlan = { steps: Step[]; rollback: Step[] };

export type SwapInput = { current: string; fresh: string; backup: string; relaunch: boolean; pid: number };

export const darwinSwapPlan = ({ current, fresh, backup, relaunch, pid }: SwapInput): SwapPlan => ({
  steps: [
    { kind: StepKind.Move, from: current, to: backup },
    { kind: StepKind.Copy, from: fresh, to: current },
    ...(relaunch ? [{ kind: StepKind.Relaunch as const, path: current, pid }] : [])
  ],
  rollback: [
    { kind: StepKind.Remove, path: current },
    { kind: StepKind.Move, from: backup, to: current }
  ]
});
