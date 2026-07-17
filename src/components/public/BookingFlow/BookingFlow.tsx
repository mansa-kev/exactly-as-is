import React, { useState, useEffect, useMemo } from 'react';
import { Car, VehicleModel } from '../../../types';
import { Step1 } from './Step1';
import { Step2 } from './Step2';
import { Step3 } from './Step3';
import { Step4 } from './Step4';
import { motion, AnimatePresence } from 'motion/react';
import { useBookingSession } from '../../../hooks/useBookingSession';
import { reservationService } from '../../../services/reservationService';
import { Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { vehicleModelToCarLike } from '../../../utils/vehicleModelAdapter';

interface BookingFlowProps {
  car?: Car;
  vehicleModel?: VehicleModel;
  reservationToken?: string | null;
  vehicleModelId?: string | null;
  uploadContextId?: string;
}

import { calculateRentalDays } from '../../../utils/rentalDays';
import { enhancedContractService } from '../../../services/enhancedContractService';
import { prefetchContractAssets } from '../../../utils/contractTemplateCache';
import { analyticsService } from '../../../services/analyticsService';

const calculateDays = (startDate?: string, endDate?: string) =>
  calculateRentalDays(startDate, endDate);

export function BookingFlow({ car: carProp, vehicleModel, reservationToken, vehicleModelId, uploadContextId }: BookingFlowProps) {
  const car = useMemo(
    () => carProp || (vehicleModel ? vehicleModelToCarLike(vehicleModel) : null),
    [carProp, vehicleModel]
  );
  const resolvedVehicleModelId = vehicleModelId || vehicleModel?.id || car?.vehicle_model_id || null;
  const [step, setStep] = useState(1);
  const [bookingData, setBookingData] = useState<any>({});
  const [loadingContinuation, setLoadingContinuation] = useState(false);
  const [continuationError, setContinuationError] = useState<string | null>(null);
  const { session, saveSession, clearSession, isSessionValid } = useBookingSession();
  const contextId = uploadContextId || (resolvedVehicleModelId ? `model:${resolvedVehicleModelId}` : car ? `car:${car.id}` : 'booking');

  // Restore session if valid
  useEffect(() => {
    if (!reservationToken && isSessionValid && session && session.bookingData) {
      setBookingData(session.bookingData);
      setStep(session.currentStep);
    }
  }, [isSessionValid, reservationToken, session]);

  useEffect(() => {
    if (!reservationToken) return;

    let isCancelled = false;

    const loadContinuation = async () => {
      setLoadingContinuation(true);
      setContinuationError(null);

      try {
        const continuation = await reservationService.getBookingContinuation(reservationToken);
        if (isCancelled) return;

        const days = calculateDays(continuation.startDate, continuation.endDate);
        const continuationData = {
          ...continuation.bookingData,
          originalAmount: continuation.estimatedBookingAmount,
          totalAmount: continuation.estimatedBookingAmount,
          discount: 0,
          promoTitle: null,
          days,
        };

        setBookingData(continuationData);
        setStep(1);
        saveSession(continuationData, 1);
      } catch (error: any) {
        if (isCancelled) return;
        const message = error.message || 'Failed to load reservation continuation';
        setContinuationError(message);
        toast.error(message);
      } finally {
        if (!isCancelled) {
          setLoadingContinuation(false);
        }
      }
    };

    loadContinuation();

    return () => {
      isCancelled = true;
    };
  }, [reservationToken, saveSession]);

  useEffect(() => {
    if (step < 2) return;
    let active = true;
    (async () => {
      const master = await enhancedContractService.getMasterContract();
      if (!active || !master) return;
      await prefetchContractAssets(master);
    })();
    return () => {
      active = false;
    };
  }, [step]);

  const nextStep = (data: any) => {
    const newBookingData = { ...bookingData, ...data };
    const newStep = step + 1;
    
    if (step === 1) {
      analyticsService.trackBookingStep('completed_dates_and_location', { 
        pickupLocation: data.pickupLocation,
        dropoffLocation: data.dropoffLocation,
        startDate: data.startDate,
        endDate: data.endDate
      });
    } else if (step === 2) {
      analyticsService.trackBookingStep('completed_personal_details', {});
    } else if (step === 3) {
      analyticsService.trackBookingStep('completed_documents', {});
    }
    
    setBookingData(newBookingData);
    setStep(newStep);
    saveSession(newBookingData, newStep);
  };

  const prevStep = () => {
    const newStep = step - 1;
    setStep(newStep);
    saveSession(bookingData, newStep);
  };

  const completeBooking = () => {
    sessionStorage.removeItem(`pending_booking_${contextId}`);
    sessionStorage.removeItem(`pending_booking_token_${contextId}`);
    clearSession();
  };

  const renderStep = () => {
    switch (step) {
      case 1: return <Step1 car={car!} onNext={nextStep} initialData={bookingData} />;
      case 2: return <Step2 car={car!} onNext={nextStep} onPrev={prevStep} initialData={bookingData} uploadContextId={contextId} />;
      case 3: return <Step3 car={car!} bookingData={bookingData} onNext={nextStep} onPrev={prevStep} vehicleModelId={resolvedVehicleModelId} />;
      case 4: return <Step4 car={car!} bookingData={bookingData} onPrev={prevStep} onComplete={completeBooking} vehicleModelId={resolvedVehicleModelId} uploadContextId={contextId} />;
      default: return null;
    }
  };

  if (!car) {
    return (
      <div className="p-8 rounded-[12px] sm:rounded-[24px] md:rounded-[40px] bg-card border border-border min-h-[280px] flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Vehicle details are unavailable.</p>
      </div>
    );
  }

  if (loadingContinuation) {
    return (
      <div className="p-8 rounded-[12px] sm:rounded-[24px] md:rounded-[40px] bg-card border border-border flex flex-col items-center justify-center gap-4 min-h-[280px]">
        <Loader2 className="animate-spin text-primary" size={32} />
        <div className="text-center space-y-1">
          <p className="text-sm font-black uppercase tracking-widest text-primary">Loading Reservation</p>
          <p className="text-xs text-muted-foreground">Preparing your booking continuation data...</p>
        </div>
      </div>
    );
  }

  if (continuationError) {
    return (
      <div className="p-8 rounded-[12px] sm:rounded-[24px] md:rounded-[40px] bg-card border border-border min-h-[280px] flex items-center justify-center">
        <div className="max-w-md text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-full bg-yellow-500/10 flex items-center justify-center">
            <AlertCircle className="text-yellow-500" size={24} />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-black uppercase tracking-widest text-foreground">Booking Continuation Unavailable</p>
            <p className="text-xs text-muted-foreground">{continuationError}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-2 sm:p-4 md:p-8 rounded-[12px] sm:rounded-[24px] md:rounded-[40px] bg-card border border-border relative overflow-hidden">
      <div className="mb-4 sm:mb-6 md:mb-8">
        <div className="flex justify-between text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5 sm:mb-2">
          <span>Step {step} of 4</span>
          <span>{Math.round((step / 4) * 100)}%</span>
        </div>
        <div className="h-1.5 sm:h-2 bg-muted rounded-full overflow-hidden">
          <motion.div 
            className="h-full bg-primary"
            initial={{ width: '25%' }}
            animate={{ width: `${(step / 4) * 100}%` }}
          />
        </div>
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3 }}
        >
          {renderStep()}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
