import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';

interface DesktopFlowOverlayProps {
  open: boolean;
  onClose: () => void;
  variant?: 'booking' | 'reservation';
  ariaLabel: string;
  children: React.ReactNode;
}

export function DesktopFlowOverlay({
  open,
  onClose,
  variant = 'booking',
  ariaLabel,
  children,
}: DesktopFlowOverlayProps) {
  const glowClass =
    variant === 'reservation'
      ? 'from-warning/20 via-orange-500/10 to-warning/20'
      : 'from-primary/20 via-orange-500/10 to-primary/20';
  const borderClass = variant === 'reservation' ? 'border-warning/20' : 'border-primary/20';

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="hidden lg:block fixed inset-0 z-50"
        >
          <button
            type="button"
            aria-label={ariaLabel}
            onClick={onClose}
            className="absolute inset-0 bg-black/65 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 40 }}
            className="absolute top-20 bottom-6 left-[12%] right-6 max-w-none overflow-y-auto"
          >
            <div className="relative h-full">
              <div className={`absolute -inset-1 bg-gradient-to-r ${glowClass} rounded-[32px] blur-2xl`} />
              <div
                className={`relative h-full min-h-[520px] p-6 xl:p-10 bg-card/95 backdrop-blur-xl rounded-[32px] border ${borderClass} shadow-2xl`}
              >
                <button
                  type="button"
                  onClick={onClose}
                  className="absolute top-5 right-5 p-2 hover:bg-white/10 rounded-full transition-all z-10"
                >
                  <X size={24} className="text-white" />
                </button>
                {children}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
