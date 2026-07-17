import React, { useState, useEffect } from 'react';
import { SlidersHorizontal, ChevronDown, ChevronUp, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Filters {
  category: string;
  priceMin: number;
  priceMax: number;
  transmission: string;
  fuelType: string;
  minSeats: number;
  sortBy: string;
}

const DEFAULT_FILTERS: Filters = {
  category: '',
  priceMin: 0,
  priceMax: 50000,
  transmission: '',
  fuelType: '',
  minSeats: 0,
  sortBy: 'recommended',
};

const CATEGORIES = ['Luxury', 'SUV', 'Sedan', 'Electric', 'Compact', 'Van', 'Convertible'];
const TRANSMISSIONS = ['Automatic', 'Manual'];
const FUEL_TYPES = ['Petrol', 'Diesel', 'Electric', 'Hybrid'];
const SORT_OPTIONS = [
  { value: 'recommended', label: 'Recommended' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'newest', label: 'Newest First' },
  { value: 'name_asc', label: 'Name: A-Z' },
];

export function FilterPanel({ onFilterChange }: { onFilterChange: (filters: Filters) => void }) {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    category: true,
    price: true,
    transmission: false,
    fuel: false,
    seats: false,
    sort: false,
  });
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  useEffect(() => {
    onFilterChange(filters);
  }, [filters]);

  const updateFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const resetFilters = () => {
    setFilters(DEFAULT_FILTERS);
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const hasActiveFilters = filters.category || filters.transmission || filters.fuelType || filters.minSeats > 0 || filters.priceMax < 50000 || filters.priceMin > 0;

  const FilterSection = ({ id, title, children }: { id: string; title: string; children: React.ReactNode }) => (
    <div className="border-b border-white/5 last:border-0">
      <button
        onClick={() => toggleSection(id)}
        className="w-full flex items-center justify-between py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
      >
        <span>{title}</span>
        {expandedSections[id] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      <AnimatePresence initial={false}>
        {expandedSections[id] && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="pb-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  const filterContent = (
    <div className="space-y-1">
      {/* Category */}
      <FilterSection id="category" title="Category">
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => updateFilter('category', filters.category === cat.toLowerCase() ? '' : cat.toLowerCase())}
              className={`px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all ${
                filters.category === cat.toLowerCase()
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-card/50 text-muted-foreground hover:bg-card/70 hover:text-foreground'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </FilterSection>

      {/* Price Range */}
      <FilterSection id="price" title="Price Range (KES/day)">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <input
              type="number"
              value={filters.priceMin || ''}
              onChange={(e) => updateFilter('priceMin', Number(e.target.value) || 0)}
              placeholder="Min"
              className="w-full px-3 py-2 bg-card/50 border border-border rounded-xl text-xs font-bold text-foreground outline-none focus:border-primary/50"
            />
            <span className="text-muted-foreground text-xs">-</span>
            <input
              type="number"
              value={filters.priceMax >= 50000 ? '' : filters.priceMax}
              onChange={(e) => updateFilter('priceMax', Number(e.target.value) || 50000)}
              placeholder="Max"
              className="w-full px-3 py-2 bg-card/50 border border-border rounded-xl text-xs font-bold text-foreground outline-none focus:border-primary/50"
            />
          </div>
          <input
            type="range"
            min={0}
            max={50000}
            step={1000}
            value={filters.priceMax}
            onChange={(e) => updateFilter('priceMax', Number(e.target.value))}
            className="w-full accent-primary"
          />
          <div className="flex justify-between text-[9px] font-bold text-white/30 uppercase tracking-wider">
            <span>KES 0</span>
            <span>KES 50,000</span>
          </div>
        </div>
      </FilterSection>

      {/* Transmission */}
      <FilterSection id="transmission" title="Transmission">
        <div className="flex gap-2">
          {TRANSMISSIONS.map(t => (
            <button
              key={t}
              onClick={() => updateFilter('transmission', filters.transmission === t.toLowerCase() ? '' : t.toLowerCase())}
              className={`flex-1 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all ${
                filters.transmission === t.toLowerCase()
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-card/50 text-muted-foreground hover:bg-card/70'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </FilterSection>

      {/* Fuel Type */}
      <FilterSection id="fuel" title="Fuel Type">
        <div className="flex flex-wrap gap-2">
          {FUEL_TYPES.map(f => (
            <button
              key={f}
              onClick={() => updateFilter('fuelType', filters.fuelType === f.toLowerCase() ? '' : f.toLowerCase())}
              className={`px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all ${
                filters.fuelType === f.toLowerCase()
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-card/50 text-muted-foreground hover:bg-card/70'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </FilterSection>

      {/* Seats */}
      <FilterSection id="seats" title="Minimum Seats">
        <div className="flex gap-2">
          {[0, 2, 4, 5, 7].map(s => (
            <button
              key={s}
              onClick={() => updateFilter('minSeats', filters.minSeats === s ? 0 : s)}
              className={`flex-1 py-2 rounded-xl text-[10px] font-bold transition-all ${
                filters.minSeats === s && s > 0
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-card/50 text-muted-foreground hover:bg-card/70'
              }`}
            >
              {s === 0 ? 'Any' : `${s}+`}
            </button>
          ))}
        </div>
      </FilterSection>

      {/* Sort By */}
      <FilterSection id="sort" title="Sort By">
        <select
          value={filters.sortBy}
          onChange={(e) => updateFilter('sortBy', e.target.value)}
          className="w-full px-3 py-2.5 bg-card/50 border border-border rounded-xl text-xs font-bold text-foreground outline-none focus:border-primary/50 appearance-none"
        >
          {SORT_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </FilterSection>

      {/* Reset */}
      {hasActiveFilters && (
        <button
          onClick={resetFilters}
          className="w-full py-2.5 mt-2 bg-white/5 rounded-xl text-[10px] font-bold uppercase tracking-wider text-white/60 hover:bg-white/10 hover:text-white transition-all flex items-center justify-center gap-2"
        >
          <X size={12} />
          Clear All Filters
        </button>
      )}
    </div>
  );

  return (
    <>
      {/* Mobile Filter Toggle */}
      <button
        onClick={() => setIsMobileOpen(true)}
        className="md:hidden flex items-center gap-2 px-4 py-2.5 bg-card border border-white/5 rounded-2xl text-xs font-bold text-white/60 mb-4"
      >
        <SlidersHorizontal size={16} className="text-primary" />
        Filters
        {hasActiveFilters && (
          <span className="w-2 h-2 rounded-full bg-primary" />
        )}
      </button>

      {/* Mobile Filter Drawer */}
      <AnimatePresence>
        {isMobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="md:hidden fixed inset-0 bg-black/60 z-40"
              onClick={() => setIsMobileOpen(false)}
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="md:hidden fixed bottom-0 left-0 right-0 max-h-[85vh] bg-card border-t border-white/10 rounded-t-[24px] z-50 flex flex-col"
            >
              <div className="flex items-center justify-between p-4 border-b border-white/5">
                <div className="flex items-center gap-2 text-primary">
                  <SlidersHorizontal size={18} />
                  <h3 className="font-serif font-black italic text-white text-lg">Filters</h3>
                </div>
                <button
                  onClick={() => setIsMobileOpen(false)}
                  className="p-2 hover:bg-white/5 rounded-lg text-white/60"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                {filterContent}
              </div>
              <div className="p-4 border-t border-white/5">
                <button
                  onClick={() => setIsMobileOpen(false)}
                  className="w-full py-3 bg-primary rounded-2xl text-black font-bold uppercase tracking-wider text-xs"
                >
                  Apply Filters
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Desktop Filter Panel */}
      <div className="hidden md:block w-64 p-6 bg-card border border-white/5 rounded-[40px] h-fit sticky top-24">
        <div className="flex items-center gap-2 mb-6 text-primary">
          <SlidersHorizontal size={20} />
          <h3 className="font-serif font-black italic text-white">Filters</h3>
        </div>
        {filterContent}
      </div>
    </>
  );
}
