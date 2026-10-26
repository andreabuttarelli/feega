import chalk from 'chalk';
import Table from 'cli-table3';

export const c = chalk;

export function table(head: string[], rows: (string | number)[][]): void {
  const t = new Table({
    head: head.map((h) => chalk.bold(h)),
    style: { head: [], border: ['grey'] }
  });
  for (const row of rows) t.push(row.map(String));
  console.log(t.toString());
}

export function ok(msg: string) { console.log(chalk.green('✓'), msg); }
export function warn(msg: string) { console.log(chalk.yellow('⚠'), msg); }
export function fail(msg: string) { console.error(chalk.red('✗'), msg); }
export function info(msg: string) { console.log(chalk.dim(msg)); }

export function section(title: string) {
  console.log('\n' + chalk.bold.underline(title));
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return chalk.dim('—');
  const d = new Date(iso);
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' }) +
    ' ' + d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
}
