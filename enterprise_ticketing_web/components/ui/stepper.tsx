import React from 'react';
import { Check, Clock, AlertCircle, XCircle, ChevronRight } from 'lucide-react';
import { TicketState } from '@/lib/types';
import { cn } from '@/lib/utils';

interface StepperProps {
  currentState: TicketState;
}

const LIFECYCLE_STEPS: { state: TicketState; label: string }[] = [
  { state: 'DRAFT', label: 'Draft' },
  { state: 'SUBMITTED', label: 'Submitted' },
  { state: 'PENDING_APPROVAL', label: 'Triage / Gate' },
  { state: 'APPROVED', label: 'Approved' },
  { state: 'IN_PROGRESS', label: 'In Execution' },
  { state: 'RESOLVED', label: 'Resolved' },
  { state: 'CLOSED', label: 'Closed' },
];

export function WorkflowStepper({ currentState }: StepperProps) {
  const isRejected = currentState === 'REJECTED';

  const getStateIndex = (state: TicketState) => {
    if (state === 'REJECTED') return 2; // Diverges from approval
    const idx = LIFECYCLE_STEPS.findIndex((s) => s.state === state);
    return idx !== -1 ? idx : 0;
  };

  const currentIndex = getStateIndex(currentState);

  return (
    <div className="w-full py-3 px-1">
      <div className="relative flex items-center justify-between">
        {/* Background Track Line */}
        <div className="absolute left-4 right-4 top-1/2 h-[2px] -translate-y-1/2 bg-zinc-800" />
        
        {/* Active Progress Fill */}
        <div
          className={cn(
            'absolute left-4 top-1/2 h-[2px] -translate-y-1/2 transition-all duration-700 ease-in-out',
            isRejected
              ? 'bg-gradient-to-r from-indigo-500 to-rose-500'
              : 'bg-gradient-to-r from-indigo-500 via-indigo-400 to-emerald-500'
          )}
          style={{
            width: `${Math.min(100, (currentIndex / (LIFECYCLE_STEPS.length - 1)) * 100)}%`,
          }}
        />

        {/* Individual Step Nodes */}
        {LIFECYCLE_STEPS.map((step, index) => {
          const isCompleted = index < currentIndex;
          const isCurrent = index === currentIndex;

          let stepIcon = <span className="text-[11px] font-semibold">{index + 1}</span>;
          let circleClasses = 'bg-zinc-900 border-zinc-800 text-zinc-500';

          if (isCurrent) {
            if (isRejected && step.state === 'PENDING_APPROVAL') {
              stepIcon = <XCircle className="h-3.5 w-3.5 text-white" />;
              circleClasses =
                'bg-rose-600 border-rose-500 text-white shadow-glow-rose ring-4 ring-rose-500/20';
            } else {
              stepIcon = <Clock className="h-3.5 w-3.5 text-white" />;
              circleClasses =
                'bg-indigo-600 border-indigo-400 text-white shadow-glow ring-4 ring-indigo-500/25 animate-pulse-subtle';
            }
          } else if (isCompleted) {
            stepIcon = <Check className="h-3.5 w-3.5 text-white" />;
            circleClasses = 'bg-emerald-600 border-emerald-500 text-white shadow-sm shadow-emerald-600/30';
          }

          return (
            <div key={step.state} className="relative z-10 flex flex-col items-center group">
              <div
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-full border transition-all duration-300',
                  circleClasses
                )}
              >
                {stepIcon}
              </div>

              <span
                className={cn(
                  'absolute -bottom-5 text-[10px] font-medium tracking-tight whitespace-nowrap transition-colors select-none',
                  isCurrent
                    ? isRejected
                      ? 'text-rose-400 font-semibold'
                      : 'text-indigo-300 font-semibold'
                    : isCompleted
                    ? 'text-emerald-400/90'
                    : 'text-zinc-500 group-hover:text-zinc-400'
                )}
              >
                {isRejected && step.state === 'APPROVED' ? 'Rejected' : step.label}
              </span>
            </div>
          );
        })}
      </div>
      <div className="h-4" />
    </div>
  );
}
