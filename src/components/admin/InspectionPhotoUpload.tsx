import React, { useRef, useState } from 'react';
import { Camera, Image as ImageIcon, Loader2, AlertTriangle, X } from 'lucide-react';
import { uploadInspectionPhoto } from '../../services/inspectionUploadService';
import { logger } from '../../utils/logger';
import { toast } from 'sonner';

interface Props {
  bookingId: string;
  label: string;
  images: string | string[];
  onChange: (value: string | string[]) => void;
  multi?: boolean;
  sectionKey: string;
  subfolder: 'photos' | 'fuel' | 'exterior' | 'interior';
}

export function InspectionPhotoUpload({
  bookingId,
  label,
  images,
  onChange,
  multi = false,
  sectionKey,
  subfolder,
}: Props) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const inputResetKey = useRef(0);

  const hasImages = multi ? (images as string[]).length > 0 : Boolean(images);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setUploadError(null);

    try {
      const urls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const url = await uploadInspectionPhoto(bookingId, files[i], subfolder);
        urls.push(url);
      }

      if (multi) {
        onChange([...(images as string[]), ...urls]);
      } else {
        onChange(urls[0]);
      }

      toast.success(urls.length > 1 ? `${urls.length} photos uploaded` : 'Photo uploaded');
    } catch (err: any) {
      const message = err?.message || 'Failed to upload image';
      logger.error('Upload error:', err);
      setUploadError(message);
      toast.error(message);
    } finally {
      setUploading(false);
      inputResetKey.current += 1;
      e.target.value = '';
    }
  };

  const removeAt = (index: number) => {
    if (!multi) {
      onChange('');
      return;
    }
    onChange((images as string[]).filter((_, i) => i !== index));
  };

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground uppercase tracking-wide">{label}</span>
        <label
          className={`cursor-pointer bg-primary/10 hover:bg-primary/20 text-primary px-3 py-1 rounded-full text-[10px] font-bold flex items-center gap-1 transition-colors ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
        >
          {uploading ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} />}
          {uploading ? 'Uploading…' : multi ? 'Add Photos' : 'Add Photo'}
          <input
            key={`${sectionKey}-${inputResetKey.current}`}
            type="file"
            multiple={multi}
            accept="image/*"
            className="hidden"
            onChange={handleFileUpload}
            disabled={uploading}
          />
        </label>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
        {!multi && images ? (
          <div className="relative w-24 h-24 shrink-0 rounded-xl border border-border overflow-hidden">
            <img src={images as string} alt={label} className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={() => onChange('')}
              className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1"
            >
              <X size={10} />
            </button>
          </div>
        ) : multi ? (
          (images as string[]).map((img, i) => (
            <div key={`${img}-${i}`} className="relative w-24 h-24 shrink-0 rounded-xl border border-border overflow-hidden">
              <img src={img} alt={`${label} ${i + 1}`} className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => removeAt(i)}
                className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1"
              >
                <X size={10} />
              </button>
            </div>
          ))
        ) : null}

        {!hasImages && (
          <div
            className={`w-full min-h-24 border-2 border-dashed rounded-xl flex flex-col items-center justify-center px-3 py-4 ${
              uploadError ? 'border-error/50 bg-error/5 text-error' : 'border-border text-muted-foreground bg-muted/20'
            }`}
          >
            {uploading ? (
              <>
                <Loader2 size={20} className="mb-1 animate-spin" />
                <span className="text-[10px]">Uploading photo…</span>
              </>
            ) : uploadError ? (
              <>
                <AlertTriangle size={20} className="mb-1" />
                <span className="text-[10px] text-center">{uploadError}</span>
              </>
            ) : (
              <>
                <ImageIcon size={20} className="mb-1 opacity-50" />
                <span className="text-[10px]">No photos yet — tap Add Photo</span>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
