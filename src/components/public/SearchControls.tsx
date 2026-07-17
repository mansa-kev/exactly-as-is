import React, { useState } from 'react';
import { Search, Calendar, MapPin } from 'lucide-react';

interface SearchParams {
  location: string;
  pickupDate: string;
  dropoffDate: string;
}

export function SearchControls({ onSearch, initialParams }: { onSearch: (params: SearchParams) => void; initialParams?: SearchParams }) {
  const [location, setLocation] = useState(initialParams?.location || '');
  const [pickupDate, setPickupDate] = useState(initialParams?.pickupDate || '');
  const [dropoffDate, setDropoffDate] = useState(initialParams?.dropoffDate || '');

  const handleSearch = () => {
    onSearch({ location, pickupDate, dropoffDate });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  return (
    <div className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border py-3 md:py-4 px-4 md:px-6">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row gap-3 md:gap-4 items-stretch md:items-center">
        <div className="flex-1 flex items-center gap-2 px-4 py-2.5 md:py-3 bg-card border border-border rounded-2xl">
          <MapPin className="text-primary shrink-0" size={18} />
          <input
            type="text"
            placeholder="Pickup location..."
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            onKeyDown={handleKeyDown}
            className="bg-transparent w-full focus:outline-none text-sm text-foreground placeholder:text-foreground/30"
          />
        </div>
        <div className="flex gap-3 md:flex-1">
          <div className="flex-1 flex items-center gap-2 px-4 py-2.5 md:py-3 bg-card border border-border rounded-2xl">
            <Calendar className="text-primary shrink-0" size={18} />
            <input
              type="date"
              value={pickupDate}
              onChange={(e) => setPickupDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="bg-transparent w-full focus:outline-none text-sm text-foreground"
            />
          </div>
          <div className="flex-1 flex items-center gap-2 px-4 py-2.5 md:py-3 bg-card border border-border rounded-2xl">
            <Calendar className="text-primary shrink-0" size={18} />
            <input
              type="date"
              value={dropoffDate}
              onChange={(e) => setDropoffDate(e.target.value)}
              min={pickupDate || new Date().toISOString().split('T')[0]}
              className="bg-transparent w-full focus:outline-none text-sm text-foreground"
            />
          </div>
        </div>
        <button
          onClick={handleSearch}
          className="w-full md:w-auto px-6 md:px-8 py-2.5 md:py-3 bg-primary text-primary-foreground font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-primary/90 transition-all"
        >
          Search
        </button>
      </div>
    </div>
  );
}
