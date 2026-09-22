'use client';

import React from 'react';
import { useTheme } from 'next-themes';
import {
  Sun,
  Moon,
  Laptop,
  Palette,
  Check,
  Sparkles,
  SlidersHorizontal,
  Layers,
  CheckCircle2,
  Tag,
} from 'lucide-react';
import { Modal } from './ui/modal';
import { Button } from './ui/button';
import { usePalette, PALETTES, ThemePalette } from './theme-provider';
import { cn } from '@/lib/utils';

interface ThemeSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ThemeSettingsModal({ isOpen, onClose }: ThemeSettingsModalProps) {
  const { theme, setTheme } = useTheme();
  const { palette, setPalette } = usePalette();

  const themeModes = [
    {
      id: 'light',
      label: 'Light Mode',
      desc: 'High clarity & crisp contrast for daylight environments',
      icon: Sun,
    },
    {
      id: 'dark',
      label: 'Dark Mode',
      desc: 'Deep zinc canvas engineered for low-light enterprise focus',
      icon: Moon,
    },
    {
      id: 'system',
      label: 'System Sync',
      desc: 'Automatically adapts to your operating system preference',
      icon: Laptop,
    },
  ];

  const currentPaletteInfo = PALETTES.find((p) => p.id === palette) || PALETTES[2];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Theme & Appearance"
      description="Personalize your enterprise interface mode and active accent palette."
      maxWidth="xl"
    >
      <div className="space-y-6">
        {/* Section 1: Appearance Mode */}
        <div className="space-y-2.5">
          <label className="text-xs font-semibold text-foreground flex items-center gap-1.5 font-mono uppercase tracking-wider">
            <Sun className="h-3.5 w-3.5 text-primary" />
            <span>Interface Mode</span>
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {themeModes.map((mode) => {
              const Icon = mode.icon;
              const isSelected = theme === mode.id;

              return (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setTheme(mode.id)}
                  className={cn(
                    'p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between group relative select-none',
                    isSelected
                      ? 'bg-card border-primary ring-1 ring-primary shadow-sm'
                      : 'bg-card/60 border-border hover:border-zinc-600 hover:bg-card'
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div
                      className={cn(
                        'p-2 rounded-lg border transition-colors',
                        isSelected
                          ? 'bg-primary/10 border-primary/30 text-primary'
                          : 'bg-muted border-border text-muted-foreground group-hover:text-foreground'
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    {isSelected && (
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <Check className="h-3 w-3" />
                      </span>
                    )}
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-foreground">{mode.label}</h4>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{mode.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Section 2: Color Palette Presets */}
        <div className="space-y-2.5 pt-4 border-t border-border">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-foreground flex items-center gap-1.5 font-mono uppercase tracking-wider">
              <Palette className="h-3.5 w-3.5 text-primary" />
              <span>Accent Color Palette</span>
            </label>
            <span className="text-[11px] font-mono text-muted-foreground">
              Current: <strong className="text-foreground">{currentPaletteInfo.name}</strong>
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {PALETTES.map((item) => {
              const isSelected = palette === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setPalette(item.id)}
                  className={cn(
                    'p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between group select-none',
                    isSelected
                      ? 'bg-card border-primary ring-1 ring-primary shadow-sm'
                      : 'bg-card/60 border-border hover:border-zinc-600 hover:bg-card'
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    {/* Swatch Dot */}
                    <div className="flex items-center gap-2">
                      <span
                        className="h-4 w-4 rounded-full shadow-sm ring-2 ring-border"
                        style={{ backgroundColor: item.primaryColor }}
                      />
                      <span className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">
                        {item.name}
                      </span>
                    </div>

                    {isSelected && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                  </div>

                  <p className="text-[10px] text-muted-foreground line-clamp-1">{item.description}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Section 3: Live Preview Sandbox */}
        <div className="pt-4 border-t border-border">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 font-mono">
            Interactive Theme Preview
          </p>

          <div className="p-4 rounded-xl border border-border bg-card/80 space-y-3 relative overflow-hidden">
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="primary">
                Primary Action
              </Button>
              <Button size="sm" variant="secondary">
                Secondary
              </Button>
              <Button size="sm" variant="outline">
                Outline
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20">
                Active Queue ({currentPaletteInfo.name})
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Approved SLA
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                Critical SLA
              </span>
            </div>
          </div>
        </div>

        {/* Done / Close Button */}
        <div className="flex items-center justify-end pt-2">
          <Button variant="primary" size="md" onClick={onClose} className="font-semibold">
            Done
          </Button>
        </div>
      </div>
    </Modal>
  );
}
