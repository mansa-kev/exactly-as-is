import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Car } from '../../../types';
import { Calendar, MapPin, ArrowRight, Clock, ShieldCheck, Users, Star, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { supabase } from '../../../lib/supabase';
import { promotionService, Promotion } from '../../../services/promotionService';
import { calculateRentalDays } from '../../../utils/rentalDays';

interface Step1Props {
  car: Car;
  onNext: (data: any) => void;
  initialData?: any;
}

interface AvailableDriver {
  id: string;
  full_name: string;
  rating: number;
  total_trips: number;
  avatar_url?: string;
}

export function Step1({ car, onNext, initialData }: Step1Props) {
  const navigate = useNavigate();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [pickupLocation, setPickupLocation] = useState('');
  const [dropoffLocation, setDropoffLocation] = useState('');
  const [needsChauffeur, setNeedsChauffeur] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState<string | null>(null);
  const [drivers, setDrivers] = useState<AvailableDriver[]>([]);
  const [loadingDrivers, setLoadingDrivers] = useState(false);
  const [days, setDays] = useState(0);
  const [total, setTotal] = useState(0);
  const [activePromo, setActivePromo] = useState<Promotion | null>(null);
  const [discountedTotal, setDiscountedTotal] = useState(0);
  const [reservationFee, setReservationFee] = useState(0);

  // Fetch active promo for this car's category
  useEffect(() => {
    promotionService.getForCategory(car.category || '').then(setActivePromo);
  }, [car.category]);

  useEffect(() => {
    if (startDate && endDate) {
      const diffDays = calculateRentalDays(startDate, endDate);
      setDays(diffDays);
      const originalTotal = diffDays * car.daily_rate;
      
      let computedDiscounted = originalTotal;
      if (activePromo) {
        const { discounted } = promotionService.applyDiscount(car.daily_rate, activePromo);
        computedDiscounted = diffDays * discounted;
      }

      setTotal(Math.max(0, originalTotal - reservationFee));
      setDiscountedTotal(Math.max(0, computedDiscounted - reservationFee));
    }
  }, [startDate, endDate, car.daily_rate, activePromo, reservationFee]);

  useEffect(() => {
    if (needsChauffeur) {
      fetchAvailableDrivers();
    } else {
      setSelectedDriver(null);
    }
  }, [needsChauffeur]);

  useEffect(() => {
    if (!initialData) return;

    setStartDate(initialData.startDate || '');
    setEndDate(initialData.endDate || '');
    setPickupLocation(initialData.pickupLocation || initialData.location || '');
    setDropoffLocation(initialData.dropoffLocation || '');
    setNeedsChauffeur(Boolean(initialData.needsChauffeur));
    setSelectedDriver(initialData.driverId || null);
    setReservationFee(initialData.reservationFee || 0);
  }, [initialData]);

  const fetchAvailableDrivers = async () => {
    setLoadingDrivers(true);
    try {
      const { data, error } = await supabase
        .from('driver_profiles')
        .select('id, rating, total_trips, user_profiles!inner(full_name, avatar_url)')
        .eq('status', 'active');

      if (error) throw error;

      const mapped = (data || []).map((d: any) => ({
        id: d.id,
        full_name: d.user_profiles?.full_name || 'Driver',
        rating: d.rating || 0,
        total_trips: d.total_trips || 0,
        avatar_url: d.user_profiles?.avatar_url
      }));
      setDrivers(mapped);
    } catch {
      // Fallback if driver_profiles join fails
      const { data } = await supabase
        .from('user_profiles')
        .select('id, full_name, avatar_url')
        .eq('role', 'driver')
        .eq('status', 'active');

      setDrivers((data || []).map((d: any) => ({
        id: d.id,
        full_name: d.full_name || 'Driver',
        rating: 4.5,
        total_trips: 0,
        avatar_url: d.avatar_url
      })));
    } finally {
      setLoadingDrivers(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (days <= 0 || !pickupLocation) return;
    onNext({
      startDate,
      endDate,
      location: pickupLocation,
      pickupLocation,
      dropoffLocation,
      needsChauffeur,
      driverId: needsChauffeur ? selectedDriver : null,
      totalAmount: activePromo ? discountedTotal : total,
      originalAmount: total,
      discount: activePromo ? total - discountedTotal : 0,
      promoTitle: activePromo?.title || null,
      days
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6 md:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <button
        onClick={() => navigate('/')}
        className="flex items-center gap-2 text-sm text-gray-400 hover:text-white mb-6 group transition-colors"
      >
        <span className="text-lg group-hover:-translate-x-1 transition-transform inline-block">â</span>
        <span className="font-semibold">Back to Home</span>
      </button>
      <div className="space-y-1">
        <h3 className="text-xl sm:text-2xl md:text-3xl font-serif font-black italic text-white">Select Your Journey</h3>
        <p className="text-muted-foreground text-xs sm:text-sm">Choose your pickup & drop-off locations and rental duration.</p>
      </div>

      <div className="space-y-3 sm:space-y-4 md:space-y-6">
        {/* Pickup Location */}
        <div className="group">
          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-primary mb-2 block">Pickup Location</label>
          <div className="relative">
            <MapPin className="absolute left-4 md:left-5 top-1/2 -translate-y-1/2 text-primary/50 group-focus-within:text-primary transition-colors" size={18} />
            <input
              type="text"
              required
              value={pickupLocation}
              onChange={(e) => setPickupLocation(e.target.value)}
              placeholder="Enter pickup location (e.g. Nairobi CBD, Westlands, JKIA...)"
              className="w-full pl-12 md:pl-14 pr-4 md:pr-6 py-4 md:py-5 bg-white/5 border border-white/10 rounded-[20px] md:rounded-[24px] text-sm font-bold text-white focus:ring-2 focus:ring-primary/20 outline-none transition-all hover:bg-white/10 placeholder:text-white/30"
            />
          </div>
        </div>

        {/* Drop-off Location */}
        <div className="group">
          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-primary mb-2 block">Drop-off Location</label>
          <div className="relative">
            <MapPin className="absolute left-4 md:left-5 top-1/2 -translate-y-1/2 text-primary/50 group-focus-within:text-primary transition-colors" size={18} />
            <input
              type="text"
              required
              value={dropoffLocation}
              onChange={(e) => setDropoffLocation(e.target.value)}
              placeholder="Enter drop-off location (e.g. Nairobi CBD, Westlands, JKIA...)"
              className="w-full pl-12 md:pl-14 pr-4 md:pr-6 py-4 md:py-5 bg-white/5 border border-white/10 rounded-[20px] md:rounded-[24px] text-sm font-bold text-white focus:ring-2 focus:ring-primary/20 outline-none transition-all hover:bg-white/10 placeholder:text-white/30"
            />
          </div>
        </div>

        {/* Reservation Date Info */}
        {reservationFee > 0 && (
          <div className="bg-primary/10 border border-primary/20 rounded-[16px] p-4 flex gap-3 items-start">
            <Calendar className="text-primary shrink-0" size={16} />
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-1">Dates Pre-filled</p>
              <p className="text-xs text-primary/80">
                Your reserved dates are pre-filled. You can extend your rental if needed, and your KES {reservationFee.toLocaleString()} reservation fee will still be applied to the final total.
              </p>
            </div>
          </div>
        )}

        {/* Date Grid */}
        <div className="grid grid-cols-2 gap-3 md:gap-6">
          <div className="group">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-primary mb-2 block">Pickup Date</label>
            <div className="relative">
              <Calendar className="absolute left-4 md:left-5 top-1/2 -translate-y-1/2 text-primary/50 group-focus-within:text-primary transition-colors" size={18} />
              <input
                type="date"
                required
                min={new Date().toISOString().split('T')[0]}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full pl-12 md:pl-14 pr-2 md:pr-6 py-4 md:py-5 bg-white/5 border border-white/10 rounded-[20px] md:rounded-[24px] text-xs md:text-sm font-bold text-white focus:ring-2 focus:ring-primary/20 outline-none transition-all hover:bg-white/10 [color-scheme:dark]"
              />
            </div>
          </div>
          <div className="group">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-primary mb-2 block">Return Date</label>
            <div className="relative">
              <Calendar className="absolute left-4 md:left-5 top-1/2 -translate-y-1/2 text-primary/50 group-focus-within:text-primary transition-colors" size={18} />
              <input
                type="date"
                required
                min={startDate || new Date().toISOString().split('T')[0]}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full pl-12 md:pl-14 pr-2 md:pr-6 py-4 md:py-5 bg-white/5 border border-white/10 rounded-[20px] md:rounded-[24px] text-xs md:text-sm font-bold text-white focus:ring-2 focus:ring-primary/20 outline-none transition-all hover:bg-white/10 [color-scheme:dark]"
              />
            </div>
          </div>
        </div>

        {/* Chauffeur Section */}
        <div className="p-4 md:p-6 bg-white/5 border border-white/10 rounded-[20px] md:rounded-[32px] space-y-4">
          <label className="flex items-center justify-between cursor-pointer">
            <div className="flex items-center gap-3">
              <Users className="text-primary" size={20} />
              <div>
                <p className="text-sm font-bold text-white">Need a Chauffeur?</p>
                <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">Professional driver for your trip</p>
              </div>
            </div>
            <div className="relative">
              <input
                type="checkbox"
                checked={needsChauffeur}
                onChange={(e) => setNeedsChauffeur(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-white/10 rounded-full peer-checked:bg-primary transition-colors" />
              <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full peer-checked:translate-x-5 transition-transform" />
            </div>
          </label>

          {needsChauffeur && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-3 pt-3 border-t border-white/10">
              <p className="text-[10px] font-black uppercase tracking-widest text-primary/60">Available Drivers</p>
              {loadingDrivers ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="animate-spin text-primary" size={24} />
                </div>
              ) : drivers.length === 0 ? (
                <p className="text-xs text-white/40 text-center py-4">No drivers currently available. You can still proceed without a chauffeur.</p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {drivers.map((driver) => (
                    <button
                      key={driver.id}
                      type="button"
                      onClick={() => setSelectedDriver(driver.id === selectedDriver ? null : driver.id)}
                      className={`w-full flex items-center gap-3 p-3 rounded-[16px] border transition-all text-left ${
                        selectedDriver === driver.id
                          ? 'border-primary bg-primary/10'
                          : 'border-white/10 bg-white/5 hover:bg-white/10'
                      }`}
                    >
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0 overflow-hidden">
                        {driver.avatar_url ? (
                          <img src={driver.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          driver.full_name.charAt(0)
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-white truncate">{driver.full_name}</p>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="flex items-center gap-1 text-amber-500">
                            <Star size={10} fill="currentColor" />
                            <span className="text-[10px] font-bold">{driver.rating.toFixed(1)}</span>
                          </span>
                          <span className="text-[10px] text-white/40 font-bold">{driver.total_trips} trips</span>
                        </div>
                      </div>
                      {selectedDriver === driver.id && (
                        <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center shrink-0">
                          <span className="text-black text-xs">✓</span>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </div>
      </div>

      {/* Dynamic Price Card */}
      {days > 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="p-4 md:p-6 bg-primary/5 border border-primary/20 rounded-[24px] md:rounded-[32px] space-y-4"
        >
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <Clock size={20} />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-primary/60">Duration</p>
                <p className="text-sm font-bold text-white">{days} {days === 1 ? 'Day' : 'Days'}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black uppercase tracking-widest text-primary/60">Total Amount</p>
              {activePromo && discountedTotal < total ? (
                <div>
                  <p className="text-sm text-white/40 line-through">KES {total.toLocaleString()}</p>
                  <p className="text-xl md:text-2xl font-black text-primary">KES {discountedTotal.toLocaleString()}</p>
                </div>
              ) : (
                <p className="text-xl md:text-2xl font-black text-primary">KES {total.toLocaleString()}</p>
              )}
            </div>
          </div>

          {/* Promo discount breakdown */}
          {(activePromo && discountedTotal < total) || reservationFee > 0 ? (
            <div className="pt-3 border-t border-primary/10 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-white/60">Rental ({days} days x KES {car.daily_rate.toLocaleString()})</span>
                <span className="text-white/60">KES {(days * car.daily_rate).toLocaleString()}</span>
              </div>
              {activePromo && discountedTotal < total && (
                <div className="flex justify-between text-xs">
                  <span className="text-green-400 font-bold">{activePromo.title} (-{activePromo.discount_type === 'percentage' ? `${activePromo.discount_value}%` : `KES ${activePromo.discount_value}`})</span>
                  <span className="text-green-400 font-bold">- KES {(total - discountedTotal).toLocaleString()}</span>
                </div>
              )}
              {reservationFee > 0 && (
                <div className="flex justify-between text-xs">
                  <span className="text-green-400 font-bold">Reservation Fee Paid</span>
                  <span className="text-green-400 font-bold">- KES {reservationFee.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-bold pt-2 border-t border-primary/10">
                <span className="text-white">You Pay</span>
                <span className="text-primary font-black">KES {(activePromo ? discountedTotal : total).toLocaleString()}</span>
              </div>
            </div>
          ) : null}

          <div className="pt-4 border-t border-primary/10 flex items-center gap-2 text-[10px] text-primary/60 font-bold uppercase tracking-widest">
            <ShieldCheck size={14} />
            Includes Basic Insurance & 24/7 Roadside Assistance
          </div>
        </motion.div>
      )}

      <button
        type="submit"
        disabled={!startDate || !endDate || days <= 0 || !pickupLocation || (needsChauffeur && drivers.length > 0 && !selectedDriver)}
        className="w-full py-3.5 sm:py-5 md:py-6 bg-primary rounded-[14px] sm:rounded-[24px] text-black font-black uppercase tracking-[0.15em] text-[11px] sm:text-sm flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-primary/20 disabled:opacity-50 disabled:hover:scale-100 group"
      >
        Continue to fill your personal details
        <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
      </button>
    </form>
  );
}
