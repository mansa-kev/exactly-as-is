// @ts-nocheck
import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { groupVehicleModels } from '../../utils/vehicleModelGrouping';
import { adminService } from '../../services/adminService';
import { 
  Search, 
  Filter, 
  Plus, 
  Car, 
  Building2, 
  MapPin, 
  MoreVertical, 
  Edit3, 
  Eye, 
  Trash2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Loader2,
  X,
  Save,
  Image as ImageIcon,
  Video,
  Settings,
  Calendar,
  Wrench,
  ChevronRight,
  ArrowUpDown,
  ChevronDown,
  Palette,
  Hash,
  UserCog
} from 'lucide-react';
import { toast } from 'sonner';
// --- Types ---

type CarStatus = 'available' | 'rented' | 'maintenance' | 'unavailable';
type MaintenanceStatus = 'ok' | 'due' | 'in_progress';

interface CarItem {
  id: string;
  fleet_owner: string; // Changed from fleet_owner_id to match database
  vehicle_model_id?: string | null;
  vehicle_model?: {
    id: string;
    display_name?: string | null;
    make?: string | null;
    model?: string | null;
  } | null;
  make: string;
  model: string;
  year: number;
  color: string;
  license_plate: string;
  category: string;
  description: string;
  primary_image_url: string;
  photos: string[];
  video_url: string;
  transmission: string;
  fuel_type: string;
  seats: number;
  features: string[];
  location_lat: number;
  location_lon: number;
  status: CarStatus;
  maintenance_status: MaintenanceStatus;
  last_maintenance_date: string;
  next_service_date: string;
  daily_rate: number;
  overtime_rate: number;
  security_deposit: number;
  created_at: string;
  fleet_owner_details?: { 
    full_name: string; 
    fleet_owner_settings?: Array<{ company_name?: string }>;
  };
}

// --- Components ---

const StatusBadge = ({ status }: { status: CarStatus }) => {
  const safeStatus = (status || 'unavailable') as CarStatus;
  const styles: Record<CarStatus, string> = {
    available: 'bg-success/10 text-success border-success/20',
    rented: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    maintenance: 'bg-warning/10 text-warning border-warning/20',
    unavailable: 'bg-muted text-muted-foreground border-border',
  };

  return (
    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${styles[safeStatus]}`}>
      {safeStatus}
    </span>
  );
};

const MaintenanceBadge = ({ status }: { status: MaintenanceStatus }) => {
  const safeStatus = (status || 'ok') as MaintenanceStatus;
  const styles: Record<MaintenanceStatus, string> = {
    ok: 'bg-success/10 text-success border-success/20',
    due: 'bg-warning/10 text-warning border-warning/20',
    in_progress: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  };

  return (
    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${styles[safeStatus]}`}>
      {safeStatus.replace(/_/g, ' ')}
    </span>
  );
};

