'use client';

import * as React from 'react';
import { ThemeProvider as NextThemesProvider, useTheme } from 'next-themes';

export type ThemePalette = 'zinc' | 'slate' | 'indigo' | 'emerald' | 'violet' | 'rose';

export interface PaletteInfo {
  id: ThemePalette;
  name: string;
  description: string;
  primaryColor: string;
  activeColor: string;
  glowClass: string;
}

export const PALETTES: PaletteInfo[] = [
  {
    id: 'zinc',
    name: 'Zinc',
    description: 'Monochrome & Linear Minimalist',
    primaryColor: '#18181b',
    activeColor: '#71717a',
    glowClass: 'shadow-zinc-500/20',
  },
  {
    id: 'slate',
    name: 'Slate',
    description: 'Cool Enterprise Gray',
    primaryColor: '#334155',
    activeColor: '#64748b',
    glowClass: 'shadow-slate-500/20',
  },
  {
    id: 'indigo',
    name: 'Indigo',
    description: 'Modern Tech SaaS Blue',
    primaryColor: '#6366f1',
    activeColor: '#818cf8',
    glowClass: 'shadow-indigo-500/25',
  },
  {
    id: 'emerald',
    name: 'Emerald',
    description: 'Clean Corporate Green',
    primaryColor: '#10b981',
    activeColor: '#34d399',
    glowClass: 'shadow-emerald-500/25',
  },
  {
    id: 'violet',
    name: 'Violet',
    description: 'Creative Enterprise Purple',
    primaryColor: '#8b5cf6',
    activeColor: '#a78bfa',
    glowClass: 'shadow-purple-500/25',
  },
  {
    id: 'rose',
    name: 'Rose',
    description: 'Warm Modern Accent',
    primaryColor: '#f43f5e',
    activeColor: '#fb7185',
    glowClass: 'shadow-rose-500/25',
  },
];

interface PaletteContextType {
  palette: ThemePalette;
  setPalette: (palette: ThemePalette) => void;
  availablePalettes: PaletteInfo[];
}

const PaletteContext = React.createContext<PaletteContextType>({
  palette: 'indigo',
  setPalette: () => {},
  availablePalettes: PALETTES,
});

export function usePalette() {
  const context = React.useContext(PaletteContext);
  if (!context) {
    throw new Error('usePalette must be used within a PaletteProvider');
  }
  return context;
}

export function PaletteProvider({ children }: { children: React.ReactNode }) {
  const [palette, setPaletteState] = React.useState<ThemePalette>('indigo');
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    try {
      const saved = localStorage.getItem('nexus-theme-palette') as ThemePalette | null;
      if (saved && PALETTES.some((p) => p.id === saved)) {
        setPaletteState(saved);
        document.documentElement.setAttribute('data-palette', saved);
      } else {
        document.documentElement.setAttribute('data-palette', 'indigo');
      }
    } catch {
      // Fallback
      document.documentElement.setAttribute('data-palette', 'indigo');
    }
  }, []);

  const setPalette = React.useCallback((newPalette: ThemePalette) => {
    setPaletteState(newPalette);
    try {
      localStorage.setItem('nexus-theme-palette', newPalette);
      document.documentElement.setAttribute('data-palette', newPalette);
    } catch (e) {
      console.warn('Failed to save palette to localStorage:', e);
    }
  }, []);

  return (
    <PaletteContext.Provider
      value={{
        palette,
        setPalette,
        availablePalettes: PALETTES,
      }}
    >
      {children}
    </PaletteContext.Provider>
  );
}

export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange={false}
      {...props}
    >
      <PaletteProvider>{children}</PaletteProvider>
    </NextThemesProvider>
  );
}
