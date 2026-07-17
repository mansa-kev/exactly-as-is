import React from 'react';
import { Logo } from './Logo';

interface LogoLoaderProps {
  message?: string;
  fullScreen?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function LogoLoader({ message, fullScreen = false, size = 'md' }: LogoLoaderProps) {
  const containerSize = size === 'sm' ? 'w-16 h-16' : size === 'lg' ? 'w-36 h-36' : 'w-28 h-28';
  const outerBorder = size === 'sm' ? 'border-[2px]' : 'border-[3px]';
  const innerBorder = size === 'sm' ? 'border-[1.5px]' : 'border-[2px]';

  const spinner = (
    <div className="flex flex-col items-center gap-5">
      <div className={`relative ${containerSize} flex items-center justify-center`}>
        {/* Outer ring — clockwise */}
        <div className={`absolute inset-0 rounded-full ${outerBorder} border-primary/20 border-t-primary animate-spin`} />
        {/* Inner ring — counter-clockwise */}
        <div
          className={`absolute inset-2 rounded-full ${innerBorder} border-primary/10 border-b-primary/60`}
          style={{ animation: 'spin 1.5s linear infinite reverse' }}
        />
        {/* Logo — slow spin */}
        <div style={{ animation: 'spin 3s linear infinite' }}>
          <Logo size="sm" showText={false} />
        </div>
      </div>
      {message && (
        <p className="text-muted-foreground text-xs font-semibold tracking-widest uppercase">
          {message}
        </p>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        {spinner}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center h-64">
      {spinner}
    </div>
  );
}
