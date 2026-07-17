import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Tag, Clock } from 'lucide-react';
import { promotionService, Promotion } from '../../services/promotionService';

export function PromoBadge() {
  const [promos, setPromos] = useState<Promotion[]>([]);
  const [dismissed, setDismissed] = useState(false);
  const [, setTick] = useState(0);

  useEffect(() => {
    promotionService.getActive().then(setPromos);
  }, []);

  // Tick countdown every minute
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  if (dismissed || promos.length === 0) return null;

  const promo = promos[0];
  const diff = new Date(promo.end_date).getTime() - Date.now();
  const daysLeft = Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
  const hoursLeft = Math.max(0, Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)));

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -20, scale: 0.9 }}
        className="fixed top-24 right-4 md:right-8 z-40 max-w-xs"
      >
        <div className="relative bg-gradient-to-br from-primary via-amber-500 to-primary rounded-2xl shadow-2xl shadow-primary/30 overflow-hidden">
          {/* Dismiss button */}
          <button
            onClick={() => setDismissed(true)}
            className="absolute top-2 right-2 p-1 bg-black/20 rounded-full hover:bg-black/40 transition-colors z-10"
          >
            <X size={14} className="text-foreground" />
          </button>

          {/* Hanging ribbon effect */}
          <div className="absolute -top-1 left-6 w-6 h-8 bg-red-600 rounded-b-sm" />
          <div className="absolute -top-1 left-5 w-0 h-0 border-l-[4px] border-l-transparent border-t-[4px] border-t-red-800" />
          <div className="absolute -top-1 left-[42px] w-0 h-0 border-r-[4px] border-r-transparent border-t-[4px] border-t-red-800" />

          <div className="p-5 pt-4">
            {/* Discount Badge */}
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-xl bg-black/20 flex items-center justify-center">
                <Tag className="text-foreground" size={24} />
              </div>
              <div>
                <p className="text-black font-black text-2xl leading-none">
                  {promo.discount_type === 'percentage'
                    ? `${promo.discount_value}% OFF`
                    : `KES ${promo.discount_value} OFF`
                  }
                </p>
                <p className="text-black/70 text-[10px] font-bold uppercase tracking-widest mt-0.5">
                  {promo.category === 'all' ? 'All vehicles' : `${promo.category} vehicles`}
                </p>
              </div>
            </div>

            {/* Title */}
            <p className="text-black/90 text-xs font-bold mb-3 leading-relaxed">
              {promo.banner_text || promo.title}
            </p>

            {/* Countdown */}
            {diff > 0 && (
              <div className="flex items-center gap-1.5 text-black/70">
                <Clock size={12} />
                <span className="text-[10px] font-bold uppercase tracking-widest">
                  {daysLeft > 0 ? `${daysLeft}d ` : ''}{hoursLeft}h remaining
                </span>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
