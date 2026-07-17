import React, { useState, useEffect, useMemo } from 'react';
import { promotionService, Promotion } from '../../services/promotionService';

function getTimeRemaining(endDate: string) {
  const total = new Date(endDate).getTime() - Date.now();
  if (total <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };
  const seconds = Math.floor((total / 1000) % 60);
  const minutes = Math.floor((total / 1000 / 60) % 60);
  const hours = Math.floor((total / (1000 * 60 * 60)) % 24);
  const days = Math.floor(total / (1000 * 60 * 60 * 24));
  return { days, hours, minutes, seconds, expired: false };
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}

export function PromoBanner() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [, setTick] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    promotionService.getActive().then((data) => {
      setPromotions(data);
      setLoaded(true);
    });
  }, []);

  // Tick every second to update countdowns
  useEffect(() => {
    if (promotions.length === 0) return;
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, [promotions.length]);

  // Filter out any that have expired since last fetch
  const activePromos = useMemo(
    () => promotions.filter((p) => !getTimeRemaining(p.end_date).expired),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [promotions]
  );

  if (!loaded || activePromos.length === 0) return null;

  const renderPromoItem = (promo: Promotion, index: number) => {
    const remaining = getTimeRemaining(promo.end_date);
    const displayText =
      promo.banner_text ||
      `${promo.title} - ${promo.discount_type === 'percentage' ? `${promo.discount_value}% OFF` : `R${promo.discount_value} OFF`}`;
    const countdown = `${pad(remaining.days)}d : ${pad(remaining.hours)}h : ${pad(remaining.minutes)}m : ${pad(remaining.seconds)}s`;

    return (
      <span key={promo.id + '-' + index} className="inline-flex items-center gap-3 whitespace-nowrap">
        <span className="font-bold uppercase tracking-wider text-xs text-black">
          {displayText}
        </span>
        <span className="bg-black/20 rounded-full px-3 py-1 text-xs font-mono text-black font-semibold">
          {countdown}
        </span>
      </span>
    );
  };

  const divider = (
    <span className="inline-flex items-center mx-6 text-black/60 text-sm select-none" aria-hidden="true">
      &#9670;
    </span>
  );

  // Build one full set of promo items with dividers between them
  const buildStrip = (keyPrefix: string) =>
    activePromos.map((promo, i) => (
      <React.Fragment key={keyPrefix + '-' + i}>
        {renderPromoItem(promo, i)}
        {divider}
      </React.Fragment>
    ));

  return (
    <>
      <style>{`
        @keyframes marquee-scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
      <div className="w-full bg-gradient-to-r from-primary via-amber-500 to-primary py-3 overflow-hidden relative">
        <div
          className="inline-flex items-center"
          style={{
            animation: 'marquee-scroll 20s linear infinite',
            willChange: 'transform',
          }}
        >
          {/* First copy */}
          {buildStrip('a')}
          {/* Duplicate for seamless loop */}
          {buildStrip('b')}
        </div>
      </div>
    </>
  );
}
