import React, { useState, useEffect, useRef } from 'react';
import {
  Camera,
  Upload,
  ShieldAlert,
  ArrowRight,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  X,
  MapPin,
  PenTool,
  Info
} from 'lucide-react';
import { toast } from 'sonner';
import { uploadInspectionPhoto } from '../../services/inspectionUploadService';
import { CameraCapture } from '../public/BookingFlow/CameraCapture';
import { resolveDocumentPreviewUrl } from '../../utils/documentPreviewUrl';
import {
  submitBookingPickup,
  submitBookingReturn,
} from '../../services/bookingLifecycleClientService';

interface DriverInspectionFormProps {
  booking: any;
  type: 'pre_handover' | 'post_return';
  onBack: () => void;
}

type Step = 'details' | 'photos' | 'signature';

export function DriverInspectionForm({ booking, type, onBack }: DriverInspectionFormProps) {
  const [currentStep, setCurrentStep] = useState<Step>('details');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);

  // Form State
  const [mileage, setMileage] = useState('');
  const [fuelLevel, setFuelLevel] = useState('full');
  const [scratchesNotes, setScratchesNotes] = useState('');
  
  // Photo URLs
  const [photoFuelMileage, setPhotoFuelMileage] = useState('');
  const [photosExterior, setPhotosExterior] = useState<string[]>([]);
  const [photosInterior, setPhotosInterior] = useState<string[]>([]);

  // Geolocation
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [fetchingGps, setFetchingGps] = useState(false);

  // Signature state
  const [agreed, setAgreed] = useState(false);
  const signatureRef = useRef<HTMLCanvasElement>(null);

  // Fetch coordinates on mount
  useEffect(() => {
    const fetchCoords = async () => {
      if (!navigator.geolocation) {
        toast.error('Geolocation is not supported by your browser');
        return;
      }
      setFetchingGps(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setGpsCoords({
            lat: position.coords.latitude,
            lon: position.coords.longitude
          });
          setFetchingGps(false);
        },
        (error) => {
          console.error('Error fetching GPS coords:', error);
          toast.warning('Unable to fetch precise location. Handover coordinates may not be captured.');
          setFetchingGps(false);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    };

    fetchCoords();
  }, []);

  // Signature drawing canvas listeners
  useEffect(() => {
    if (currentStep === 'signature' && signatureRef.current) {
      const canvas = signatureRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3;

      let drawing = false;

      const getPos = (e: MouseEvent | TouchEvent) => {
        const rect = canvas.getBoundingClientRect();
        if (e instanceof MouseEvent) {
          return { x: e.clientX - rect.left, y: e.clientY - rect.top };
        } else {
          return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
        }
      };

      const startDrawing = (e: MouseEvent | TouchEvent) => {
        drawing = true;
        const pos = getPos(e);
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
      };

      const draw = (e: MouseEvent | TouchEvent) => {
        if (!drawing) return;
        e.preventDefault();
        const pos = getPos(e);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
      };

      const stopDrawing = () => {
        drawing = false;
      };

      canvas.addEventListener('mousedown', startDrawing);
      canvas.addEventListener('mousemove', draw);
      canvas.addEventListener('mouseup', stopDrawing);

      canvas.addEventListener('touchstart', startDrawing, { passive: false });
      canvas.addEventListener('touchmove', draw, { passive: false });
      canvas.addEventListener('touchend', stopDrawing);

      return () => {
        canvas.removeEventListener('mousedown', startDrawing);
        canvas.removeEventListener('mousemove', draw);
        canvas.removeEventListener('mouseup', stopDrawing);

        canvas.removeEventListener('touchstart', startDrawing);
        canvas.removeEventListener('touchmove', draw);
        canvas.removeEventListener('touchend', stopDrawing);
      };
    }
  }, [currentStep]);

  const clearSignature = () => {
    const canvas = signatureRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>, target: 'fuel' | 'exterior' | 'interior') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const localPreview = URL.createObjectURL(file);
    if (target === 'fuel') {
      setPhotoFuelMileage(localPreview);
    }
    setUploading(target);
    try {
      const subfolder = target === 'fuel' ? 'fuel' : target;
      const url = await uploadInspectionPhoto(booking.id, file, subfolder);
      const displayUrl = resolveDocumentPreviewUrl(url, true) || url;

      if (target === 'fuel') {
        setPhotoFuelMileage(displayUrl);
      } else if (target === 'exterior') {
        setPhotosExterior(prev => [...prev, displayUrl]);
      } else {
        setPhotosInterior(prev => [...prev, displayUrl]);
      }
      toast.success('Photo uploaded successfully');
    } catch (err: any) {
      console.error(err);
      toast.error('Upload failed: ' + (err.message || err));
    } finally {
      URL.revokeObjectURL(localPreview);
      setUploading(null);
      e.target.value = '';
    }
  };

  const handleDetailsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mileage || !photoFuelMileage) {
      toast.error('Please record the odometer reading and upload dashboard proof photo.');
      return;
    }
    setCurrentStep('photos');
  };

  const handlePhotosSubmit = () => {
    if (photosExterior.length === 0 || photosInterior.length === 0) {
      toast.error('Please upload at least one exterior and one interior photo.');
      return;
    }
    setCurrentStep('signature');
  };

  const handleSubmitAll = async () => {
    if (!agreed) {
      toast.error('Client must agree to rental inspection parameters.');
      return;
    }

    const canvas = signatureRef.current;

    setLoading(true);
    try {
      // Upload signature via canvas.toBlob (fetch(data:...) is blocked by CSP connect-src)
      let clientSignatureStorageUrl = '';
      if (canvas) {
        const signatureBlob = await new Promise<Blob | null>((resolve) => {
          canvas.toBlob((blob) => resolve(blob), 'image/png');
        });
        if (signatureBlob) {
          const signatureFile = new File([signatureBlob], 'signature.png', { type: 'image/png' });
          clientSignatureStorageUrl = await uploadInspectionPhoto(booking.id, signatureFile, 'photos');
        }
      }

      const payload = {
        fuel_level: fuelLevel,
        mileage: parseInt(mileage, 10),
        location: booking.pickup_location || 'Field Delivery',
        scratches_notes: scratchesNotes,
        photos_exterior: photosExterior,
        photos_interior: photosInterior,
        photo_fuel_mileage: photoFuelMileage,
        gps_lat: gpsCoords?.lat ?? null,
        gps_lon: gpsCoords?.lon ?? null,
        client_signature_url: clientSignatureStorageUrl || null,
      };

      if (type === 'pre_handover') {
        await submitBookingPickup(booking.id, payload);
      } else {
        await submitBookingReturn(booking.id, payload);
      }

      toast.success(`${type === 'pre_handover' ? 'Handover completed successfully!' : 'Car returned successfully!'}`);
      onBack();
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to submit inspection checklist: ' + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-6 md:p-8 animate-in slide-in-from-right-4 duration-300">
      {/* Header */}
      <div className="border-b border-border pb-4 mb-6 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-black flex items-center gap-2">
            <Camera className="text-primary" /> {type === 'pre_handover' ? 'Pre-Handover Checklist' : 'Post-Return Checkout'}
          </h2>
          <p className="text-xs text-muted-foreground mt-1">Booking: {booking.cars?.make} {booking.cars?.model} ({booking.cars?.license_plate})</p>
        </div>
        <button onClick={onBack} className="text-xs font-bold text-muted-foreground hover:text-foreground">Cancel</button>
      </div>

      {/* Progress Indicators */}
      <div className="flex gap-2 mb-6">
        {(['details', 'photos', 'signature'] as Step[]).map((step, idx) => (
          <div
            key={step}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              currentStep === step ? 'bg-primary' : idx < ['details', 'photos', 'signature'].indexOf(currentStep) ? 'bg-primary/50' : 'bg-muted'
            }`}
          />
        ))}
      </div>

      {/* Form Steps */}
      {currentStep === 'details' && (
        <form onSubmit={handleDetailsSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">Odometer Mileage (KM) *</label>
                <input
                  type="number"
                  required
                  placeholder="e.g. 45230"
                  value={mileage}
                  onChange={e => setMileage(e.target.value)}
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary transition-colors"
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">Fuel Level *</label>
                <select
                  value={fuelLevel}
                  onChange={e => setFuelLevel(e.target.value)}
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary transition-colors"
                >
                  <option value="full">Full (1/1)</option>
                  <option value="7/8">7/8 Fuel</option>
                  <option value="3/4">3/4 Fuel</option>
                  <option value="1/2">1/2 Fuel</option>
                  <option value="1/4">1/4 Fuel</option>
                  <option value="empty">Empty (Reserve)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">Condition/Scratches Notes</label>
                <textarea
                  placeholder="Record any visual scratches, dents, clean status..."
                  value={scratchesNotes}
                  onChange={e => setScratchesNotes(e.target.value)}
                  rows={4}
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary transition-colors"
                />
              </div>
            </div>

            <div className="space-y-4">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">Dashboard Photo Proof (Odometer/Fuel) *</label>
              
              {photoFuelMileage ? (
                <div className="relative border border-border rounded-xl overflow-hidden bg-muted/20">
                  <img src={resolveDocumentPreviewUrl(photoFuelMileage, true) || photoFuelMileage} alt="Odometer Proof" className="w-full h-48 object-cover" />
                  <button
                    type="button"
                    onClick={() => setPhotoFuelMileage('')}
                    className="absolute top-2 right-2 p-1.5 bg-black/60 text-white rounded-lg hover:bg-black/80 transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <label className="border-2 border-dashed border-border rounded-2xl h-48 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-muted/10 transition-colors">
                  {uploading === 'fuel' ? (
                    <Loader2 className="animate-spin text-primary" size={24} />
                  ) : (
                    <>
                      <Camera className="text-muted-foreground" size={32} />
                      <span className="text-xs font-bold text-muted-foreground">Take Dashboard Photo</span>
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={e => handleUploadFile(e, 'fuel')}
                  />
                </label>
              )}

              {gpsCoords ? (
                <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded-xl p-3 flex items-center gap-2 text-xs font-bold">
                  <MapPin size={14} />
                  <span>GPS Location Logged ({gpsCoords.lat.toFixed(4)}, {gpsCoords.lon.toFixed(4)})</span>
                </div>
              ) : (
                <div className="bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-xl p-3 flex items-center gap-2 text-xs font-bold">
                  {fetchingGps ? (
                    <>
                      <Loader2 className="animate-spin" size={14} />
                      <span>Fetching precise Geolocation coordinates...</span>
                    </>
                  ) : (
                    <>
                      <ShieldAlert size={14} />
                      <span>GPS location unavailable. Please grant browser permissions.</span>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-border">
            <button
              type="submit"
              className="px-6 py-3 bg-primary text-primary-foreground font-black uppercase tracking-wider rounded-xl flex items-center gap-2 hover:bg-primary/90 transition-colors"
            >
              Continue to Photos <ArrowRight size={16} />
            </button>
          </div>
        </form>
      )}

      {currentStep === 'photos' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Exterior Photos */}
            <div className="space-y-3">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">Exterior Walk-around Photos (At least 1) *</label>
              <div className="grid grid-cols-2 gap-2">
                {photosExterior.map((url, idx) => (
                  <div key={idx} className="relative border border-border rounded-lg overflow-hidden h-24 bg-muted/20">
                    <img src={resolveDocumentPreviewUrl(url, true) || url} alt={`Exterior ${idx}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setPhotosExterior(prev => prev.filter((_, i) => i !== idx))}
                      className="absolute top-1.5 right-1.5 p-1 bg-black/60 text-white rounded-md hover:bg-black/80 transition-colors"
                    >
                      <X size={10} />
                    </button>
                  </div>
                ))}
                
                <label className="border-2 border-dashed border-border rounded-lg h-24 flex flex-col items-center justify-center gap-1 cursor-pointer hover:bg-muted/10 transition-colors">
                  {uploading === 'exterior' ? (
                    <Loader2 className="animate-spin text-primary" size={18} />
                  ) : (
                    <>
                      <Camera className="text-muted-foreground" size={20} />
                      <span className="text-[10px] font-bold text-muted-foreground">Add Exterior</span>
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={e => handleUploadFile(e, 'exterior')}
                  />
                </label>
              </div>
            </div>

            {/* Interior Photos */}
            <div className="space-y-3">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">Interior Cabin Photos (At least 1) *</label>
              <div className="grid grid-cols-2 gap-2">
                {photosInterior.map((url, idx) => (
                  <div key={idx} className="relative border border-border rounded-lg overflow-hidden h-24 bg-muted/20">
                    <img src={resolveDocumentPreviewUrl(url, true) || url} alt={`Interior ${idx}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setPhotosInterior(prev => prev.filter((_, i) => i !== idx))}
                      className="absolute top-1.5 right-1.5 p-1 bg-black/60 text-white rounded-md hover:bg-black/80 transition-colors"
                    >
                      <X size={10} />
                    </button>
                  </div>
                ))}
                
                <label className="border-2 border-dashed border-border rounded-lg h-24 flex flex-col items-center justify-center gap-1 cursor-pointer hover:bg-muted/10 transition-colors">
                  {uploading === 'interior' ? (
                    <Loader2 className="animate-spin text-primary" size={18} />
                  ) : (
                    <>
                      <Camera className="text-muted-foreground" size={20} />
                      <span className="text-[10px] font-bold text-muted-foreground">Add Interior</span>
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={e => handleUploadFile(e, 'interior')}
                  />
                </label>
              </div>
            </div>
          </div>

          <div className="flex justify-between pt-4 border-t border-border">
            <button
              onClick={() => setCurrentStep('details')}
              className="px-6 py-3 bg-muted text-muted-foreground rounded-xl font-bold flex items-center gap-2 hover:bg-muted/80 transition-colors"
            >
              <ArrowLeft size={16} /> Back
            </button>
            <button
              onClick={handlePhotosSubmit}
              className="px-6 py-3 bg-primary text-primary-foreground font-black uppercase tracking-wider rounded-xl flex items-center gap-2 hover:bg-primary/90 transition-colors"
            >
              Continue to Signature <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {currentStep === 'signature' && (
        <div className="space-y-6">
          <div className="bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 rounded-2xl p-4 flex gap-3 items-start text-xs font-bold leading-normal">
            <Info className="shrink-0 mt-0.5" size={16} />
            <p>
              By proceeding, the client confirms that they have visually inspected the vehicle's fuel level ({fuelLevel.toUpperCase()}), recorded mileage ({mileage} KM), and verify the reported exterior/interior visual condition.
            </p>
          </div>

          <div className="bg-muted/10 border border-border rounded-2xl p-6 space-y-4">
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="agree-inspection"
                checked={agreed}
                onChange={e => setAgreed(e.target.checked)}
                className="mt-0.5 w-5 h-5 rounded border-border text-primary focus:ring-primary/20 cursor-pointer"
              />
              <label htmlFor="agree-inspection" className="text-xs font-bold text-muted-foreground select-none cursor-pointer leading-normal">
                The client agrees to the Handover Inspection parameters and certifies the visual/fuel/mileage details listed.
              </label>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-bold text-muted-foreground">Client Signature (Have the client draw below):</p>
              <div className="bg-white border border-border rounded-xl overflow-hidden relative touch-none">
                <canvas 
                   ref={signatureRef} 
                   width={800} 
                   height={200} 
                   className="w-full max-w-full cursor-crosshair touch-none bg-white"
                   style={{ touchAction: 'none' }}
                ></canvas>
              </div>
              
              <div className="flex justify-end">
                <button onClick={clearSignature} className="text-xs font-bold text-muted-foreground hover:text-foreground">Clear Signature</button>
              </div>
            </div>
          </div>

          <div className="flex justify-between pt-4 border-t border-border">
            <button
              onClick={() => setCurrentStep('photos')}
              disabled={loading}
              className="px-6 py-3 bg-muted text-muted-foreground rounded-xl font-bold flex items-center gap-2 hover:bg-muted/80 transition-colors disabled:opacity-50"
            >
              <ArrowLeft size={16} /> Back
            </button>
            <button
              onClick={handleSubmitAll}
              disabled={loading || !agreed}
              className="px-6 py-3 bg-primary text-primary-foreground font-black uppercase tracking-wider rounded-xl flex items-center gap-2 hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin" size={16} />
                  <span>Submitting Checklist...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={16} />
                  <span>Submit Inspection</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
