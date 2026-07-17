import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { Download, ZoomIn, ZoomOut, RotateCw, AlertCircle, FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { toProxiedAssetUrl } from '../../../utils/assetUrl';
import { resolveContractVehicle } from '../../../utils/contractTemplate';

interface ContractViewerProps {
  contract: {
    id: string;
    version: string;
    contract_title?: string;
    pdf_url?: string;
    contract_url?: string;
    terms_summary?: string;
    is_active: boolean;
  };
  bookingData: any;
  car: any;
  onContractLoaded?: () => void;
  vehicleModelId?: string | null;
}

export function ContractViewer({ contract, bookingData, car, onContractLoaded, vehicleModelId }: ContractViewerProps) {
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [overlayPositions, setOverlayPositions] = useState<any[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Get the correct URL - support both pdf_url and contract_url
  const contractUrl = contract?.pdf_url || contract?.contract_url || '';

  const vehicle = resolveContractVehicle(car, vehicleModelId);

  useEffect(() => {
    if (!contractUrl) {
      console.error('No contract URL provided');
      setError(true);
      setLoading(false);
      return;
    }

    const loadContract = async () => {
      try {
        setLoading(true);
        setError(false);

        // Simulate PDF loading with canvas
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Set canvas size
        canvas.width = 600;
        canvas.height = 800;

        // Draw simulated PDF content
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw border
        ctx.strokeStyle = '#e5e7eb';
        ctx.lineWidth = 1;
        ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);

        // Draw title
        ctx.fillStyle = '#1f2937';
        ctx.font = 'bold 24px Arial';
        ctx.fillText(contract.contract_title || 'Rental Agreement', 40, 80);

        // Draw contract content
        ctx.font = '14px Arial';
        ctx.fillStyle = '#4b5563';
        
        let yPosition = 120;
        const lineHeight = 20;
        const maxWidth = canvas.width - 80;

        // Contract sections
        const sections = [
          'RENTAL AGREEMENT',
          '',
          'This Rental Agreement is made on ' + new Date().toLocaleDateString(),
          '',
          'PARTIES:',
          `Renter: ${bookingData?.firstName || 'N/A'} ${bookingData?.lastName || 'N/A'}`,
          `Vehicle: ${vehicle.displayName}`,
          `Rental Period: ${bookingData?.startDate || 'N/A'} to ${bookingData?.endDate || 'N/A'}`,
          '',
          'TERMS AND CONDITIONS:',
          '1. The renter agrees to return the vehicle in the same condition',
          '2. The renter is responsible for any damage during rental period',
          '3. Insurance coverage is mandatory for all rentals',
          '4. Late returns will incur additional charges',
          '',
          'SIGNATURE:',
          '_________________________',
          'Renter Signature',
          '',
          'Date: _________________'
        ];

        sections.forEach(line => {
          if (line) {
            ctx.fillText(line, 40, yPosition);
          }
          yPosition += lineHeight;
        });

        // Calculate overlay positions for dynamic data
        const overlays = [
          { x: 200, y: 160, width: 200, height: 20, field: 'renterName' },
          { x: 200, y: 180, width: 200, height: 20, field: 'vehicle' },
          { x: 200, y: 200, width: 200, height: 20, field: 'rentalPeriod' }
        ];

        setOverlayPositions(overlays);
        setLoading(false);
        
        if (onContractLoaded) {
          onContractLoaded();
        }

      } catch (error) {
        console.error('Error loading contract:', error);
        setError(true);
        setLoading(false);
      }
    };

    loadContract();
  }, [contractUrl, contract, bookingData, car, onContractLoaded]);

  const handleZoomIn = () => setScale(prev => Math.min(prev + 0.1, 2));
  const handleZoomOut = () => setScale(prev => Math.max(prev - 0.1, 0.5));
  const handleRotate = () => setRotation(prev => prev + 90);

  const handleDownload = async () => {
    try {
      toast.loading('Preparing download...');
      const url = toProxiedAssetUrl(contractUrl) || contractUrl;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch contract');
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `rental-contract-${bookingData?.id || 'default'}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
      toast.dismiss();
      toast.success('Contract downloaded');
    } catch {
      toast.dismiss();
      toast.error('Download failed — opening in new tab instead');
      const url = toProxiedAssetUrl(contractUrl) || contractUrl;
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  if (error) {
    return (
      <div className="p-8 bg-red-500/10 rounded-[24px] border border-red-500/20 text-center">
        <AlertCircle className="mx-auto text-red-500 mb-4" size={48} />
        <p className="text-red-500 font-bold">Failed to load contract</p>
        <p className="text-red-500/80 text-sm mt-2">Please try again or contact support</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-primary mb-2 block">E-Contract Display</label>
      
      {/* Controls */}
      <div className="flex items-center justify-between p-4 bg-card/50 rounded-[20px] border border-border">
        <div className="flex items-center gap-2">
          <button
            onClick={handleZoomOut}
            className="p-2 hover:bg-card/70 rounded-lg transition-colors"
            title="Zoom Out"
          >
            <ZoomOut size={16} />
          </button>
          <span className="text-xs text-muted-foreground min-w-[3rem] text-center">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={handleZoomIn}
            className="p-2 hover:bg-card/70 rounded-lg transition-colors"
            title="Zoom In"
          >
            <ZoomIn size={16} />
          </button>
          <button
            onClick={handleRotate}
            className="p-2 hover:bg-card/70 rounded-lg transition-colors"
            title="Rotate"
          >
            <RotateCw size={16} />
          </button>
        </div>
        
        <button
          onClick={handleDownload}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-black rounded-lg text-xs font-bold hover:scale-105 transition-all"
        >
          <Download size={14} />
          Download PDF
        </button>
      </div>

      {/* Contract Display */}
      <div 
        ref={containerRef}
        className="relative bg-card rounded-[24px] overflow-hidden shadow-2xl"
        style={{ maxHeight: '600px' }}
      >
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-card/90">
            <div className="text-center space-y-3">
              <Loader2 className="animate-spin text-primary mx-auto" size={32} />
              <p className="text-sm font-bold text-foreground">Loading contract...</p>
            </div>
          </div>
        ) : (
          <div className="relative overflow-auto" style={{ maxHeight: '600px' }}>
            <div 
              className="relative"
              style={{
                transform: `scale(${scale}) rotate(${rotation}deg)`,
                transformOrigin: 'center',
                transition: 'transform 0.3s ease'
              }}
            >
              <canvas
                ref={canvasRef}
                className="mx-auto"
                style={{ maxWidth: '100%', height: 'auto' }}
              />
              
              {/* Dynamic Data Overlay */}
              {overlayPositions.map((overlay) => (
                <div
                  key={overlay.id}
                  className="absolute bg-yellow-200/80 px-2 py-1 rounded text-xs font-bold text-black"
                  style={{
                    left: `${overlay.x}px`,
                    top: `${overlay.y}px`,
                    transform: `scale(${1/scale}) rotate(${-rotation}deg)`,
                    transformOrigin: 'left top'
                  }}
                >
                  {overlay.value}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Contract Information */}
      <div className="p-4 bg-primary/5 rounded-[20px] border border-primary/10 space-y-3">
        <div className="flex items-center gap-2 text-xs">
          <FileText className="text-primary" size={14} />
          <span className="text-primary font-bold">Dynamic Data Overlay Active</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
          <div><span className="text-muted-foreground">Client:</span> <span className="text-foreground font-bold">{bookingData?.firstName || 'N/A'} {bookingData?.lastName || 'N/A'}</span></div>
          <div><span className="text-muted-foreground">Vehicle:</span> <span className="text-foreground font-bold">{vehicle.displayName}</span></div>
          <div><span className="text-muted-foreground">Period:</span> <span className="text-foreground font-bold">{bookingData?.startDate || 'N/A'} to {bookingData?.endDate || 'N/A'}</span></div>
          <div><span className="text-muted-foreground">Total:</span> <span className="text-foreground font-bold">KES {bookingData?.totalCost?.toLocaleString() || '0'}</span></div>
        </div>
        <p className="text-[10px] text-primary/80 italic">
          Yellow highlights indicate dynamically inserted booking-specific data
        </p>
      </div>
    </div>
  );
}
