import React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, label, error, hint, ...props }, ref) => {
    return (
      <div className="w-full space-y-1.5">
        {label && <label className="text-xs font-medium text-foreground">{label}</label>}
        <input
          type={type}
          className={cn(
            'flex h-9 w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground',
            'focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-40 transition-all',
            error && 'border-rose-500/80 focus:border-rose-500 focus:ring-rose-500/40',
            className
          )}
          ref={ref}
          {...props}
        />
        {hint && !error && <p className="text-[11px] text-muted-foreground">{hint}</p>}
        {error && <p className="text-[11px] text-rose-500 dark:text-rose-400 font-medium">{error}</p>}
      </div>
    );
  }
);
Input.displayName = 'Input';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, hint, ...props }, ref) => {
    return (
      <div className="w-full space-y-1.5">
        {label && <label className="text-xs font-medium text-foreground">{label}</label>}
        <textarea
          className={cn(
            'flex min-h-[85px] w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground',
            'focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-40 transition-all',
            error && 'border-rose-500/80 focus:border-rose-500 focus:ring-rose-500/40',
            className
          )}
          ref={ref}
          {...props}
        />
        {hint && !error && <p className="text-[11px] text-muted-foreground">{hint}</p>}
        {error && <p className="text-[11px] text-rose-500 dark:text-rose-400 font-medium">{error}</p>}
      </div>
    );
  }
);
Textarea.displayName = 'Textarea';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, hint, children, ...props }, ref) => {
    return (
      <div className="w-full space-y-1.5">
        {label && <label className="text-xs font-medium text-foreground">{label}</label>}
        <select
          className={cn(
            'flex h-9 w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground',
            'focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-40 transition-all cursor-pointer',
            error && 'border-rose-500/80 focus:border-rose-500 focus:ring-rose-500/40',
            className
          )}
          ref={ref}
          {...props}
        >
          {children}
        </select>
        {hint && !error && <p className="text-[11px] text-muted-foreground">{hint}</p>}
        {error && <p className="text-[11px] text-rose-500 dark:text-rose-400 font-medium">{error}</p>}
      </div>
    );
  }
);
Select.displayName = 'Select';
