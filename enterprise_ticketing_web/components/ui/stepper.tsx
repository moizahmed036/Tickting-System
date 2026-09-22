import React from 'react';
import { Check, Clock, AlertCircle, XCircle } from 'lucide-react';
import { TicketState } from '@/lib/types';
import { cn } from '@/lib/utils';

interface StepperProps {
  currentState: TicketState;
}

const LIFECYCLE_STEPS: { state: TicketState; label: string }[] = [
  { state: 'DRAFT', label: 'Draft' },
  { state: 'SUBMITTED', label: 'Submitted' },
  { state: 'PENDING_APPROVAL', label: 'Triage / Approval' },
  { state: 'APPROVED', label: 'Approved' },
  { state: 'IN_PROGRESS', label: 'In Progress' },
  { state: 'RESOLVED', label: 'Resolved' },
  { state: 'CLOSED', label: 'Closed' },
];

export function WorkflowStepper({ currentState }: StepperProps) {
  const isRejected = currentState === 'REJECTED';

  const getStateIndex = (state: TicketState) => {
    if (state === 'REJECTED') return 2; // Split off from pending approval
    const idx = LIFECYCLE_STEPS.findIndex((s) => s.state === state);
    return idx !== -1 ? idx : 0;
  };

  const currentIndex = getStateIndex(currentState);

  return (
    <div className="w-full py-4 px-2">
      <div className="relative flex items-center justify-between">
        {/* Connection Line */}
        <div className="absolute left-0 top-1/2 h-0.5 w-full -translate-y-1/2 bg-slate-800" />
        <div
          className={cn(
            'absolute left-0 top-1/2 h-0.5 -translate-y-1/2 transition-all duration-500',
            isRejected ? 'bg-rose-500' : 'bg-indigo-600'
          )}
          style={{
            width: `${Math.min(100, (currentIndex / (LIFECYCLE_STEPS.length - 1)) * 100)}%`,
          }}
        />

        {/* Steps */}
        {LIFECYCLE_STEPS.map((step, index) => {
          const isCompleted = index < currentIndex;
          const isCurrent = index === currentIndex;

          let stepIcon = <span className="text-xs font-semibold">{index + 1}</span>;
          let circleStyle = 'bg-slate-900 border-slate-700 text-slate-400';

          if (isCurrent) {
            if (isRejected && step.state === 'PENDING_APPROVAL') {
              stepIcon = <XCircle className="h-4 w-4 text-white" />;
              circleStyle = 'bg-rose-600 border-rose-500 text-white ring-4 ring-rose-500/20';
            } else {
              stepIcon = <Clock className="h-4 w-4 text-white animate-pulse" />;
              circleStyle = 'bg-indigo-600 border-indigo-400 text-white ring-4 ring-indigo-500/20';
            }
          } else if (isCompleted) {
            stepIcon = <Check className="h-4 w-4 text-white" />;
            circleStyle = 'bg-emerald-600 border-emerald-500 text-white';
          }

          return (
            <div key={step.state} className="relative z-10 flex flex-col items-center">
              <div
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all duration-300',
                  circleStyle
                )}
              >
                {stepIcon}
              </div>
              <span
                className={cn(
                  'absolute -bottom-6 text-[11px] font-medium whitespace-nowrap transition-colors',
                  isCurrent
                    ? isRejected
                      ? 'text-rose-400 font-semibold'
                      : 'text-indigo-300 font-semibold'
                    : isCompleted
                    ? 'text-emerald-400'
                    : 'text-slate-500'
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
