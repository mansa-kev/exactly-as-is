import { Car, VehicleModel } from '../types';

/** Map a public catalog model to the Car-shaped object steps still expect for display. */
export function vehicleModelToCarLike(model: VehicleModel): Car {
  return {
    id: model.id,
    vehicle_model_id: model.id,
    make: model.make,
    model: model.model,
    year: model.year || new Date().getFullYear(),
    color: 'N/A',
    license_plate: 'MODEL',
    category: model.category || 'N/A',
    description: model.description || '',
    primary_image_url: model.primary_image_url || '',
    photos: (model.gallery_urls || []) as string[],
    video_url: model.video_url || '',
    transmission: model.transmission || '',
    fuel_type: model.fuel_type || '',
    seats: model.seats || 0,
    luggage: model.luggage || 0,
    features: (model.features || []) as string[],
    daily_rate: Number(model.base_daily_rate || 0),
    overtime_rate: Number(model.overtime_rate || 0),
    security_deposit: Number(model.security_deposit || 0),
    status: 'available',
    maintenance_status: 'ok',
    created_at: model.created_at || new Date().toISOString(),
    vehicle_model: model,
  } as Car;
}
