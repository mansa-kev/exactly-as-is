import React, { useState, useEffect } from 'react';
import { X, Upload, Save } from 'lucide-react';

interface AddEditCarModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (carData: any) => void;
  car?: any;
}

export function AddEditCarModal({ isOpen, onClose, onSave, car }: AddEditCarModalProps) {
  const [formData, setFormData] = useState({
    make: '',
    model: '',
    year: new Date().getFullYear(),
    license_plate: '',
    color: '',
    transmission: 'automatic',
    fuel_type: 'petrol',
    category: 'sedan',
    seats: 5,
    daily_rate: '',
    overtime_rate: '',
    security_deposit: '',
    description: '',
    features: [] as string[],
    primary_image_url: '',
    video_url: '',
    maintenance_status: 'ok',
    next_service_date: '',
    photos: [] as string[],
  });

  const [primaryImageFile, setPrimaryImageFile] = useState<File | null>(null);
  const [galleryFiles, setGalleryFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (car) {
      setFormData({
        make: car.make || '',
        model: car.model || '',
        year: car.year || new Date().getFullYear(),
        license_plate: car.license_plate || '',
        color: car.color || '',
        transmission: car.transmission || 'automatic',
        fuel_type: car.fuel_type || 'petrol',
        category: car.category || 'sedan',
        seats: car.seats || 5,
        daily_rate: car.daily_rate?.toString() || '',
        overtime_rate: car.overtime_rate?.toString() || '',
        security_deposit: car.security_deposit?.toString() || '',
        description: car.description || '',
        features: car.features || [],
        primary_image_url: car.primary_image_url || '',
        video_url: car.video_url || '',
        maintenance_status: car.maintenance_status || 'ok',
        next_service_date: car.next_service_date || '',
        photos: car.photos || [],
      });
    } else {
      setFormData({
        make: '',
        model: '',
        year: new Date().getFullYear(),
        license_plate: '',
        color: '',
        transmission: 'automatic',
        fuel_type: 'petrol',
        category: 'sedan',
        seats: 5,
        daily_rate: '',
        overtime_rate: '',
        security_deposit: '',
        description: '',
        features: [],
        primary_image_url: '',
        video_url: '',
        maintenance_status: 'ok',
        next_service_date: '',
        photos: [],
      });
    }
  }, [car, isOpen]);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handlePrimaryImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setPrimaryImageFile(e.target.files[0]);
      setFormData(prev => ({ ...prev, primary_image_url: URL.createObjectURL(e.target.files![0]) }));
    }
  };

  const handleGalleryImagesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      setGalleryFiles(prev => [...prev, ...filesArray]);
      const newUrls = filesArray.map(f => URL.createObjectURL(f as Blob));
      setFormData(prev => ({ ...prev, photos: [...(prev.photos || []), ...newUrls] }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUploading(true);
    try {
      // In a real app, you'd upload files here and get URLs.
      // For now, we'll assume the onSave handles the upload or uses the local URLs.
      onSave({
        ...formData,
        year: parseInt(formData.year.toString()),
        seats: parseInt(formData.seats.toString()),
        daily_rate: parseFloat(formData.daily_rate),
        overtime_rate: parseFloat(formData.overtime_rate) || 0,
        security_deposit: parseFloat(formData.security_deposit) || 0,
        primaryImageFile,
        galleryFiles,
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card w-full max-w-3xl rounded-2xl shadow-xl border border-border overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-border flex justify-between items-center sticky top-0 bg-card z-10">
          <h2 className="text-xl font-bold">{car ? 'Edit Car Details' : 'Add New Car'}</h2>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto flex-1">
          <form id="car-form" onSubmit={handleSubmit} className="space-y-6">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-muted-foreground">Make</label>
                <input required name="make" value={formData.make} onChange={handleChange} className="w-full p-3 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary/20 outline-none" placeholder="e.g., Toyota" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-muted-foreground">Model</label>
                <input required name="model" value={formData.model} onChange={handleChange} className="w-full p-3 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary/20 outline-none" placeholder="e.g., Camry" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-muted-foreground">Year</label>
                <input required type="number" name="year" value={formData.year} onChange={handleChange} className="w-full p-3 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary/20 outline-none" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-muted-foreground">License Plate</label>
                <input required name="license_plate" value={formData.license_plate} onChange={handleChange} className="w-full p-3 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary/20 outline-none" placeholder="e.g., KCA 123A" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-muted-foreground">Color</label>
                <input name="color" value={formData.color} onChange={handleChange} className="w-full p-3 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary/20 outline-none" placeholder="e.g., Silver" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-muted-foreground">Category</label>
                <select name="category" value={formData.category} onChange={handleChange} className="w-full p-3 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary/20 outline-none">
                  <option value="sedan">Sedan</option>
                  <option value="suv">SUV</option>
                  <option value="hatchback">Hatchback</option>
                  <option value="luxury">Luxury</option>
                  <option value="van">Van</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-muted-foreground">Seats</label>
                <input required type="number" name="seats" value={formData.seats} onChange={handleChange} className="w-full p-3 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary/20 outline-none" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-muted-foreground">Transmission</label>
                <select name="transmission" value={formData.transmission} onChange={handleChange} className="w-full p-3 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary/20 outline-none">
                  <option value="automatic">Automatic</option>
                  <option value="manual">Manual</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-muted-foreground">Fuel Type</label>
                <select name="fuel_type" value={formData.fuel_type} onChange={handleChange} className="w-full p-3 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary/20 outline-none">
                  <option value="petrol">Petrol</option>
                  <option value="diesel">Diesel</option>
                  <option value="electric">Electric</option>
                  <option value="hybrid">Hybrid</option>
                </select>
              </div>
            </div>

            <div className="border-t border-border pt-6">
              <h3 className="text-lg font-bold mb-4">Pricing</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-muted-foreground">Daily Rate (Ksh)</label>
                  <input required type="number" name="daily_rate" value={formData.daily_rate} onChange={handleChange} className="w-full p-3 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary/20 outline-none" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-muted-foreground">Overtime Rate/Hr (Ksh)</label>
                  <input type="number" name="overtime_rate" value={formData.overtime_rate} onChange={handleChange} className="w-full p-3 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary/20 outline-none" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-muted-foreground">Security Deposit (Ksh)</label>
                  <input type="number" name="security_deposit" value={formData.security_deposit} onChange={handleChange} className="w-full p-3 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary/20 outline-none" />
                </div>
              </div>
            </div>

            <div className="border-t border-border pt-6">
              <h3 className="text-lg font-bold mb-4">Description, Media & Maintenance</h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-muted-foreground">Description</label>
                  <textarea name="description" value={formData.description} onChange={handleChange} rows={4} className="w-full p-3 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary/20 outline-none" placeholder="Describe the car's condition, features, and any rules..."></textarea>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-muted-foreground">Primary Hero Image</label>
                    <input type="file" accept="image/*" onChange={handlePrimaryImageChange} className="w-full p-3 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary/20 outline-none" />
                    {formData.primary_image_url && (
                      <img src={formData.primary_image_url} alt="Preview" className="h-32 w-48 object-cover rounded-xl mt-2 border border-border" />
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-muted-foreground">Carousel Images</label>
                    <input type="file" accept="image/*" multiple onChange={handleGalleryImagesChange} className="w-full p-3 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary/20 outline-none" />
                    <div className="flex flex-wrap gap-2 mt-2">
                      {formData.photos?.map((url, index) => (
                        <img key={index} src={url} alt={`Carousel ${index}`} className="h-20 w-20 object-cover rounded-lg border border-border" />
                      ))}
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-muted-foreground">Video URL (Optional)</label>
                  <input name="video_url" value={formData.video_url} onChange={handleChange} className="w-full p-3 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary/20 outline-none" placeholder="https://youtube.com/..." />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-muted-foreground">Maintenance Status</label>
                    <select name="maintenance_status" value={formData.maintenance_status} onChange={handleChange} className="w-full p-3 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary/20 outline-none">
                      <option value="ok">OK</option>
                      <option value="due">Due</option>
                      <option value="in_progress">In Progress</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-muted-foreground">Next Service Date</label>
                    <input type="date" name="next_service_date" value={formData.next_service_date} onChange={handleChange} className="w-full p-3 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary/20 outline-none" />
                  </div>
                </div>
              </div>
            </div>

          </form>
        </div>
        
        <div className="p-6 border-t border-border bg-muted/30 flex justify-end gap-4 sticky bottom-0">
          <button onClick={onClose} className="px-6 py-2 rounded-xl font-bold hover:bg-muted transition-colors">
            Cancel
          </button>
          <button type="submit" form="car-form" className="px-6 py-2 bg-primary text-white rounded-xl font-bold flex items-center gap-2 hover:bg-primary/90 transition-colors">
            <Save size={16} /> {car ? 'Save Changes' : 'Add Car'}
          </button>
        </div>
      </div>
    </div>
  );
}
