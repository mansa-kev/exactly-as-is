import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminService } from '../../services/adminService';
import { groupVehicleModels, VehicleModelGroup, getVehicleModelIdsForGroup, suggestVehicleModelFamily } from '../../utils/vehicleModelGrouping';
import { VehicleModel } from '../../types';
import { ModelFleetStatusPanel } from './ModelFleetStatusPanel';
import type { ModelFleetStatusSummary } from '../../utils/modelFleetStatus';
import {
  Car,
  Edit3,
  ExternalLink,
  Eye,
  EyeOff,
  Layers,
  Link2,
  Loader2,
  Plus,
  Save,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { generateVehicleSlug } from '../../utils/urlUtils';

type VehicleModelRow = VehicleModel & {
  cars?: Array<{ id: string }>;
};

type FleetUnit = {
  id: string;
  make: string;
  model: string;
  year?: number;
  color?: string;
  license_plate?: string;
  status?: string;
  daily_rate?: number;
  vehicle_model_id?: string | null;
  primary_image_url?: string;
  fleet_owner?: { full_name?: string } | null;
};

type DetailTab = 'units' | 'variants' | 'catalog';
type EditorMode = 'catalog' | 'variant';

const CATALOG_CATEGORIES = [
  'SUV',
  'Sedan',
  'Compact',
  'Hatchback',
  'Station Wagon',
  'Luxury',
  'Van',
  'Electric',
  'Convertible',
];

const EMPTY_CATALOG_FORM: Partial<VehicleModelRow> = {
  make: '',
  model: '',
  family_name: '',
  family_slug: '',
  display_name: '',
  category: 'SUV',
  description: '',
  primary_image_url: '',
  base_daily_rate: 0,
  is_public: true,
  sort_order: 0,
};

const EMPTY_ADVANCED_FORM: Partial<VehicleModelRow> = {
  ...EMPTY_CATALOG_FORM,
  year: new Date().getFullYear(),
  slug: '',
  variant_name: '',
  gallery_urls: [],
  video_url: '',
  transmission: 'Automatic',
  fuel_type: 'Petrol',
  seats: 5,
  luggage: 2,
  features: [],
  overtime_rate: 0,
  security_deposit: 0,
  is_chauffeured_only: false,
};

const ADVANCED_STEPS = [
  { id: 1, label: 'Identity' },
  { id: 2, label: 'Media' },
  { id: 3, label: 'Specs' },
  { id: 4, label: 'Pricing' },
];

const ModelFamilyCard: React.FC<{
  group: VehicleModelGroup;
  onOpen: () => void;
  onEditCatalog: () => void;
}> = ({ group, onOpen, onEditCatalog }) => {
  const image = group.primary_image_url;

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden hover:border-primary/30 transition-colors shadow-sm flex flex-col">
      <div className="p-4 border-b border-border bg-muted/10">
        <div className="flex justify-between items-start gap-3 mb-3">
          <div className="flex items-center gap-3 min-w-0">
            {image ? (
              <img src={image} alt={group.displayName} className="w-14 h-11 rounded-lg object-cover border border-border shrink-0" />
            ) : (
              <div className="w-14 h-11 rounded-lg bg-muted flex items-center justify-center border border-border shrink-0">
                <Car size={18} className="text-muted-foreground" />
              </div>
            )}
            <div className="min-w-0">
              <h3 className="font-black text-sm truncate">{group.displayName}</h3>
              <p className="text-[10px] text-muted-foreground font-mono truncate">{group.slug}</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                group.is_public ? 'bg-success/10 text-success border-success/30' : 'bg-muted text-muted-foreground border-border'
              }`}
            >
              {group.is_public ? 'Public' : 'Hidden'}
            </span>
            {group.booking_mode && group.booking_mode !== 'both' && (
              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${
                group.booking_mode === 'reservation_only'
                  ? 'bg-amber-500/10 text-amber-500 border-amber-500/30'
                  : 'bg-red-500/10 text-red-400 border-red-500/30'
              }`}>
                {group.booking_mode === 'reservation_only' ? 'Reserve only' : 'No booking'}
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="text-muted-foreground">
            Category: <span className="text-foreground font-semibold">{group.category || 'N/A'}</span>
          </div>
          <div className="text-muted-foreground">
            Units: <span className="text-foreground font-semibold">{group.unitCount}</span>
          </div>
          <div className="text-muted-foreground">
            Variants: <span className="text-foreground font-semibold">{group.variants.length}</span>
          </div>
          <div className="text-muted-foreground">
            Rate:{' '}
            <span className="text-foreground font-semibold">
              {group.base_daily_rate ? `KES ${Number(group.base_daily_rate).toLocaleString()}` : 'N/A'}
            </span>
          </div>
        </div>
      </div>

      <div className="p-4 flex gap-2 mt-auto">
        <button
          onClick={onOpen}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-primary text-primary-foreground rounded-xl text-xs font-bold hover:bg-primary/90 transition-colors"
        >
          <Layers size={14} /> Open Family
        </button>
        <button
          onClick={onEditCatalog}
          className="p-2.5 bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground rounded-xl transition-colors"
          title="Edit catalog"
        >
          <Edit3 size={16} />
        </button>
      </div>
    </div>
  );
};

