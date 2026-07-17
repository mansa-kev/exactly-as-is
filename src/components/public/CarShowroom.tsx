// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Users,
  Fuel,
  Settings,
  ArrowRight,
  Star,
} from 'lucide-react';
import { useInView } from 'react-intersection-observer';
import { fleetService } from '../../services/fleetService';
import { VehicleModelGroup } from '../../utils/vehicleModelGrouping';
import { resolveModelCardImageUrl, rememberFailedModelImage } from '../../utils/catalogImageCache';
import { SearchControls } from './SearchControls';
import { FilterPanel } from './FilterPanel';
import { PromoBadge } from './PromoBadge';
import { CarStatusBadges } from './CarStatusBadges';
import { analyticsService } from '../../services/analyticsService';
import { generateVehicleSlug } from '../../utils/urlUtils';

interface Filters {
  category: string;
  priceMin: number;
  priceMax: number;
  transmission: string;
  fuelType: string;
  minSeats: number;
  sortBy: string;
}

interface CarShowroomProps {
  isHome?: boolean;
  showSearchControls?: boolean;
}

export function CarShowroom({ isHome = false, showSearchControls = true }: CarShowroomProps) {
  const [searchParamsURL] = useSearchParams();
  const [modelGroups, setModelGroups] = useState<VehicleModelGroup[]>([]);
  const [filteredGroups, setFilteredGroups] = useState<VehicleModelGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const { ref, inView } = useInView();

  const [searchParams, setSearchParams] = useState({
    location: searchParamsURL.get('location') || '',
    pickupDate: searchParamsURL.get('pickup') || '',
    dropoffDate: searchParamsURL.get('return') || ''
  });

  const [filters, setFilters] = useState<Filters>({
    category: searchParamsURL.get('category') || '',
    priceMin: 0,
    priceMax: 50000,
    transmission: '',
    fuelType: '',
    minSeats: 0,
    sortBy: 'recommended',
  });

  useEffect(() => {
    async function fetchVehicleModels() {
      setLoading(true);
      try {
        let result: VehicleModelGroup[];
        if (searchParams.pickupDate && searchParams.dropoffDate) {
          result = await fleetService.getAvailableGroupedVehicleModels(
            searchParams.pickupDate,
            searchParams.dropoffDate
          );
        } else {
          result = await fleetService.getGroupedPublicVehicleModels();
        }

        setModelGroups(Array.isArray(result) ? result : []);
      } catch (error) {
        console.error('Error fetching vehicle models:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchVehicleModels();
  }, [searchParams]);

  // Apply filters whenever models or filters change
  useEffect(() => {
    let result = [...modelGroups];
    const modelFromGroup = (group: VehicleModelGroup) => group.representative;

    if (filters.category) {
      result = result.filter((group) => (group.category || '').toLowerCase() === filters.category);
    }

    if (filters.priceMin > 0) {
      result = result.filter((group) => Number(group.base_daily_rate || 0) >= filters.priceMin);
    }
    if (filters.priceMax < 50000) {
      result = result.filter((group) => Number(group.base_daily_rate || 0) <= filters.priceMax);
    }

    if (filters.transmission) {
      result = result.filter(
        (group) => (modelFromGroup(group).transmission || '').toLowerCase() === filters.transmission
      );
    }

    if (filters.fuelType) {
      result = result.filter(
        (group) => (modelFromGroup(group).fuel_type || '').toLowerCase() === filters.fuelType
      );
    }

    if (filters.minSeats > 0) {
      result = result.filter((group) => Number(modelFromGroup(group).seats || 0) >= filters.minSeats);
    }

    switch (filters.sortBy) {
      case 'price_asc':
        result.sort((a, b) => Number(a.base_daily_rate || 0) - Number(b.base_daily_rate || 0));
        break;
      case 'price_desc':
        result.sort((a, b) => Number(b.base_daily_rate || 0) - Number(a.base_daily_rate || 0));
        break;
      case 'newest':
        result.sort(
          (a, b) =>
            new Date(b.representative.created_at || 0).getTime() -
            new Date(a.representative.created_at || 0).getTime()
        );
        break;
      case 'name_asc':
        result.sort((a, b) => group.displayName.localeCompare(b.displayName));
        break;
    }

    setFilteredGroups(result);
  }, [modelGroups, filters]);

  return (
    <div className="min-h-screen bg-background">
      <PromoBadge />
      {showSearchControls && (
        <SearchControls onSearch={setSearchParams} initialParams={searchParams} />
      )}

      <section className="py-8 md:py-20 px-4 md:px-6 relative overflow-hidden">
        <div className="flex flex-col md:flex-row gap-6">
          {/* FilterPanel — handles its own responsive display internally */}
          <FilterPanel onFilterChange={setFilters} />

          {/* Main Content Area */}
          <div className="flex-1 min-w-0">
            {/* Results count */}
            {!loading && (
              <div className="mb-4 md:mb-6 flex items-center justify-between">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  {filteredGroups.length} {filteredGroups.length === 1 ? 'model' : 'models'} found
                </p>
              </div>
            )}

            {loading ? (
              <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 lg:gap-5">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                  <div key={i} className="bg-card rounded-2xl overflow-hidden shadow-md animate-pulse">
                    <div className="h-44 md:h-48 bg-muted" />
                    <div className="p-3 md:p-4">
                      <div className="h-4 bg-muted rounded mb-2" />
                      <div className="h-3 bg-muted rounded w-3/4" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredGroups.length === 0 ? (
              <div className="text-center py-20">
                <p className="text-lg font-bold text-white/60 mb-2">No vehicles match your criteria</p>
                <p className="text-sm text-muted-foreground">Try adjusting your filters or search terms</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 lg:gap-5">
                <AnimatePresence mode="popLayout">
                  {(isHome ? filteredGroups.slice(0, 20) : filteredGroups).map((group, i) => {
                    const model = group.representative;
                    return (
                    <motion.div
                      key={group.groupKey}
                      layout
                      initial={{ opacity: 0, y: 30 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ delay: i * 0.05 }}
                      className="group cursor-pointer"
                    >
                      <Link to={`/vehicles/${generateVehicleSlug(group.representative)}`}>
                        <div className="bg-card dark:bg-card rounded-2xl overflow-hidden shadow-md group cursor-pointer">
                          {/* Card Image Container */}
                          <div className="relative h-44 md:h-48 overflow-hidden">
                            <img
                              src={resolveModelCardImageUrl(
                                model.id,
                                model.primary_image_url,
                                Array.isArray(model.gallery_urls) ? model.gallery_urls : []
                              )}
                              alt={`${model.make} ${model.model}`}
                              className="w-full h-44 md:h-48 object-cover group-hover:scale-110 transition-transform duration-700"
                              loading={i < 8 ? "eager" : "lazy"}
                              referrerPolicy="no-referrer"
                              onError={(e) => {
                                rememberFailedModelImage(model.id);
                                e.currentTarget.src = '/placeholder-car.svg';
                              }}
                            />
                            <CarStatusBadges status={'available'} />
                          </div>

                          {/* Card Body */}
                          <div className="p-3 md:p-4">
                            {/* Car Name - No truncation, allow 2 lines */}
                            <h3 className="font-bold text-sm md:text-base leading-tight mb-2 line-clamp-2 group-hover:text-primary transition-colors">
                              {group.displayName}
                              {group.variantYears.length > 1 && (
                                <span className="text-muted-foreground font-normal"> · {group.variantYears.join(', ')}</span>
                              )}
                            </h3>

                            <div className="font-black text-orange-500 text-base md:text-lg mb-2">
                              KES {Number(group.base_daily_rate || 0).toLocaleString()}
                              <span className="text-xs text-muted-foreground font-normal">/day</span>
                            </div>

                            {/* Specs Row */}
                            <div className="flex flex-wrap gap-1 mb-3">
                              {model.transmission && (
                                <div className="flex items-center gap-1 text-xs text-gray-400 bg-gray-800/50 px-2 py-1 rounded">
                                  <Settings size={12} className="w-3 h-3" />
                                  <span>{model.transmission}</span>
                                </div>
                              )}
                              {model.fuel_type && (
                                <div className="flex items-center gap-1 text-xs text-gray-400 bg-gray-800/50 px-2 py-1 rounded">
                                  <Fuel size={12} className="w-3 h-3" />
                                  <span>{model.fuel_type}</span>
                                </div>
                              )}
                              {Number(model.seats || 0) > 0 && (
                                <div className="flex items-center gap-1 text-xs text-gray-400 bg-gray-800/50 px-2 py-1 rounded">
                                  <Users size={12} className="w-3 h-3" />
                                  <span>{model.seats} seats</span>
                                </div>
                              )}
                            </div>

                            {/* BOOK NOW + View Details */}
                            <div className="flex items-center justify-between gap-1 md:gap-2 mt-3 pt-2 border-t border-white/10">
                              {group.booking_mode !== 'disabled' && group.booking_mode !== 'reservation_only' && (
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    window.location.href = `/vehicles/${generateVehicleSlug(group.representative)}?booking=true`;
                                  }}
                                  className="bg-orange-500 hover:bg-orange-600 text-white text-[10px] md:text-xs font-black uppercase tracking-wider px-2 md:px-3 py-1 md:py-1.5 rounded-full transition-all cursor-pointer whitespace-nowrap"
                                >
                                  BOOK NOW
                                </button>
                              )}
                              {group.booking_mode === 'reservation_only' && (
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    window.location.href = `/vehicles/${generateVehicleSlug(group.representative)}?reservation=true`;
                                  }}
                                  className="bg-white/10 hover:bg-white/15 text-white text-[10px] md:text-xs font-black uppercase tracking-wider px-2 md:px-3 py-1 md:py-1.5 rounded-full transition-all cursor-pointer whitespace-nowrap border border-white/15"
                                >
                                  RESERVE
                                </button>
                              )}
                              {group.booking_mode === 'disabled' && (
                                <span className="text-[10px] md:text-xs font-bold uppercase tracking-wider text-gray-500 px-2 md:px-3 py-1 md:py-1.5">
                                  Unavailable
                                </span>
                              )}
                              <Link 
                                to={`/vehicles/${generateVehicleSlug(group.representative)}`}
                                className="flex items-center gap-1 md:gap-2 text-[10px] md:text-xs font-bold text-gray-400 hover:text-white hover:underline underline-offset-2 whitespace-nowrap transition-colors"
                              >
                                VIEW DETAILS
                                <ArrowRight size={12} className="hidden md:block" />
                              </Link>
                            </div>
                          </div>
                        </div>
                      </Link>
                    </motion.div>
                    );
                  })}
                </AnimatePresence>
                <div ref={ref} className="h-10" />
              </div>
            )}

            {isHome && filteredGroups.length > 20 && (
              <div className="mt-12 flex justify-center">
                <Link
                  to="/cars"
                  className="bg-primary text-black px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-sm hover:scale-105 transition-transform flex items-center gap-3 shadow-xl shadow-primary/20"
                >
                  View All Cars
                  <ArrowRight size={18} />
                </Link>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}