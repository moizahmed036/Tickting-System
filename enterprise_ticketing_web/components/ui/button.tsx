import React from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'destructive' | 'ghost' | 'success' | 'amber' | 'subtle';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'icon';
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading = false, children, disabled, ...props }, ref) => {
    const baseStyles =
      'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-40 disabled:pointer-events-none cursor-pointer active:scale-[0.98] select-none';

    const variants = {
      primary:
        'bg-primary hover:opacity-90 text-primary-foreground shadow-sm shadow-primary/30 border border-primary/30 hover:shadow-glow',
      secondary:
        'bg-secondary hover:bg-muted text-secondary-foreground border border-border shadow-sm',
      outline:
        'bg-transparent hover:bg-muted text-foreground border border-border hover:border-zinc-500',
      subtle:
        'bg-muted/80 hover:bg-muted text-foreground border border-border',
      destructive:
        'bg-rose-600 hover:bg-rose-500 text-white shadow-sm shadow-rose-600/25 border border-rose-500/30 hover:shadow-glow-rose',
      ghost:
        'bg-transparent hover:bg-muted text-muted-foreground hover:text-foreground',
      success:
        'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm shadow-emerald-600/25 border border-emerald-500/30 hover:shadow-glow-emerald',
      amber:
        'bg-amber-600 hover:bg-amber-500 text-white shadow-sm shadow-amber-600/25 border border-amber-500/30',
    };

    const sizes = {
      xs: 'px-2.5 py-1 text-[11px] gap-1 rounded-md',
      sm: 'px-3 py-1.5 text-xs gap-1.5 rounded-md',
      md: 'px-3.5 py-2 text-xs font-medium gap-2 rounded-lg',
      lg: 'px-5 py-2.5 text-sm font-semibold gap-2.5 rounded-lg',
      icon: 'p-2 w-8 h-8 rounded-lg',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      >
        {isLoading ? (
          <svg className="animate-spin -ml-0.5 mr-1.5 h-3.5 w-3.5 text-current" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        ) : null}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
