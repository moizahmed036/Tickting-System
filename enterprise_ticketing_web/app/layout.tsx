import React from 'react';
import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/lib/auth';
import { ThemeProvider } from '@/components/theme-provider';

import { Toaster } from 'sonner';

export const metadata: Metadata = {
  title: 'NexusFlow Enterprise - Workflow & Ticketing Automation',
  description: 'Enterprise-grade multi-department workflow management and ticketing finite state machine.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased selection:bg-primary selection:text-primary-foreground font-sans">
        <ThemeProvider>
          <AuthProvider>
            {children}
            <Toaster richColors position="top-right" theme="system" />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
