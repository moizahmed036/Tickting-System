import React from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info';
  size?: 'sm' | 'md';
}

export function Badge({ className, variant = 'default', size = 'md', children, ...props }: BadgeProps) {
  const baseStyles = 'inline-flex items-center font-medium rounded-full border transition-colors';

  const variants = {
    default: 'border-transparent bg-indigo-950/80 text-indigo-300 border-indigo-700/50',
    secondary: 'border-transparent bg-slate-800 text-slate-300 border-slate-700',
    destructive: 'border-transparent bg-rose-950/80 text-rose-300 border-rose-700/50',
    outline: 'text-slate-300 border-slate-700',
    success: 'border-transparent bg-emerald-950/80 text-emerald-300 border-emerald-700/50',
    warning: 'border-transparent bg-amber-950/80 text-amber-300 border-amber-700/50',
    info: 'border-transparent bg-sky-950/80 text-sky-300 border-sky-700/50',
  };

  const sizes = {
    sm: 'px-2 py-0.5 text-[10px]',
    md: 'px-2.5 py-0.5 text-xs',
  };

  return (
    <div className={cn(baseStyles, variants[variant], sizes[size], className)} {...props}>
      {children}
    </div>
  );
}
