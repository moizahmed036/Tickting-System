import React from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info';
  size?: 'xs' | 'sm' | 'md';
}

export function Badge({ className, variant = 'default', size = 'sm', children, ...props }: BadgeProps) {
  const baseStyles = 'inline-flex items-center font-medium rounded-full border transition-colors select-none';

  const variants = {
    default: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20',
    secondary: 'bg-zinc-800/80 text-zinc-300 border-zinc-700/60',
    destructive: 'bg-rose-500/10 text-rose-300 border-rose-500/20',
    outline: 'text-zinc-300 border-zinc-700/80 bg-transparent',
    success: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
    warning: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
    info: 'bg-sky-500/10 text-sky-300 border-sky-500/20',
  };

  const sizes = {
    xs: 'px-1.5 py-0.2 text-[10px]',
    sm: 'px-2 py-0.5 text-[11px]',
    md: 'px-2.5 py-0.5 text-xs',
  };

  return (
    <div className={cn(baseStyles, variants[variant], sizes[size], className)} {...props}>
      {children}
    </div>
  );
}
