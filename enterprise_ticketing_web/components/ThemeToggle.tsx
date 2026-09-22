'use client';

import React, { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import {
  Sun,
  Moon,
  Laptop,
  Palette,
  Check,
  ChevronDown,
  Sparkles,
} from 'lucide-react';
import { usePalette, PALETTES } from './theme-provider';
import { ThemeSettingsModal } from './ThemeSettingsModal';
import { cn } from '@/lib/utils';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const { palette } = usePalette();
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="w-8 h-8 rounded-lg border border-border bg-card/60 animate-pulse" />
    );
  }

  const currentPaletteInfo = PALETTES.find((p) => p.id === palette) || PALETTES[2];

  const getThemeIcon = () => {
    if (theme === 'light') return <Sun className="h-3.5 w-3.5 text-amber-500" />;
    if (theme === 'dark') return <Moon className="h-3.5 w-3.5 text-primary" />;
    return <Laptop className="h-3.5 w-3.5 text-zinc-400" />;
  };

  return (
    <>
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg border border-border bg-card/80 hover:bg-muted text-xs font-medium text-foreground transition-all cursor-pointer shadow-sm select-none"
          title="Theme & Appearance Controls"
        >
          {getThemeIcon()}
          {/* Palette Color Indicator Dot */}
          <span
            className="h-2 w-2 rounded-full shadow-sm"
            style={{ backgroundColor: currentPaletteInfo.primaryColor }}
            title={`Active Palette: ${currentPaletteInfo.name}`}
          />
          <ChevronDown className={cn('h-3 w-3 text-muted-foreground transition-transform duration-150', isOpen && 'rotate-180')} />
        </button>

        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <div className="absolute right-0 mt-2 w-56 rounded-xl border border-border bg-popover/95 backdrop-blur-xl p-1.5 shadow-2xl z-50 animate-fade-in">
              <div className="px-2.5 py-1.5 border-b border-border/80 mb-1">
                <p className="text-[11px] font-semibold text-foreground">Appearance Mode</p>
                <p className="text-[10px] text-muted-foreground">Active Palette: {currentPaletteInfo.name}</p>
              </div>

              {/* Mode Options */}
              <div className="space-y-0.5">
                <button
                  onClick={() => {
                    setTheme('light');
                    setIsOpen(false);
                  }}
                  className={cn(
                    'w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition cursor-pointer',
                    theme === 'light'
                      ? 'bg-muted text-foreground font-semibold'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                  )}
                >
                  <span className="flex items-center gap-2">
                    <Sun className="h-3.5 w-3.5 text-amber-500" />
                    <span>Light Mode</span>
                  </span>
                  {theme === 'light' && <Check className="h-3.5 w-3.5 text-primary" />}
                </button>

                <button
                  onClick={() => {
                    setTheme('dark');
                    setIsOpen(false);
                  }}
                  className={cn(
                    'w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition cursor-pointer',
                    theme === 'dark'
                      ? 'bg-muted text-foreground font-semibold'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                  )}
                >
                  <span className="flex items-center gap-2">
                    <Moon className="h-3.5 w-3.5 text-primary" />
                    <span>Dark Mode</span>
                  </span>
                  {theme === 'dark' && <Check className="h-3.5 w-3.5 text-primary" />}
                </button>

                <button
                  onClick={() => {
                    setTheme('system');
                    setIsOpen(false);
                  }}
                  className={cn(
                    'w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition cursor-pointer',
                    theme === 'system'
                      ? 'bg-muted text-foreground font-semibold'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                  )}
                >
                  <span className="flex items-center gap-2">
                    <Laptop className="h-3.5 w-3.5 text-zinc-400" />
                    <span>System Sync</span>
                  </span>
                  {theme === 'system' && <Check className="h-3.5 w-3.5 text-primary" />}
                </button>
              </div>

              {/* Palette Settings Trigger */}
              <div className="pt-1.5 mt-1 border-t border-border/80">
                <button
                  onClick={() => {
                    setIsOpen(false);
                    setIsModalOpen(true);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-primary hover:bg-primary/10 transition font-medium cursor-pointer"
                >
                  <Palette className="h-3.5 w-3.5" />
                  <span>Customize Palettes...</span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Full Theme Customization Modal */}
      <ThemeSettingsModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
}
