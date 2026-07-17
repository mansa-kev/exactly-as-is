// @ts-nocheck
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Car } from '../../../types';
import { Upload, ArrowRight, ArrowLeft, User, Mail, Phone, FileText, CheckCircle2, Loader2, Camera, Image, ShieldCheck, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
// Removed react-dropzone for mobile stability
import { clientService } from '../../../services/clientService';
import { supabase } from '../../../lib/supabase';
import { InternationalPhoneInput } from '../../ui/InternationalPhoneInput';
import { toast } from 'sonner';
import { CameraCapture } from './CameraCapture';
import {
  type BookingDocType,
  resumePendingUpload,
  stashPendingFile,
  uploadBookingDocument,
} from '../../../services/bookingDocumentUploadService';
import { listPendingUploadsForCar } from '../../../utils/pendingUploadStore';
import { resolveDocumentPreviewUrl } from '../../../utils/documentPreviewUrl';

interface Step2Props {
  car: Car;
  onNext: (data: any) => void;
  onPrev: () => void;
  initialData?: any;
  uploadContextId?: string;
}

type DocType = BookingDocType;

type GloveboxDocuments = {
  idNumber?: string;
  facePhotoUrl?: string;
  licenseFrontUrl?: string;
  licenseBackUrl?: string;
  idFrontUrl?: string;
  idBackUrl?: string;
};

const DOC_LABELS: Record<DocType, string> = {
  facePhoto: 'Face Photo',
  licenseFront: 'License Front',
  licenseBack: 'License Back',
  idFront: 'ID Front',
  idBack: 'ID Back'
};

interface DocumentSlotProps {
  type: DocType;
  uploadedUrl: string;
  previewUrl?: string;
  isUploading: boolean;
  disablePicker: boolean;
  onUploadFile: (file: File, type: DocType) => void;
  onOpenCamera: (type: DocType) => void;
  onClear: (type: DocType) => void;
}

function DocumentSlot({ type, uploadedUrl, previewUrl, isUploading, disablePicker, onUploadFile, onOpenCamera, onClear }: DocumentSlotProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const openPicker = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disablePicker) return;
    // Reset before opening so picking the same filename twice still fires onChange
    if (fileInputRef.current) fileInputRef.current.value = '';
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Clear immediately so the same file can be re-selected later
    e.target.value = '';
    if (file) onUploadFile(file, type);
  };

  const isPdf = uploadedUrl && /\.pdf(\?|$)/i.test(uploadedUrl);
  const displaySrc = previewUrl || resolveDocumentPreviewUrl(uploadedUrl);

  return (
    <div className="space-y-2">
      <p className="text-[9px] font-black uppercase tracking-widest text-white/50 text-center">{DOC_LABELS[type]}</p>
      <div
        className={`relative p-3 border-2 border-dashed rounded-[16px] md:rounded-[20px] text-center transition-all overflow-hidden ${
          uploadedUrl ? 'border-green-500/50 bg-green-500/5'
          : 'border-white/10 hover:border-white/20'
        }`}
      >
        {/* Hidden input — outside the label, triggered programmatically so it never submits the form */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf"
          className="hidden"
          disabled={disablePicker}
          onChange={handleFileChange}
        />

        <AnimatePresence mode="wait">
          {isUploading ? (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="relative">
              {previewUrl ? (
                <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden bg-black/30">
                  <img src={previewUrl} alt={DOC_LABELS[type]} className="w-full h-full object-cover opacity-80" />
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/35">
                    <Loader2 className="animate-spin text-primary" size={20} />
                    <p className="text-[9px] font-black uppercase tracking-widest text-primary">Uploading...</p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1 py-3">
                  <Loader2 className="animate-spin text-primary" size={20} />
                  <p className="text-[9px] font-black uppercase tracking-widest text-primary">Uploading...</p>
                </div>
              )}
            </motion.div>
          ) : displaySrc ? (
            <motion.div key="success" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="relative">
              {isPdf ? (
                <div className="flex flex-col items-center gap-1 py-3">
                  <FileText className="text-green-500" size={24} />
                  <p className="text-[9px] font-black uppercase tracking-widest text-green-500">PDF Uploaded</p>
                </div>
              ) : (
                <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden bg-black/30">
                  <img src={displaySrc} alt={DOC_LABELS[type]} className="w-full h-full object-cover" />
                  <div className="absolute top-1 left-1 bg-green-500/90 rounded-full p-1">
                    <CheckCircle2 className="text-black" size={12} />
                  </div>
                </div>
              )}
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClear(type); }}
                className="absolute -top-1 -right-1 z-10 bg-red-500 hover:bg-red-600 text-white rounded-full p-1.5 shadow-lg transition-colors"
                aria-label={`Remove ${DOC_LABELS[type]}`}
              >
                <X size={12} strokeWidth={3} />
              </button>
            </motion.div>
          ) : (
            <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-2 py-1">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (disablePicker) return;
                    onOpenCamera(type);
                  }}
                  disabled={disablePicker}
                  className="flex items-center gap-1.5 px-3 py-2 bg-primary/10 rounded-xl text-primary hover:bg-primary/20 transition-colors active:scale-95"
                >
                  <Camera size={14} />
                  <span className="text-[9px] font-bold uppercase tracking-wider">Camera</span>
                </button>
                <button
                  type="button"
                  onClick={openPicker}
                  disabled={disablePicker}
                  className={`flex items-center gap-1.5 px-3 py-2 bg-white/5 rounded-xl text-white/70 hover:bg-white/10 transition-colors active:scale-95 ${disablePicker ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <Image size={14} />
                  <span className="text-[9px] font-bold uppercase tracking-wider">File</span>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export function Step2({ car, onNext, onPrev, initialData, uploadContextId }: Step2Props) {
  const contextId = uploadContextId || `car:${car.id}`;
  const [uploadingSlots, setUploadingSlots] = useState<Set<DocType>>(new Set());
  const [localPreviews, setLocalPreviews] = useState<Partial<Record<DocType, string>>>({});
  const localPreviewRef = useRef<Partial<Record<DocType, string>>>({});
  const [showCamera, setShowCamera] = useState<DocType | null>(null);
  const [prefilled, setPrefilled] = useState(false);
  const resumeLockRef = useRef(false);
  const [formData, setFormData] = useState(() => {
    const saved = sessionStorage.getItem(`step2_data_${contextId}`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return {
      fullName: '',
      email: '',
      phone: '',
      license: '',
      idNumber: '',
      poBox: '',
      facePhotoUrl: '',
      licenseFrontUrl: '',
      licenseBackUrl: '',
      idFrontUrl: '',
      idBackUrl: ''
    };
  });

  useEffect(() => {
    sessionStorage.setItem(`step2_data_${contextId}`, JSON.stringify(formData));
  }, [formData, contextId]);

  // Pre-fill from profile + glovebox for logged-in users
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const [profileRes, gloveboxRes] = await Promise.allSettled([
        supabase.from('user_profiles').select('full_name, email, phone_number, license_number, id_number, role').eq('id', user.id).single(),
        clientService.getGloveboxData(user.id),
      ]);
      const profile = profileRes.status === 'fulfilled' ? profileRes.value.data : null;
      const glovebox = gloveboxRes.status === 'fulfilled' ? gloveboxRes.value : null;

      // Skip autofilling profile info if the user is an admin or fleet owner testing the flow
      if (profile?.role === 'admin' || profile?.role === 'fleet_owner') {
        return;
      }

      const docs: GloveboxDocuments = glovebox?.documents || {};
      setFormData(prev => ({
        ...prev,
        fullName:       profile?.full_name    || prev.fullName,
        email:          profile?.email        || prev.email,
        phone:          profile?.phone_number || prev.phone,
        license:        profile?.license_number || prev.license,
        idNumber:       profile?.id_number    || docs.idNumber         || prev.idNumber,
        poBox:          prev.poBox,
        facePhotoUrl:   docs.facePhotoUrl     || prev.facePhotoUrl,
        licenseFrontUrl:docs.licenseFrontUrl  || prev.licenseFrontUrl,
        licenseBackUrl: docs.licenseBackUrl   || prev.licenseBackUrl,
        idFrontUrl:     docs.idFrontUrl       || prev.idFrontUrl,
        idBackUrl:      docs.idBackUrl        || prev.idBackUrl,
      }));
      if (profile?.full_name) setPrefilled(true);
    })();
  }, []);

  useEffect(() => {
    if (!initialData) return;

    setFormData(prev => ({
      ...prev,
      fullName: initialData.fullName || prev.fullName,
      email: initialData.email || prev.email,
      phone: initialData.phone || prev.phone,
      license: initialData.license || prev.license,
      idNumber: initialData.idNumber || prev.idNumber,
      poBox: initialData.poBox || prev.poBox,
      facePhotoUrl: initialData.facePhotoUrl || prev.facePhotoUrl,
      licenseFrontUrl: initialData.licenseFrontUrl || prev.licenseFrontUrl,
      licenseBackUrl: initialData.licenseBackUrl || prev.licenseBackUrl,
      idFrontUrl: initialData.idFrontUrl || prev.idFrontUrl,
      idBackUrl: initialData.idBackUrl || prev.idBackUrl,
    }));

    if (initialData.fullName || initialData.email || initialData.phone) {
      setPrefilled(true);
    }
  }, [initialData]);

  const markUploading = useCallback((type: DocType, active: boolean) => {
    setUploadingSlots((prev) => {
      const next = new Set(prev);
      if (active) next.add(type);
      else next.delete(type);
      return next;
    });
  }, []);

  const applyUploadedUrl = useCallback((type: DocType, url: string) => {
    setFormData((prev) => ({ ...prev, [`${type}Url`]: url }));
  }, []);

  const runUpload = useCallback(async (file: File, type: DocType) => {
    if (uploadingSlots.has(type)) return;

    const localPreview = URL.createObjectURL(file);
    localPreviewRef.current[type] = localPreview;
    setLocalPreviews((prev) => ({ ...prev, [type]: localPreview }));

    markUploading(type, true);
    try {
      await stashPendingFile(contextId, type, file);
      const url = await uploadBookingDocument(contextId, type, file);
      applyUploadedUrl(type, url);
      toast.success(`${DOC_LABELS[type]} uploaded successfully`);
    } catch (error) {
      toast.error(`Failed to upload: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      const preview = localPreviewRef.current[type];
      if (preview) {
        URL.revokeObjectURL(preview);
        delete localPreviewRef.current[type];
      }
      setLocalPreviews((prev) => {
        const next = { ...prev };
        delete next[type];
        return next;
      });
      markUploading(type, false);
    }
  }, [applyUploadedUrl, contextId, markUploading, uploadingSlots]);

  const uploadFile = useCallback(async (file: File, type: DocType) => {
    await runUpload(file, type);
  }, [runUpload]);

  const resumePendingUploads = useCallback(async () => {
    if (resumeLockRef.current) return;
    resumeLockRef.current = true;

    try {
      const pending = await listPendingUploadsForCar(contextId);
      for (const record of pending) {
        const type = record.docType as DocType;
        if (!DOC_LABELS[type]) continue;

        markUploading(type, true);
        try {
          const url = await resumePendingUpload(record);
          applyUploadedUrl(type, url);
          toast.success(`${DOC_LABELS[type]} uploaded (resumed after refresh)`);
        } catch (error) {
          console.warn('Pending upload resume failed:', error);
        } finally {
          markUploading(type, false);
        }
      }
    } finally {
      resumeLockRef.current = false;
    }
  }, [applyUploadedUrl, contextId, markUploading]);

  useEffect(() => {
    void resumePendingUploads();

    const onPageShow = () => {
      void resumePendingUploads();
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, [resumePendingUploads]);

  const clearDocument = useCallback((type: DocType) => {
    setFormData(prev => ({ ...prev, [`${type}Url`]: '' }));
  }, []);

  const handleCameraCapture = (file: File) => {
    if (showCamera) {
      uploadFile(file, showCamera);
    }
    setShowCamera(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const required: DocType[] = ['facePhoto', 'licenseFront', 'licenseBack', 'idFront', 'idBack'];
    const missing = required.filter(type => !formData[`${type}Url` as keyof typeof formData]);
    if (missing.length > 0) {
      toast.error(`Please upload: ${missing.map(t => DOC_LABELS[t]).join(', ')}`);
      return;
    }
    sessionStorage.removeItem('temp_step2_data');
    onNext({ ...formData, _fromGlovebox: prefilled });
  };

  return (
    <>
      {showCamera && (
        <CameraCapture
          onCapture={handleCameraCapture}
          onClose={() => setShowCamera(null)}
          defaultFacing={showCamera === 'facePhoto' ? 'user' : 'environment'}
        />
      )}
      <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6 md:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="space-y-1">
          <h3 className="text-xl sm:text-2xl md:text-3xl font-serif font-black italic text-foreground">Your Details</h3>
          <p className="text-muted-foreground text-xs sm:text-sm">Provide your information and verification documents.</p>
          {prefilled && (
            <div className="flex items-center gap-2 mt-2 px-3 py-2 bg-success/10 border border-success/20 rounded-xl">
              <ShieldCheck size={14} className="text-success shrink-0" />
              <p className="text-xs text-success font-medium">Pre-filled from your profile &amp; glovebox — review and continue.</p>
            </div>
          )}
        </div>

        <div className="space-y-3 sm:space-y-4 md:space-y-6">
          {/* Personal Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="group relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-primary transition-colors" size={18} />
              <input
                type="text" placeholder="Full Name" required
                value={formData.fullName || ''} onChange={(e) => setFormData({...formData, fullName: e.target.value})}
                className="w-full pl-12 pr-4 py-4 bg-card/50 border border-border rounded-[18px] text-sm text-foreground focus:ring-2 focus:ring-primary/20 outline-none transition-all hover:bg-card/70"
              />
            </div>
            <div className="group relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-primary transition-colors" size={18} />
              <input
                type="email" placeholder="Email Address" required
                value={formData.email || ''} onChange={(e) => setFormData({...formData, email: e.target.value})}
                className="w-full pl-12 pr-4 py-4 bg-card/50 border border-border rounded-[18px] text-sm text-foreground focus:ring-2 focus:ring-primary/20 outline-none transition-all hover:bg-card/70"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="group relative">
              <InternationalPhoneInput
                required
                value={formData.phone || ''}
                onChange={(val) => setFormData({...formData, phone: val})}
              />
            </div>
            <div className="group relative">
              <FileText className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-primary transition-colors" size={18} />
              <input
                type="text" placeholder="Driver's License No." required
                value={formData.license || ''} onChange={(e) => setFormData({...formData, license: e.target.value})}
                className="w-full pl-12 pr-4 py-4 bg-card/50 border border-border rounded-[18px] text-sm text-foreground focus:ring-2 focus:ring-primary/20 outline-none transition-all hover:bg-card/70"
              />
            </div>
          </div>

          <div className="group relative">
            <FileText className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-primary transition-colors" size={18} />
            <input
              type="text" placeholder="National ID / Passport Number" required
              value={formData.idNumber || ''} onChange={(e) => setFormData({...formData, idNumber: e.target.value})}
              className="w-full pl-12 pr-4 py-4 bg-card/50 border border-border rounded-[18px] text-sm text-foreground focus:ring-2 focus:ring-primary/20 outline-none transition-all hover:bg-card/70"
            />
          </div>

          <div className="group relative">
            <User className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-primary transition-colors" size={18} />
            <input
              type="text" placeholder="P.O. Box (Optional)"
              value={formData.poBox || ''} onChange={(e) => setFormData({...formData, poBox: e.target.value})}
              className="w-full pl-12 pr-4 py-4 bg-card/50 border border-border rounded-[18px] text-sm text-foreground focus:ring-2 focus:ring-primary/20 outline-none transition-all hover:bg-card/70"
            />
          </div>

          {/* Face Photo */}
          <div>
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-primary mb-3 block">Face Photo / Passport Photo</label>
            <div className="max-w-xs mx-auto">
              <DocumentSlot type="facePhoto" uploadedUrl={formData.facePhotoUrl} previewUrl={localPreviews.facePhoto} isUploading={uploadingSlots.has('facePhoto')} disablePicker={uploadingSlots.has('facePhoto')} onUploadFile={uploadFile} onOpenCamera={setShowCamera} onClear={clearDocument} />
            </div>
          </div>

          {/* License Documents */}
          <div>
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-primary mb-3 block">Driver's License</label>
            <div className="grid grid-cols-2 gap-3 md:gap-4">
              <DocumentSlot type="licenseFront" uploadedUrl={formData.licenseFrontUrl} previewUrl={localPreviews.licenseFront} isUploading={uploadingSlots.has('licenseFront')} disablePicker={uploadingSlots.has('licenseFront')} onUploadFile={uploadFile} onOpenCamera={setShowCamera} onClear={clearDocument} />
              <DocumentSlot type="licenseBack" uploadedUrl={formData.licenseBackUrl} previewUrl={localPreviews.licenseBack} isUploading={uploadingSlots.has('licenseBack')} disablePicker={uploadingSlots.has('licenseBack')} onUploadFile={uploadFile} onOpenCamera={setShowCamera} onClear={clearDocument} />
            </div>
          </div>

          {/* ID Documents */}
          <div>
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-primary mb-3 block">National ID / Passport</label>
            <div className="grid grid-cols-2 gap-3 md:gap-4">
              <DocumentSlot type="idFront" uploadedUrl={formData.idFrontUrl} previewUrl={localPreviews.idFront} isUploading={uploadingSlots.has('idFront')} disablePicker={uploadingSlots.has('idFront')} onUploadFile={uploadFile} onOpenCamera={setShowCamera} onClear={clearDocument} />
              <DocumentSlot type="idBack" uploadedUrl={formData.idBackUrl} previewUrl={localPreviews.idBack} isUploading={uploadingSlots.has('idBack')} disablePicker={uploadingSlots.has('idBack')} onUploadFile={uploadFile} onOpenCamera={setShowCamera} onClear={clearDocument} />
            </div>
          </div>
        </div>

        <div className="flex gap-2 sm:gap-3">
          <button
            type="button" onClick={onPrev}
            className="w-1/5 sm:w-1/4 py-3.5 sm:py-4 bg-card/50 rounded-[14px] sm:rounded-[20px] text-foreground font-black uppercase tracking-widest hover:bg-card/70 transition-all flex items-center justify-center border border-border"
          >
            <ArrowLeft size={18} />
          </button>
          <button
            type="submit"
            className="flex-1 py-3.5 sm:py-4 bg-primary rounded-[14px] sm:rounded-[20px] text-black font-black uppercase tracking-[0.15em] text-[11px] sm:text-sm flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-primary/20 group"
          >
            Continue to Sign contract
            <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </form>
    </>
  );
}