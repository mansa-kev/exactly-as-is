import React, { useState, useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { loadFilledContractHtmlCached, prefetchContractAssets } from '../../../utils/contractTemplateCache';
import { useDebouncedValue } from '../../../utils/useDebouncedValue';
import {
  formatContractDate,
  getClientNameFromBooking,
  getTotalCostFromBooking,
  isHtmlContract,
  resolveContractVehicle,
} from '../../../utils/contractTemplate';

interface DirectContractDisplayProps {
  contract: any;
  bookingData: any;
  car: any;
  signatureData?: string;
  vehicleModelId?: string | null;
}

export function DirectContractDisplay({ contract, bookingData, car, signatureData, vehicleModelId }: DirectContractDisplayProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [iframeHeight, setIframeHeight] = useState<number>(800);
  if (!contract) {
    return (
      <div className="p-8 bg-yellow-100 border border-yellow-300 rounded-lg text-center">
        <h3 className="text-lg font-bold text-yellow-800 mb-2">No Contract Available</h3>
        <p className="text-yellow-700">Please upload an HTML contract template in the admin panel.</p>
      </div>
    );
  }

  const isHtmlTemplate = isHtmlContract(contract);
  const vehicle = resolveContractVehicle(car, vehicleModelId);
  const getClientName = () => getClientNameFromBooking(bookingData);
  const getTotalCost = () => getTotalCostFromBooking(bookingData);
  const formatDate = formatContractDate;

  const [htmlTemplate, setHtmlTemplate] = useState<string | null>(null);
  const [loadingHtml, setLoadingHtml] = useState(false);
  const debouncedSignature = useDebouncedValue(signatureData || '', 450);
  const htmlRequestId = useRef(0);

  useEffect(() => {
    if (!isHtmlTemplate || !contract) return;
    void prefetchContractAssets(contract);
  }, [isHtmlTemplate, contract]);

  useEffect(() => {
    if (!isHtmlTemplate || !contract) return;

    const requestId = ++htmlRequestId.current;
    setLoadingHtml(true);

    loadFilledContractHtmlCached(contract, bookingData, car, debouncedSignature, vehicleModelId)
      .then((html) => {
        if (htmlRequestId.current !== requestId) return;
        setHtmlTemplate(html);
      })
      .catch((err) => console.error('Failed to load HTML contract', err))
      .finally(() => {
        if (htmlRequestId.current === requestId) {
          setLoadingHtml(false);
        }
      });
  }, [isHtmlTemplate, contract, bookingData, car, debouncedSignature, vehicleModelId]);

  // Build a full-document srcDoc for the iframe so the template's CSS is
  // completely isolated from the app and cannot collapse the layout.
  const clientNameForScript = JSON.stringify(getClientName() || '');
  const overrideStyles = `
    <style>
      html, body { max-width: none !important; width: 100% !important; min-width: 0 !important; margin: 0 !important; padding: 16px !important; box-sizing: border-box !important; background: #ffffff !important; -webkit-text-size-adjust: 100% !important; }
      body { display: block !important; overflow-x: hidden !important; }
      * { box-sizing: border-box; max-width: 100% !important; word-wrap: break-word !important; overflow-wrap: break-word !important; }
      img { max-width: 100% !important; height: auto !important; }
      table { width: 100% !important; max-width: 100% !important; table-layout: fixed !important; }
      td, th { word-wrap: break-word !important; overflow-wrap: break-word !important; }
      .container, .page, .a4, .sheet, .document, .agreement, .contract, .wrapper, .content { max-width: none !important; width: 100% !important; min-width: 0 !important; margin-left: 0 !important; margin-right: 0 !important; box-shadow: none !important; padding-left: 0 !important; padding-right: 0 !important; }
      .signatures { display: flex !important; flex-direction: row !important; justify-content: space-between !important; align-items: flex-start !important; gap: 24px !important; width: 100% !important; }
      .signature-box { flex: 1 1 0 !important; width: auto !important; min-width: 0 !important; }
      @media (max-width: 600px) {
        html, body { padding: 10px !important; font-size: 14px !important; }
        .signatures { flex-direction: column !important; gap: 16px !important; }
        .signature-box { width: 100% !important; }
        h1, h2, h3 { font-size: 1.1em !important; }
        table { font-size: 12px !important; }
      }
    </style>
  `;
  const repositionScript = `
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <script>
      (function(){
        function reposition(){
          var sig = document.querySelector('img[data-client-signature="1"]');
          if (!sig) return;
          var name = ${clientNameForScript};
          var block = sig.parentElement;
          while (block && block !== document.body) {
            if (name && block.textContent && block.textContent.indexOf(name) !== -1) break;
            block = block.parentElement;
          }
          if (block) { block.insertBefore(sig, block.firstChild); sig.style.marginBottom='4px'; sig.style.display='block'; }
        }
        function postHeight(){
          try {
            var h = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight, document.documentElement.offsetHeight, document.body.offsetHeight);
            parent.postMessage({ __linkedupContractHeight: true, height: h }, '*');
          } catch(e){}
        }
        function fixImages(){
          var imgs = document.querySelectorAll('img');
          imgs.forEach(function(img) {
            if (img.complete && img.naturalWidth === 0 && img.src && !img.dataset.retried) {
              img.dataset.retried = '1';
              var src = img.src;
              img.src = '';
              img.src = src;
            }
          });
        }
        function init(){ reposition(); fixImages(); postHeight(); }
        if (document.readyState === 'complete' || document.readyState === 'interactive') {
          setTimeout(init, 50);
        } else {
          document.addEventListener('DOMContentLoaded', init);
        }
        window.addEventListener('load', function(){ reposition(); fixImages(); postHeight(); setTimeout(postHeight, 300); setTimeout(postHeight, 800); setTimeout(postHeight, 1500); });
        try { new ResizeObserver(function(){ postHeight(); }).observe(document.documentElement); } catch(e){}
      })();
    </script>
  `;
  const srcDoc = htmlTemplate
    ? (() => {
        if (/<\/body>/i.test(htmlTemplate)) {
          return htmlTemplate.replace(/<\/body>/i, `${overrideStyles}${repositionScript}</body>`);
        }
        return `${htmlTemplate}${overrideStyles}${repositionScript}`;
      })()
    : '';

  // Listen for height messages from the iframe so it grows to fit its content
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      const data: any = e.data;
      if (data && data.__linkedupContractHeight && typeof data.height === 'number') {
        setIframeHeight(Math.max(400, Math.ceil(data.height)));
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);



  return (
    <div className="bg-gradient-to-br from-card to-muted rounded-xl overflow-hidden shadow-xl border border-border">
      {/* Professional Header */}
      <div className="bg-primary p-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-black tracking-widest uppercase text-black">
            Rental Agreement
          </h1>
          <div className="text-sm font-medium text-black/70">
            Made and entered into on{" "}
            <span className="text-black font-bold">
              {formatDate(bookingData?.startDate || new Date())}
            </span>
            {" "}between:
          </div>
          <div className="bg-black/10 rounded-xl p-4 mt-3 border border-black/10 w-full">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="text-left">
                <div className="font-black text-black">LinkedUp Cars Rentals</div>
                <div className="text-black/60 text-xs">Hereinafter referred to as "the Company"</div>
              </div>
              <div className="text-right">
                <div className="font-black text-black">{getClientName()}</div>
                <div className="text-black/60 text-xs">Hereinafter referred to as "the Client"</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Optimized Contract Display - Full width spread */}
      <div className="p-2 sm:p-4 bg-card">
        <div className="bg-background rounded-lg shadow-lg overflow-hidden border border-border">
          {isHtmlTemplate ? (
            loadingHtml && !htmlTemplate ? (
              <div className="w-full h-96 flex items-center justify-center">
                <Loader2 className="animate-spin text-primary" size={32} />
              </div>
            ) : (
              <iframe
                ref={iframeRef}
                title="Rental Contract"
                srcDoc={srcDoc}
                sandbox="allow-scripts allow-same-origin"
                className="w-full bg-white block"
                style={{ height: `${iframeHeight}px`, border: 'none', minHeight: 500 }}
              />

            )
          ) : (
            <div className="w-full h-96 flex items-center justify-center p-8 text-center">
              <div className="max-w-sm">
                <div className="text-red-500 mb-4">
                  <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-gray-800 mb-2">HTML Contract Not Available</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Contract Manager must provide an HTML contract template.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Enhanced Booking Summary - Mobile Responsive */}
      <div className="p-4 sm:p-6 bg-card border-t border-border">
        <h2 className="text-lg sm:text-xl font-bold mb-4 sm:mb-6 text-foreground flex items-center gap-2">
          <div className="w-1 h-5 sm:h-6 bg-blue-600 rounded-full"></div>
          Booking Summary & Terms
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Client Information */}
          <div className="bg-muted/50 rounded-lg p-3 sm:p-4 border border-border">
            <h3 className="font-semibold text-foreground mb-2 sm:mb-3 text-xs sm:text-sm uppercase tracking-wide">Client Information</h3>
            <div className="space-y-1 sm:space-y-2 text-xs sm:text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Name:</span>
                <span className="font-medium text-foreground text-right">{getClientName()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Email:</span>
                <span className="font-medium text-foreground text-right">{bookingData?.email || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Phone:</span>
                <span className="font-medium text-foreground text-right">{bookingData?.phone || 'N/A'}</span>
              </div>
            </div>
          </div>

          {/* Vehicle Information */}
          <div className="bg-muted/50 rounded-lg p-3 sm:p-4 border border-border">
            <h3 className="font-semibold text-foreground mb-2 sm:mb-3 text-xs sm:text-sm uppercase tracking-wide">Vehicle Information</h3>
            <div className="space-y-1 sm:space-y-2 text-xs sm:text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{vehicle.isModelBooking ? 'Model:' : 'Make/Model:'}</span>
                <span className="font-medium text-foreground text-right">{vehicle.displayName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Registration:</span>
                <span className="font-medium text-foreground text-right">{vehicle.licensePlate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Daily Rate:</span>
                <span className="font-medium text-foreground text-right">KES {vehicle.dailyRate.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Rental Period */}
          <div className="bg-muted/50 rounded-lg p-3 sm:p-4 md:col-span-2 lg:col-span-1 border border-border">
            <h3 className="font-semibold text-foreground mb-2 sm:mb-3 text-xs sm:text-sm uppercase tracking-wide">Rental Period</h3>
            <div className="space-y-1 sm:space-y-2 text-xs sm:text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Start Date:</span>
                <span className="font-medium text-foreground text-right">{formatDate(bookingData?.startDate)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">End Date:</span>
                <span className="font-medium text-foreground text-right">{formatDate(bookingData?.endDate)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Duration:</span>
                <span className="font-medium text-foreground text-right">
                  {bookingData?.days || 'N/A'} days
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Total Cost - Mobile Responsive */}
        <div className="mt-4 sm:mt-6 bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg p-4 sm:p-6 text-primary-foreground">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
            <div>
              <div className="text-blue-100 text-xs sm:text-sm uppercase tracking-wide">Total Rental Cost</div>
              <div className="text-2xl sm:text-3xl font-bold mt-1">
                KES {getTotalCost().toLocaleString()}
              </div>
            </div>
            <div className="text-left sm:text-right">
              <div className="text-blue-100 text-xs sm:text-sm">Security Deposit</div>
              <div className="text-lg sm:text-xl font-semibold">
                KES {vehicle.securityDeposit.toLocaleString()}
              </div>
            </div>
          </div>
        </div>

        {/* Terms Confirmation - Mobile Responsive */}
        <div className="mt-4 sm:mt-6 bg-amber-50 border border-amber-200 rounded-lg p-3 sm:p-4">
          <div className="flex items-start gap-2 sm:gap-3">
            <div className="text-amber-600 mt-0.5 sm:mt-1 flex-shrink-0">
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-amber-900 mb-1 sm:mb-2 text-sm">Important Notice</h3>
              <p className="text-xs sm:text-sm text-amber-800 leading-relaxed">
                By proceeding to payment, you acknowledge that you have read, understood, and agree to be bound by all terms and conditions outlined in this Rental Agreement. This constitutes a legally binding contract.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
