export type BookingVehicleAudience = 'client' | 'admin';

export type BookingVehicleDisplay = {
  label: string;
  modelLabel: string;
  unitLabel: string | null;
  clientSubtitle: string | null;
  imageUrl: string | null;
  year: number | null;
  isModelBooking: boolean;
};

const BOOKING_VEHICLE_MODEL_SELECT = 'vehicle_model:vehicle_models(*)';

export const BOOKING_WITH_VEHICLE_SELECT = `*, cars(*), ${BOOKING_VEHICLE_MODEL_SELECT}`;

export function getBookingVehicleModel(booking: any): any | null {
  return booking?.vehicle_model || booking?.vehicle_models || null;
}

/** Reservation rows use the same booked-model + optional unit shape as bookings. */
export function getReservationVehicleDisplay(
  reservation: any,
  audience: BookingVehicleAudience = 'admin'
): BookingVehicleDisplay {
  return getBookingVehicleDisplay(
    {
      vehicle_model_id: reservation?.vehicle_model_id,
      vehicle_model: reservation?.vehicle_model,
      cars: reservation?.cars,
    },
    audience
  );
}

function getUnitPlate(car: any): string | null {
  const plate = String(car?.license_plate || '').trim();
  if (!plate || plate.toUpperCase() === 'MODEL') return null;
  return plate;
}

export function getBookingVehicleDisplay(
  booking: any,
  audience: BookingVehicleAudience = 'client'
): BookingVehicleDisplay {
  const model = getBookingVehicleModel(booking);
  const car = booking?.cars;
  const isModelBooking = !!booking?.vehicle_model_id || !!model;

  const modelLabel = model
    ? String(model.display_name || `${model.make || ''} ${model.model || ''}`.trim() || 'Booked model')
    : car
      ? `${car.make || ''} ${car.model || ''}`.trim() || 'Vehicle'
      : 'Vehicle';

  const unitLabel = getUnitPlate(car);
  const imageUrl = model?.primary_image_url || car?.primary_image_url || null;
  const year = model?.year ?? car?.year ?? null;

  let label = modelLabel;
  if (audience === 'admin' && unitLabel) {
    label = `${modelLabel} · ${unitLabel}`;
  }

  let clientSubtitle: string | null = null;
  if (audience === 'client') {
    if (isModelBooking && !unitLabel) {
      clientSubtitle = 'Specific vehicle assigned prior to handover';
    } else if (!isModelBooking && unitLabel) {
      clientSubtitle = `Registration: ${unitLabel}`;
    }
  }

  return {
    label,
    modelLabel,
    unitLabel,
    clientSubtitle,
    imageUrl,
    year,
    isModelBooking,
  };
}
