import { cn } from '../cn';

export function Tag({ className }: { className?: string }) {
  return <span className={cn('tag', className)}>tag</span>;
}
