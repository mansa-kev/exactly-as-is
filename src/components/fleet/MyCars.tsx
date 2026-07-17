// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { fleetService } from '../../services/fleetService';
import { supabase } from '../../lib/supabase';
import { Car, Plus, Wrench, AlertTriangle, Search, Filter, Map, List, Eye, Edit } from 'lucide-react';
import { AddEditCarModal } from './AddEditCarModal';
import { CarDetailModal } from './CarDetailModal';

export function MyCars() {
  const [cars, setCars] = useState<any[]>([]);
  const [filteredCars, setFilteredCars] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  
  // Modals state
  const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedCar, setSelectedCar] = useState<any>(null);
  const [selectedCarId, setSelectedCarId] = useState<string | null>(null);
  const [detailModalTab, setDetailModalTab] = useState('specs');

  // Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [makeFilter, setMakeFilter] = useState('all');

  const fetchCars = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const data = await fleetService.getMyCars(user.id);
      setCars(data || []);
      setFilteredCars(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCars();
  }, []);

  useEffect(() => {
    let result = cars;
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(c => 
        c.make.toLowerCase().includes(query) || 
        c.model.toLowerCase().includes(query) || 
        c.license_plate.toLowerCase().includes(query)
      );
    }
    
    if (statusFilter !== 'all') {
      result = result.filter(c => c.status === statusFilter);
    }
    
    if (makeFilter !== 'all') {
      result = result.filter(c => c.make === makeFilter);
    }
    
    setFilteredCars(result);
  }, [searchQuery, statusFilter, makeFilter, cars]);

  const uniqueMakes = Array.from(new Set(cars.map(c => c.make)));

  const handleSaveCar = async (carData: any) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    try {
      if (selectedCar) {
        await fleetService.updateCar(selectedCar.id, carData);
      } else {
        await fleetService.addCar({ ...carData, fleet_owner_id: user.id });
      }
      setIsAddEditModalOpen(false);
      fetchCars();
    } catch (error) {
      console.error("Error saving car:", error);
      alert("Failed to save car details.");
    }
  };

  const handleStatusChange = async (carId: string, status: string) => {
    try {
      await fleetService.updateCar(carId, { status });
      fetchCars();
      setIsDetailModalOpen(false);
    } catch (error) {
      console.error("Error updating status:", error);
      alert("Failed to update car status.");
    }
  };

  const openDetails = (id: string, tab: string = 'specs') => {
    setSelectedCarId(id);
    setDetailModalTab(tab);
    setIsDetailModalOpen(true);
  };

  const openEdit = (car: any) => {
    setSelectedCar(car);
    setIsAddEditModalOpen(true);
  };

  const openAdd = () => {
    setSelectedCar(null);
    setIsAddEditModalOpen(true);
  };

  if (loading) return <div className="p-8 animate-pulse">Loading cars...</div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-150">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">My Cars</h2>
          <p className="text-sm text-muted-foreground">Manage your fleet inventory and track status.</p>
        </div>
        <div className="flex gap-4">
          <div className="flex bg-muted rounded-xl p-1">
            <button 
              onClick={() => setViewMode('list')}
              className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors ${viewMode === 'list' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <List size={16} /> List
            </button>
            <button 
              onClick={() => setViewMode('map')}
              className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors ${viewMode === 'map' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <Map size={16} /> Map
            </button>
          </div>
          <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl font-bold text-sm hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20">
            <Plus size={16} /> Add New Car
          </button>
        </div>
      </div>

      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden flex flex-col">
        <div className="p-6 border-b border-border flex flex-col md:flex-row gap-4 bg-muted/30">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <input 
              type="text" 
              placeholder="Search by make, model, or license plate..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div className="flex gap-4">
            <div className="flex items-center gap-2">
              <Filter size={16} className="text-muted-foreground" />
              <select 
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 bg-background border border-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="all">All Statuses</option>
                <option value="available">Available</option>
                <option value="booked">Booked</option>
                <option value="maintenance">Maintenance</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <select 
                value={makeFilter}
                onChange={(e) => setMakeFilter(e.target.value)}
                className="px-3 py-2 bg-background border border-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="all">All Makes</option>
                {uniqueMakes.map(make => (
                  <option key={make} value={make}>{make}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {viewMode === 'list' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground uppercase text-[10px] font-bold tracking-widest">
                <tr>
                  <th className="px-6 py-4 text-left">Car Details</th>
                  <th className="px-6 py-4 text-left">License Plate</th>
                  <th className="px-6 py-4 text-left">Status</th>
                  <th className="px-6 py-4 text-left">Daily Rate</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCars.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                      No cars found matching your filters.
                    </td>
                  </tr>
                ) : (
                  filteredCars.map((car) => (
                    <tr key={car.id} className="border-t border-border hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-lg bg-muted border border-border overflow-hidden flex-shrink-0">
                            {car.primary_image_url ? (
                              <img src={car.primary_image_url} alt={car.make} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-muted-foreground"><Car size={20} /></div>
                            )}
                          </div>
                          <div>
                            <p className="font-bold">{car.make} {car.model}</p>
                            <p className="text-xs text-muted-foreground">{car.year} • {car.color || 'N/A'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-mono text-xs">{car.license_plate}</td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1 items-start">
                          <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                            car.status === 'available' ? 'bg-success/10 text-success' :
                            car.status === 'booked' ? 'bg-primary/10 text-primary' :
                            'bg-warning/10 text-warning'
                          }`}>
                            {car.status}
                          </span>
                          {!car.is_approved && (
                            <span className="text-[10px] text-error font-bold uppercase tracking-wider">Pending Approval</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 font-bold">Ksh {car.daily_rate?.toLocaleString()}</td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button onClick={() => openDetails(car.id)} className="p-2 hover:bg-primary/10 hover:text-primary rounded-lg transition-colors" title="View Details">
                            <Eye size={16} />
                          </button>
                          <button onClick={() => openEdit(car)} className="p-2 hover:bg-primary/10 hover:text-primary rounded-lg transition-colors" title="Edit Car">
                            <Edit size={16} />
                          </button>
                          <button onClick={() => openDetails(car.id, 'maintenance')} className="p-2 hover:bg-primary/10 hover:text-primary rounded-lg transition-colors" title="View Maintenance">
                            <Wrench size={16} />
                          </button>
                          <button onClick={() => openDetails(car.id, 'damage')} className="p-2 hover:bg-primary/10 hover:text-primary rounded-lg transition-colors" title="View Damage Reports">
                            <AlertTriangle size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-6 bg-muted/10 h-[600px] flex flex-col items-center justify-center border-t border-border relative overflow-hidden">
            {/* Mock Map Background */}
            <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, var(--foreground) 1px, transparent 0)', backgroundSize: '32px 32px' }}></div>
            
            <div className="z-10 text-center space-y-4 max-w-md">
              <div className="w-20 h-20 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-6">
                <Map size={40} />
              </div>
              <h3 className="text-xl font-bold">Live Status Tracker</h3>
              <p className="text-muted-foreground">
                GPS integration is required to view real-time vehicle locations on the map. 
                Currently displaying {filteredCars.length} active vehicles in your fleet list.
              </p>
              <div className="mt-8 grid grid-cols-2 gap-4 text-left">
                <div className="bg-card p-4 rounded-xl border border-border shadow-sm">
                  <p className="text-xs text-muted-foreground font-bold uppercase">Available</p>
                  <p className="text-2xl font-bold text-success">{filteredCars.filter(c => c.status === 'available').length}</p>
                </div>
                <div className="bg-card p-4 rounded-xl border border-border shadow-sm">
                  <p className="text-xs text-muted-foreground font-bold uppercase">On Trip</p>
                  <p className="text-2xl font-bold text-primary">{filteredCars.filter(c => c.status === 'booked').length}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <AddEditCarModal 
        isOpen={isAddEditModalOpen} 
        onClose={() => setIsAddEditModalOpen(false)} 
        onSave={handleSaveCar} 
        car={selectedCar} 
      />

      <CarDetailModal 
        isOpen={isDetailModalOpen} 
        onClose={() => setIsDetailModalOpen(false)} 
        carId={selectedCarId} 
        onEdit={(car) => { setIsDetailModalOpen(false); openEdit(car); }}
        onStatusChange={handleStatusChange}
        initialTab={detailModalTab}
      />
    </div>
  );
}