export function AdminVehicleModels() {
  const navigate = useNavigate();
  const [models, setModels] = useState<VehicleModelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<VehicleModelGroup | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>('units');
  const [fleetUnits, setFleetUnits] = useState<FleetUnit[]>([]);
  const [loadingUnits, setLoadingUnits] = useState(false);
  const [fleetStatus, setFleetStatus] = useState<ModelFleetStatusSummary | null>(null);
  const [loadingFleetStatus, setLoadingFleetStatus] = useState(false);
  const [fleetStatusStart, setFleetStatusStart] = useState('');
  const [fleetStatusEnd, setFleetStatusEnd] = useState('');
  const [savingBookingMode, setSavingBookingMode] = useState(false);

  const [showCatalogForm, setShowCatalogForm] = useState(false);
  const [showAdvancedForm, setShowAdvancedForm] = useState(false);
  const [editorMode, setEditorMode] = useState<EditorMode>('catalog');
  const [advancedStep, setAdvancedStep] = useState(1);
  const [selectedModel, setSelectedModel] = useState<VehicleModelRow | null>(null);
  const [formData, setFormData] = useState<Partial<VehicleModelRow>>(EMPTY_CATALOG_FORM);
  const [primaryImageFile, setPrimaryImageFile] = useState<File | null>(null);
  const [galleryFiles, setGalleryFiles] = useState<File[]>([]);
  const [familyReconcile, setFamilyReconcile] = useState({ family_name: '', family_slug: '' });
  const [savingFamily, setSavingFamily] = useState(false);

  const fetchModels = async () => {
    setLoading(true);
    try {
      const result = await adminService.getVehicleModels(1, 500);
      if (result?.data) setModels(result.data as VehicleModelRow[]);
    } catch (error) {
      console.error('Failed to fetch vehicle models:', error);
      toast.error('Failed to load vehicle models');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchModels();
  }, []);

  useEffect(() => {
    if (!selectedGroup) return;
    setFamilyReconcile({
      family_name: selectedGroup.representative.family_name || selectedGroup.displayName,
      family_slug: selectedGroup.representative.family_slug || selectedGroup.slug,
    });
  }, [selectedGroup?.groupKey]);

  const refreshGroupsAfterMutation = async (groupKey?: string) => {
    const result = await adminService.getVehicleModels(1, 500);
    const freshModels = (result?.data || []) as VehicleModelRow[];
    setModels(freshModels);
    if (!groupKey) return null;
    const unitCounts = Object.fromEntries(freshModels.map((row) => [row.id, row.cars?.length || 0]));
    const refreshed = groupVehicleModels(freshModels, unitCounts);
    return refreshed.find((group) => group.groupKey === groupKey) || null;
  };

  const handleSuggestFamily = () => {
    if (!selectedGroup) return;
    const suggestion = suggestVehicleModelFamily(selectedGroup.representative);
    setFamilyReconcile(suggestion);
    toast.message('Suggested family applied — review and save to all variants.');
  };

  const handleApplyFamilyToAll = async () => {
    if (!selectedGroup) return;
    if (!familyReconcile.family_name.trim()) {
      toast.error('Family name is required');
      return;
    }
    setSavingFamily(true);
    try {
      await adminService.updateVehicleModelsFamily(
        getVehicleModelIdsForGroup(selectedGroup),
        familyReconcile
      );
      toast.success(`Family updated for ${selectedGroup.variants.length} variant(s)`);
      const nextGroup = await refreshGroupsAfterMutation(selectedGroup.groupKey);
      if (nextGroup) {
        setSelectedGroup(nextGroup);
        await loadFleetUnits(nextGroup);
      } else {
        closeGroupDetail();
      }
    } catch (error: any) {
      toast.error(error?.message || 'Failed to update family grouping');
    } finally {
      setSavingFamily(false);
    }
  };

  const groupedModels = useMemo(() => {
    const unitCounts: Record<string, number> = {};
    for (const row of models) {
      unitCounts[row.id] = row.cars?.length || 0;
    }
    return groupVehicleModels(models, unitCounts);
  }, [models]);

  const buildFleetCarsUrl = (group: VehicleModelGroup, includeAdd = false) => {
    const params = new URLSearchParams();
    params.set('modelId', group.representativeId);
    params.set('modelIds', getVehicleModelIdsForGroup(group).join(','));
    if (includeAdd) params.set('add', '1');
    return `/admin/cars?${params.toString()}`;
  };

  const filteredGroups = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return groupedModels;
    return groupedModels.filter((group) => {
      const haystack = [group.displayName, group.slug, group.category, group.variantYears.join(' ')]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [groupedModels, search]);

  const handleMoveVariantToFamily = async (variantId: string, targetGroupKey: string) => {
    if (!targetGroupKey || !selectedGroup) return;
    const target = groupedModels.find((group) => group.groupKey === targetGroupKey);
    if (!target) return;
    try {
      await adminService.updateVehicleModelsFamily([variantId], {
        family_name: target.displayName,
        family_slug: target.slug,
      });
      toast.success('Variant moved to selected family');
      const nextGroup = await refreshGroupsAfterMutation(selectedGroup.groupKey);
      if (nextGroup) {
        setSelectedGroup(nextGroup);
        await loadFleetUnits(nextGroup);
      } else {
        closeGroupDetail();
      }
    } catch (error: any) {
      toast.error(error?.message || 'Failed to move variant');
    }
  };

  const loadFleetUnits = async (group: VehicleModelGroup) => {
    setLoadingUnits(true);
    try {
      const units = await adminService.getCarsByVehicleModelIds(getVehicleModelIdsForGroup(group));
      setFleetUnits((units as any) || []);
    } catch (error) {
      console.error('Failed to load fleet units:', error);
      setFleetUnits([]);
    } finally {
      setLoadingUnits(false);
    }
  };

  const loadFleetStatus = async (group: VehicleModelGroup, startDate?: string, endDate?: string) => {
    setLoadingFleetStatus(true);
    try {
      const status = await adminService.getModelFleetStatus(getVehicleModelIdsForGroup(group), {
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      setFleetStatus(status);
    } catch (error) {
      console.error('Failed to load fleet status:', error);
      setFleetStatus(null);
    } finally {
      setLoadingFleetStatus(false);
    }
  };

  const handleBookingModeChange = async (mode: 'both' | 'reservation_only' | 'disabled') => {
    if (!selectedGroup) return;
    setSavingBookingMode(true);
    try {
      await adminService.setVehicleModelBookingMode(getVehicleModelIdsForGroup(selectedGroup), mode);
      toast.success(
        mode === 'reservation_only'
          ? 'Model set to reservation-only — Book Now hidden on public site'
          : mode === 'disabled'
            ? 'Model booking disabled on public site'
            : 'Model booking restored — Book Now and Reserve available'
      );
      const nextGroup = await refreshGroupsAfterMutation(selectedGroup.groupKey);
      if (nextGroup) setSelectedGroup(nextGroup);
    } catch (error: any) {
      toast.error(error?.message || 'Failed to update booking mode');
    } finally {
      setSavingBookingMode(false);
    }
  };

  const handleUnreserve = async (reservationId: string) => {
    if (!selectedGroup) return;
    if (!window.confirm('Are you sure you want to cancel this reservation? This will instantly free up the held unit.')) return;
    try {
      await adminService.deleteReservation(reservationId);
      toast.success('Reservation cancelled successfully');
      loadFleetStatus(selectedGroup, fleetStatusStart, fleetStatusEnd);
    } catch (error: any) {
      toast.error(error?.message || 'Failed to cancel reservation');
    }
  };

  const openGroupDetail = async (group: VehicleModelGroup, tab: DetailTab = 'units') => {
    setSelectedGroup(group);
    setDetailTab(tab);
    const today = new Date().toISOString().slice(0, 10);
    const weekAhead = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    setFleetStatusStart(today);
    setFleetStatusEnd(weekAhead);
    await Promise.all([loadFleetUnits(group), loadFleetStatus(group, today, weekAhead)]);
  };

  const closeGroupDetail = () => {
    setSelectedGroup(null);
    setFleetUnits([]);
    setFleetStatus(null);
  };

  const openCreateCatalog = () => {
    setSelectedModel(null);
    setFormData(EMPTY_CATALOG_FORM);
    setPrimaryImageFile(null);
    setShowCatalogForm(true);
  };

  const openAdvancedEdit = (model: VehicleModelRow) => {
    setEditorMode('catalog');
    setAdvancedStep(1);
    setSelectedModel(model);
    setFormData({
      ...EMPTY_ADVANCED_FORM,
      ...model,
      gallery_urls: model.gallery_urls || [],
      features: model.features || [],
    });
    setPrimaryImageFile(null);
    setGalleryFiles([]);
    setShowAdvancedForm(true);
  };

  const openCreateVariant = (group: VehicleModelGroup) => {
    const representative = group.representative as VehicleModelRow;
    setEditorMode('variant');
    setAdvancedStep(1);
    setSelectedModel(null);
    setFormData({
      ...EMPTY_ADVANCED_FORM,
      make: representative.make,
      model: representative.model,
      family_name: representative.family_name || group.displayName,
      family_slug: representative.family_slug || group.slug,
      display_name: representative.display_name || group.displayName,
      category: representative.category || group.category || 'SUV',
      description: representative.description || '',
      primary_image_url: representative.primary_image_url || '',
      gallery_urls: representative.gallery_urls || [],
      transmission: representative.transmission || 'Automatic',
      fuel_type: representative.fuel_type || 'Petrol',
      seats: representative.seats || 5,
      luggage: representative.luggage || 2,
      features: representative.features || [],
      base_daily_rate: representative.base_daily_rate || group.base_daily_rate || 0,
      overtime_rate: representative.overtime_rate || 0,
      security_deposit: representative.security_deposit || 0,
      sort_order: representative.sort_order || 0,
      is_chauffeured_only: !!representative.is_chauffeured_only,
      is_public: representative.is_public !== false,
      year: new Date().getFullYear(),
      slug: '',
      variant_name: '',
    });
    setPrimaryImageFile(null);
    setGalleryFiles([]);
    setShowAdvancedForm(true);
  };

  const handleSaveCatalog = async () => {
    if (!formData.make || !formData.model) {
      toast.error('Make and model are required');
      return;
    }

    setSaving(true);
    try {
      let primaryImageUrl = formData.primary_image_url || '';
      if (primaryImageFile) {
        primaryImageUrl = await adminService.uploadCarImage(primaryImageFile);
      }

      await adminService.addVehicleModel({
        ...formData,
        primary_image_url: primaryImageUrl,
        family_name: formData.family_name || `${formData.make} ${formData.model}`.trim(),
        display_name: formData.display_name || `${formData.make} ${formData.model}`.trim(),
      });

      toast.success('Catalog family created. Link fleet units from the family drawer.');
      setShowCatalogForm(false);
      setFormData(EMPTY_CATALOG_FORM);
      setPrimaryImageFile(null);
      await fetchModels();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to create catalog family');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAdvanced = async () => {
    if (!formData.make || !formData.model) {
      toast.error('Make and model are required');
      return;
    }
    if (editorMode === 'variant' && !formData.year) {
      toast.error('Year is required for a variant');
      return;
    }

    setSaving(true);
    try {
      let primaryImageUrl = formData.primary_image_url || '';
      if (primaryImageFile) {
        primaryImageUrl = await adminService.uploadCarImage(primaryImageFile);
      } else if (primaryImageUrl.startsWith('blob:')) {
        primaryImageUrl = selectedModel?.primary_image_url || '';
      }

      let galleryUrls = [...(formData.gallery_urls || [])].filter(
        (url) => typeof url === 'string' && !url.startsWith('blob:')
      );
      if (galleryFiles.length > 0) {
        const uploaded = await Promise.all(galleryFiles.map((file) => adminService.uploadCarImage(file)));
        galleryUrls = [...galleryUrls, ...uploaded];
      }

      const payload = {
        ...formData,
        primary_image_url: primaryImageUrl,
        gallery_urls: galleryUrls,
        family_name: formData.family_name || `${formData.make} ${formData.model}`.trim(),
      };

      if (selectedModel?.id) {
        await adminService.updateVehicleModel(selectedModel.id, payload);
        toast.success('Vehicle model updated');
      } else {
        await adminService.addVehicleModel(payload);
        toast.success('Variant created');
      }
      setShowAdvancedForm(false);
      setSelectedModel(null);
      await fetchModels();
      if (selectedGroup) {
        const result = await adminService.getVehicleModels(1, 500);
        const freshModels = (result?.data || []) as VehicleModelRow[];
        const unitCounts = Object.fromEntries(freshModels.map((row) => [row.id, row.cars?.length || 0]));
        const refreshed = groupVehicleModels(freshModels, unitCounts);
        const nextGroup = refreshed.find((group) => group.groupKey === selectedGroup.groupKey);
        if (nextGroup) {
          setSelectedGroup(nextGroup);
          await loadFleetUnits(nextGroup);
        } else {
          closeGroupDetail();
        }
      }
    } catch (error: any) {
      const message = error?.message || 'Failed to save vehicle model';
      const hint = message.includes('family_slug')
        ? ' Run scripts/add_vehicle_model_families.sql on the database first.'
        : '';
      toast.error(`${message}${hint}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this vehicle model row? Linked cars may lose their public model link.')) {
      return;
    }
    try {
      await adminService.deleteVehicleModel(id);
      toast.success('Vehicle model deleted');
      const result = await adminService.getVehicleModels(1, 500);
      const freshModels = (result?.data || []) as VehicleModelRow[];
      setModels(freshModels);
      if (selectedGroup) {
        const unitCounts = Object.fromEntries(freshModels.map((row) => [row.id, row.cars?.length || 0]));
        const refreshed = groupVehicleModels(freshModels, unitCounts);
        const nextGroup = refreshed.find((group) => group.groupKey === selectedGroup.groupKey);
        if (nextGroup) {
          setSelectedGroup(nextGroup);
          await loadFleetUnits(nextGroup);
        } else {
          closeGroupDetail();
        }
      }
    } catch (error: any) {
      toast.error(error?.message || 'Failed to delete vehicle model');
    }
  };

  const addFeature = (feature: string) => {
    const trimmed = feature.trim();
    if (!trimmed) return;
    setFormData((prev) => ({
      ...prev,
      features: Array.from(new Set([...(prev.features || []), trimmed])),
    }));
  };

  if (loading && models.length === 0) {
    return (
      <div className="h-full w-full flex items-center justify-center p-20">
        <Loader2 className="animate-spin text-primary" size={48} />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black">Vehicle Models</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Public catalog families — open a card to manage linked fleet units.
          </p>
        </div>
        <button
          onClick={openCreateCatalog}
          className="flex items-center gap-2 px-6 py-2 bg-primary text-white rounded-xl font-bold text-sm hover:scale-105 transition-transform shadow-lg shadow-primary/20"
        >
          <Plus size={16} /> New Catalog Family
        </button>
      </div>

      <div className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
          <input
            type="text"
            placeholder="Search catalog families..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20 outline-none"
          />
        </div>
        <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
          {filteredGroups.length} famil{filteredGroups.length === 1 ? 'y' : 'ies'}
        </div>
      </div>

      {filteredGroups.length === 0 ? (
        <div className="p-12 text-center bg-card border border-border rounded-2xl">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
            <Car size={32} className="text-muted-foreground" />
          </div>
          <h3 className="text-lg font-bold mb-1">No catalog families found</h3>
          <p className="text-muted-foreground mb-4">
            Create one public family, then link physical cars in Fleet → Cars.
          </p>
          <button onClick={openCreateCatalog} className="px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-bold">
            Create catalog family
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredGroups.map((group) => (
            <ModelFamilyCard
              key={group.groupKey}
              group={group}
              onOpen={() => openGroupDetail(group)}
              onEditCatalog={() => openAdvancedEdit(group.representative as VehicleModelRow)}
            />
          ))}
        </div>
      )}

      {selectedGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between gap-4 p-6 border-b border-border bg-muted/10">
              <div className="flex gap-4 min-w-0">
                {selectedGroup.primary_image_url ? (
                  <img
                    src={selectedGroup.primary_image_url}
                    alt={selectedGroup.displayName}
                    className="w-20 h-16 rounded-xl object-cover border border-border shrink-0"
                  />
                ) : (
                  <div className="w-20 h-16 rounded-xl bg-muted flex items-center justify-center shrink-0">
                    <Car size={22} className="text-muted-foreground" />
                  </div>
                )}
                <div className="min-w-0">
                  <h2 className="text-xl font-black truncate">{selectedGroup.displayName}</h2>
                  <p className="text-xs text-muted-foreground font-mono mt-1">{selectedGroup.slug}</p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-muted">
                      {selectedGroup.category || 'Uncategorized'}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-primary/10 text-primary">
                      {selectedGroup.unitCount} unit{selectedGroup.unitCount === 1 ? '' : 's'}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-muted">
                      {selectedGroup.variants.length} variant{selectedGroup.variants.length === 1 ? '' : 's'}
                    </span>
                  </div>
                </div>
              </div>
              <button onClick={closeGroupDetail} className="p-2 hover:bg-muted rounded-full transition-colors shrink-0">
                <X size={20} />
              </button>
            </div>

            <div className="px-6 pt-4 flex gap-2 border-b border-border">
              {([
                ['units', 'Fleet Units'],
                ['variants', 'Variants'],
                ['catalog', 'Catalog'],
              ] as const).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setDetailTab(key)}
                  className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-t-xl border-b-2 transition-colors ${
                    detailTab === key
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {detailTab === 'units' && (
                <>
                  <div className="p-4 bg-muted/20 border border-border rounded-xl space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-end gap-3">
                      <div className="flex-1 space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          Status from
                        </label>
                        <input
                          type="date"
                          value={fleetStatusStart}
                          onChange={(e) => setFleetStatusStart(e.target.value)}
                          className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm"
                        />
                      </div>
                      <div className="flex-1 space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          Status to
                        </label>
                        <input
                          type="date"
                          value={fleetStatusEnd}
                          onChange={(e) => setFleetStatusEnd(e.target.value)}
                          className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          selectedGroup &&
                          loadFleetStatus(selectedGroup, fleetStatusStart, fleetStatusEnd)
                        }
                        className="px-4 py-2 bg-primary text-primary-foreground rounded-xl text-xs font-bold"
                      >
                        Refresh status
                      </button>
                    </div>
                    <ModelFleetStatusPanel
                      status={fleetStatus}
                      loading={loadingFleetStatus}
                      dateRangeLabel={
                        fleetStatusStart && fleetStatusEnd
                          ? `(${fleetStatusStart} → ${fleetStatusEnd})`
                          : undefined
                      }
                      onUnreserve={handleUnreserve}
                    />
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2">
                    <button
                      onClick={() => navigate(buildFleetCarsUrl(selectedGroup, true))}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-primary text-primary-foreground rounded-xl text-xs font-bold"
                    >
                      <Plus size={14} /> Add Fleet Unit
                    </button>
                    <button
                      onClick={() => navigate(buildFleetCarsUrl(selectedGroup))}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-muted hover:bg-muted/80 rounded-xl text-xs font-bold"
                    >
                      <Link2 size={14} /> Manage in Fleet Cars
                    </button>
                  </div>

                  {loadingUnits ? (
                    <div className="py-10 flex justify-center">
                      <Loader2 className="animate-spin text-primary" size={28} />
                    </div>
                  ) : fleetUnits.length === 0 ? (
                    <div className="p-8 text-center bg-muted/20 border border-dashed border-border rounded-2xl">
                      <p className="text-sm font-semibold">No fleet units linked yet</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Link existing cars or add a new unit and assign this public model.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {fleetUnits.map((unit) => (
                        <div
                          key={unit.id}
                          className="flex items-center justify-between gap-3 p-3 bg-muted/20 border border-border rounded-xl"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {unit.primary_image_url ? (
                              <img src={unit.primary_image_url} alt="" className="w-12 h-10 rounded-lg object-cover border border-border" />
                            ) : (
                              <div className="w-12 h-10 rounded-lg bg-muted flex items-center justify-center">
                                <Car size={14} className="text-muted-foreground" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="text-sm font-bold truncate">
                                {unit.year || '—'} · {unit.color || 'N/A'}
                              </p>
                              <p className="text-[10px] text-muted-foreground font-mono truncate">
                                {unit.license_plate || 'No plate'} · {unit.fleet_owner?.full_name || 'Unknown owner'}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-muted">
                              {unit.status || 'unknown'}
                            </span>
                            <button
                              onClick={() => navigate(buildFleetCarsUrl(selectedGroup))}
                              className="p-2 hover:bg-muted rounded-lg text-muted-foreground hover:text-primary"
                              title="Edit in Fleet Cars"
                            >
                              <Edit3 size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {detailTab === 'variants' && (
                <div className="space-y-3">
                  <button
                    onClick={() => openCreateVariant(selectedGroup)}
                    className="w-full py-2.5 bg-primary text-primary-foreground rounded-xl text-xs font-bold"
                  >
                    <Plus size={14} className="inline mr-2" />
                    Add Variant To This Family
                  </button>
                  {selectedGroup.variants.map((variant) => (
                    <div key={variant.id} className="p-3 bg-muted/20 border border-border rounded-xl space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-bold">
                            {variant.year ? `${variant.year}` : 'No year'}
                            {variant.display_name && variant.display_name !== selectedGroup.displayName
                              ? ` · ${variant.display_name}`
                              : ''}
                          </p>
                          <p className="text-xs text-muted-foreground font-mono">
                            {variant.variant_name || 'Standard'} · {variant.slug}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            {models.find((row) => row.id === variant.id)?.cars?.length || 0} units
                          </span>
                          <button
                            onClick={() => openAdvancedEdit(variant as VehicleModelRow)}
                            className="p-2 hover:bg-muted rounded-lg"
                            title="Edit variant"
                          >
                            <Edit3 size={14} />
                          </button>
                          <button
                            onClick={() => handleDelete(variant.id)}
                            className="p-2 hover:bg-error/10 rounded-lg text-error"
                            title="Delete variant"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                      <select
                        defaultValue=""
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value) handleMoveVariantToFamily(variant.id, value);
                          e.target.value = '';
                        }}
                        className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs"
                      >
                        <option value="">Move variant to another family…</option>
                        {groupedModels
                          .filter((group) => group.groupKey !== selectedGroup.groupKey)
                          .map((group) => (
                            <option key={group.groupKey} value={group.groupKey}>
                              {group.displayName}
                            </option>
                          ))}
                      </select>
                    </div>
                  ))}
                </div>
              )}

              {detailTab === 'catalog' && (
                <div className="space-y-4">
                  {selectedGroup.primary_image_url ? (
                    <div className="rounded-xl overflow-hidden border border-border">
                      <img
                        src={selectedGroup.primary_image_url}
                        alt={selectedGroup.displayName}
                        className="w-full h-40 object-cover"
                      />
                      <p className="px-3 py-2 text-[10px] text-muted-foreground bg-muted/20">
                        Current hero image on public catalog cards
                      </p>
                    </div>
                  ) : (
                    <div className="p-6 text-center bg-muted/20 border border-dashed border-border rounded-xl">
                      <p className="text-sm font-semibold">No hero image yet</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Add a primary image in catalog details — it appears on the website model card.
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="p-4 bg-muted/20 rounded-xl border border-border">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Daily rate</p>
                      <p className="font-black mt-1">
                        {selectedGroup.base_daily_rate
                          ? `KES ${Number(selectedGroup.base_daily_rate).toLocaleString()}`
                          : 'Not set'}
                      </p>
                    </div>
                    <div className="p-4 bg-muted/20 rounded-xl border border-border">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Visibility</p>
                      <p className="font-bold mt-1">{selectedGroup.is_public ? 'Public listing' : 'Hidden'}</p>
                    </div>
                    <div className="p-4 bg-muted/20 rounded-xl border border-border col-span-2 space-y-3">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Public booking mode</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          When fleet is exhausted, switch to reservation-only so clients can still hold dates while you source an outsourced unit.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {([
                          ['both', 'Book + Reserve'],
                          ['reservation_only', 'Reservation only'],
                          ['disabled', 'Booking disabled'],
                        ] as const).map(([mode, label]) => (
                          <button
                            key={mode}
                            type="button"
                            disabled={savingBookingMode}
                            onClick={() => handleBookingModeChange(mode)}
                            className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors ${
                              selectedGroup.booking_mode === mode
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'bg-background border-border hover:border-primary/40'
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="p-4 bg-muted/20 rounded-xl border border-border col-span-2">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Description</p>
                      <p className="mt-1 text-muted-foreground">
                        {selectedGroup.representative.description || 'No description yet.'}
                      </p>
                    </div>
                  </div>

                  <div className="p-4 bg-muted/20 border border-border rounded-xl space-y-3">
                    <div>
                      <p className="text-sm font-bold">Reconcile family grouping</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Apply one public family name to all {selectedGroup.variants.length} variant row
                        {selectedGroup.variants.length === 1 ? '' : 's'} in this drawer. Example: merge Toyota Prado
                        Diesel, VXL, and TX into one family; keep V8 in a separate family.
                      </p>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-muted-foreground">Family name (public card title)</label>
                      <input
                        value={familyReconcile.family_name}
                        onChange={(e) =>
                          setFamilyReconcile((prev) => ({ ...prev, family_name: e.target.value }))
                        }
                        placeholder="Toyota Land Cruiser Prado"
                        className="w-full px-4 py-2 bg-background border border-border rounded-xl text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-muted-foreground">Family slug (URL key)</label>
                      <input
                        value={familyReconcile.family_slug}
                        onChange={(e) =>
                          setFamilyReconcile((prev) => ({ ...prev, family_slug: e.target.value }))
                        }
                        placeholder="toyota-land-cruiser-prado"
                        className="w-full px-4 py-2 bg-background border border-border rounded-xl text-sm font-mono"
                      />
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <button
                        type="button"
                        onClick={handleSuggestFamily}
                        className="flex-1 py-2.5 bg-card border border-border rounded-xl text-xs font-bold hover:bg-muted transition-colors"
                      >
                        Suggest from make/model rules
                      </button>
                      <button
                        type="button"
                        onClick={handleApplyFamilyToAll}
                        disabled={savingFamily}
                        className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-xl text-xs font-bold disabled:opacity-60"
                      >
                        {savingFamily ? 'Saving…' : 'Apply to all variants'}
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={() => openAdvancedEdit(selectedGroup.representative as VehicleModelRow)}
                    className="w-full py-2.5 bg-muted hover:bg-muted/80 rounded-xl text-xs font-bold"
                  >
                    Edit catalog details & hero image
                  </button>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-border bg-muted/10 flex flex-col sm:flex-row gap-2">
              <a
                href={`/vehicles/${generateVehicleSlug(selectedGroup.representative)}`}
                target="_blank"
                rel="noreferrer"
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-card border border-border rounded-xl text-xs font-bold hover:bg-muted transition-colors"
              >
                <ExternalLink size={14} /> Preview public page
              </a>
              <button
                onClick={closeGroupDetail}
                className="flex-1 py-2.5 bg-card border border-border rounded-xl text-xs font-bold hover:bg-muted transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showCatalogForm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="bg-card w-full max-w-xl rounded-2xl border border-border shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold">New Catalog Family</h3>
                <p className="text-sm text-muted-foreground mt-1">Minimal public listing — link fleet units after saving.</p>
              </div>
              <button onClick={() => setShowCatalogForm(false)} className="p-2 hover:bg-muted rounded-full">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-muted-foreground">Make *</label>
                  <input
                    value={formData.make || ''}
                    onChange={(e) => setFormData({ ...formData, make: e.target.value })}
                    className="w-full px-4 py-2 bg-background border border-border rounded-xl text-sm"
                    placeholder="Toyota"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-muted-foreground">Model *</label>
                  <input
                    value={formData.model || ''}
                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                    className="w-full px-4 py-2 bg-background border border-border rounded-xl text-sm"
                    placeholder="Axio"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-muted-foreground">Family name</label>
                  <input
                    value={formData.family_name || ''}
                    onChange={(e) => setFormData({ ...formData, family_name: e.target.value })}
                    className="w-full px-4 py-2 bg-background border border-border rounded-xl text-sm"
                    placeholder="Nissan Note"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-muted-foreground">Family slug</label>
                  <input
                    value={formData.family_slug || ''}
                    onChange={(e) => setFormData({ ...formData, family_slug: e.target.value })}
                    className="w-full px-4 py-2 bg-background border border-border rounded-xl text-sm"
                    placeholder="nissan-note"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase text-muted-foreground">Display name</label>
                <input
                  value={formData.display_name || ''}
                  onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                  className="w-full px-4 py-2 bg-background border border-border rounded-xl text-sm"
                  placeholder="Toyota Axio"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-muted-foreground">Category</label>
                  <select
                    value={formData.category || 'SUV'}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-4 py-2 bg-background border border-border rounded-xl text-sm"
                  >
                    {CATALOG_CATEGORIES.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-muted-foreground">Daily rate (KES)</label>
                  <input
                    type="number"
                    value={formData.base_daily_rate || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, base_daily_rate: e.target.value ? parseFloat(e.target.value) : 0 })
                    }
                    className="w-full px-4 py-2 bg-background border border-border rounded-xl text-sm"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase text-muted-foreground">Short description</label>
                <textarea
                  rows={2}
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2 bg-background border border-border rounded-xl text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase text-muted-foreground">Hero image</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    setPrimaryImageFile(file);
                    if (file) {
                      setFormData((prev) => ({ ...prev, primary_image_url: URL.createObjectURL(file) }));
                    }
                  }}
                  className="w-full px-4 py-2 bg-background border border-border rounded-xl text-sm"
                />
              </div>
              <label className="flex items-center gap-3 p-3 bg-muted/20 border border-border rounded-xl">
                <input
                  type="checkbox"
                  checked={!!formData.is_public}
                  onChange={(e) => setFormData({ ...formData, is_public: e.target.checked })}
                />
                <span className="text-sm font-medium flex items-center gap-2">
                  {formData.is_public ? <Eye size={16} /> : <EyeOff size={16} />} Visible on public site
                </span>
              </label>
            </div>
            <div className="p-6 border-t border-border flex justify-end gap-3">
              <button onClick={() => setShowCatalogForm(false)} className="px-5 py-2 rounded-xl font-bold border border-border">
                Cancel
              </button>
              <button
                onClick={handleSaveCatalog}
                disabled={saving}
                className="px-6 py-2 rounded-xl font-bold bg-primary text-white flex items-center gap-2 disabled:opacity-50"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                Create family
              </button>
            </div>
          </div>
        </div>
      )}

      {showAdvancedForm && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="bg-card w-full max-w-5xl rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold">
                  {editorMode === 'variant'
                    ? selectedModel
                      ? 'Edit Variant'
                      : 'Add Variant'
                    : 'Edit Catalog Details'}
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {editorMode === 'variant'
                    ? 'Variant-specific fields like year and pricing, while staying in the same family.'
                    : 'Catalog-level fields for the public family card and showroom listing.'}
                </p>
              </div>
              <button onClick={() => setShowAdvancedForm(false)} className="p-2 hover:bg-muted rounded-full">
                <X size={20} />
              </button>
            </div>
            <div className="px-6 pt-4 flex gap-2 border-b border-border overflow-x-auto">
              {ADVANCED_STEPS.map((step) => (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => setAdvancedStep(step.id)}
                  className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-t-xl border-b-2 transition-colors ${
                    advancedStep === step.id
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {step.label}
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {advancedStep === 1 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <input
                    placeholder="Make"
                    value={formData.make || ''}
                    onChange={(e) => setFormData({ ...formData, make: e.target.value })}
                    className="px-4 py-2 bg-background border border-border rounded-xl text-sm"
                  />
                  <input
                    placeholder="Model"
                    value={formData.model || ''}
                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                    className="px-4 py-2 bg-background border border-border rounded-xl text-sm"
                  />
                  <input
                    type="number"
                    placeholder="Year"
                    value={formData.year || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, year: e.target.value ? parseInt(e.target.value, 10) : undefined })
                    }
                    className="px-4 py-2 bg-background border border-border rounded-xl text-sm"
                  />
                  <input
                    placeholder="Display name"
                    value={formData.display_name || ''}
                    onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                    className="md:col-span-2 px-4 py-2 bg-background border border-border rounded-xl text-sm"
                  />
                  <input
                    placeholder="Slug"
                    value={formData.slug || ''}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                    className="px-4 py-2 bg-background border border-border rounded-xl text-sm"
                  />
                  <input
                    placeholder="Family name"
                    value={formData.family_name || ''}
                    onChange={(e) => setFormData({ ...formData, family_name: e.target.value })}
                    className="md:col-span-2 px-4 py-2 bg-background border border-border rounded-xl text-sm"
                  />
                  <input
                    placeholder="Family slug"
                    value={formData.family_slug || ''}
                    onChange={(e) => setFormData({ ...formData, family_slug: e.target.value })}
                    className="px-4 py-2 bg-background border border-border rounded-xl text-sm"
                  />
                  <input
                    placeholder="Variant name"
                    value={formData.variant_name || ''}
                    onChange={(e) => setFormData({ ...formData, variant_name: e.target.value })}
                    className="md:col-span-3 px-4 py-2 bg-background border border-border rounded-xl text-sm"
                  />
                  <select
                    value={formData.category || 'SUV'}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="px-4 py-2 bg-background border border-border rounded-xl text-sm"
                  >
                    {CATALOG_CATEGORIES.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                  <label className="flex items-center gap-3 p-3 bg-muted/20 border border-border rounded-xl md:col-span-2">
                    <input
                      type="checkbox"
                      checked={!!formData.is_public}
                      onChange={(e) => setFormData({ ...formData, is_public: e.target.checked })}
                    />
                    <span className="text-sm font-medium flex items-center gap-2">
                      {formData.is_public ? <Eye size={16} /> : <EyeOff size={16} />} Visible on public site
                    </span>
                  </label>
                  <textarea
                    placeholder="Description"
                    rows={4}
                    value={formData.description || ''}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="md:col-span-3 px-4 py-2 bg-background border border-border rounded-xl text-sm"
                  />
                </div>
              )}

              {advancedStep === 2 && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-muted-foreground">
                      Primary / hero image (website catalog card)
                    </label>
                    {formData.primary_image_url ? (
                      <img
                        src={formData.primary_image_url}
                        alt="Hero preview"
                        className="w-full max-h-48 object-cover rounded-xl border border-border"
                      />
                    ) : (
                      <div className="p-8 text-center bg-muted/20 border border-dashed border-border rounded-xl text-xs text-muted-foreground">
                        No hero image — upload one to feature this model on the public site.
                      </div>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        setPrimaryImageFile(file);
                        if (file) {
                          setFormData((prev) => ({
                            ...prev,
                            primary_image_url: URL.createObjectURL(file),
                          }));
                        }
                      }}
                      className="w-full px-4 py-2 bg-background border border-border rounded-xl text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-muted-foreground">Gallery images (optional)</label>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(e) => setGalleryFiles(Array.from(e.target.files || []))}
                      className="w-full px-4 py-2 bg-background border border-border rounded-xl text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase text-muted-foreground">Video URL (optional)</label>
                    <input
                      placeholder="https://..."
                      value={formData.video_url || ''}
                      onChange={(e) => setFormData({ ...formData, video_url: e.target.value })}
                      className="w-full px-4 py-2 bg-background border border-border rounded-xl text-sm"
                    />
                  </div>
                </div>
              )}

              {advancedStep === 3 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <input
                    placeholder="Transmission"
                    value={formData.transmission || ''}
                    onChange={(e) => setFormData({ ...formData, transmission: e.target.value })}
                    className="px-4 py-2 bg-background border border-border rounded-xl text-sm"
                  />
                  <input
                    placeholder="Fuel type"
                    value={formData.fuel_type || ''}
                    onChange={(e) => setFormData({ ...formData, fuel_type: e.target.value })}
                    className="px-4 py-2 bg-background border border-border rounded-xl text-sm"
                  />
                  <input
                    type="number"
                    placeholder="Seats"
                    value={formData.seats || ''}
                    onChange={(e) => setFormData({ ...formData, seats: e.target.value ? parseInt(e.target.value, 10) : 0 })}
                    className="px-4 py-2 bg-background border border-border rounded-xl text-sm"
                  />
                  <input
                    type="number"
                    placeholder="Luggage"
                    value={formData.luggage || ''}
                    onChange={(e) => setFormData({ ...formData, luggage: e.target.value ? parseInt(e.target.value, 10) : 0 })}
                    className="px-4 py-2 bg-background border border-border rounded-xl text-sm"
                  />
                  <label className="flex items-center gap-3 p-3 bg-muted/20 border border-border rounded-xl md:col-span-2">
                    <input
                      type="checkbox"
                      checked={!!formData.is_chauffeured_only}
                      onChange={(e) => setFormData({ ...formData, is_chauffeured_only: e.target.checked })}
                    />
                    <span className="text-sm font-medium">Chauffeured only</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Add feature and press Enter"
                    className="md:col-span-3 w-full px-4 py-2 bg-background border border-border rounded-xl text-sm"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addFeature((e.target as HTMLInputElement).value);
                        (e.target as HTMLInputElement).value = '';
                      }
                    }}
                  />
                  {!!formData.features?.length && (
                    <div className="md:col-span-3 flex flex-wrap gap-2">
                      {formData.features.map((feature, index) => (
                        <span key={`${feature}-${index}`} className="px-3 py-1 bg-primary/10 text-primary text-xs font-bold rounded-full">
                          {feature}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {advancedStep === 4 && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <input
                    type="number"
                    placeholder="Daily rate"
                    value={formData.base_daily_rate || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, base_daily_rate: e.target.value ? parseFloat(e.target.value) : 0 })
                    }
                    className="px-4 py-2 bg-background border border-border rounded-xl text-sm"
                  />
                  <input
                    type="number"
                    placeholder="Overtime rate"
                    value={formData.overtime_rate || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, overtime_rate: e.target.value ? parseFloat(e.target.value) : 0 })
                    }
                    className="px-4 py-2 bg-background border border-border rounded-xl text-sm"
                  />
                  <input
                    type="number"
                    placeholder="Security deposit"
                    value={formData.security_deposit || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, security_deposit: e.target.value ? parseFloat(e.target.value) : 0 })
                    }
                    className="px-4 py-2 bg-background border border-border rounded-xl text-sm"
                  />
                  <input
                    type="number"
                    placeholder="Sort order"
                    value={formData.sort_order || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, sort_order: e.target.value ? parseInt(e.target.value, 10) : 0 })
                    }
                    className="px-4 py-2 bg-background border border-border rounded-xl text-sm"
                  />
                </div>
              )}
            </div>
            <div className="p-6 border-t border-border flex justify-end gap-3">
              <button onClick={() => setShowAdvancedForm(false)} className="px-5 py-2 rounded-xl font-bold border border-border">
                Cancel
              </button>
              <button
                onClick={handleSaveAdvanced}
                disabled={saving}
                className="px-6 py-2 rounded-xl font-bold bg-primary text-white flex items-center gap-2 disabled:opacity-50"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                Save changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
