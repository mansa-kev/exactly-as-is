import React, { useState, useRef } from 'react';
import { Upload, X, Check, AlertCircle, Image as ImageIcon } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';
import { clearLogoCache } from '../shared/Logo';

export function AdminLogoManager() {
  const [currentLogo, setCurrentLogo] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    fetchCurrentLogo();
  }, []);

  const fetchCurrentLogo = async () => {
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('logo_url')
        .eq('key', 'site_logo')
        .single();

      if (data?.logo_url) {
        setCurrentLogo(data.logo_url);
      }
    } catch (error) {
      console.error('Error fetching current logo:', error);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Logo file must be less than 5MB');
        return;
      }

      if (!file.type.startsWith('image/')) {
        toast.error('Please select an image file');
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        setPreviewUrl(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadLogo = async (file: File) => {
    try {
      setUploading(true);

      // Upload to Supabase Storage
      const fileName = `logo-${Date.now()}.${file.name.split('.').pop()}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('public_assets')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('public_assets')
        .getPublicUrl(fileName);

      // Update app_settings
      const { error: updateError } = await supabase
        .from('app_settings')
        .upsert({
          key: 'site_logo',
          value: publicUrl,
          logo_url: publicUrl,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'key'
        });

      if (updateError) throw updateError;

      setCurrentLogo(publicUrl);
      setPreviewUrl(null);
      clearLogoCache(); // Clear cache to update all logo instances
      toast.success('Logo uploaded successfully!');
      
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Error uploading logo:', error);
      toast.error('Failed to upload logo');
    } finally {
      setUploading(false);
    }
  };

  const handleUpload = () => {
    const file = fileInputRef.current?.files?.[0];
    if (file) {
      uploadLogo(file);
    }
  };

  const handleRemoveLogo = async () => {
    try {
      // Remove from app_settings
      const { error } = await supabase
        .from('app_settings')
        .delete()
        .eq('key', 'site_logo');

      if (error) throw error;

      setCurrentLogo(null);
      setPreviewUrl(null);
      clearLogoCache(); // Clear cache to update all logo instances
      toast.success('Logo removed successfully');
    } catch (error) {
      console.error('Error removing logo:', error);
      toast.error('Failed to remove logo');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold mb-2">Logo Management</h3>
        <p className="text-sm text-muted-foreground">
          Upload a custom logo that will appear across all portals. Recommended size: 200x80px, max file size: 5MB.
        </p>
      </div>

      {/* Current Logo Display */}
      <div className="bg-card p-6 rounded-2xl border border-border">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-semibold">Current Logo</h4>
          {currentLogo && (
            <button
              onClick={handleRemoveLogo}
              className="text-sm text-destructive hover:text-destructive/80 flex items-center gap-1"
            >
              <X size={16} />
              Remove
            </button>
          )}
        </div>
        
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 bg-muted rounded-lg flex items-center justify-center overflow-hidden">
            {currentLogo ? (
              <img
                src={currentLogo}
                alt="Current Logo"
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="text-center">
                <ImageIcon size={24} className="mx-auto mb-1 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">No logo</span>
              </div>
            )}
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium">
              {currentLogo ? 'Custom Logo Active' : 'Using Default Logo'}
            </p>
            <p className="text-xs text-muted-foreground">
              {currentLogo ? 'Your custom logo is displayed across all portals' : 'Default geometric logo is used'}
            </p>
          </div>
        </div>
      </div>

      {/* Upload Section */}
      <div className="bg-card p-6 rounded-2xl border border-border">
        <h4 className="font-semibold mb-4">Upload New Logo</h4>
        
        {/* Preview */}
        {previewUrl && (
          <div className="mb-4">
            <p className="text-sm font-medium mb-2">Preview:</p>
            <div className="w-20 h-20 bg-muted rounded-lg overflow-hidden">
              <img
                src={previewUrl}
                alt="Logo Preview"
                className="w-full h-full object-contain"
              />
            </div>
          </div>
        )}

        {/* File Input */}
        <div className="space-y-4">
          <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
              id="logo-upload"
            />
            <label
              htmlFor="logo-upload"
              className="cursor-pointer flex flex-col items-center gap-2"
            >
              <Upload size={24} className="text-muted-foreground" />
              <span className="text-sm font-medium">
                {previewUrl ? 'Change selection' : 'Click to upload or drag and drop'}
              </span>
              <span className="text-xs text-muted-foreground">
                PNG, JPG, GIF up to 5MB
              </span>
            </label>
          </div>

          {/* Upload Button */}
          {previewUrl && (
            <div className="flex gap-2">
              <button
                onClick={handleUpload}
                disabled={uploading}
                className="flex-1 bg-primary text-primary-foreground px-4 py-2 rounded-lg font-medium disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {uploading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin"></div>
                    Uploading...
                  </>
                ) : (
                  <>
                    <Check size={16} />
                    Upload Logo
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  setPreviewUrl(null);
                  if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                  }
                }}
                className="px-4 py-2 border border-border rounded-lg font-medium hover:bg-muted"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-muted/30 p-4 rounded-lg">
        <div className="flex gap-2">
          <AlertCircle size={16} className="text-muted-foreground mt-0.5" />
          <div className="text-sm text-muted-foreground">
            <p className="font-medium text-foreground mb-1">Tips:</p>
            <ul className="space-y-1">
              <li>Use a high-resolution image for best quality</li>
              <li>Transparent PNG backgrounds work best</li>
              <li>Square or landscape orientation recommended</li>
              <li>Logo will be automatically resized to fit different areas</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
