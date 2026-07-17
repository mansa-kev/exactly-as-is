import React, { useState, useEffect } from 'react';
import { X, Printer, FileText, Loader2, AlertCircle, ExternalLink, Download } from 'lucide-react';
import { resolveAssetUrl, toProxyUrl } from '../../utils/assetUrl';
import { contractService } from '../../services/contractService';
import { PdfViewer } from '../admin/PdfViewer';

interface ContractModalProps {
  booking: any;
  onClose: () => void;
}

export function ContractModal({ booking, onClose }: ContractModalProps) {
  const [contract, setContract] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // If the booking already has a signed contract URL, use that.
    // Otherwise fallback to master contract for preview purposes.
    if (booking?.metadata?.contract_url) {
      setContract({ pdf_url: booking.metadata.contract_url });
      setLoading(false);
    } else {
      contractService.getMasterContract().then(c => {
        setContract(c);
      }).finally(() => setLoading(false));
    }
  }, [booking]);

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Resolve the PDF URL — PdfViewer will fetch it as a blob and render it
  // in an iframe, which works on all devices including mobile.
  const rawPdfUrl = contract?.pdf_url || contract?.contract_url || '';
  const pdfUrl = resolveAssetUrl(rawPdfUrl);
  const proxiedPdfUrl = pdfUrl ? `${window.location.origin}${toProxyUrl(pdfUrl) || pdfUrl}` : '';

  // Derive all booking details
  const guestInfo = booking?.metadata?.guest_info;
  const clientName    = guestInfo?.full_name      || booking?.client?.full_name      || 'N/A';
  const clientEmail   = guestInfo?.email          || booking?.client?.email          || 'N/A';
  const clientPhone   = guestInfo?.phone          || booking?.client?.phone_number   || 'N/A';
  const licenseNumber = guestInfo?.license_number || booking?.client?.license_number || 'N/A';

  const ncbaTransactionId = booking?.transaction_code || null;

  const bookingRef = booking?.id ? booking.id.slice(0, 8).toUpperCase() : 'N/A';

  const handleSaveAsPDF = () => {
    if (booking?.metadata?.contract_url && proxiedPdfUrl) {
      // Open the resolved PDF URL in a new tab so the user can download/print it natively.
      window.open(proxiedPdfUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>Rental Contract — ${bookingRef}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:Arial,Helvetica,sans-serif;color:#111;background:#fff}
    .header{background:#FF6B00;color:#fff;padding:28px 36px;display:flex;align-items:center;justify-content:space-between}
    .header-left h1{font-size:20px;font-weight:900;letter-spacing:.12em;text-transform:uppercase}
    .header-left p{font-size:11px;opacity:.85;margin-top:4px}
    .header-right{font-size:11px;text-align:right;opacity:.9}
    .section{padding:20px 36px;border-bottom:1px solid #e5e7eb}
    .section-title{font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:.18em;color:#FF6B00;margin-bottom:12px}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:10px 24px}
    .field-label{font-size:9px;color:#6b7280;text-transform:uppercase;letter-spacing:.1em;margin-bottom:2px}
    .field-value{font-size:13px;font-weight:700;color:#111}
    .amount{font-size:22px;font-weight:900;color:#FF6B00}
    .badge{display:inline-block;padding:2px 10px;border-radius:999px;background:#dcfce7;color:#15803d;font-size:11px;font-weight:700}
    .contract-page{page-break-before:always;width:100%;height:100vh}
    .contract-page iframe{width:100%;height:100%;border:none;display:block}
    .footer{padding:16px 36px;font-size:10px;color:#9ca3af;border-top:1px solid #e5e7eb;text-align:center}
    @media print{
      .header{-webkit-print-color-adjust:exact;print-color-adjust:exact;background:#FF6B00 !important}
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <h1>LinkedUp Cars Rentals</h1>
      <p>Motor Vehicle Rental Agreement — Booking Ref: ${bookingRef}</p>
    </div>
    <div class="header-right">
      <div>Confirmed</div>
      <div>${new Date().toLocaleDateString('en-KE', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Client Details</div>
    <div class="grid">
      <div><div class="field-label">Full Name</div><div class="field-value">${clientName}</div></div>
      <div><div class="field-label">Email Address</div><div class="field-value">${clientEmail}</div></div>
      <div><div class="field-label">Phone Number</div><div class="field-value">${clientPhone}</div></div>
      <div><div class="field-label">Driver's License No.</div><div class="field-value">${licenseNumber}</div></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Vehicle Details</div>
    <div class="grid">
      <div><div class="field-label">Make &amp; Model</div><div class="field-value">${booking?.cars?.make || 'N/A'} ${booking?.cars?.model || ''} (${booking?.cars?.year || ''})</div></div>
      <div><div class="field-label">License Plate</div><div class="field-value">${booking?.cars?.license_plate || 'N/A'}</div></div>
      <div><div class="field-label">Daily Rate</div><div class="field-value">KES ${Number(booking?.cars?.daily_rate || 0).toLocaleString()}</div></div>
      <div><div class="field-label">Colour / Type</div><div class="field-value">${booking?.cars?.color || 'N/A'}</div></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Rental Period &amp; Locations</div>
    <div class="grid">
      <div><div class="field-label">Start Date</div><div class="field-value">${booking?.start_date || 'N/A'}</div></div>
      <div><div class="field-label">End Date</div><div class="field-value">${booking?.end_date || 'N/A'}</div></div>
      <div><div class="field-label">Pickup Location</div><div class="field-value">${booking?.pickup_location || 'N/A'}</div></div>
      <div><div class="field-label">Dropoff Location</div><div class="field-value">${booking?.dropoff_location || 'Same as pickup'}</div></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Payment Details</div>
    <div class="grid">
      <div><div class="field-label">Total Amount Paid</div><div class="amount">KES ${Number(booking?.total_amount || 0).toLocaleString()}</div></div>
      <div><div class="field-label">Payment Status</div><div class="field-value"><span class="badge">${(booking?.payment_status || 'N/A').toUpperCase()}</span></div></div>
      <div><div class="field-label">Payment Method</div><div class="field-value">${(booking?.payment_method || 'N/A').toUpperCase()}</div></div>
      ${ncbaTransactionId ? `<div><div class="field-label">NCBA Transaction ID</div><div class="field-value">${ncbaTransactionId}</div></div>` : ''}
    </div>
  </div>

  ${proxiedPdfUrl ? `
  <div class="contract-page">
    <iframe src="${proxiedPdfUrl}" title="Rental Agreement Contract"></iframe>
  </div>` : `
  <div class="section" style="text-align:center;padding:40px 36px;color:#6b7280">
    <p style="font-size:13px">No contract template is currently active. Please contact support.</p>
  </div>`}

  <div class="footer">LinkedUp Cars Rentals · linkedupcarsrentals.com · Generated ${new Date().toISOString()}</div>
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = `rental-contract-${bookingRef}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/70 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative flex flex-col w-full max-w-4xl bg-background shadow-2xl overflow-hidden md:my-6 md:rounded-[24px]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-primary shrink-0">
          <div className="flex items-center gap-3">
            <FileText size={20} className="text-black" />
            <div>
              <p className="text-black font-black text-sm uppercase tracking-widest">Rental Contract</p>
              <p className="text-black/70 text-xs font-medium">Ref: {bookingRef}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSaveAsPDF}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-2 bg-black text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-black/80 transition-colors disabled:opacity-50"
            >
              <Printer size={14} />
              <span className="hidden sm:inline">Save Contract</span>
            </button>
            {proxiedPdfUrl && (
              <a
                href={proxiedPdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-2 bg-black/20 text-black rounded-xl text-xs font-bold hover:bg-black/30 transition-colors"
              >
                <ExternalLink size={14} />
                <span className="hidden sm:inline">Open Contract</span>
              </a>
            )}
            <button
              onClick={onClose}
              className="p-2 bg-black/20 text-black rounded-xl hover:bg-black/30 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Booking details strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-border shrink-0">
          {[
            { label: 'Client', value: clientName },
            { label: 'Vehicle', value: `${booking?.cars?.make || 'N/A'} ${booking?.cars?.model || ''}` },
            { label: 'Period', value: `${booking?.start_date || 'N/A'} → ${booking?.end_date || 'N/A'}` },
            { label: 'Total Paid', value: `KES ${Number(booking?.total_amount || 0).toLocaleString()}` },
          ].map(({ label, value }) => (
            <div key={label} className="bg-card px-4 py-3">
              <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">{label}</p>
              <p className="text-xs font-bold text-foreground truncate mt-0.5">{value}</p>
            </div>
          ))}
        </div>

        {ncbaTransactionId && (
          <div className="px-6 py-2 bg-green-500/10 border-b border-green-500/20 flex items-center gap-2 shrink-0">
            <span className="text-[9px] font-black uppercase tracking-widest text-green-600">NCBA Transaction ID:</span>
            <span className="text-xs font-black text-green-600">{ncbaTransactionId}</span>
          </div>
        )}

        {/* Contract PDF area */}
        <div className="bg-muted/30" style={{ height: 'calc(100dvh - 220px)', minHeight: '300px', overflow: 'auto' }}>
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 py-20">
              <Loader2 className="animate-spin text-primary" size={36} />
              <p className="text-sm font-bold text-muted-foreground">Loading contract...</p>
            </div>
          ) : !pdfUrl ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 py-20 text-center px-8">
              <AlertCircle className="text-yellow-500" size={48} />
              <div>
                <p className="font-bold text-foreground mb-1">No Active Contract Template</p>
                <p className="text-sm text-muted-foreground">The admin has not yet uploaded an active contract PDF. Please contact support.</p>
              </div>
            </div>
          ) : (
            <PdfViewer
              url={proxiedPdfUrl!}
              className="w-full h-full"
              style={{ minHeight: '300px' }}
            />
          )}
        </div>

        {/* Footer note */}
        <div className="px-6 py-3 bg-card border-t border-border text-center shrink-0">
          <p className="text-[10px] text-muted-foreground">
            Click <strong>Save Contract</strong> to download your booking summary. Open the downloaded file in a browser and use <strong>Print → Save as PDF</strong> to get a PDF copy.
          </p>
        </div>
      </div>
    </div>
  );
}
