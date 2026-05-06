import { cn } from '@auction/ui';
import { WIZARD_STEPS, type StepId } from '../../lib/wizard';

export function StepIndicator({ current }: { current: StepId }) {
  return (
    <ol className="flex items-center justify-between gap-2">
      {WIZARD_STEPS.map((step) => {
        const state =
          step.id < current ? 'done' : step.id === current ? 'active' : 'upcoming';
        return (
          <li key={step.id} className="flex flex-1 items-center gap-2">
            <span
              className={cn(
                'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-medium',
                state === 'done' && 'border-primary bg-primary text-primary-foreground',
                state === 'active' && 'border-primary text-primary',
                state === 'upcoming' && 'border-muted text-muted-foreground',
              )}
            >
              {step.id}
            </span>
            <span
              className={cn(
                'text-sm',
                state === 'upcoming' ? 'text-muted-foreground' : 'text-foreground',
              )}
            >
              {step.title}
            </span>
            {step.id < WIZARD_STEPS.length && (
              <span
                className={cn(
                  'mx-2 hidden h-px flex-1 sm:block',
                  state === 'done' ? 'bg-primary' : 'bg-muted',
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
