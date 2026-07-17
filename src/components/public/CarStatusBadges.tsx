import React from 'react';

interface CarStatusBadgesProps {
  status: 'available' | 'booked' | 'reserved' | 'unavailable';
}

export function CarStatusBadges({ status }: CarStatusBadgesProps) {
  const getBadgeConfig = (carStatus: string) => {
    switch (carStatus) {
      case 'available':
        return {
          left: 'Available',
          right: 'Reserve',
          leftBg: 'bg-success/20',
          leftText: 'text-success',
          leftBorder: 'border-success/30',
          rightBg: 'bg-primary/20',
          rightText: 'text-primary',
          rightBorder: 'border-primary/30'
        };
      case 'booked':
        return {
          left: 'Booked',
          right: 'Unavailable',
          leftBg: 'bg-error/20',
          leftText: 'text-error',
          leftBorder: 'border-error/30',
          rightBg: 'bg-muted/50',
          rightText: 'text-muted-foreground',
          rightBorder: 'border-border'
        };
      case 'reserved':
        return {
          left: 'Reserved',
          right: 'Unavailable',
          leftBg: 'bg-amber-500/20',
          leftText: 'text-amber-500',
          leftBorder: 'border-amber-500/30',
          rightBg: 'bg-muted/50',
          rightText: 'text-muted-foreground',
          rightBorder: 'border-border'
        };
      case 'unavailable':
        return {
          left: 'Unavailable',
          right: 'Unavailable',
          leftBg: 'bg-error/20',
          leftText: 'text-error',
          leftBorder: 'border-error/30',
          rightBg: 'bg-muted/50',
          rightText: 'text-muted-foreground',
          rightBorder: 'border-border'
        };
      default:
        return {
          left: 'Available',
          right: 'Reserve',
          leftBg: 'bg-success/20',
          leftText: 'text-success',
          leftBorder: 'border-success/30',
          rightBg: 'bg-primary/20',
          rightText: 'text-primary',
          rightBorder: 'border-primary/30'
        };
    }
  };

  const config = getBadgeConfig(status);

  return (
    <>
      {/* Left Badge - Status */}
      <div className={`absolute top-3 left-3 px-2 py-1 md:px-3 md:py-1.5 bg-background/90 backdrop-blur-sm rounded-full border text-[9px] md:text-[10px] font-black uppercase tracking-widest z-10 ${config.leftBg} ${config.leftText} ${config.leftBorder}`}>
        {config.left}
      </div>

      {/* Right Badge - Action */}
      <div className={`absolute top-3 right-3 px-2 py-1 md:px-3 md:py-1.5 bg-background/90 backdrop-blur-sm rounded-full border text-[9px] md:text-[10px] font-black uppercase tracking-widest z-10 ${config.rightBg} ${config.rightText} ${config.rightBorder}`}>
        {config.right}
      </div>
    </>
  );
}
