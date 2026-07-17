import React from 'react';

export function SunsetRays() {
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      {/* Left Sun Ray */}
      <div 
        className="absolute -left-[10%] top-[20%] w-[60%] h-[120%] opacity-20 rotate-[15deg]"
        style={{
          background: 'radial-gradient(circle at center, rgba(255, 107, 0, 0.15) 0%, transparent 70%)',
          filter: 'blur(80px)',
        }}
      />
      
      {/* Right Sun Ray */}
      <div 
        className="absolute -right-[10%] top-[10%] w-[50%] h-[100%] opacity-15 -rotate-[12deg]"
        style={{
          background: 'radial-gradient(circle at center, rgba(255, 165, 0, 0.12) 0%, transparent 70%)',
          filter: 'blur(100px)',
        }}
      />

      {/* Center Glow */}
      <div 
        className="absolute left-1/2 top-[-20%] -translate-x-1/2 w-[80%] h-[60%] opacity-10"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(255, 69, 0, 0.1) 0%, transparent 80%)',
          filter: 'blur(120px)',
        }}
      />
      
      {/* Ambient Warmth Overlay */}
      <div className="absolute inset-0 bg-gradient-to-tr from-orange-500/5 via-transparent to-amber-500/5 mix-blend-overlay" />
    </div>
  );
}
