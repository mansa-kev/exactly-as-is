import React, { useState, useEffect } from 'react';
import { adminService } from '../../services/adminService';
import { 
  Image as ImageIcon, 
  Upload, 
  Trash2, 
  Save, 
  Loader2,
  Eye,
  Plus,
  X,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';

interface ImageSection {
  id: string;
  title: string;
  description: string;
  key: string;
  placeholder: string;
  dimensions?: string;
  category: 'cta' | 'about' | 'hero' | 'general';
}

const imageSections: ImageSection[] = [
  {
    id: 'homepage-cta',
    title: 'Homepage CTA Section',
    description: 'Main image for the homepage call-to-action section',
    key: 'homepage_cta_image',
    placeholder: 'https://picsum.photos/seed/luxury-car-rental-cta/1000/1000.jpg',
    dimensions: '1000x1000px (Square)',
    category: 'cta'
  },
  {
    id: 'about-hero',
    title: 'About Us Hero',
    description: 'Hero banner image for the About Us page',
    key: 'about_hero_image',
    placeholder: 'https://picsum.photos/seed/about-us-hero/1920/600.jpg',
    dimensions: '1920x600px (Banner)',
    category: 'about'
  },
  {
    id: 'about-team',
    title: 'About Us Team',
    description: 'Team photo or office image for About Us page',
    key: 'about_team_image',
    placeholder: 'https://picsum.photos/seed/about-team/800/500.jpg',
    dimensions: '800x500px (Landscape)',
    category: 'about'
  },
  {
    id: 'about-mission',
    title: 'About Us Mission',
    description: 'Mission statement image for About Us page',
    key: 'about_mission_image',
    placeholder: 'https://picsum.photos/seed/about-mission/600/400.jpg',
    dimensions: '600x400px (Landscape)',
    category: 'about'
  }
];

export function AdminImageManager() {
  const [images, setImages] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);

  useEffect(() => {
    fetchImages();
  }, []);

  const fetchImages = async () => {
    try {
      setLoading(true);
      const imageKeys = imageSections.map(section => section.key);
      
      // Fetch all image settings
      console.log('AdminImageManager - Fetching images for keys:', imageKeys);
      
      const { data, error } = await supabase
        .from('app_settings')
        .select('key, value')
        .in('key', imageKeys);

      console.log('AdminImageManager - Fetch result:', { data, error });

      if (error) throw error;

      const imageMap: Record<string, string> = {};
      data?.forEach(setting => {
        imageMap[setting.key] = setting.value;
      });

      setImages(imageMap);
    } catch (error) {
      console.error('Failed to fetch images:', error);
      toast.error('Failed to load images');
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (section: ImageSection, file: File) => {
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size must be less than 5MB');
      return;
    }

    setUploading(section.id);

    try {
      // Generate unique filename
      const timestamp = Date.now();
      const fileExtension = file.name.split('.').pop();
      const filename = `${section.key}-${timestamp}.${fileExtension}`;

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('public_assets')
        .upload(filename, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('public_assets')
        .getPublicUrl(filename);

      // Save to settings
      console.log('AdminImageManager - Saving to app_settings:', {
        key: section.key,
        value: publicUrl,
        updated_at: new Date().toISOString()
      });

      const { error: saveError, data: saveData } = await supabase
        .from('app_settings')
        .upsert({
          key: section.key,
          value: publicUrl,
          updated_at: new Date().toISOString()
        })
        .select();

      console.log('AdminImageManager - Save result:', { saveData, saveError });

      if (saveError) throw saveError;

      // Update local state
      setImages(prev => ({
        ...prev,
        [section.key]: publicUrl
      }));

      toast.success(`${section.title} image uploaded successfully`);
    } catch (error) {
      console.error('Upload failed:', error);
      toast.error('Failed to upload image');
    } finally {
      setUploading(null);
    }
  };

  const handleDeleteImage = async (section: ImageSection) => {
    if (!images[section.key]) return;

    try {
      // Extract filename from URL
      const url = images[section.key];
      const filename = url.split('/').pop();

      if (filename) {
        // Delete from storage
        const { error: deleteError } = await supabase.storage
          .from('public_assets')
          .remove([filename]);

        if (deleteError) throw deleteError;
      }

      // Remove from settings
      const { error: saveError } = await supabase
        .from('app_settings')
        .delete()
        .eq('key', section.key);

      if (saveError) throw saveError;

      // Update local state
      setImages(prev => {
        const newImages = { ...prev };
        delete newImages[section.key];
        return newImages;
      });

      toast.success(`${section.title} image removed`);
    } catch (error) {
      console.error('Delete failed:', error);
      toast.error('Failed to remove image');
    }
  };

  const handleDrop = (e: React.DragEvent, section: ImageSection) => {
    e.preventDefault();
    setDragOver(null);

    const files = Array.from(e.dataTransfer.files) as File[];
    const imageFile = files.find(file => file.type.startsWith('image/'));
    
    if (imageFile) {
      handleImageUpload(section, imageFile);
    }
  };

  const handleDragOver = (e: React.DragEvent, sectionId: string) => {
    e.preventDefault();
    setDragOver(sectionId);
  };

  const handleDragLeave = () => {
    setDragOver(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Image Management</h2>
          <p className="text-muted-foreground mt-1">
            Manage images for homepage CTA and About Us page sections
          </p>
        </div>
      </div>

      {/* CTA Images */}
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <ImageIcon className="w-5 h-5 text-primary" />
          Homepage CTA Images
        </h3>
        <div className="grid gap-6">
          {imageSections
            .filter(section => section.category === 'cta')
            .map(section => (
              <React.Fragment key={section.id}>
                <ImageCard
                  section={section}
                  currentImage={images[section.key]}
                  onUpload={handleImageUpload}
                  onDelete={handleDeleteImage}
                  onPreview={setPreviewImage}
                  uploading={uploading === section.id}
                  dragOver={dragOver === section.id}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                />
              </React.Fragment>
            ))}
        </div>
      </div>

      {/* About Us Images */}
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <ImageIcon className="w-5 h-5 text-primary" />
          About Us Page Images
        </h3>
        <div className="grid gap-6">
          {imageSections
            .filter(section => section.category === 'about')
            .map(section => (
              <React.Fragment key={section.id}>
                <ImageCard
                  section={section}
                  currentImage={images[section.key]}
                  onUpload={handleImageUpload}
                  onDelete={handleDeleteImage}
                  onPreview={setPreviewImage}
                  uploading={uploading === section.id}
                  dragOver={dragOver === section.id}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                />
              </React.Fragment>
            ))}
        </div>
      </div>

      {/* Image Preview Modal */}
      {previewImage && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-lg max-w-4xl max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="text-lg font-semibold">Image Preview</h3>
              <button
                onClick={() => setPreviewImage(null)}
                className="p-2 hover:bg-muted rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4">
              <img
                src={previewImage}
                alt="Preview"
                className="w-full h-auto max-h-[70vh] object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface ImageCardProps {
  section: ImageSection;
  currentImage: string | undefined;
  onUpload: (section: ImageSection, file: File) => Promise<void>;
  onDelete: (section: ImageSection) => Promise<void>;
  onPreview: (url: string) => void;
  uploading: boolean;
  dragOver: boolean;
  onDrop: (e: React.DragEvent, section: ImageSection) => void;
  onDragOver: (e: React.DragEvent, sectionId: string) => void;
  onDragLeave: () => void;
}

function ImageCard({
  section,
  currentImage,
  onUpload,
  onDelete,
  onPreview,
  uploading,
  dragOver,
  onDrop,
  onDragOver,
  onDragLeave
}: ImageCardProps) {
  const [fileInputRef, setFileInputRef] = useState<HTMLInputElement | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUpload(section, file);
    }
  };

  return (
    <div className="bg-card rounded-lg border border-border p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h4 className="font-semibold text-foreground">{section.title}</h4>
          <p className="text-sm text-muted-foreground mt-1">{section.description}</p>
          {section.dimensions && (
            <p className="text-xs text-muted-foreground mt-1">
              Recommended: {section.dimensions}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {currentImage && (
            <>
              <button
                onClick={() => onPreview(currentImage)}
                className="p-2 hover:bg-muted rounded-lg transition-colors"
                title="Preview image"
              >
                <Eye className="w-4 h-4" />
              </button>
              <button
                onClick={() => onDelete(section)}
                className="p-2 hover:bg-destructive/10 text-destructive rounded-lg transition-colors"
                title="Delete image"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>

      <div
        className={`
          relative border-2 border-dashed rounded-lg overflow-hidden transition-all
          ${dragOver ? 'border-primary bg-primary/5' : 'border-border'}
          ${currentImage ? 'border-solid' : ''}
        `}
        onDrop={(e) => onDrop(e, section)}
        onDragOver={(e) => onDragOver(e, section.id)}
        onDragLeave={onDragLeave}
      >
        {currentImage ? (
          <div className="relative aspect-video">
            <img
              src={currentImage}
              alt={section.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
              <button
                onClick={() => fileInputRef?.click()}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium flex items-center gap-2"
              >
                <Upload className="w-4 h-4" />
                Replace Image
              </button>
            </div>
          </div>
        ) : (
          <div className="aspect-video flex flex-col items-center justify-center p-8">
            <ImageIcon className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center mb-4">
              Drag and drop an image here, or click to browse
            </p>
            <button
              onClick={() => fileInputRef?.click()}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              Choose Image
            </button>
          </div>
        )}

        {uploading && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <span className="text-sm font-medium">Uploading...</span>
            </div>
          </div>
        )}
      </div>

      <input
        ref={setFileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      {currentImage && (
        <div className="mt-3 p-3 bg-muted/50 rounded-lg">
          <p className="text-xs text-muted-foreground font-mono break-all">
            {currentImage}
          </p>
        </div>
      )}
    </div>
  );
}
