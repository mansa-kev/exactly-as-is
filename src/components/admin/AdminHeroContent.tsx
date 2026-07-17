import React, { useState, useEffect, useCallback } from 'react';
import { adminService } from '../../services/adminService';
import { 
  Plus, 
  Search, 
  Image as ImageIcon, 
  Trash2, 
  Edit2, 
  Loader2,
  Eye,
  CheckCircle2,
  XCircle,
  GripVertical,
  Upload,
  Video,
  ExternalLink,
  ChevronDown,
  X
} from 'lucide-react';
import { toast } from 'sonner';
import { useDropzone } from 'react-dropzone';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { supabase } from '../../lib/supabase';

// --- Sortable Item Component ---

interface SortableItemProps {
  id: string;
  item: any;
  onDelete: (id: string) => Promise<void>;
  onToggleStatus: (id: string, currentStatus: boolean) => Promise<void>;
  onPreview: (item: any) => void;
  cars: any[];
}

function SortableRow({ id, item, onDelete, onToggleStatus, onPreview, cars }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    opacity: isDragging ? 0.5 : 1,
  };

  const associatedCar = cars.find(c => c.id === item.car_id);

  return (
    <tr 
      ref={setNodeRef} 
      style={style} 
      className={`hover:bg-muted/30 transition-colors group ${isDragging ? 'bg-muted shadow-lg' : ''}`}
    >
      <td className="px-6 py-4">
        <div className="flex items-center gap-3">
          <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded text-muted-foreground">
            <GripVertical size={18} />
          </button>
          <div className="w-16 h-10 rounded-lg bg-muted overflow-hidden border border-border flex items-center justify-center relative">
            {item.media_type === 'video' ? (
              <Video size={16} className="text-muted-foreground" />
            ) : (
              <img 
                src={item.media_url} 
                alt="Preview" 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            )}
          </div>
        </div>
      </td>
      <td className="px-6 py-4">
        <div className="flex flex-col">
          <span className="text-sm font-bold">{associatedCar ? `${associatedCar.make} ${associatedCar.model}` : 'None'}</span>
          <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">{item.media_type}</span>
        </div>
      </td>
      <td className="px-6 py-4">
        <p className="text-sm text-foreground line-clamp-1 max-w-[200px]">{item.overlay_text || '-'}</p>
      </td>
      <td className="px-6 py-4">
        {item.deep_link_url ? (
          <a href={item.deep_link_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
            Link <ExternalLink size={10} />
          </a>
        ) : (
          <span className="text-xs text-muted-foreground">-</span>
        )}
      </td>
      <td className="px-6 py-4">
        <button 
          onClick={() => onToggleStatus(item.id, item.is_active)}
          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border transition-all ${
            item.is_active 
              ? 'bg-success/10 text-success border-success/20 hover:bg-success/20' 
              : 'bg-muted text-muted-foreground border-border hover:bg-muted/80'
          }`}
        >
          {item.is_active ? 'Active' : 'Inactive'}
        </button>
      </td>
      <td className="px-6 py-4 text-right">
        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button 
            onClick={() => onPreview(item)}
            className="p-2 hover:bg-muted rounded-lg text-muted-foreground hover:text-primary transition-colors"
          >
            <Eye size={18} />
          </button>
          <button 
            onClick={() => onDelete(item.id)}
            className="p-2 hover:bg-muted rounded-lg text-muted-foreground hover:text-error transition-colors"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </td>
    </tr>
  );
}

// --- Main Component ---

export function AdminHeroContent() {
  const [content, setContent] = useState<any[]>([]);
  const [cars, setCars] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewItem, setPreviewItem] = useState<any>(null);
  
  const [formData, setFormData] = useState({
    car_id: '',
    media_url: '',
    media_type: 'image' as 'image' | 'video',
    overlay_text: '',
    deep_link_url: '',
    is_active: true
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const fetchData = async () => {
    setLoading(true);
    try {
      const [heroData, carsResult] = await Promise.all([
        adminService.getHeroContent(),
        adminService.getCars()
      ]);
      setContent(heroData || []);
      
      if (carsResult && 'data' in carsResult) {
        setCars(carsResult.data || []);
      } else if (Array.isArray(carsResult)) {
        setCars(carsResult);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `hero-content/${fileName}`;

      const { error: uploadError, data } = await supabase.storage
        .from('public_assets')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('public_assets')
        .getPublicUrl(filePath);

      setFormData(prev => ({
        ...prev,
        media_url: publicUrl,
        media_type: file.type.startsWith('video') ? 'video' : 'image'
      }));
    } catch (error: any) {
      console.error('Upload error:', error);
      const message = error.message || 'Failed to upload file';
      toast.error(`Upload error: ${message}`);
    } finally {
      setUploading(false);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.webp'],
      'video/*': ['.mp4', '.webm']
    },
    maxFiles: 1,
    multiple: false
  } as any);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.media_url) {
      toast.error('Please upload media first');
      return;
    }

    const promise = (async () => {
      const payload = {
        ...formData,
        car_id: formData.car_id === "" ? null : formData.car_id,
        display_order: content.length
      };
      await adminService.createHeroContent(payload);
      setIsAdding(false);
      setFormData({
        car_id: '',
        media_url: '',
        media_type: 'image',
        overlay_text: '',
        deep_link_url: '',
        is_active: true
      });
      fetchData();
    })();

    toast.promise(promise, {
      loading: 'Saving content...',
      success: 'Content saved successfully',
      error: 'Failed to create content'
    });
  };

  const handleDelete = async (id: string) => {
    const promise = (async () => {
      await adminService.deleteHeroContent(id);
      fetchData();
    })();

    toast.promise(promise, {
      loading: 'Deleting content...',
      success: 'Content deleted successfully',
      error: 'Failed to delete content'
    });
  };

  const handleToggleStatus = async (id: string, currentStatus: boolean) => {
    const promise = (async () => {
      await supabase
        .from('hero_content')
        .update({ is_active: !currentStatus })
        .eq('id', id);
      fetchData();
    })();

    toast.promise(promise, {
      loading: 'Updating status...',
      success: 'Status updated successfully',
      error: 'Failed to update status'
    });
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const activeId = active.id as string;
      const overId = over.id as string;
      
      const oldIndex = content.findIndex((item: any) => item.id === activeId);
      const newIndex = content.findIndex((item: any) => item.id === overId);

      const newOrder = arrayMove(content, oldIndex, newIndex);
      setContent(newOrder);

      // Update display_order in Supabase
      try {
        const updates = newOrder.map((item: any, index) => ({
          id: item.id,
          display_order: index
        }));

        for (const update of updates) {
          await supabase
            .from('hero_content')
            .update({ display_order: update.display_order })
            .eq('id', update.id);
        }
      } catch (error) {
        console.error('Failed to update order:', error);
      }
    }
  };

  if (loading && content.length === 0) {
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
          <h2 className="text-2xl font-bold">Hero Content Manager</h2>
          <p className="text-muted-foreground">Curate cinematic car content for the homepage carousel.</p>
        </div>
        <button 
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-2 px-6 py-2 bg-primary text-white rounded-xl font-bold hover:scale-105 transition-all shadow-lg shadow-primary/20"
        >
          <Plus size={20} />
          Add New Content
        </button>
      </div>

      {isAdding && (
        <div className="bg-card p-8 rounded-2xl border border-border shadow-xl animate-in slide-in-from-top duration-300">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-lg">Upload Hero Content</h3>
            <button onClick={() => setIsAdding(false)} className="p-2 hover:bg-muted rounded-full transition-colors">
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleCreate} className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div 
                {...getRootProps()} 
                className={`border-2 border-dashed rounded-2xl p-12 text-center transition-all cursor-pointer ${
                  isDragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                }`}
              >
                <input {...getInputProps()} />
                {uploading ? (
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="animate-spin text-primary" size={32} />
                    <p className="text-sm font-bold">Uploading media...</p>
                  </div>
                ) : formData.media_url ? (
                  <div className="relative group">
                    {formData.media_type === 'video' ? (
                      <div className="flex flex-col items-center gap-2">
                        <Video size={48} className="text-primary" />
                        <p className="text-sm font-bold">Video Uploaded</p>
                      </div>
                    ) : (
                      <img src={formData.media_url} alt="Uploaded" className="max-h-48 mx-auto rounded-lg shadow-md" />
                    )}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center rounded-lg transition-opacity">
                      <p className="text-white text-xs font-bold">Click to replace</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <div className="p-4 bg-primary/10 text-primary rounded-2xl">
                      <Upload size={32} />
                    </div>
                    <div>
                      <p className="font-bold">Drag & drop media here</p>
                      <p className="text-xs text-muted-foreground mt-1">Supports high-res images and MP4/WebM videos</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Associated Car</label>
                  <select 
                    value={formData.car_id}
                    onChange={e => setFormData({...formData, car_id: e.target.value})}
                    className="w-full px-4 py-2 bg-muted border-none rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="">Select a car model...</option>
                    {cars.map(car => (
                      <option key={car.id} value={car.id}>{car.make} {car.model} ({car.license_plate})</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Status</label>
                  <div className="flex items-center gap-4 h-10">
                    <button 
                      type="button"
                      onClick={() => setFormData({...formData, is_active: !formData.is_active})}
                      className={`flex items-center gap-2 px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        formData.is_active ? 'bg-success text-white' : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {formData.is_active ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                      {formData.is_active ? 'Active' : 'Inactive'}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Overlay Text (Optional)</label>
                <textarea 
                  value={formData.overlay_text}
                  onChange={e => setFormData({...formData, overlay_text: e.target.value})}
                  placeholder="e.g. Experience the thrill of the open road in our latest Ferrari..."
                  className="w-full px-4 py-3 bg-muted border-none rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20 h-32 resize-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Deep Link URL (Optional)</label>
                <input 
                  type="text"
                  value={formData.deep_link_url}
                  onChange={e => setFormData({...formData, deep_link_url: e.target.value})}
                  placeholder="e.g. /cars/ferrari-488"
                  className="w-full px-4 py-2 bg-muted border-none rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="flex items-center gap-3 pt-4">
                <button 
                  type="submit" 
                  disabled={uploading || !formData.media_url}
                  className="flex-1 py-3 bg-primary text-white rounded-xl font-bold hover:scale-[1.02] transition-transform shadow-lg shadow-primary/20 disabled:opacity-50"
                >
                  Save Content
                </button>
                <button 
                  type="button" 
                  onClick={() => setIsAdding(false)}
                  className="px-8 py-3 bg-muted text-foreground rounded-xl font-bold hover:bg-muted/80 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="p-6 border-b border-border flex items-center justify-between">
          <h3 className="font-bold text-lg">Content List</h3>
          <p className="text-xs text-muted-foreground">Drag rows to reorder display sequence</p>
        </div>

        <div className="overflow-x-auto">
          <DndContext 
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground w-20">Order</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Car Model</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Overlay Text</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Deep Link</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Status</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                <SortableContext 
                  items={content.map(c => c.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {content.map((item) => {
                    const rowProps: any = {
                      key: item.id,
                      id: item.id,
                      item: item,
                      onDelete: handleDelete,
                      onToggleStatus: handleToggleStatus,
                      onPreview: setPreviewItem,
                      cars: cars
                    };
                    return <SortableRow {...rowProps} />;
                  })}
                </SortableContext>
                {content.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                      No hero content found. Click "Add New Content" to get started.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </DndContext>
        </div>
      </div>

      {/* Preview Modal */}
      {previewItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 animate-in fade-in duration-300">
          <div className="relative w-full max-w-5xl aspect-video bg-black rounded-3xl overflow-hidden shadow-2xl">
            <button 
              onClick={() => setPreviewItem(null)}
              className="absolute top-6 right-6 z-10 p-2 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-md transition-all"
            >
              <X size={24} />
            </button>
            
            {previewItem.media_type === 'video' ? (
              <video 
                src={previewItem.media_url} 
                className="w-full h-full object-cover"
                autoPlay 
                loop 
                muted 
                controls
              />
            ) : (
              <img 
                src={previewItem.media_url} 
                alt="Preview" 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            )}

            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex flex-col justify-end p-12">
              <div className="max-w-2xl space-y-4">
                <h2 className="text-4xl font-bold text-white leading-tight">
                  {previewItem.overlay_text || 'Experience Luxury on Wheels'}
                </h2>
                <div className="flex items-center gap-4">
                  <button className="px-8 py-3 bg-primary text-white rounded-xl font-bold">
                    Book Now
                  </button>
                  <button className="px-8 py-3 bg-white/10 text-white rounded-xl font-bold backdrop-blur-md">
                    Learn More
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
