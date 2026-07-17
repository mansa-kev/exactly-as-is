import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Calendar, Users, ShieldCheck, ArrowRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Car } from '../../types';

interface BookingFormProps {
  car: Car;
}

export function BookingForm({ car }: BookingFormProps) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);

  const calculateTotal = () => {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return (diffDays || 1) * car.daily_rate;
  };

  const handleBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    // Simulate booking process
    try {
      // Removed simulated delay for instant feel
      toast.success('Booking request sent successfully! Our team will contact you shortly.');
    } catch (error) {
      toast.error('Failed to send booking request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 rounded-[40px] bg-card border border-white/5 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-[60px] -translate-y-1/2 translate-x-1/2" />
      
      <div className="relative z-10">
        <h3 className="text-2xl font-serif font-black italic text-foreground mb-6">Reserve This Vehicle</h3>
        
        <form onSubmit={handleBooking} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-2">Pickup Date</label>
              <div className="relative">
                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-primary" size={18} />
                <input 
                  type="date" 
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-card/50 border border-border rounded-2xl text-sm text-foreground focus:ring-2 focus:ring-primary/50 outline-none transition-all"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-2">Return Date</label>
              <div className="relative">
                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-primary" size={18} />
                <input 
                  type="date" 
                  required
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-card/50 border border-border rounded-2xl text-sm text-foreground focus:ring-2 focus:ring-primary/50 outline-none transition-all"
                />
              </div>
            </div>
          </div>

          <div className="p-6 rounded-3xl bg-card/50 border border-border space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground font-medium">Daily Rate</span>
              <span className="text-lg font-bold text-foreground">KES {car.daily_rate}</span>
            </div>
            <div className="flex justify-between items-center pt-4 border-t border-border">
              <span className="text-sm text-foreground font-black uppercase tracking-widest">Estimated Total</span>
              <span className="text-2xl font-black text-primary">KES {calculateTotal()}</span>
            </div>
          </div>

          <div className="space-y-3">
            {[
              "Comprehensive Insurance Included",
              "Free Cancellation up to 24h",
              "24/7 Roadside Assistance"
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3 text-xs text-muted-foreground font-medium">
                <ShieldCheck size={14} className="text-primary" />
                {item}
              </div>
            ))}
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full py-6 bg-primary rounded-2xl text-black font-black uppercase tracking-widest flex items-center justify-center gap-4 hover:bg-primary/90 transition-all group shadow-xl shadow-primary/20 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="animate-spin" size={24} />
            ) : (
              <>
                Confirm Reservation
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
