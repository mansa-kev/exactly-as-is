import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';
import {
  Search,
  Star,
  Fuel,
  Settings,
  Users,
  ArrowRight,
  Loader2,
  Calendar,
  MapPin,
  X,
  ChevronDown,
  CheckCircle2,
} from 'lucide-react';
import { fleetService } from '../../services/fleetService';
import { bookingService } from '../../services/bookingService';
import { VehicleModel, Car } from '../../types';
import { VehicleModelGroup } from '../../utils/vehicleModelGrouping';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';
import { promotionService, Promotion } from '../../services/promotionService';
import { BookingFlow } from '../public/BookingFlow/BookingFlow';

type BookingStep = 'browse' | 'details' | 'dates' | 'confirm';

export function BrowseAndBook() {
  const { user, profile } = useAuth();
  const [modelGroups, setModelGroups] = useState<VehicleModelGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [transmissionFilter, setTransmissionFilter] = useState('');
  const [seatsFilter, setSeatsFilter] = useState<number | ''>('');
  const [maxPrice, setMaxPrice] = useState<number | ''>('');
  const [sortBy, setSortBy] = useState<'recommended' | 'price_asc' | 'price_desc'>('recommended');

  // Booking state
  const [selectedModel, setSelectedModel] = useState<VehicleModel | null>(null);
  const [bookingStep, setBookingStep] = useState<BookingStep>('browse');
  const [pickupDate, setPickupDate] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [pickupLocation, setPickupLocation] = useState('');
  const [bookingLoading, setBookingLoading] = useState(false);
  const [activePromo, setActivePromo] = useState<Promotion | null>(null);

  useEffect(() => {
    fetchModels();
  }, []);

  const fetchModels = async () => {
    setLoading(true);
    try {
      const result = await fleetService.getGroupedPublicVehicleModels();
      setModelGroups(Array.isArray(result) ? result : []);
    } catch (error) {
      console.error('Error fetching models:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredGroups = modelGroups
    .filter((group) => {
      const model = group.representative;
      const q = searchQuery.toLowerCase();
      const matchesSearch = !q || group.displayName.toLowerCase().includes(q);
      const matchesCategory = !categoryFilter || (group.category || '').toLowerCase() === categoryFilter;
      const matchesTrans = !transmissionFilter || (model.transmission || '').toLowerCase() === transmissionFilter;
      const matchesSeats = !seatsFilter || (Number(model.seats || 0) >= Number(seatsFilter));
      const matchesPrice = !maxPrice || (Number(group.base_daily_rate || 0) <= Number(maxPrice));
      return matchesSearch && matchesCategory && matchesTrans && matchesSeats && matchesPrice;
    })
    .sort((a, b) => {
      if (sortBy === 'price_asc') return Number(a.base_daily_rate || 0) - Number(b.base_daily_rate || 0);
      if (sortBy === 'price_desc') return Number(b.base_daily_rate || 0) - Number(a.base_daily_rate || 0);
      return 0;
    });

  const categories = [...new Set(modelGroups.map((group) => group.category).filter(Boolean))] as string[];
  const transmissions = [...new Set(modelGroups.map((group) => group.representative.transmission?.toLowerCase()).filter(Boolean))] as string[];
  const activeFilterCount = [categoryFilter, transmissionFilter, seatsFilter, maxPrice].filter(v => v !== '' && v !== 0).length;
  const resetFilters = () => {
    setCategoryFilter(''); setTransmissionFilter(''); setSeatsFilter(''); setMaxPrice('');
  };

  const totalDays = (() => {
    if (!pickupDate || !returnDate) return 0;
    const diff = new Date(returnDate).getTime() - new Date(pickupDate).getTime();
    return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  })();

  const originalAmount = selectedModel ? Number(selectedModel.base_daily_rate || 0) * totalDays : 0;
  const discountedAmount = selectedModel && activePromo
    ? totalDays * promotionService.applyDiscount(Number(selectedModel.base_daily_rate || 0), activePromo).discounted
    : originalAmount;
  const totalAmount = discountedAmount;
  const discountSavings = originalAmount - discountedAmount;

  const handleSelectModel = async (group: VehicleModelGroup) => {
    const model = group.representative;
    setSelectedModel(model);
    setBookingStep('dates');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    const promo = await promotionService.getForCategory(model.category || '');
    setActivePromo(promo);
  };

  const handleConfirmBooking = async () => {
    if (!selectedModel || !user || !pickupDate || !returnDate) return;
    setBookingLoading(true);

    try {
      const booking = await bookingService.createBooking({
        vehicleModelId: selectedModel.id,
        startDate: pickupDate,
        endDate: returnDate,
        totalAmount,
        paymentMethod: 'ncba_stk',
        pickupLocation,
        dropoffLocation: pickupLocation,
        needsChauffeur: false,
        clientId: user.id,
      });

      toast.success('Booking created! Proceed to payment.');
      setBookingStep('browse');
      setSelectedModel(null);
    } catch (error: any) {
      toast.error(error.message || 'Failed to create booking');
    } finally {
      setBookingLoading(false);
    }
  };

  const handleBack = () => {
    if (bookingStep === 'dates') {
      setBookingStep('browse');
      setSelectedModel(null);
    } else if (bookingStep === 'confirm') {
      setBookingStep('dates');
    }
  };

  // ─── Booking Flow (dates + confirm) ────────────────────────────────────────
  if (bookingStep !== 'browse' && selectedModel) {
    const carLike: Car = {
      id: selectedModel.id,
      vehicle_model_id: selectedModel.id,
      make: selectedModel.make,
      model: selectedModel.model,
      year: selectedModel.year || new Date().getFullYear(),
      color: 'N/A',
      license_plate: 'MODEL',
      category: selectedModel.category || 'N/A',
      description: selectedModel.description || '',
      primary_image_url: selectedModel.primary_image_url || '',
      photos: (selectedModel.gallery_urls || []) as any,
      video_url: selectedModel.video_url || '',
      transmission: selectedModel.transmission || '',
      fuel_type: selectedModel.fuel_type || '',
      seats: selectedModel.seats || 0,
      luggage: selectedModel.luggage || 0,
      features: (selectedModel.features || []) as any,
      daily_rate: Number(selectedModel.base_daily_rate || 0),
      overtime_rate: Number(selectedModel.overtime_rate || 0),
      security_deposit: Number(selectedModel.security_deposit || 0),
      status: 'available',
      maintenance_status: 'ok',
      created_at: selectedModel.created_at || new Date().toISOString(),
      vehicle_model: selectedModel,
    } as any;

    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <button 
          onClick={() => { setBookingStep('browse'); setSelectedModel(null); }} 
          className="text-sm font-bold text-muted-foreground hover:text-foreground flex items-center gap-2 mb-2"
        >
          <ArrowRight size={16} className="rotate-180" /> Back to Catalog
        </button>
        <BookingFlow car={carLike} vehicleModelId={selectedModel.id} uploadContextId={`client-model:${selectedModel.id}`} />
      </div>
    );
  }

  // ─── Browse Cars Grid ──────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Browse Models</h1>
          <p className="text-sm text-muted-foreground">{filteredGroups.length} models available</p>
        </div>
      </div>

      {/* Search + Filters */}
      <div className="space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by make or model..."
              className="w-full pl-10 pr-4 py-3 bg-card border border-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-4 py-3 bg-card border border-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20 appearance-none min-w-[160px]"
          >
            <option value="recommended">Recommended</option>
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 bg-card border border-border rounded-lg text-xs font-medium outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="">All Categories</option>
            {categories.map(c => (
              <option key={c} value={c!.toLowerCase()}>{c}</option>
            ))}
          </select>
          <select
            value={transmissionFilter}
            onChange={(e) => setTransmissionFilter(e.target.value)}
            className="px-3 py-2 bg-card border border-border rounded-lg text-xs font-medium outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="">Any Transmission</option>
            {transmissions.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <select
            value={seatsFilter}
            onChange={(e) => setSeatsFilter(e.target.value ? Number(e.target.value) : '')}
            className="px-3 py-2 bg-card border border-border rounded-lg text-xs font-medium outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="">Any Seats</option>
            <option value="2">2+ seats</option>
            <option value="4">4+ seats</option>
            <option value="5">5+ seats</option>
            <option value="7">7+ seats</option>
          </select>
          <input
            type="number"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value ? Number(e.target.value) : '')}
            placeholder="Max KES/day"
            className="px-3 py-2 bg-card border border-border rounded-lg text-xs font-medium outline-none focus:ring-2 focus:ring-primary/20 w-32"
          />
          {activeFilterCount > 0 && (
            <button
              onClick={resetFilters}
              className="flex items-center gap-1 px-3 py-2 text-xs font-bold text-muted-foreground hover:text-foreground"
            >
              <X size={12} /> Clear ({activeFilterCount})
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-primary" size={32} />
        </div>
      ) : filteredGroups.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-lg font-bold text-muted-foreground mb-2">No vehicles match your filters</p>
          <p className="text-sm text-muted-foreground">Try adjusting your search or check back later</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredGroups.map((group) => {
            const model = group.representative;
            return (
            <motion.div
              key={group.groupKey}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-card rounded-2xl border border-border overflow-hidden group hover:border-primary/20 transition-colors"
            >
              <div className="relative aspect-[16/10] bg-muted overflow-hidden">
                <img
                  src={group.primary_image_url || model.gallery_urls?.[0] || `https://picsum.photos/seed/${group.representativeId}/400/250`}
                  alt={group.displayName}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-150"
                  referrerPolicy="no-referrer"
                  onError={(e) => { e.currentTarget.src = `https://picsum.photos/seed/m-${group.representativeId}/400/250`; }}
                />
                {group.category && (
                  <span className="absolute top-3 right-3 px-2.5 py-1 bg-black/50 backdrop-blur-sm rounded-full text-[10px] font-bold text-white uppercase tracking-wider">
                    {group.category}
                  </span>
                )}
              </div>

              <div className="p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-sm">{group.displayName}</h3>
                    <p className="text-xs text-muted-foreground">
                      {group.variantYears.length > 0 ? group.variantYears.join(', ') : ''}
                      {group.unitCount > 0 ? ` · ${group.unitCount} units` : ''}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-primary">KES {Number(group.base_daily_rate || 0).toLocaleString()}</p>
                    <p className="text-[10px] text-muted-foreground">/day</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  {model.transmission && <span className="flex items-center gap-1"><Settings size={10} />{model.transmission}</span>}
                  {model.fuel_type && <span className="flex items-center gap-1"><Fuel size={10} />{model.fuel_type}</span>}
                  {Number(model.seats || 0) > 0 && <span className="flex items-center gap-1"><Users size={10} />{model.seats}</span>}
                </div>

                <button
                  onClick={() => handleSelectModel(group)}
                  className="w-full py-3 bg-primary text-white rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  Book Now <ArrowRight size={14} />
                </button>
              </div>
            </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