export function AdminCars() {
  const [searchParams, setSearchParams] = useSearchParams();
  const vehicleModelFilter = searchParams.get('modelId') || '';
  const vehicleModelFilterIds = (searchParams.get('modelIds') || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
  const activeVehicleModelIds = vehicleModelFilterIds.length
    ? vehicleModelFilterIds
    : vehicleModelFilter
      ? [vehicleModelFilter]
      : [];
  const [cars, setCars] = useState<CarItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [fleetOwners, setFleetOwners] = useState<any[]>([]);
  const [vehicleModels, setVehicleModels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<CarStatus | 'all'>('all');
  const [makeFilter, setMakeFilter] = useState('');
  const [modelFilter, setModelFilter] = useState('');
  const [ownerFilter, setOwnerFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Modals
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedCar, setSelectedCar] = useState<CarItem | null>(null);
  const [isMaintenancePromptOpen, setIsMaintenancePromptOpen] = useState(false);
  const [carToMaintain, setCarToMaintain] = useState<string | null>(null);
  
  // Mobile expandable row state
  const [isMobile, setIsMobile] = useState(false);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  // Form State
  const [formStep, setFormStep] = useState(1);
  const [primaryImageFile, setPrimaryImageFile] = useState<File | null>(null);
  const [galleryFiles, setGalleryFiles] = useState<File[]>([]);
  const [uploadedGalleryUrls, setUploadedGalleryUrls] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [formData, setFormData] = useState<Partial<CarItem>>({
    make: '', model: '', year: new Date().getFullYear(), license_plate: '', color: '', category: 'SUV', description: '',
    daily_rate: 0, overtime_rate: 0, security_deposit: 0, status: 'available',
    primary_image_url: '', photos: [], video_url: '',
    transmission: 'Automatic', fuel_type: 'Petrol', seats: 5, features: [],
    fleet_owner: '', vehicle_model_id: '', maintenance_status: 'ok', next_service_date: ''
  });

  // Quick Edit State
  type QuickEditType = 'color' | 'plate' | 'owner' | null;
  const [quickEditState, setQuickEditState] = useState<{
    type: QuickEditType;
    car: CarItem | null;
    value: string;
  }>({ type: null, car: null, value: '' });

  const activeVehicleModelRows = useMemo(
    () => vehicleModels.filter((item) => activeVehicleModelIds.includes(item.id)),
    [vehicleModels, activeVehicleModelIds]
  );

  const familySummary = useMemo(() => {
    const available = cars.filter((car) => car.status === 'available').length;
    const maintenance = cars.filter((car) => car.status === 'maintenance').length;
    const rented = cars.filter((car) => car.status === 'rented').length;
    return { available, maintenance, rented };
  }, [cars]);

  const normalizeFleetCar = (car: any): CarItem => ({
    ...car,
    license_plate: car.license_plate || '',
    description: car.description || '',
    category: car.category || 'SUV',
    color: car.color || '',
    photos: car.photos || [],
    features: car.features || [],
    maintenance_status: car.maintenance_status || 'ok',
    daily_rate: Number(car.daily_rate || 0),
    overtime_rate: Number(car.overtime_rate || 0),
    security_deposit: Number(car.security_deposit || 0),
    fleet_owner_details:
      typeof car.fleet_owner === 'object' && car.fleet_owner
        ? car.fleet_owner
        : car.fleet_owner_details,
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [carsResult, ownersData, vehicleModelsResult] = await Promise.all([
        activeVehicleModelIds.length
          ? adminService.getCarsByVehicleModelIds(activeVehicleModelIds)
          : adminService.getCars(page, pageSize),
        adminService.getFleetOwners(),
        adminService.getVehicleModels(1, 500),
      ]);

      if (activeVehicleModelIds.length) {
        const linked = (Array.isArray(carsResult) ? carsResult : []).map(normalizeFleetCar);
        setCars(linked);
        setTotalCount(linked.length);
      } else if (carsResult && 'data' in carsResult) {
        setCars((carsResult.data || []).map(normalizeFleetCar));
        setTotalCount(carsResult.count || 0);
      }
      setFleetOwners(ownersData || []);
      setVehicleModels(vehicleModelsResult?.data || []);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [page, vehicleModelFilter, searchParams]);

  useEffect(() => {
    if (!vehicleModelFilter || !vehicleModels.length) return;
    if (searchParams.get('add') !== '1') return;

    const selectedModel = vehicleModels.find((item) => item.id === vehicleModelFilter);
    if (selectedModel) {
      setFormData((prev) => ({
        ...prev,
        vehicle_model_id: selectedModel.id,
        make: selectedModel.make || prev.make,
        model: selectedModel.model || prev.model,
        year: selectedModel.year || prev.year,
        category: selectedModel.category || prev.category,
        description: selectedModel.description || prev.description,
        primary_image_url: selectedModel.primary_image_url || prev.primary_image_url,
        transmission: selectedModel.transmission || prev.transmission,
        fuel_type: selectedModel.fuel_type || prev.fuel_type,
        seats: selectedModel.seats || prev.seats,
        daily_rate: selectedModel.base_daily_rate || prev.daily_rate,
        overtime_rate: selectedModel.overtime_rate ?? prev.overtime_rate,
        security_deposit: selectedModel.security_deposit ?? prev.security_deposit,
      }));
      setIsFormModalOpen(true);
      setFormStep(1);
    }

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('add');
    setSearchParams(nextParams, { replace: true });
  }, [vehicleModelFilter, vehicleModels, searchParams, setSearchParams]);

  // Mobile detection with resize listener
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        return !!(formData.make && formData.model && formData.year && 
                 formData.license_plate && formData.color && formData.category && 
                 formData.description);
      case 2:
        return !!(formData.daily_rate && formData.overtime_rate !== undefined && 
                 formData.security_deposit !== undefined && formData.status);
      case 3:
        return !!(primaryImageFile || formData.primary_image_url);
      case 4:
        return !!(formData.transmission && formData.fuel_type && formData.seats);
      case 5:
        return !!(formData.fleet_owner !== undefined && formData.maintenance_status);
      default:
        return false;
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUploading(true);
    const promise = (async () => {
      let finalPrimaryUrl = formData.primary_image_url;
      if (primaryImageFile) {
        finalPrimaryUrl = await adminService.uploadCarImage(primaryImageFile);
      }

      let finalGalleryUrls = [...(formData.photos || [])];
      if (galleryFiles.length > 0) {
        const uploadedUrls = await Promise.all(galleryFiles.map(f => adminService.uploadCarImage(f)));
        // Filter out the temporary blob URLs and replace with uploaded URLs
        finalGalleryUrls = finalGalleryUrls.filter(url => !uploadedGalleryUrls.includes(url));
        finalGalleryUrls = [...finalGalleryUrls, ...uploadedUrls];
      }

      const finalData = { 
        ...formData, 
        primary_image_url: finalPrimaryUrl, 
        photos: finalGalleryUrls,
        fleet_owner: formData.fleet_owner === '' ? null : formData.fleet_owner,
        vehicle_model_id: formData.vehicle_model_id || null,
      };
      delete (finalData as any).vehicle_model;

      if (selectedCar && selectedCar.id) {
        await adminService.updateCar(selectedCar.id, finalData);
      } else {
        await adminService.addCar(finalData);
      }
      setIsFormModalOpen(false);
      setSelectedCar(null);
      setPrimaryImageFile(null);
      setGalleryFiles([]);
      setUploadedGalleryUrls([]);
      fetchData();
    })();

    toast.promise(promise, {
      loading: selectedCar ? 'Updating car...' : 'Adding car...',
      success: selectedCar ? 'Car updated successfully' : 'Car added successfully',
      error: 'Failed to save car'
    });
    
    try {
      await promise;
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteCar = async (id: string) => {
    const promise = (async () => {
      await adminService.deleteCar(id);
      fetchData();
    })();

    toast.promise(promise, {
      loading: 'Deleting car...',
      success: 'Car deleted successfully',
      error: 'Failed to delete car'
    });
  };

  const openAddModal = () => {
    setSelectedCar(null);
    setFormStep(1);
    setPrimaryImageFile(null);
    setGalleryFiles([]);
    setUploadedGalleryUrls([]);
    setFormData({
      make: '', model: '', year: new Date().getFullYear(), license_plate: '', color: '', category: 'SUV', description: '',
      daily_rate: 0, overtime_rate: 0, security_deposit: 0, status: 'available',
      primary_image_url: '', photos: [], video_url: '',
      transmission: 'Automatic', fuel_type: 'Petrol', seats: 5, features: [],
      fleet_owner: '', vehicle_model_id: '', maintenance_status: 'ok', next_service_date: ''
    });
    setIsFormModalOpen(true);
  };

  const openEditModal = (car: CarItem) => {
    setSelectedCar(car);
    setFormStep(1);
    setPrimaryImageFile(null);
    setGalleryFiles([]);
    setUploadedGalleryUrls([]);
    setFormData({ ...car });
    setIsFormModalOpen(true);
  };

  const openDetailModal = (car: CarItem) => {
    setSelectedCar(car);
    setIsDetailModalOpen(true);
  };

  const handleUpdateStatus = async (id: string, status: CarStatus) => {
    if (status === 'maintenance') {
      setCarToMaintain(id);
      setIsMaintenancePromptOpen(true);
      return;
    }

    try {
      await adminService.updateCar(id, { status });
      fetchData();
      if (selectedCar && selectedCar.id === id) {
        setSelectedCar({ ...selectedCar, status });
      }
    } catch (error) {
      console.error('Failed to update status', error);
    }
  };

  const confirmMaintenance = async () => {
    if (!carToMaintain) return;
    try {
      await adminService.updateCar(carToMaintain, { status: 'maintenance' });
      fetchData();
      if (selectedCar && selectedCar.id === carToMaintain) {
        setSelectedCar({ ...selectedCar, status: 'maintenance' });
      }
      setIsMaintenancePromptOpen(false);
      setCarToMaintain(null);
      // Here you would typically open the actual maintenance log form
    } catch (error) {
      console.error('Failed to update status', error);
    }
  };

  const handleUpdateMaintenance = async (id: string, maintenance_status: MaintenanceStatus) => {
    const promise = (async () => {
      await adminService.updateCar(id, { maintenance_status });
      fetchData();
      if (selectedCar && selectedCar.id === id) {
        setSelectedCar({ ...selectedCar, maintenance_status });
      }
    })();

    toast.promise(promise, {
      loading: 'Updating maintenance status...',
      success: 'Maintenance status updated successfully',
      error: 'Failed to update maintenance status'
    });
  };

  const handleQuickSave = async () => {
    if (!quickEditState.car || !quickEditState.type) return;
    
    const updateData: Partial<CarItem> = {};
    if (quickEditState.type === 'color') updateData.color = quickEditState.value;
    if (quickEditState.type === 'plate') updateData.license_plate = quickEditState.value;
    if (quickEditState.type === 'owner') updateData.fleet_owner = quickEditState.value === '' ? null as any : quickEditState.value;

    const promise = (async () => {
      await adminService.updateCar(quickEditState.car!.id, updateData);
      fetchData();
    })();

    toast.promise(promise, {
      loading: 'Updating...',
      success: 'Updated successfully',
      error: 'Failed to update'
    });

    setQuickEditState({ type: null, car: null, value: '' });
  };

  const filteredCars = cars.filter(c => {
    const carName = `${c.make} ${c.model}`;
    const ownerName = c.fleet_owner?.full_name || 'Unknown Owner';
    
    const matchesSearch = carName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (c.license_plate || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                          ownerName.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
    const matchesMake = makeFilter === '' || c.make.toLowerCase().includes(makeFilter.toLowerCase());
    const matchesModel = modelFilter === '' || c.model.toLowerCase().includes(modelFilter.toLowerCase());
    const matchesOwner = ownerFilter === '' || ownerName.toLowerCase().includes(ownerFilter.toLowerCase());
    const matchesLocation = locationFilter === '' || (c.location_lat ? 'Tracked' : 'N/A').toLowerCase().includes(locationFilter.toLowerCase());

    return matchesSearch && matchesStatus && matchesMake && matchesModel && matchesOwner && matchesLocation;
  });

  if (loading && cars.length === 0) {
    return (
      <div className="h-full w-full flex items-center justify-center p-20">
        <Loader2 className="animate-spin text-primary" size={48} />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {activeVehicleModelIds.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-primary/10 border border-primary/20 rounded-2xl">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-primary">Fleet units for public model</p>
            <p className="text-sm font-semibold text-foreground mt-1">
              {vehicleModels.find((item) => item.id === vehicleModelFilter)?.family_name ||
                vehicleModels.find((item) => item.id === vehicleModelFilter)?.display_name ||
                vehicleModels.find((item) => item.id === vehicleModelFilter)?.model ||
                vehicleModelFilter}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {activeVehicleModelRows.length} linked model row{activeVehicleModelRows.length === 1 ? '' : 's'} ·
              {' '}{familySummary.available} available · {familySummary.maintenance} maintenance · {familySummary.rented} rented
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              const next = new URLSearchParams(searchParams);
              next.delete('modelId');
              next.delete('modelIds');
              setSearchParams(next, { replace: true });
            }}
            className="px-4 py-2 rounded-xl text-xs font-bold border border-primary/30 hover:bg-primary/10 transition-colors"
          >
            Show all fleet cars
          </button>
        </div>
      )}
      {/* Header & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <input 
              type="text" 
              placeholder="Search cars..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-3 py-1.5 md:pl-10 md:pr-4 md:py-2 bg-card border border-border rounded-lg md:rounded-xl text-xs md:text-sm w-full md:w-64 focus:ring-2 focus:ring-primary/20 transition-all outline-none"
            />
          </div>
          <button 
            onClick={() => setShowFilters(!showFilters)}
            className={`p-1.5 md:p-2 rounded-lg md:rounded-xl border transition-colors ${showFilters ? 'bg-primary/10 border-primary text-primary' : 'bg-card border-border text-muted-foreground hover:bg-muted'}`}
          >
            <Filter size={16} />
          </button>
        </div>

        <button 
          onClick={openAddModal}
          className="flex items-center gap-2 px-4 py-1.5 md:px-6 md:py-2 bg-primary text-white rounded-lg md:rounded-xl font-bold text-xs md:text-sm hover:scale-105 transition-transform shadow-lg shadow-primary/20"
        >
          <Plus size={16} /> Add New Car
        </button>
      </div>

      {/* Advanced Filters */}
      {showFilters && (
        <div className="bg-card p-4 rounded-xl border border-border shadow-sm grid grid-cols-1 md:grid-cols-5 gap-4 animate-in slide-in-from-top-2">
          <div>
            <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Status</label>
            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="all">All Statuses</option>
              <option value="available">Available</option>
              <option value="rented">Rented</option>
              <option value="maintenance">In Maintenance</option>
              <option value="unavailable">Unavailable</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Make</label>
            <input 
              type="text" 
              placeholder="Filter by make..."
              value={makeFilter}
              onChange={(e) => setMakeFilter(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Model</label>
            <input 
              type="text" 
              placeholder="Filter by model..."
              value={modelFilter}
              onChange={(e) => setModelFilter(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Fleet Owner</label>
            <input 
              type="text" 
              placeholder="Filter by owner..."
              value={ownerFilter}
              onChange={(e) => setOwnerFilter(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Location</label>
            <input 
              type="text" 
              placeholder="Filter by location..."
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
        </div>
      )}

      {/* Table View - Desktop */}
      {!isMobile && (
        <div className="bg-card rounded-xl md:rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs md:text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-3 md:px-6 py-2 md:py-4 text-[10px] md:text-xs font-bold uppercase tracking-wider text-muted-foreground">Car ID</th>
                  <th className="px-3 md:px-6 py-2 md:py-4 text-[10px] md:text-xs font-bold uppercase tracking-wider text-muted-foreground">Make & Model</th>
                  <th className="px-3 md:px-6 py-2 md:py-4 text-[10px] md:text-xs font-bold uppercase tracking-wider text-muted-foreground">License</th>
                  <th className="hidden md:table-cell px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Fleet Owner</th>
                  <th className="px-3 md:px-6 py-2 md:py-4 text-[10px] md:text-xs font-bold uppercase tracking-wider text-muted-foreground">Daily Rate</th>
                  <th className="px-3 md:px-6 py-2 md:py-4 text-[10px] md:text-xs font-bold uppercase tracking-wider text-muted-foreground">Status</th>
                  <th className="hidden md:table-cell px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Location</th>
                  <th className="px-3 md:px-6 py-2 md:py-4 text-[10px] md:text-xs font-bold uppercase tracking-wider text-muted-foreground text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredCars.map((car) => (
                  <tr key={car.id} className="hover:bg-muted/30 transition-colors group">
                    <td className="px-3 md:px-6 py-2 md:py-4">
                      <span className="text-xs md:text-sm font-bold text-foreground truncate block w-16 md:w-20" title={car.id}>
                        {car.id.split('-')[0]}...
                      </span>
                    </td>
                    <td className="px-3 md:px-6 py-2 md:py-4">
                      <div className="flex items-center gap-2 md:gap-3">
                        <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-muted overflow-hidden flex-shrink-0">
                          <img 
                            src={car.primary_image_url || car.photos?.[0] || `https://picsum.photos/seed/${car.id}/100/100`} 
                            alt={car.make}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                        <div>
                          <p className="text-xs md:text-sm font-bold text-foreground truncate max-w-[120px] md:max-w-none">{car.make} {car.model}</p>
                          <p className="text-[8px] md:text-xs text-muted-foreground">{car.year} {car.color}</p>
                          {car.vehicle_model && (
                            <p className="text-[8px] md:text-xs text-primary truncate max-w-[120px] md:max-w-none">
                              Public model: {car.vehicle_model.display_name || `${car.vehicle_model.make} ${car.vehicle_model.model}`}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 md:px-6 py-2 md:py-4">
                      <span className="text-xs md:text-sm font-mono bg-muted px-1.5 md:px-2 py-0.5 md:py-1 rounded-md">{car.license_plate}</span>
                    </td>
                    <td className="hidden md:table-cell px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Building2 size={14} className="text-muted-foreground" />
                        <span className="text-sm text-foreground">{car.fleet_owner?.full_name || 'Platform Owned'}</span>
                      </div>
                    </td>
                    <td className="px-3 md:px-6 py-2 md:py-4">
                      <span className="text-xs md:text-sm font-bold text-foreground">KES {car.daily_rate}/day</span>
                    </td>
                    <td className="px-3 md:px-6 py-2 md:py-4">
                      <div className="flex flex-col gap-1 items-start">
                        <StatusBadge status={car.status} />
                        {car.maintenance_status !== 'ok' && (
                          <MaintenanceBadge status={car.maintenance_status} />
                        )}
                      </div>
                    </td>
                    <td className="hidden md:table-cell px-6 py-4">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <MapPin size={14} />
                        <span className="text-sm">{car.location_lat ? 'Tracked' : 'N/A'}</span>
                      </div>
                    </td>
                    <td className="px-3 md:px-6 py-2 md:py-4 text-right">
                      <div className="flex items-center justify-end gap-1 md:gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => setQuickEditState({ type: 'color', car, value: car.color || '' })}
                          className="p-1.5 md:p-2 hover:bg-muted rounded-lg text-muted-foreground hover:text-primary transition-colors" 
                          title="Quick Edit Color"
                        >
                          <Palette size={14} />
                        </button>
                        <button 
                          onClick={() => setQuickEditState({ type: 'plate', car, value: car.license_plate || '' })}
                          className="p-1.5 md:p-2 hover:bg-muted rounded-lg text-muted-foreground hover:text-primary transition-colors" 
                          title="Quick Edit Plate"
                        >
                          <Hash size={14} />
                        </button>
                        <button 
                          onClick={() => setQuickEditState({ type: 'owner', car, value: car.fleet_owner?.full_name ? car.fleet_owner : '' })}
                          className="p-1.5 md:p-2 hover:bg-muted rounded-lg text-muted-foreground hover:text-primary transition-colors" 
                          title="Reassign Owner"
                        >
                          <UserCog size={14} />
                        </button>
                        <div className="w-px h-4 bg-border mx-1"></div>
                        <button 
                          onClick={() => openDetailModal(car)}
                          className="p-1.5 md:p-2 hover:bg-muted rounded-lg text-muted-foreground hover:text-primary transition-colors" 
                          title="View Details"
                        >
                          <Eye size={14} />
                        </button>
                        <button 
                          onClick={() => openEditModal(car)}
                          className="p-1.5 md:p-2 hover:bg-muted rounded-lg text-muted-foreground hover:text-primary transition-colors" 
                          title="Edit"
                        >
                          <Edit3 size={14} />
                        </button>
                        <button 
                          onClick={() => handleDeleteCar(car.id)}
                          className="p-1.5 md:p-2 hover:bg-error/10 rounded-lg text-muted-foreground hover:text-error transition-colors" 
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {filteredCars.length === 0 && (
            <div className="p-12 text-center">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <Car size={32} className="text-muted-foreground" />
              </div>
              <h3 className="text-lg font-bold mb-1">No cars found</h3>
              <p className="text-muted-foreground">Try adjusting your search or filters.</p>
            </div>
          )}

          {/* Pagination */}
          <div className="px-3 md:px-6 py-2 md:py-4 border-t border-border flex flex-col md:flex-row items-center justify-between gap-2 bg-muted/10">
            <span className="text-[10px] md:text-xs text-muted-foreground font-medium">
              Showing {cars.length} of {totalCount} entries
            </span>
            <div className="flex gap-1 md:gap-2">
              <button 
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-2 md:px-3 py-1 border border-border rounded-md text-[10px] md:text-xs font-bold disabled:opacity-50 hover:bg-muted transition-colors"
              >
                Previous
              </button>
              <div className="flex items-center gap-1">
                <span className="text-[10px] md:text-xs font-bold px-1 md:px-2">Page {page}</span>
              </div>
              <button 
                onClick={() => setPage(p => p + 1)}
                disabled={cars.length < pageSize}
                className="px-2 md:px-3 py-1 border border-border rounded-md text-[10px] md:text-xs font-bold disabled:opacity-50 hover:bg-muted transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Expandable Rows */}
      {isMobile && (
        <div className="space-y-2">
          {filteredCars.map((car) => (
            <div key={car.id}>
              {/* Summary Row */}
              <div 
                className="flex justify-between items-center px-4 py-3 bg-card border border-border rounded-xl cursor-pointer select-none hover:bg-muted/30 transition-colors"
                onClick={() => setExpandedRowId(expandedRowId === car.id ? null : car.id)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-muted overflow-hidden flex-shrink-0">
                    <img 
                      src={car.primary_image_url || car.photos?.[0] || `https://picsum.photos/seed/${car.id}/100/100`} 
                      alt={car.make}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div>
                    <p className="text-sm font-bold truncate max-w-[150px]">{car.make} {car.model}</p>
                    <p className="text-xs text-muted-foreground">{car.license_plate}</p>
                    {car.vehicle_model && (
                      <p className="text-[10px] text-primary truncate max-w-[150px]">
                        {car.vehicle_model.display_name || `${car.vehicle_model.make} ${car.vehicle_model.model}`}
                      </p>
                    )}
                  </div>
                </div>
                <ChevronDown 
                  size={16} 
                  className={`transition-transform duration-200 ${expandedRowId === car.id ? 'rotate-180' : ''}`}
                />
              </div>

              {/* Expanded Card */}
              {expandedRowId === car.id && (
                <div className="bg-card border border-border rounded-xl p-4 mb-3 max-h-[65vh] overflow-y-auto">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                    <div>
                      <span className="text-xs text-muted uppercase tracking-wide">Car ID</span>
                      <p className="text-sm text-white font-medium break-all">{car.id}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted uppercase tracking-wide">Make & Model</span>
                      <p className="text-sm text-white font-medium">{car.make} {car.model}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted uppercase tracking-wide">Public Model</span>
                      <p className="text-sm text-white font-medium">{car.vehicle_model?.display_name || (car.vehicle_model ? `${car.vehicle_model.make} ${car.vehicle_model.model}` : 'Not linked')}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted uppercase tracking-wide">Year</span>
                      <p className="text-sm text-white font-medium">{car.year}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted uppercase tracking-wide">Color</span>
                      <p className="text-sm text-white font-medium">{car.color}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted uppercase tracking-wide">License Plate</span>
                      <p className="text-sm text-white font-medium">{car.license_plate}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted uppercase tracking-wide">Daily Rate</span>
                      <p className="text-sm text-white font-medium">KES {car.daily_rate}/day</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted uppercase tracking-wide">Fleet Owner</span>
                      <p className="text-sm text-white font-medium">{car.fleet_owner?.full_name || 'Platform Owned'}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted uppercase tracking-wide">Status</span>
                      <div className="mt-1">
                        <StatusBadge status={car.status} />
                        {car.maintenance_status !== 'ok' && (
                          <div className="mt-1">
                            <MaintenanceBadge status={car.maintenance_status} />
                          </div>
                        )}
                      </div>
                    </div>
                    <div>
                      <span className="text-xs text-muted uppercase tracking-wide">Location</span>
                      <p className="text-sm text-white font-medium">{car.location_lat ? 'Tracked' : 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted uppercase tracking-wide">Category</span>
                      <p className="text-sm text-white font-medium">{car.category}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted uppercase tracking-wide">Transmission</span>
                      <p className="text-sm text-white font-medium">{car.transmission}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted uppercase tracking-wide">Fuel Type</span>
                      <p className="text-sm text-white font-medium">{car.fuel_type}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted uppercase tracking-wide">Seats</span>
                      <p className="text-sm text-white font-medium">{car.seats}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted uppercase tracking-wide">Security Deposit</span>
                      <p className="text-sm text-white font-medium">KES {car.security_deposit}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted uppercase tracking-wide">Overtime Rate</span>
                      <p className="text-sm text-white font-medium">KES {car.overtime_rate}/hr</p>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-border">
                    <button 
                      onClick={() => setQuickEditState({ type: 'color', car, value: car.color || '' })}
                      className="px-3 py-1.5 bg-muted text-muted-foreground rounded-lg text-xs font-bold hover:bg-muted/80 transition-colors flex items-center gap-2"
                    >
                      <Palette size={12} /> Color
                    </button>
                    <button 
                      onClick={() => setQuickEditState({ type: 'plate', car, value: car.license_plate || '' })}
                      className="px-3 py-1.5 bg-muted text-muted-foreground rounded-lg text-xs font-bold hover:bg-muted/80 transition-colors flex items-center gap-2"
                    >
                      <Hash size={12} /> Plate
                    </button>
                    <button 
                      onClick={() => setQuickEditState({ type: 'owner', car, value: car.fleet_owner?.full_name ? car.fleet_owner : '' })}
                      className="px-3 py-1.5 bg-muted text-muted-foreground rounded-lg text-xs font-bold hover:bg-muted/80 transition-colors flex items-center gap-2"
                    >
                      <UserCog size={12} /> Owner
                    </button>
                    <button 
                      onClick={() => openDetailModal(car)}
                      className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-bold hover:bg-primary/90 transition-colors flex items-center gap-2"
                    >
                      <Eye size={12} /> Details
                    </button>
                    <button 
                      onClick={() => openEditModal(car)}
                      className="px-3 py-1.5 bg-muted text-muted-foreground rounded-lg text-xs font-bold hover:bg-muted/80 transition-colors flex items-center gap-2"
                    >
                      <Edit3 size={12} /> Edit
                    </button>
                    <button 
                      onClick={() => handleDeleteCar(car.id)}
                      className="px-3 py-1.5 bg-error text-white rounded-lg text-xs font-bold hover:bg-error/90 transition-colors flex items-center gap-2"
                    >
                      <Trash2 size={12} /> Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
          
          {filteredCars.length === 0 && (
            <div className="p-12 text-center bg-card border border-border rounded-xl">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <Car size={32} className="text-muted-foreground" />
              </div>
              <h3 className="text-lg font-bold mb-1">No cars found</h3>
              <p className="text-muted-foreground">Try adjusting your search or filters.</p>
            </div>
          )}

          {/* Mobile Pagination */}
          <div className="px-4 py-3 bg-card border border-border rounded-xl flex flex-col items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground font-medium">
              Showing {cars.length} of {totalCount} entries
            </span>
            <div className="flex gap-2">
              <button 
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 border border-border rounded-md text-xs font-bold disabled:opacity-50 hover:bg-muted transition-colors"
              >
                Previous
              </button>
              <div className="flex items-center gap-1">
                <span className="text-xs font-bold px-2">Page {page}</span>
              </div>
              <button 
                onClick={() => setPage(p => p + 1)}
                disabled={cars.length < pageSize}
                className="px-3 py-1 border border-border rounded-md text-xs font-bold disabled:opacity-50 hover:bg-muted transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Car Detail Modal */}
      {isDetailModalOpen && selectedCar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-6 border-b border-border">
              <div>
                <h2 className="text-2xl font-bold">{selectedCar.make} {selectedCar.model} <span className="text-muted-foreground font-normal text-lg">({selectedCar.year})</span></h2>
                <div className="flex items-center gap-3 mt-2">
                  <span className="font-mono text-xs bg-muted px-2 py-1 rounded-md">{selectedCar.license_plate}</span>
                  <StatusBadge status={selectedCar.status} />
                  {selectedCar.maintenance_status !== 'ok' && <MaintenanceBadge status={selectedCar.maintenance_status} />}
                </div>
              </div>
              <button 
                onClick={() => setIsDetailModalOpen(false)}
                className="p-2 hover:bg-muted rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Images & Specs */}
                <div className="lg:col-span-2 space-y-8">
                  {/* Hero Image */}
                  <div className="rounded-2xl overflow-hidden bg-muted aspect-video relative">
                    <img 
                      src={selectedCar.primary_image_url || selectedCar.photos?.[0] || `https://picsum.photos/seed/${selectedCar.id}/800/450`} 
                      alt="Car" 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  
                  {/* Vehicle Specifications */}
                  <section>
                    <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
                      <Settings size={16} /> Vehicle Specifications
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-muted/30 p-4 rounded-xl">
                        <p className="text-xs text-muted-foreground mb-1">Category</p>
                        <p className="font-bold">{selectedCar.category}</p>
                      </div>
                      <div className="bg-muted/30 p-4 rounded-xl">
                        <p className="text-xs text-muted-foreground mb-1">Transmission</p>
                        <p className="font-bold">{selectedCar.transmission}</p>
                      </div>
                      <div className="bg-muted/30 p-4 rounded-xl">
                        <p className="text-xs text-muted-foreground mb-1">Fuel Type</p>
                        <p className="font-bold">{selectedCar.fuel_type}</p>
                      </div>
                      <div className="bg-muted/30 p-4 rounded-xl">
                        <p className="text-xs text-muted-foreground mb-1">Seats</p>
                        <p className="font-bold">{selectedCar.seats}</p>
                      </div>
                      <div className="bg-muted/30 p-4 rounded-xl">
                        <p className="text-xs text-muted-foreground mb-1">Color</p>
                        <p className="font-bold">{selectedCar.color}</p>
                      </div>
                    </div>
                    
                    {selectedCar.features && selectedCar.features.length > 0 && (
                      <div className="mt-4">
                        <p className="text-xs text-muted-foreground mb-2">Features</p>
                        <div className="flex flex-wrap gap-2">
                          {selectedCar.features.map((f, i) => (
                            <span key={i} className="px-3 py-1 bg-primary/10 text-primary text-xs font-bold rounded-full">{f}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    <div className="mt-4">
                      <p className="text-xs text-muted-foreground mb-2">Description</p>
                      <p className="text-sm leading-relaxed">{selectedCar.description || 'No description provided.'}</p>
                    </div>
                  </section>
                </div>

                {/* Right Column: Pricing, Owner, Maintenance */}
                <div className="space-y-8">
                  {/* Pricing */}
                  <section>
                    <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
                      <Car size={16} /> Pricing
                    </h3>
                    <div className="bg-muted/30 p-4 rounded-xl space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Daily Rate</span>
                        <span className="text-xl font-bold text-primary">KES {selectedCar.daily_rate}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Overtime Rate (per hour)</span>
                        <span className="text-sm font-bold">KES {selectedCar.overtime_rate}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Security Deposit</span>
                        <span className="text-sm font-bold">KES {selectedCar.security_deposit}</span>
                      </div>
                    </div>
                  </section>

                  {/* Fleet Owner Details */}
                  <section>
                    <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
                      <Building2 size={16} /> Fleet Owner Details
                    </h3>
                    <div className="bg-muted/30 p-4 rounded-xl">
                      {selectedCar.fleet_owner ? (
                        <>
                          <p className="font-bold">{selectedCar.fleet_owner.full_name}</p>
                          {selectedCar.fleet_owner.fleet_owner_settings?.[0]?.company_name && (
                            <p className="text-sm text-muted-foreground">
                              {selectedCar.fleet_owner.fleet_owner_settings[0].company_name}
                            </p>
                          )}
                          <button className="w-full mt-4 py-2 text-sm font-bold text-primary hover:bg-primary/5 rounded-lg transition-colors flex items-center justify-center gap-2">
                            View Owner Profile <ChevronRight size={16} />
                          </button>
                        </>
                      ) : (
                        <p className="text-sm font-medium text-muted-foreground">Platform Owned</p>
                      )}
                    </div>
                  </section>

                  {/* Maintenance History */}
                  <section>
                    <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
                      <Wrench size={16} /> Maintenance
                    </h3>
                    <div className="bg-muted/30 p-4 rounded-xl space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Status</span>
                        <MaintenanceBadge status={selectedCar.maintenance_status} />
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Last Service</span>
                        <span className="text-sm font-medium">{selectedCar.last_maintenance_date ? new Date(selectedCar.last_maintenance_date).toLocaleDateString() : 'N/A'}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Next Service</span>
                        <span className="text-sm font-medium">{selectedCar.next_service_date ? new Date(selectedCar.next_service_date).toLocaleDateString() : 'N/A'}</span>
                      </div>
                      <button className="w-full mt-2 py-2 text-sm font-bold text-primary hover:bg-primary/5 rounded-lg transition-colors flex items-center justify-center gap-2">
                        View Maintenance Logs <ChevronRight size={16} />
                      </button>
                    </div>
                  </section>
                  
                  {/* Damage Reports Placeholder */}
                  <section>
                    <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
                      <AlertCircle size={16} /> Damage Reports
                    </h3>
                    <div className="bg-muted/30 p-4 rounded-xl flex items-center justify-center h-24 border border-border border-dashed">
                      <p className="text-sm text-muted-foreground text-center">No recent damage reports.</p>
                    </div>
                  </section>
                  
                  {/* Availability Calendar Placeholder */}
                  <section>
                    <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
                      <Calendar size={16} /> Availability
                    </h3>
                    <div className="bg-muted/30 p-4 rounded-xl flex items-center justify-center h-32 border border-border border-dashed">
                      <p className="text-sm text-muted-foreground text-center">Calendar UI Component<br/>(Integration Pending)</p>
                    </div>
                  </section>
                </div>
              </div>
            </div>
            
            <div className="p-6 border-t border-border bg-muted/10 flex flex-wrap gap-3 justify-end">
              <button 
                onClick={() => { setIsDetailModalOpen(false); openEditModal(selectedCar); }}
                className="px-4 py-2 rounded-lg font-bold border border-border bg-card hover:bg-muted transition-colors flex items-center gap-2"
              >
                <Edit3 size={16} /> Update Details
              </button>
              
              {selectedCar.status !== 'maintenance' ? (
                <button 
                  onClick={() => handleUpdateStatus(selectedCar.id, 'maintenance')}
                  className="px-4 py-2 rounded-lg font-bold border border-warning text-warning hover:bg-warning/10 transition-colors flex items-center gap-2"
                >
                  <Wrench size={16} /> Mark as In Maintenance
                </button>
              ) : (
                <button 
                  onClick={() => handleUpdateStatus(selectedCar.id, 'available')}
                  className="px-4 py-2 rounded-lg font-bold border border-success text-success hover:bg-success/10 transition-colors flex items-center gap-2"
                >
                  <CheckCircle2 size={16} /> Mark as Available
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Maintenance Prompt Modal */}
      {isMaintenancePromptOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-md p-6 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-4 text-warning mb-4">
              <div className="p-3 bg-warning/10 rounded-full">
                <Wrench size={24} />
              </div>
              <h3 className="text-xl font-bold text-foreground">Maintenance Required</h3>
            </div>
            <p className="text-muted-foreground mb-6">
              Marking this car as "In Maintenance" will make it unavailable for booking. Do you want to proceed and create a maintenance log entry?
            </p>
            <div className="flex gap-3 justify-end">
              <button 
                onClick={() => { setIsMaintenancePromptOpen(false); setCarToMaintain(null); }}
                className="px-4 py-2 rounded-lg font-bold border border-border hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={confirmMaintenance}
                className="px-4 py-2 rounded-lg font-bold bg-warning text-warning-foreground hover:bg-warning/90 transition-colors"
              >
                Proceed to Maintenance
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Car Master Form Modal */}
      {isFormModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="bg-card w-full max-w-4xl rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300 max-h-[90vh]">
            <div className="p-6 border-b border-border flex justify-between items-center bg-muted/30">
              <div>
                <h3 className="text-xl font-bold">{selectedCar ? 'Edit Car Details' : 'Add New Car'}</h3>
                <p className="text-sm text-muted-foreground mt-1">Step {formStep} of 5</p>
              </div>
              <button onClick={() => setIsFormModalOpen(false)} className="p-2 hover:bg-muted rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>
            
            {/* Progress Bar */}
            <div className="w-full bg-muted h-1">
              <div className="bg-primary h-1 transition-all duration-300" style={{ width: `${(formStep / 5) * 100}%` }}></div>
            </div>

            <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6">
              {/* Step 1: Basic Information */}
              {formStep === 1 && (
                <div className="space-y-6 animate-in slide-in-from-right-4">
                  <h4 className="font-bold text-lg border-b border-border pb-2">1. Basic Information</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Public Vehicle Model</label>
                      <select
                        value={formData.vehicle_model_id || ''}
                        onChange={(e) => {
                          const selectedVehicleModel = vehicleModels.find((item) => item.id === e.target.value);
                          setFormData({
                            ...formData,
                            vehicle_model_id: e.target.value,
                            make: selectedVehicleModel?.make || formData.make,
                            model: selectedVehicleModel?.model || formData.model,
                            year: selectedVehicleModel?.year || formData.year,
                            category: selectedVehicleModel?.category || formData.category,
                            description: selectedVehicleModel?.description || formData.description,
                            primary_image_url: selectedVehicleModel?.primary_image_url || formData.primary_image_url,
                            transmission: selectedVehicleModel?.transmission || formData.transmission,
                            fuel_type: selectedVehicleModel?.fuel_type || formData.fuel_type,
                            seats: selectedVehicleModel?.seats || formData.seats,
                            features: selectedVehicleModel?.features?.length ? selectedVehicleModel.features : formData.features,
                            daily_rate: selectedVehicleModel?.base_daily_rate || formData.daily_rate,
                            overtime_rate: selectedVehicleModel?.overtime_rate ?? formData.overtime_rate,
                            security_deposit: selectedVehicleModel?.security_deposit ?? formData.security_deposit,
                          });
                        }}
                        className="w-full px-4 py-2 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/50"
                      >
                        <option value="">No linked vehicle model</option>
                        {groupVehicleModels(vehicleModels).map((group) => (
                          <optgroup key={group.groupKey} label={group.displayName}>
                            {group.variants.map((vehicleModel) => (
                              <option key={vehicleModel.id} value={vehicleModel.id}>
                                {vehicleModel.year ? `${vehicleModel.year}` : 'Standard'}
                                {vehicleModel.base_daily_rate ? ` · KES ${Number(vehicleModel.base_daily_rate).toLocaleString()}` : ''}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                      <p className="text-xs text-muted-foreground">
                        Link this physical unit to a public listing model so bookings can target the model instead of a specific car.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Make *</label>
                      <input type="text" required value={formData.make} onChange={(e) => setFormData({ ...formData, make: e.target.value })} className="w-full px-4 py-2 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/50" placeholder="e.g., Mercedes-Benz" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Model *</label>
                      <input type="text" required value={formData.model} onChange={(e) => setFormData({ ...formData, model: e.target.value })} className="w-full px-4 py-2 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/50" placeholder="e.g., S-Class" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Year *</label>
                      <input type="number" required value={formData.year || ''} onChange={(e) => setFormData({ ...formData, year: e.target.value === '' ? undefined : parseInt(e.target.value) })} className="w-full px-4 py-2 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/50" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">License Plate *</label>
                      <input type="text" required value={formData.license_plate} onChange={(e) => setFormData({ ...formData, license_plate: e.target.value })} className="w-full px-4 py-2 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/50" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Color *</label>
                      <input type="text" required value={formData.color} onChange={(e) => setFormData({ ...formData, color: e.target.value })} className="w-full px-4 py-2 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/50" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Category *</label>
                      <select required value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} className="w-full px-4 py-2 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/50">
                        <option value="SUV">SUV</option>
                        <option value="Sedan">Sedan</option>
                        <option value="Luxury">Luxury</option>
                        <option value="Sports">Sports</option>
                        <option value="Van">Van</option>
                      </select>
                    </div>
                    <div className="col-span-1 md:col-span-2 space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Short Description *</label>
                      <textarea required rows={3} value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="w-full px-4 py-2 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/50" placeholder="A compelling marketing description..."></textarea>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Pricing & Availability */}
              {formStep === 2 && (
                <div className="space-y-6 animate-in slide-in-from-right-4">
                  <h4 className="font-bold text-lg border-b border-border pb-2">2. Pricing & Availability</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Daily Rate (KES) *</label>
                      <input type="number" required min="1" value={formData.daily_rate || ''} onChange={(e) => setFormData({ ...formData, daily_rate: e.target.value === '' ? undefined : parseFloat(e.target.value) })} className="w-full px-4 py-2 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/50" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Overtime Rate (KES/hr) *</label>
                      <input type="number" required min="0" value={formData.overtime_rate || ''} onChange={(e) => setFormData({ ...formData, overtime_rate: e.target.value === '' ? undefined : parseFloat(e.target.value) })} className="w-full px-4 py-2 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/50" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Security Deposit (KES) *</label>
                      <input type="number" required min="0" value={formData.security_deposit || ''} onChange={(e) => setFormData({ ...formData, security_deposit: e.target.value === '' ? undefined : parseFloat(e.target.value) })} className="w-full px-4 py-2 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/50" />
                    </div>
                    <div className="col-span-1 md:col-span-3 space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Current Status *</label>
                      <select required value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value as CarStatus })} className="w-full px-4 py-2 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/50">
                        <option value="available">Available</option>
                        <option value="rented">Rented</option>
                        <option value="maintenance">Maintenance</option>
                        <option value="unavailable">Unavailable</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3: Media & Cinematic Gallery */}
              {formStep === 3 && (
                <div className="space-y-6 animate-in slide-in-from-right-4">
                  <h4 className="font-bold text-lg border-b border-border pb-2">3. Media & Cinematic Gallery</h4>
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Primary Hero Image *</label>
                      <div className="flex gap-2">
                        <input 
                          type="file" 
                          accept="image/*"
                          onChange={(e) => {
                            if (e.target.files?.[0]) {
                              setPrimaryImageFile(e.target.files[0]);
                              // Create a local preview URL
                              setFormData({ ...formData, primary_image_url: URL.createObjectURL(e.target.files[0]) });
                            }
                          }} 
                          className="flex-1 px-4 py-2 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/50 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20" 
                        />
                      </div>
                      {formData.primary_image_url && (
                        <div className="mt-2 flex items-center gap-2">
                          <div className="relative w-32 h-24 rounded-lg overflow-hidden border border-border">
                            <img src={formData.primary_image_url} alt="Preview" className="w-full h-full object-cover" />
                            <button
                              type="button"
                              onClick={() => {
                                setPrimaryImageFile(null);
                                setFormData({ ...formData, primary_image_url: '' });
                                // Clear the file input
                                const fileInput = document.querySelector('input[type="file"][accept="image/*"]') as HTMLInputElement;
                                if (fileInput) fileInput.value = '';
                              }}
                              className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                            >
                              <X size={12} />
                            </button>
                          </div>
                          <span className="text-xs text-muted-foreground">Click X to remove</span>
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground">The main high-res image shown on the search grid. Click X to remove and select a different image.</p>
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Cinematic Gallery Images</label>
                      <input 
                        type="file" 
                        accept="image/*"
                        multiple
                        onChange={(e) => {
                          if (e.target.files) {
                            const filesArray = Array.from(e.target.files);
                            setGalleryFiles(filesArray);
                            const newUrls = filesArray.map(f => URL.createObjectURL(f as any));
                            setUploadedGalleryUrls(newUrls);
                            setFormData({ ...formData, photos: [...(formData.photos || []), ...newUrls] });
                          }
                        }} 
                        className="w-full px-4 py-2 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/50 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20" 
                      />
                      {formData.photos && formData.photos.length > 0 && (
                        <div className="flex gap-2 mt-2 flex-wrap">
                          {formData.photos.map((url, idx) => (
                            <div key={idx} className="relative w-20 h-20 rounded-lg overflow-hidden border border-border">
                              <img src={url} alt={`Gallery ${idx}`} className="w-full h-full object-cover" />
                              <button
                                type="button"
                                onClick={() => {
                                  // Remove from photos array
                                  const newPhotos = formData.photos?.filter((_, i) => i !== idx) || [];
                                  setFormData({ ...formData, photos: newPhotos });
                                  
                                  // Check if this is a newly uploaded file (from uploadedGalleryUrls)
                                  const urlToRemove = formData.photos?.[idx];
                                  const uploadedIndex = uploadedGalleryUrls.indexOf(urlToRemove);
                                  if (uploadedIndex !== -1) {
                                    // Remove from both galleryFiles and uploadedGalleryUrls
                                    const newGalleryFiles = galleryFiles.filter((_, i) => i !== uploadedIndex);
                                    const newUploadedUrls = uploadedGalleryUrls.filter((_, i) => i !== uploadedIndex);
                                    setGalleryFiles(newGalleryFiles);
                                    setUploadedGalleryUrls(newUploadedUrls);
                                  }
                                }}
                                className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                              >
                                <X size={10} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground">Add multiple images to showcase the car from different angles. Click X on any image to remove it.</p>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Video Walkthrough URL (Optional)</label>
                      <div className="flex gap-2">
                        <input type="url" value={formData.video_url} onChange={(e) => setFormData({ ...formData, video_url: e.target.value })} className="flex-1 px-4 py-2 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/50" placeholder="YouTube/Vimeo link" />
                        <button type="button" className="p-2 bg-muted rounded-xl border border-border hover:bg-primary/10 transition-colors"><Video size={20} /></button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 4: Luxury Features & Specifications */}
              {formStep === 4 && (
                <div className="space-y-6 animate-in slide-in-from-right-4">
                  <h4 className="font-bold text-lg border-b border-border pb-2">4. Luxury Features & Specifications</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Transmission *</label>
                      <select required value={formData.transmission} onChange={(e) => setFormData({ ...formData, transmission: e.target.value })} className="w-full px-4 py-2 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/50">
                        <option value="Automatic">Automatic</option>
                        <option value="Manual">Manual</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Fuel Type *</label>
                      <select required value={formData.fuel_type} onChange={(e) => setFormData({ ...formData, fuel_type: e.target.value })} className="w-full px-4 py-2 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/50">
                        <option value="Petrol">Petrol</option>
                        <option value="Diesel">Diesel</option>
                        <option value="Electric">Electric</option>
                        <option value="Hybrid">Hybrid</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Seats *</label>
                      <input type="number" required min="1" value={formData.seats || ''} onChange={(e) => setFormData({ ...formData, seats: e.target.value === '' ? undefined : parseInt(e.target.value) })} className="w-full px-4 py-2 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/50" />
                    </div>
                    <div className="col-span-1 md:col-span-3 space-y-4">
                      <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Luxury Features</label>
                      <div className="flex flex-wrap gap-2 mb-2">
                        {formData.features?.map((feature, idx) => (
                          <span key={idx} className="px-3 py-1 bg-primary/10 text-primary text-xs font-bold rounded-full flex items-center gap-2 group">
                            {feature}
                            <button 
                              type="button" 
                              onClick={() => setFormData({ ...formData, features: formData.features?.filter((_, i) => i !== idx) })}
                              className="hover:text-red-500 transition-colors"
                            >
                              <X size={12} />
                            </button>
                          </span>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          id="new-feature-input"
                          className="flex-1 px-4 py-2 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/50" 
                          placeholder="Add a feature (e.g. Leather Seats) and press Enter or comma"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ',') {
                              e.preventDefault();
                              const val = (e.target as HTMLInputElement).value.trim().replace(/,$/, '');
                              if (val && !formData.features?.includes(val)) {
                                setFormData({ ...formData, features: [...(formData.features || []), val] });
                                (e.target as HTMLInputElement).value = '';
                              }
                            }
                          }}
                        />
                        <button 
                          type="button"
                          onClick={() => {
                            const input = document.getElementById('new-feature-input') as HTMLInputElement;
                            const val = input.value.trim();
                            if (val && !formData.features?.includes(val)) {
                              setFormData({ ...formData, features: [...(formData.features || []), val] });
                              input.value = '';
                            }
                          }}
                          className="px-4 py-2 bg-primary/10 text-primary rounded-xl text-xs font-bold hover:bg-primary/20 transition-all"
                        >
                          Add
                        </button>
                      </div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Tip: Press Enter or use a comma to add multiple features quickly.</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 5: Fleet Ownership & Management */}
              {formStep === 5 && (
                <div className="space-y-6 animate-in slide-in-from-right-4">
                  <h4 className="font-bold text-lg border-b border-border pb-2">5. Fleet Ownership & Management</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Assign to Fleet Owner *</label>
                      <select required value={formData.fleet_owner} onChange={(e) => setFormData({ ...formData, fleet_owner: e.target.value })} className="w-full px-4 py-2 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/50">
                        <option value="">Platform Owned (No Owner)</option>
                        {fleetOwners.map(owner => {
                          const settings = owner.fleet_owner_settings?.[0] || {};
                          return (
                            <option key={owner.id} value={owner.id}>
                              {owner.full_name} ({settings.company_name || 'Individual'})
                            </option>
                          );
                        })}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Maintenance Status *</label>
                      <select required value={formData.maintenance_status} onChange={(e) => setFormData({ ...formData, maintenance_status: e.target.value as MaintenanceStatus })} className="w-full px-4 py-2 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/50">
                        <option value="ok">OK</option>
                        <option value="due">Due</option>
                        <option value="in_progress">In Progress</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Next Service Date</label>
                      <input type="date" value={formData.next_service_date} onChange={(e) => setFormData({ ...formData, next_service_date: e.target.value })} className="w-full px-4 py-2 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/50" />
                    </div>
                  </div>
                </div>
              )}
            </form>

            {/* Form Navigation */}
            <div className="p-6 border-t border-border bg-muted/10 flex justify-between items-center">
              <button 
                type="button"
                onClick={() => setFormStep(Math.max(1, formStep - 1))}
                disabled={formStep === 1}
                className="px-6 py-2 rounded-xl font-bold border border-border bg-card hover:bg-muted transition-colors disabled:opacity-50"
              >
                Back
              </button>
              
              {formStep < 5 ? (
                <button 
                  type="button"
                  onClick={() => {
                    if (validateStep(formStep)) {
                      setFormStep(Math.min(5, formStep + 1));
                    } else {
                      toast.error('Please fill in all required fields marked with * before proceeding.');
                    }
                  }}
                  className="px-6 py-2 rounded-xl font-bold bg-primary text-white hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20 flex items-center gap-2"
                >
                  Next <ChevronRight size={16} />
                </button>
              ) : (
                <button 
                  onClick={handleSave}
                  className="px-8 py-2 rounded-xl font-bold bg-success text-white hover:bg-success/90 transition-colors shadow-lg shadow-success/20 flex items-center gap-2"
                >
                  <Save size={18} /> {selectedCar ? 'Update Car' : 'Save Car'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Quick Edit Modal */}
      {quickEditState.type && quickEditState.car && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-md p-6 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold flex items-center gap-2">
                {quickEditState.type === 'color' && <><Palette size={20} className="text-primary" /> Update Color</>}
                {quickEditState.type === 'plate' && <><Hash size={20} className="text-primary" /> Update Plate</>}
                {quickEditState.type === 'owner' && <><UserCog size={20} className="text-primary" /> Reassign Owner</>}
              </h3>
              <button onClick={() => setQuickEditState({ type: null, car: null, value: '' })} className="p-1 hover:bg-muted rounded-full">
                <X size={20} />
              </button>
            </div>
            
            <div className="mb-6">
              <p className="text-sm text-muted-foreground mb-4">
                Updating {quickEditState.car.make} {quickEditState.car.model} ({quickEditState.car.license_plate})
              </p>

              {quickEditState.type === 'color' && (
                <div className="space-y-4">
                  <select 
                    value={quickEditState.value} 
                    onChange={(e) => setQuickEditState({ ...quickEditState, value: e.target.value })}
                    className="w-full px-4 py-2 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/50"
                  >
                    <option value="" disabled>Select a color</option>
                    <option value="White">White</option>
                    <option value="Black">Black</option>
                    <option value="Silver">Silver</option>
                    <option value="Grey">Grey</option>
                    <option value="Blue">Blue</option>
                    <option value="Red">Red</option>
                    <option value="Pearl">Pearl</option>
                    <option value="Metallic">Metallic</option>
                  </select>
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-border" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-card px-2 text-muted-foreground">Or type custom</span>
                    </div>
                  </div>
                  <input 
                    type="text" 
                    placeholder="Custom color..."
                    value={quickEditState.value} 
                    onChange={(e) => setQuickEditState({ ...quickEditState, value: e.target.value })}
                    className="w-full px-4 py-2 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/50"
                  />
                </div>
              )}

              {quickEditState.type === 'plate' && (
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">License Plate</label>
                  <input 
                    type="text" 
                    value={quickEditState.value} 
                    onChange={(e) => setQuickEditState({ ...quickEditState, value: e.target.value.toUpperCase() })}
                    className="w-full px-4 py-2 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/50 uppercase"
                    placeholder="e.g. KDC 123A"
                  />
                </div>
              )}

              {quickEditState.type === 'owner' && (
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Select Fleet Owner</label>
                  <select 
                    value={quickEditState.value} 
                    onChange={(e) => setQuickEditState({ ...quickEditState, value: e.target.value })}
                    className="w-full px-4 py-2 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/50"
                  >
                    <option value="">Platform Owned (Company's Fleet)</option>
                    {fleetOwners.map(owner => {
                      const settings = owner.fleet_owner_settings?.[0] || {};
                      return (
                        <option key={owner.id} value={owner.id}>
                          {owner.full_name} ({settings.company_name || 'Individual'})
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setQuickEditState({ type: null, car: null, value: '' })}
                className="px-4 py-2 rounded-lg font-bold border border-border hover:bg-muted transition-colors text-sm"
              >
                Cancel
              </button>
              <button 
                onClick={handleQuickSave}
                className="px-4 py-2 rounded-lg font-bold bg-primary text-white hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20 text-sm"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}