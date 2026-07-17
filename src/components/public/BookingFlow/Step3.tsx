// @ts-nocheck
import React, { useRef, useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Car } from '../../../types';
import SignatureCanvas from 'react-signature-canvas';
import { ArrowLeft, ArrowRight, FileText, Loader2, AlertCircle, CheckCircle2, Eraser, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { enhancedContractService } from '../../../services/enhancedContractService';
import { prefetchContractAssets } from '../../../utils/contractTemplateCache';
import { generateContractPdfBase64 } from '../../../services/contractPdfService';
import { DirectContractDisplay } from './DirectContractDisplay';
import { resolveContractVehicle } from '../../../utils/contractTemplate';

interface Step3Props {
  car: Car;
  bookingData: any;
  onNext: (data: any) => void;
  onPrev: () => void;
  vehicleModelId?: string | null;
}

export function Step3({ car, bookingData, onNext, onPrev, vehicleModelId }: Step3Props) {
  const sigPad = useRef<any>(null);
  const [agreed, setAgreed] = useState(false);
  const [contract, setContract] = useState<any>(null);
  const [loadingContract, setLoadingContract] = useState(true);
  const [signingContract, setSigningContract] = useState(false);
  const [liveSignatureData, setLiveSignatureData] = useState('');

  const vehicle = resolveContractVehicle(car, vehicleModelId);

  useEffect(() => {
    let active = true;
    const fetchContract = async () => {
      try {
        const contract = await enhancedContractService.getMasterContract();
        if (!active) return;
        if (contract) {
          const htmlUrl = contract.pdf_url || contract.contract_url || contract.template_url;
          contract.preview_url = htmlUrl && htmlUrl.includes('.html') ? htmlUrl : null;
          setContract(contract);
          void prefetchContractAssets(contract);
        }
      } catch (error) {
        console.error('Error fetching contract:', error);
      } finally {
        if (active) setLoadingContract(false);
      }
    };
    fetchContract();
    return () => {
      active = false;
    };
  }, []);

  const clear = () => {
    if (sigPad.current) {
      sigPad.current.clear();
    }
    setLiveSignatureData('');
  };

  const syncSignaturePreview = () => {
    if (!sigPad.current || sigPad.current.isEmpty()) {
      setLiveSignatureData('');
      return;
    }

    setLiveSignatureData(sigPad.current.toDataURL());
  };

  const handleSignAndProceed = async () => {
    if (!agreed) {
      toast.error('Please agree to the terms and conditions');
      return;
    }

    if (!sigPad.current || sigPad.current.isEmpty()) {
      toast.error('Please provide your signature');
      return;
    }

    try {
      setSigningContract(true);

      const signatureData = sigPad.current.toDataURL();
      setLiveSignatureData(signatureData);

      let pdfBase64: string | null = null;
      if (contract) {
        try {
          pdfBase64 = await generateContractPdfBase64({
            contract,
            bookingData,
            car,
            signatureData,
            vehicleModelId,
          });
        } catch (err) {
          console.error('Failed to generate contract PDF', err);
          toast.error(err instanceof Error ? err.message : 'Failed to generate contract PDF');
          return;
        }
      }

      toast.success('Contract accepted successfully');

      onNext({
        contractSigned: true,
        contractAccepted: true,
        signatureUrl: signatureData,
        signatureData: signatureData,
        contractPdfBase64: pdfBase64,
        contractId: contract?.id || 'temp-' + Date.now()
      });

    } catch (error) {
      console.error('Error in contract process:', error);
      toast.error('An error occurred. Please try again.');
    } finally {
      setSigningContract(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSignAndProceed();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6 md:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="space-y-1">
        <h3 className="text-xl sm:text-2xl md:text-3xl font-serif font-black italic text-foreground">Review & Sign</h3>
        <p className="text-muted-foreground text-xs sm:text-sm">Review the HTML contract, then sign to generate the final PDF copy.</p>
      </div>

      <div className="space-y-6 md:space-y-8">
        <div className="p-3 sm:p-4 md:p-6 bg-card/50 border border-border rounded-[16px] sm:rounded-[24px] md:rounded-[32px] grid grid-cols-2 gap-3 sm:gap-4 md:gap-6">
          <div className="space-y-0.5">
            <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-primary/60">Vehicle</p>
            <p className="text-xs sm:text-sm font-bold text-foreground">{vehicle.displayName}</p>
          </div>
          <div className="space-y-0.5 text-right">
            <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-primary/60">Duration</p>
            <p className="text-xs sm:text-sm font-bold text-foreground">{bookingData.days} Days</p>
          </div>
          <div className="space-y-0.5">
            <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-primary/60">Dates</p>
            <p className="text-[10px] sm:text-xs font-bold text-muted-foreground">{bookingData.startDate} to {bookingData.endDate}</p>
          </div>
          <div className="space-y-0.5 text-right">
            <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-primary/60">Total Amount</p>
            {bookingData.discount > 0 ? (
              <div>
                <p className="text-[10px] sm:text-xs text-muted-foreground/60 line-through">KES {bookingData.originalAmount?.toLocaleString()}</p>
                <p className="text-sm sm:text-lg font-black text-primary">KES {bookingData.totalAmount?.toLocaleString()}</p>
              </div>
            ) : (
              <p className="text-sm sm:text-lg font-black text-primary">KES {bookingData.totalAmount?.toLocaleString()}</p>
            )}
          </div>
        </div>

        {loadingContract ? (
          <div className="p-4 sm:p-8 bg-white/5 rounded-[16px] sm:rounded-[24px] border border-white/10 text-center flex items-center justify-center gap-3 text-muted-foreground">
            <Loader2 className="animate-spin text-primary" size={20} />
            <span className="text-sm font-bold">Loading contract...</span>
          </div>
        ) : contract ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <DirectContractDisplay
              contract={contract}
              bookingData={bookingData}
              car={car}
              signatureData={liveSignatureData}
              vehicleModelId={vehicleModelId}
            />
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="p-8 bg-yellow-500/10 rounded-[24px] border border-yellow-500/20 text-center space-y-4">
              <AlertCircle className="mx-auto text-yellow-500" size={48} />
              <div>
                <h3 className="text-lg font-bold text-yellow-500 mb-2">No Active Contract Template</h3>
                <p className="text-sm text-yellow-500/80 mb-4">
                  Please upload and activate an HTML contract template in the admin panel first.
                </p>
                <div className="bg-yellow-500/5 rounded-lg p-4 text-left">
                  <p className="text-xs text-yellow-500/60 font-bold mb-2">Required Steps:</p>
                  <ol className="text-xs text-yellow-500/80 space-y-1 list-decimal list-inside">
                    <li>Go to Admin Portal &rarr; Contract Manager</li>
                    <li>Upload a master contract HTML file</li>
                    <li>Set the contract as "Active"</li>
                    <li>Return to booking flow to continue</li>
                  </ol>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-primary block">Digital Signature</label>
            <button
              type="button"
              onClick={clear}
              className="text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-primary flex items-center gap-2 transition-colors"
            >
              <Eraser size={12} /> Clear
            </button>
          </div>
          <div className="relative h-[150px] sm:h-[200px] bg-white/5 border border-white/10 rounded-[16px] sm:rounded-[24px] overflow-hidden group hover:border-primary/30 transition-colors">
            <SignatureCanvas
              ref={sigPad}
              penColor='#D4AF37'
              onEnd={syncSignaturePreview}
              clearOnResize={false}
              canvasProps={{
                className: 'w-full h-full cursor-crosshair',
                style: { width: '100%', height: '100%' }
              }}
            />
            <div className="absolute bottom-4 right-4 pointer-events-none opacity-20 group-hover:opacity-40 transition-opacity">
              <FileText size={40} className="text-white" />
            </div>
          </div>
        </div>

        {/* Terms */}
        <div className="space-y-4">
          <label className="flex items-start gap-3 cursor-pointer group">
            <div className="relative mt-1">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="peer sr-only"
              />
              <div className="w-5 h-5 border-2 border-white/20 rounded-md bg-white/5 peer-checked:bg-primary peer-checked:border-primary transition-all" />
              <CheckCircle2 size={12} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-black opacity-0 peer-checked:opacity-100 transition-opacity" />
            </div>
            <span className="text-xs text-muted-foreground leading-relaxed group-hover:text-white/80 transition-colors">
              I have read and agree to the <span className="text-primary underline cursor-pointer">Rental Terms and Conditions</span>, including insurance policies and vehicle usage guidelines.
            </span>
          </label>

          <div className="p-4 bg-primary/5 rounded-[20px] flex gap-3 items-start border border-primary/10">
            <ShieldCheck className="text-primary shrink-0" size={16} />
            <p className="text-[10px] text-primary/80 font-bold uppercase tracking-widest leading-normal">
              Your data is encrypted and stored securely in accordance with our privacy policy.
            </p>
          </div>
        </div>

        <div className="flex gap-2 sm:gap-4 pt-2">
          <button
            type="button" onClick={onPrev}
            className="w-1/5 sm:w-1/4 py-3.5 sm:py-5 bg-card/50 rounded-[14px] sm:rounded-[24px] text-foreground font-black uppercase tracking-widest hover:bg-card/70 transition-all flex items-center justify-center border border-border"
          >
            <ArrowLeft size={18} />
          </button>
          <button
            type="submit"
            disabled={signingContract || !agreed}
            className="flex-1 py-3.5 sm:py-5 bg-primary rounded-[14px] sm:rounded-[24px] text-black font-black uppercase tracking-[0.15em] text-[11px] sm:text-sm flex items-center justify-center gap-2 sm:gap-4 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-primary/20 group disabled:opacity-50"
          >
            {signingContract ? (
              <>
                <Loader2 className="animate-spin" size={20} />
                <span>Signing Contract...</span>
              </>
            ) : (
              <>
                <span>Continue to pay</span>
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </div>
      </div>
    </form>
  );
}