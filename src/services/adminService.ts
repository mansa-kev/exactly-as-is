// @ts-nocheck
import { supabase, handleSupabaseErrorWrapper } from '../lib/supabase';
import { logger } from '../utils/logger';
import { Car } from '../types';
import { getOrSetCache, invalidateCachePrefix } from '../utils/queryCache';
import {
  PAID_REVENUE_STATUSES_DB,
  isActiveBookingStatus,
} from '../constants/bookingStatuses';
import {
  buildBookingReconciliation,
  buildBrokerReconciliation,
  buildMonthlyPartnerChart,
  buildPayoutBreakdown,
  createEmptyPayoutBreakdown,
} from '../utils/partnerFinancials';
import { buildModelFleetStatus } from '../utils/modelFleetStatus';
const handleSupabaseError = handleSupabaseErrorWrapper;
const ADMIN_CACHE_TTL_MS = 60_000;

function sanitizeCarPayload(car: any) {
  const {
    vehicle_model,
    fleet_owner,
    fleet_owner_details,
    fleet_owner_settings,
    ...rest
  } = car || {};

  return {
    ...rest,
    vehicle_model_id: rest.vehicle_model_id ? rest.vehicle_model_id : null,
    fleet_owner_id:
      fleet_owner === '' || fleet_owner === undefined
        ? rest.fleet_owner_id ?? null
        : fleet_owner || rest.fleet_owner_id || null,
  };
}

const VEHICLE_MODEL_WRITE_FIELDS = [
  'slug',
  'family_slug',
  'family_name',
  'variant_name',
  'make',
  'model',
  'year',
  'display_name',
  'category',
  'description',
  'primary_image_url',
  'gallery_urls',
  'video_url',
  'transmission',
  'fuel_type',
  'seats',
  'luggage',
  'features',
  'base_daily_rate',
  'overtime_rate',
  'security_deposit',
  'is_chauffeured_only',
  'is_public',
  'booking_mode',
  'sort_order',
] as const;

function sanitizeVehicleModelPayload(input: Record<string, any> = {}) {
  const payload: Record<string, any> = {};
  for (const key of VEHICLE_MODEL_WRITE_FIELDS) {
    if (input[key] !== undefined) payload[key] = input[key];
  }
  if (
    typeof payload.primary_image_url === 'string' &&
    payload.primary_image_url.startsWith('blob:')
  ) {
    delete payload.primary_image_url;
  }
  return payload;
}

async function resolveVehicleModelIdForCar(car: {
  make?: string;
  model?: string;
  year?: number;
  vehicle_model_id?: string | null;
}): Promise<string | null> {
  if (car.vehicle_model_id) return car.vehicle_model_id;
  if (!car.make || !car.model) return null;

  const { data } = await supabase
    .from('vehicle_models')
    .select('id, year')
    .eq('make', car.make)
    .eq('model', car.model);

  if (!data?.length) return null;
  const exactYear = data.find((row: any) => row.year === car.year);
  return (exactYear || data[0]).id;
}

function invalidateFleetInventoryCaches() {
  invalidateCachePrefix('fleet:');
  invalidateCachePrefix('admin:vehicleModels:');
  invalidateCachePrefix('admin:cars:');
}

export const adminService = {
  // --- Dashboard ---
  getDashboardStats: async (timeRange: '7d' | '30d' | '3m' | '6m' | '1y' = '7d') => {
    return getOrSetCache(`admin:dashboard:${timeRange}`, ADMIN_CACHE_TTL_MS, async () => {
    try {
      const now = new Date();
      let startDate = new Date();
      let previousStartDate = new Date();
      
      switch (timeRange) {
        case '7d':
          startDate.setDate(now.getDate() - 7);
          previousStartDate.setDate(startDate.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(now.getDate() - 30);
          previousStartDate.setDate(startDate.getDate() - 30);
          break;
        case '3m':
          startDate.setMonth(now.getMonth() - 3);
          previousStartDate.setMonth(startDate.getMonth() - 3);
          break;
        case '6m':
          startDate.setMonth(now.getMonth() - 6);
          previousStartDate.setMonth(startDate.getMonth() - 6);
          break;
        case '1y':
          startDate.setFullYear(now.getFullYear() - 1);
          previousStartDate.setFullYear(startDate.getFullYear() - 1);
          break;
      }

      const { data: bookings, error: bError } = await supabase
        .from('bookings')
        .select('total_amount, platform_commission, status, payment_status, created_at, car_id, client_id, cars(make, model, year)')
        .gte('created_at', previousStartDate.toISOString())
        .in('status', [...PAID_REVENUE_STATUSES_DB])
        .eq('payment_status', 'paid');
      if (bError) throw bError;

      const { data: cars, error: cError } = await supabase
        .from('cars')
        .select('status');
      if (cError) throw cError;

      const { data: users, error: uError } = await supabase
        .from('user_profiles')
        .select('id, role, created_at');
      if (uError) throw uError;

      // Filter bookings by current and previous periods
      const currentBookings = bookings?.filter(b => new Date(b.created_at) >= startDate) || [];
      const previousBookings = bookings?.filter(b => new Date(b.created_at) >= previousStartDate && new Date(b.created_at) < startDate) || [];

      // Current Period Stats
      const totalRevenue = currentBookings.reduce((sum, b) => sum + (b.total_amount || 0), 0);
      const netCommission = currentBookings.reduce((sum, b) => sum + (b.platform_commission || 0), 0);
      const activeBookings = currentBookings.filter(b => isActiveBookingStatus(b.status)).length;

      // Previous Period Stats
      const prevTotalRevenue = previousBookings.reduce((sum, b) => sum + (b.total_amount || 0), 0);
      const prevNetCommission = previousBookings.reduce((sum, b) => sum + (b.platform_commission || 0), 0);
      const prevActiveBookings = previousBookings.filter(b => isActiveBookingStatus(b.status)).length;

      // Calculate Trend Percentages
      const calculateTrend = (current: number, previous: number) => {
        if (previous === 0) return current > 0 ? 100 : 0;
        return Math.round(((current - previous) / previous) * 100);
      };

      const revenueTrendPercent = calculateTrend(totalRevenue, prevTotalRevenue);
      const commissionTrendPercent = calculateTrend(netCommission, prevNetCommission);
      const activeBookingsTrendPercent = calculateTrend(activeBookings, prevActiveBookings);

      const totalCars = cars?.length || 0;
      const maintenanceCars = cars?.filter(c => c.status === 'maintenance').length || 0;
      const newClients = users?.filter(u => u.role === 'client' && new Date(u.created_at) >= startDate).length || 0;
      const newFleetOwners = users?.filter(u => u.role === 'fleet_owner' && new Date(u.created_at) >= startDate).length || 0;

      // Calculate revenue trend for chart based on timeRange
      let revenueTrend = [];
      if (timeRange === '7d' || timeRange === '30d') {
        const days = timeRange === '7d' ? 7 : 30;
        const lastDays = [...Array(days)].map((_, i) => {
          const d = new Date();
          d.setDate(d.getDate() - i);
          return d.toISOString().split('T')[0];
        }).reverse();

        revenueTrend = lastDays.map(date => {
          const dayBookings = currentBookings.filter(b => b.created_at.startsWith(date));
          return {
            name: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            gross: dayBookings.reduce((sum, b) => sum + (b.total_amount || 0), 0),
            net: dayBookings.reduce((sum, b) => sum + (b.platform_commission || 0), 0),
          };
        });
      } else {
        // Group by month for 3m, 6m, 1y
        const months = timeRange === '3m' ? 3 : timeRange === '6m' ? 6 : 12;
        const lastMonths = [...Array(months)].map((_, i) => {
          const d = new Date();
          d.setMonth(d.getMonth() - i);
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        }).reverse();

        revenueTrend = lastMonths.map(monthStr => {
          const monthBookings = currentBookings.filter(b => b.created_at.startsWith(monthStr));
          const [year, month] = monthStr.split('-');
          const date = new Date(parseInt(year), parseInt(month) - 1, 1);
          return {
            name: date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
            gross: monthBookings.reduce((sum, b) => sum + (b.total_amount || 0), 0),
            net: monthBookings.reduce((sum, b) => sum + (b.platform_commission || 0), 0),
          };
        });
      }

      // Top 5 Most Booked Cars
      const carBookingCounts: Record<string, { count: number; name: string }> = {};
      currentBookings.forEach(b => {
        if (b.car_id && b.cars) {
          const carData = Array.isArray(b.cars) ? b.cars[0] : b.cars;
          if (!carBookingCounts[b.car_id]) {
            carBookingCounts[b.car_id] = { count: 0, name: `${(carData as any).make} ${(carData as any).model} (${(carData as any).year})` };
          }
          carBookingCounts[b.car_id].count++;
        }
      });
      const topCars = Object.values(carBookingCounts)
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Client Churn Rate
      // Clients who booked in the previous period but NOT in the current period
      const clientsInPrevPeriod = new Set(previousBookings.map(b => b.client_id));
      const clientsInCurrentPeriod = new Set(currentBookings.map(b => b.client_id));
      
      let churnRate = 0;
      if (clientsInPrevPeriod.size > 0) {
        let churnedClients = 0;
        clientsInPrevPeriod.forEach(clientId => {
          if (!clientsInCurrentPeriod.has(clientId)) {
            churnedClients++;
          }
        });
        churnRate = Math.round((churnedClients / clientsInPrevPeriod.size) * 100);
      }

      return {
        totalRevenue,
        revenueTrendPercent,
        netCommission,
        commissionTrendPercent,
        activeBookings,
        activeBookingsTrendPercent,
        totalCars,
        maintenanceCars,
        newClients,
        newFleetOwners,
        revenueTrend,
        topCars,
        churnRate,
        bookingStatusDistribution: [
          { name: 'Active', value: activeBookings, color: '#10B981' },
          { name: 'Completed', value: currentBookings.filter(b => b.status === 'completed').length, color: '#3B82F6' },
        ]
      };
    } catch (error) {
      logger.error('[getDashboardStats] Raw error:', error);
      // Return safe default stats object so dashboard renders empty rather than crashing
      return {
        totalRevenue: 0,
        revenueTrendPercent: 0,
        netCommission: 0,
        commissionTrendPercent: 0,
        activeBookings: 0,
        activeBookingsTrendPercent: 0,
        totalCars: 0,
        maintenanceCars: 0,
        newClients: 0,
        newFleetOwners: 0,
        revenueTrend: [],
        topCars: [],
        churnRate: 0,
        bookingStatusDistribution: [
          { name: 'Active', value: 0, color: '#10B981' },
          { name: 'Completed', value: 0, color: '#3B82F6' },
        ]
      };
    }
    });
  },

  // --- Reservations ---
  getReservationStats: async () => {
    return getOrSetCache('admin:reservationStats', ADMIN_CACHE_TTL_MS, async () => {
    try {
      const { data, error } = await supabase
        .from('car_reservations')
        .select('reservation_fee, total_amount, status, payment_status, created_at')
        .eq('payment_status', 'paid');

      if (error) throw error;

      const totalReservationFees = data?.reduce((sum, r) => sum + (r.reservation_fee || 0), 0) || 0;
      const totalReservationValue = data?.reduce((sum, r) => sum + (r.total_amount || 0), 0) || 0;
      const activeReservations = data?.filter(r => r.status === 'reserved').length || 0;
      const confirmedReservations = data?.filter(r => r.status === 'confirmed').length || 0;

      return {
        totalReservationFees,      // fees collected (non-refundable)
        totalReservationValue,     // full value of all reservations
        activeReservations,
        confirmedReservations,
        count: data?.length || 0
      };
    } catch (error) {
      return handleSupabaseErrorWrapper(error, 'getReservationStats');
    }
    });
  },

  // --- Bookings ---
  getBookings: async (page: number = 1, pageSize: number = 20) => {
    return getOrSetCache(`admin:bookings:${page}:${pageSize}`, 30_000, async () => {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data, error, count } = await supabase
        .from('bookings')
        .select(`
          id,
          client_id,
          car_id,
          driver_id,
          fleet_owner_id,
          start_date,
          end_date,
          total_amount,
          platform_commission,
          status,
          payment_status,
          document_status,
          admin_notes,
          is_flagged,
          flag_reason,
          sub_status,
          pickup_confirmed_at,
          return_confirmed_at,
          return_condition,
          overtime_hours,
          overtime_charge,
          created_at,
          metadata,
          vehicle_model_id,
          cars (
            id,
            make,
            model,
            year,
            license_plate,
            photos,
            primary_image_url
          ),
          vehicle_model:vehicle_models (
            id,
            display_name,
            make,
            model,
            year,
            primary_image_url
          ),

          client:user_profiles!bookings_client_id_fkey (
            id,
            full_name,
            email,
            phone_number
          ),
          fleet_owner:user_profiles!bookings_fleet_owner_id_fkey (
            id,
            full_name,
            email
          )
        `, { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) return handleSupabaseErrorWrapper(error, 'getBookings');
      return { data, count };
    });
  },

  createConciergeBooking: async (bookingData: any) => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      
      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({
          ...bookingData,
          bookingFlowInitiatedBy: 'admin_concierge'
        }),
      });

      const rawResponse = await response.text();
      const result = rawResponse ? JSON.parse(rawResponse) : null;

      if (!response.ok || result?.error || !result?.booking) {
        throw new Error(result?.error || rawResponse || 'Failed to create concierge booking');
      }

      // If it's a bank transfer, we might need to manually update payment_status in a subsequent call, 
      // but the API endpoint handles the initial insert.
      return result.booking;
    } catch (error) {
      return handleSupabaseErrorWrapper(error, 'createConciergeBooking');
    }
  },

  confirmBankTransferPayment: async (bookingId: string, reference: string) => {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .update({
          status: 'confirmed',
          payment_status: 'paid',
          payment_method: 'bank_transfer',
          payment_provider: 'bank_transfer',
          payment_reference: reference,
          transaction_code: reference,
          updated_at: new Date().toISOString()
        })
        .eq('id', bookingId)
        .select();

      if (error) throw error;
      invalidateCachePrefix('admin:bookings:');
      invalidateCachePrefix('admin:dashboard:');
      return data;
    } catch (error) {
      return handleSupabaseErrorWrapper(error, 'confirmBankTransferPayment');
    }
  },

  updateBookingStatus: async (id: string, status: string) => {
    const { data, error } = await supabase
      .from('bookings')
      .update({ status })
      .eq('id', id)
      .select();
    if (error) return handleSupabaseErrorWrapper(error, 'updateBookingStatus');
    invalidateCachePrefix('admin:bookings:');
    invalidateCachePrefix('admin:dashboard:');
    return data;
  },

  assignBookingUnit: async (bookingId: string, carId: string) => {
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('id, car_id, vehicle_model_id, start_date, end_date, status')
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      return handleSupabaseErrorWrapper(bookingError, 'assignBookingUnit');
    }

    const { data: car, error: carError } = await supabase
      .from('cars')
      .select('id, vehicle_model_id, license_plate, status')
      .eq('id', carId)
      .single();

    if (carError || !car) {
      return handleSupabaseErrorWrapper(carError, 'assignBookingUnit');
    }

    // Relax validation check to allow admins to reassign units across family variants or perform manual upgrades.
    // Booking vehicle_model_id will automatically update to match the selected car's vehicle_model_id.
    // if (booking.vehicle_model_id && car.vehicle_model_id !== booking.vehicle_model_id) {
    //   throw new Error('Selected fleet unit is not linked to the booked vehicle model.');
    // }

    const hasOverlap = (startDate: string, endDate: string, existingStart: string, existingEnd: string) => {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const currentStart = new Date(existingStart);
      const currentEnd = new Date(existingEnd);
      return (
        (start >= currentStart && start <= currentEnd) ||
        (end >= currentStart && end <= currentEnd) ||
        (start <= currentStart && end >= currentEnd)
      );
    };

    const { data: bookingConflicts, error: bookingConflictsError } = await supabase
      .from('bookings')
      .select('id, start_date, end_date')
      .eq('car_id', carId)
      .neq('id', bookingId)
      .in('status', ['confirmed', 'on_trip', 'pending_payment_verification', 'pending']);

    if (bookingConflictsError) {
      return handleSupabaseErrorWrapper(bookingConflictsError, 'assignBookingUnit');
    }

    const bookingBlocked = (bookingConflicts || []).some((row: any) =>
      hasOverlap(booking.start_date, booking.end_date, row.start_date, row.end_date)
    );
    if (bookingBlocked) {
      throw new Error('Selected unit is not available for these booking dates.');
    }

    const { data: reservationConflicts, error: reservationConflictsError } = await supabase
      .from('car_reservations')
      .select('id, start_date, end_date')
      .eq('car_id', carId)
      .in('status', ['reserved', 'confirmed', 'pending_payment']);

    if (reservationConflictsError) {
      return handleSupabaseErrorWrapper(reservationConflictsError, 'assignBookingUnit');
    }

    const reservationBlocked = (reservationConflicts || []).some((row: any) =>
      hasOverlap(booking.start_date, booking.end_date, row.start_date, row.end_date)
    );
    if (reservationBlocked) {
      throw new Error('Selected unit has an overlapping reservation for these dates.');
    }

    const { data, error } = await supabase
      .from('bookings')
      .update({
        car_id: carId,
        vehicle_model_id: booking.vehicle_model_id || car.vehicle_model_id || null,
      })
      .eq('id', bookingId)
      .select();

    if (error) return handleSupabaseErrorWrapper(error, 'assignBookingUnit');
    invalidateCachePrefix('admin:bookings:');
    invalidateCachePrefix('admin:dashboard:');
    return data;
  },

  getVehicleModelVariantIds: async (modelId: string) => {
    return getOrSetCache(`admin:modelVariantIds:${modelId}`, ADMIN_CACHE_TTL_MS, async () => {
      const { data: model, error } = await supabase
        .from('vehicle_models')
        .select('id, make, model, family_slug')
        .eq('id', modelId)
        .single();

      if (error || !model) return [modelId];

      let query = supabase.from('vehicle_models').select('id');
      if (model.family_slug) {
        query = query.eq('family_slug', model.family_slug);
      } else {
        query = query.eq('make', model.make).eq('model', model.model);
      }

      const { data: variants, error: variantsError } = await query;
      if (variantsError || !variants?.length) return [modelId];
      return variants.map((row: { id: string }) => row.id);
    });
  },

  // --- Cars ---
  getVehicleModels: async (page: number = 1, pageSize: number = 50) => {
    return getOrSetCache(`admin:vehicleModels:${page}:${pageSize}`, ADMIN_CACHE_TTL_MS, async () => {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data, error, count } = await supabase
        .from('vehicle_models')
        .select(`
          *,
          cars(id)
        `, { count: 'exact' })
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) return handleSupabaseErrorWrapper(error, 'getVehicleModels');
      return { data: data || [], count: count || 0 };
    });
  },

  getCarsByVehicleModelIds: async (modelIds: string[]) => {
    if (!modelIds?.length) return [];
    const { data, error } = await supabase
      .from('cars')
      .select(`
        id,
        make,
        model,
        year,
        color,
        license_plate,
        status,
        maintenance_status,
        daily_rate,
        vehicle_model_id,
        primary_image_url,
        fleet_owner:user_profiles(full_name)
      `)
      .in('vehicle_model_id', modelIds)
      .order('year', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) return handleSupabaseErrorWrapper(error, 'getCarsByVehicleModelIds');
    return data || [];
  },

  getModelFleetStatus: async (
    modelIds: string[],
    options: { startDate?: string; endDate?: string } = {}
  ) => {
    if (!modelIds?.length) {
      return buildModelFleetStatus([], options);
    }

    const cacheKey = `admin:fleetStatus:${modelIds.sort().join(',')}:${options.startDate || 'all'}:${options.endDate || 'all'}`;
    return getOrSetCache(cacheKey, 30_000, async () => {
      const { data: units, error: unitsError } = await supabase
        .from('cars')
        .select(`
          id,
          make,
          model,
          year,
          color,
          license_plate,
          status,
          maintenance_status,
          daily_rate,
          vehicle_model_id,
          primary_image_url,
          is_outsourced,
          fleet_owner:user_profiles(full_name)
        `)
        .in('vehicle_model_id', modelIds)
        .order('license_plate');

      if (unitsError) return handleSupabaseErrorWrapper(unitsError, 'getModelFleetStatus');

      let bookings: any[] = [];
      let reservations: any[] = [];

      if (options.startDate && options.endDate) {
        const [{ data: bookingRows, error: bookingError }, { data: reservationRows, error: reservationError }] =
          await Promise.all([
            supabase
              .from('bookings')
              .select('id, car_id, start_date, end_date, status')
              .in('status', ['confirmed', 'on_trip', 'pending_payment_verification', 'pending'])
              .lte('start_date', options.endDate)
              .gte('end_date', options.startDate),
            supabase
              .from('car_reservations')
              .select('id, car_id, start_date, end_date, status, expires_at')
              .in('status', ['reserved', 'confirmed', 'pending_payment'])
              .lte('start_date', options.endDate)
              .gte('end_date', options.startDate),
          ]);

        if (bookingError) return handleSupabaseErrorWrapper(bookingError, 'getModelFleetStatus');
        if (reservationError) return handleSupabaseErrorWrapper(reservationError, 'getModelFleetStatus');
        bookings = bookingRows || [];
        reservations = (reservationRows || []).filter((r: any) => {
          if (r.status === 'pending_payment' && r.expires_at && new Date(r.expires_at) < new Date()) {
            return false;
          }
          return true;
        });
      }

      return buildModelFleetStatus(units || [], {
        startDate: options.startDate,
        endDate: options.endDate,
        bookings,
        reservations,
      });
    });
  },

  setVehicleModelBookingMode: async (
    modelIds: string[],
    bookingMode: 'both' | 'reservation_only' | 'disabled'
  ) => {
    if (!modelIds?.length) throw new Error('No model variants selected.');

    const { data, error } = await supabase
      .from('vehicle_models')
      .update({ booking_mode: bookingMode })
      .in('id', modelIds)
      .select('id, booking_mode');

    if (error) return handleSupabaseErrorWrapper(error, 'setVehicleModelBookingMode');
    invalidateFleetInventoryCaches();
    invalidateCachePrefix('admin:vehicleModels:');
    return data;
  },

  addOutsourcedCarForBooking: async (
    bookingId: string,
    car: {
      make: string;
      model: string;
      year: number;
      license_plate: string;
      color?: string;
      category?: string;
      daily_rate: number;
      primary_image_url?: string;
      description?: string;
      outsource_owner_name: string;
      outsource_owner_phone?: string | null;
      outsource_owner_email?: string | null;
      outsource_commission_rate?: number;
      vehicle_model_id: string;
    }
  ) => {
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('id, vehicle_model_id, start_date, end_date')
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      return handleSupabaseErrorWrapper(bookingError, 'addOutsourcedCarForBooking');
    }

    const targetModelId = car.vehicle_model_id || booking.vehicle_model_id;
    if (!targetModelId) {
      throw new Error('Booking has no vehicle model to link an outsourced unit.');
    }

    const created = await adminService.addCar({
      make: car.make,
      model: car.model,
      year: car.year,
      license_plate: car.license_plate.trim().toUpperCase(),
      color: car.color || 'N/A',
      category: car.category || 'Sedan',
      description: car.description || 'Outsourced partner vehicle',
      daily_rate: car.daily_rate,
      overtime_rate: 0,
      security_deposit: 0,
      status: 'available',
      transmission: 'Automatic',
      fuel_type: 'Petrol',
      seats: 5,
      features: [],
      photos: [],
      primary_image_url: car.primary_image_url || '',
      fleet_owner: null,
      vehicle_model_id: targetModelId,
      is_outsourced: true,
      is_approved: true,
      outsource_owner_name: car.outsource_owner_name,
      outsource_owner_phone: car.outsource_owner_phone || null,
      outsource_owner_email: car.outsource_owner_email || null,
      outsource_commission_rate: car.outsource_commission_rate ?? 15,
    });

    const newCar = Array.isArray(created) ? created[0] : created;
    if (!newCar?.id) {
      throw new Error('Failed to create outsourced fleet unit.');
    }

    await adminService.assignBookingUnit(bookingId, newCar.id);
    invalidateCachePrefix('admin:fleetStatus:');
    return newCar;
  },

  getCars: async (page: number = 1, pageSize: number = 20) => {
    return getOrSetCache(`admin:cars:${page}:${pageSize}`, ADMIN_CACHE_TTL_MS, async () => {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data, error, count } = await supabase
        .from('cars')
        .select(`
          *,
          vehicle_model:vehicle_models (
            id,
            display_name,
            make,
            model
          ),
          fleet_owner:user_profiles (
            *,
            fleet_owner_settings (*)
          )
        `, { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) return handleSupabaseErrorWrapper(error, 'getCars');

      const normalizedData = (data || []).map((car: any) => {
        if (car.fleet_owner) {
          const settings = car.fleet_owner.fleet_owner_settings;
          const settingsArray = settings
            ? (Array.isArray(settings) ? settings : [settings])
            : [];
          return {
            ...car,
            fleet_owner: {
              ...car.fleet_owner,
              fleet_owner_settings: settingsArray
            }
          };
        }
        return car;
      });

      return { data: normalizedData, count };
    });
  },

  uploadCarImage: async (file: File): Promise<string> => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
      const filePath = `car_images/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('public_assets')
        .upload(filePath, file);

      if (uploadError) {
        logger.error('Error uploading image:', uploadError);
        // Fallback to a placeholder if bucket doesn't exist
        return `https://picsum.photos/seed/${fileName}/800/600`;
      }

      const { data } = supabase.storage
        .from('public_assets')
        .getPublicUrl(filePath);

      return data.publicUrl;
    } catch (err) {
      logger.error('Failed to upload image:', err);
      return `https://picsum.photos/seed/${Math.random()}/800/600`;
    }
  },

  addCar: async (car: Partial<Car> & { fleet_owner?: string, fleet_owner_details?: any }) => {
    const { fleet_owner, fleet_owner_details, ...cleanCar } = car;
    const resolvedModelId = await resolveVehicleModelIdForCar(cleanCar);
    const processedCar = sanitizeCarPayload({
      ...cleanCar,
      vehicle_model_id: resolvedModelId,
      fleet_owner,
      next_service_date: cleanCar.next_service_date || null,
      last_maintenance_date: cleanCar.last_maintenance_date || null,
    });
    
    const { data, error } = await supabase
      .from('cars')
      .insert([processedCar])
      .select();
    if (error) return handleSupabaseErrorWrapper(error, 'addCar');
    invalidateFleetInventoryCaches();
    invalidateCachePrefix('admin:dashboard:');
    return data;
  },

  addVehicleModel: async (vehicleModel: any) => {
    const cleaned = sanitizeVehicleModelPayload(vehicleModel);
    const fallbackFamilyName =
      cleaned.family_name ||
      `${cleaned.make || vehicleModel.make || ''} ${cleaned.model || vehicleModel.model || ''}`.trim();
    const fallbackFamilySlug = (cleaned.family_slug || fallbackFamilyName)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    const payload = {
      ...cleaned,
      gallery_urls: cleaned.gallery_urls || [],
      features: cleaned.features || [],
      display_name:
        cleaned.display_name ||
        `${cleaned.make || vehicleModel.make || ''} ${cleaned.model || vehicleModel.model || ''}`.trim(),
      slug:
        cleaned.slug ||
        `${cleaned.make || vehicleModel.make || ''}-${cleaned.model || vehicleModel.model || ''}`
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, ''),
      family_name: fallbackFamilyName || null,
      family_slug: fallbackFamilySlug || null,
      variant_name: cleaned.variant_name || null,
      year: cleaned.year || null,
      category: cleaned.category || null,
      description: cleaned.description || null,
      primary_image_url: cleaned.primary_image_url || null,
      video_url: cleaned.video_url || null,
      transmission: cleaned.transmission || null,
      fuel_type: cleaned.fuel_type || null,
      seats: cleaned.seats || null,
      luggage: cleaned.luggage || null,
      base_daily_rate: cleaned.base_daily_rate || null,
      overtime_rate: cleaned.overtime_rate || 0,
      security_deposit: cleaned.security_deposit || 0,
      sort_order: cleaned.sort_order || 0,
      is_chauffeured_only: !!cleaned.is_chauffeured_only,
      is_public: cleaned.is_public !== false,
    };

    const { data, error } = await supabase
      .from('vehicle_models')
      .insert([payload])
      .select();
    if (error) return handleSupabaseErrorWrapper(error, 'addVehicleModel');
    invalidateFleetInventoryCaches();
    invalidateCachePrefix('admin:vehicleModels:');
    return data;
  },

  addOutsourcedCar: async (car: {
    make: string;
    model: string;
    year: number;
    license_plate: string;
    color?: string;
    category?: string;
    daily_rate: number;
    primary_image_url?: string;
    description?: string;
    outsource_owner_name: string;
    outsource_owner_phone?: string | null;
    outsource_owner_email?: string | null;
    outsource_commission_rate?: number;
  }) => {
    return adminService.addCar({
      make: car.make,
      model: car.model,
      year: car.year,
      license_plate: car.license_plate.trim().toUpperCase(),
      color: car.color || 'N/A',
      category: car.category || 'Sedan',
      description: car.description || 'Outsourced partner vehicle',
      daily_rate: car.daily_rate,
      overtime_rate: 0,
      security_deposit: 0,
      status: 'available',
      transmission: 'Automatic',
      fuel_type: 'Petrol',
      seats: 5,
      features: [],
      photos: [],
      primary_image_url: car.primary_image_url || '',
      fleet_owner: null,
      is_outsourced: true,
      is_approved: true,
      outsource_owner_name: car.outsource_owner_name,
      outsource_owner_phone: car.outsource_owner_phone || null,
      outsource_owner_email: car.outsource_owner_email || null,
      outsource_commission_rate: car.outsource_commission_rate ?? 15,
    });
  },

  updateCar: async (id: string, updates: any) => {
    const { fleet_owner, fleet_owner_details, ...cleanUpdates } = updates;
    const resolvedModelId = await resolveVehicleModelIdForCar(cleanUpdates);
    const processedUpdates = sanitizeCarPayload({
      ...cleanUpdates,
      vehicle_model_id: cleanUpdates.vehicle_model_id
        ? cleanUpdates.vehicle_model_id
        : resolvedModelId,
      fleet_owner,
      next_service_date: cleanUpdates.next_service_date || null,
      last_maintenance_date: cleanUpdates.last_maintenance_date || null,
    });
    
    const { data, error } = await supabase
      .from('cars')
      .update(processedUpdates)
      .eq('id', id)
      .select();
    if (error) return handleSupabaseErrorWrapper(error, 'updateCar');
    invalidateFleetInventoryCaches();
    invalidateCachePrefix('admin:dashboard:');
    return data;
  },

  updateVehicleModel: async (id: string, updates: any) => {
    const cleaned = sanitizeVehicleModelPayload(updates);
    const fallbackFamilyName =
      cleaned.family_name ||
      `${cleaned.make || updates.make || ''} ${cleaned.model || updates.model || ''}`.trim();
    const fallbackFamilySlug = (cleaned.family_slug || fallbackFamilyName)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    const payload = {
      ...cleaned,
      gallery_urls: cleaned.gallery_urls || [],
      features: cleaned.features || [],
      display_name:
        cleaned.display_name ||
        `${cleaned.make || updates.make || ''} ${cleaned.model || updates.model || ''}`.trim() ||
        null,
      slug: cleaned.slug || undefined,
      family_name: fallbackFamilyName || null,
      family_slug: fallbackFamilySlug || null,
      variant_name: cleaned.variant_name ?? null,
      year: cleaned.year ?? null,
      category: cleaned.category ?? null,
      description: cleaned.description ?? null,
      primary_image_url: cleaned.primary_image_url ?? null,
      video_url: cleaned.video_url ?? null,
      transmission: cleaned.transmission ?? null,
      fuel_type: cleaned.fuel_type ?? null,
      seats: cleaned.seats ?? null,
      luggage: cleaned.luggage ?? null,
      base_daily_rate: cleaned.base_daily_rate ?? null,
      overtime_rate: cleaned.overtime_rate ?? 0,
      security_deposit: cleaned.security_deposit ?? 0,
      sort_order: cleaned.sort_order ?? 0,
      is_chauffeured_only: !!cleaned.is_chauffeured_only,
      is_public: cleaned.is_public !== false,
      updated_at: new Date().toISOString(),
    };

    if (!payload.slug && (payload.make || payload.model)) {
      payload.slug = `${payload.make || ''}-${payload.model || ''}`
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    }

    const { data, error } = await supabase
      .from('vehicle_models')
      .update(payload)
      .eq('id', id)
      .select();
    if (error) return handleSupabaseErrorWrapper(error, 'updateVehicleModel');
    invalidateFleetInventoryCaches();
    invalidateCachePrefix('admin:vehicleModels:');
    return data;
  },

  updateVehicleModelsFamily: async (
    variantIds: string[],
    family: { family_name: string; family_slug: string }
  ) => {
    if (!variantIds?.length) return [];
    const familyName = family.family_name?.trim();
    const familySlug =
      family.family_slug?.trim() ||
      familyName
        ?.toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    if (!familyName || !familySlug) {
      throw new Error('Family name and slug are required');
    }

    const { data, error } = await supabase
      .from('vehicle_models')
      .update({
        family_name: familyName,
        family_slug: familySlug,
        updated_at: new Date().toISOString(),
      })
      .in('id', variantIds)
      .select();
    if (error) return handleSupabaseErrorWrapper(error, 'updateVehicleModelsFamily');
    invalidateFleetInventoryCaches();
    invalidateCachePrefix('admin:vehicleModels:');
    return data;
  },

  deleteCar: async (id: string) => {
    const { error } = await supabase
      .from('cars')
      .delete()
      .eq('id', id);
    if (error) return handleSupabaseErrorWrapper(error, 'deleteCar');
    invalidateFleetInventoryCaches();
    invalidateCachePrefix('admin:dashboard:');
  },

  deleteVehicleModel: async (id: string) => {
    const { error } = await supabase
      .from('vehicle_models')
      .delete()
      .eq('id', id);
    if (error) return handleSupabaseErrorWrapper(error, 'deleteVehicleModel');
    invalidateFleetInventoryCaches();
  },

  // --- Users ---
  getUsers: async () => {
    return getOrSetCache('admin:users', ADMIN_CACHE_TTL_MS, async () => {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, full_name, email, phone_number, role, status, created_at, last_login, avatar_url')
        .order('created_at', { ascending: false });
      if (error) return handleSupabaseErrorWrapper(error, 'getUsers');
      return data;
    });
  },

  updateUserRole: async (id: string, role: string) => {
    const { data, error } = await supabase
      .from('user_profiles')
      .update({ role })
      .eq('id', id)
      .select();
    if (error) return handleSupabaseErrorWrapper(error, 'updateUserRole');
    invalidateCachePrefix('admin:users');
    invalidateCachePrefix('admin:dashboard:');
    return data;
  },

  updateUserStatus: async (id: string, status: string) => {
    const { data, error } = await supabase
      .from('user_profiles')
      .update({ status })
      .eq('id', id)
      .select();
    if (error) return handleSupabaseErrorWrapper(error, 'updateUserStatus');
    invalidateCachePrefix('admin:users');
    return data;
  },

  deleteUser: async (id: string) => {
    const { data, error } = await supabase.functions.invoke('delete-user', {
      body: { userId: id }
    });

    if (error) {
      console.error('Delete user Edge Function error:', error);
      throw new Error(error.message || 'Failed to delete user');
    }

    if (data?.error) {
      console.error('Delete user API error:', data.error);
      throw new Error(data.error || 'Failed to delete user');
    }

    invalidateCachePrefix('admin:users');
    invalidateCachePrefix('admin:dashboard:');

    return true;
  },

  // --- Settings ---
  getSettings: async () => {
    const { data, error } = await supabase
      .from('settings')
      .select('*');
    if (error) return handleSupabaseErrorWrapper(error, 'getSettings');
    return data;
  },

  updateSetting: async (key: string, value: any) => {
    const { data, error } = await supabase
      .from('settings')
      .upsert({ key, value, updated_at: new Date().toISOString() })
      .select();
    if (error) return handleSupabaseErrorWrapper(error, 'updateSetting');
    return data;
  },

  getAdmins: async () => {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('role', 'admin')
      .order('created_at', { ascending: false });
    if (error) return handleSupabaseErrorWrapper(error, 'getAdmins');
    return data;
  },

  addAdmin: async (email: string) => {
    // This is tricky because we need to find the user by email first.
    // Assuming we have a way to find user by email or the user is already in user_profiles.
    const { data, error } = await supabase
      .from('user_profiles')
      .update({ role: 'admin' })
      .eq('email', email) // Assuming email is in user_profiles
      .select();
    if (error) return handleSupabaseErrorWrapper(error, 'addAdmin');
    return data;
  },

  removeAdmin: async (id: string) => {
    const { data, error } = await supabase
      .from('user_profiles')
      .update({ role: 'client' })
      .eq('id', id)
      .select();
    if (error) return handleSupabaseErrorWrapper(error, 'removeAdmin');
    return data;
  },

  // --- Fleet Owners ---
  getFleetOwnersWithStats: async () => {
    const { data: owners, error } = await supabase
      .from('user_profiles')
      .select(`
        *,
        fleet_owner_settings (*),
        cars (id),
        bookings!bookings_fleet_owner_id_fkey (total_amount, status, payment_status, start_date, end_date)
      `)
      .eq('role', 'fleet_owner');
      
    if (error) return handleSupabaseErrorWrapper(error, 'getFleetOwnersWithStats');
    
    // Normalize fleet_owner_settings to an array to match UI assumptions
    const normalizedOwners = (owners || []).map((owner: any) => {
      const settings = owner.fleet_owner_settings;
      const settingsArray = settings
        ? (Array.isArray(settings) ? settings : [settings])
        : [];
      return {
        ...owner,
        fleet_owner_settings: settingsArray
      };
    });

    const { data: payouts } = await supabase
      .from('payouts')
      .select('*');

    const { data: reviews } = await supabase
      .from('reviews')
      .select('user_id, rating');
      
    return normalizedOwners.map(owner => {
      const confirmedBookings = owner.bookings?.filter((b: any) => 
        (b.status === 'completed' || b.status === 'confirmed') && b.payment_status === 'paid'
      ) || [];

      const totalEarnings = confirmedBookings
        .reduce((sum: number, b: any) => sum + Number(b.total_amount), 0);

      const ownerPayouts = payouts?.filter(p => p.fleet_owner_id === owner.id) || [];
      const pendingPayouts = ownerPayouts.filter(p => p.status === 'pending')
        .reduce((sum: number, p: any) => sum + Math.abs(Number(p.amount)), 0);
      const payoutHistory = ownerPayouts.filter(p => p.status === 'completed');

      // Avg rating from reviews left on bookings for this owner's cars
      const ownerReviews = reviews?.filter(r => {
        const booking = owner.bookings?.find((b: any) => b.client_id === r.user_id);
        return !!booking;
      }) || [];
      const avgRating = ownerReviews.length > 0
        ? (ownerReviews.reduce((s: number, r: any) => s + Number(r.rating), 0) / ownerReviews.length).toFixed(1)
        : null;

      // Utilization: booked days / (total cars × 30 days window)
      const totalCars = owner.cars?.length || 0;
      let bookedDays = 0;
      confirmedBookings.forEach((b: any) => {
        if (b.start_date && b.end_date) {
          const days = Math.max(1, Math.round((new Date(b.end_date).getTime() - new Date(b.start_date).getTime()) / 86400000));
          bookedDays += days;
        }
      });
      const avgUtilization = totalCars > 0 ? Math.min(100, Math.round((bookedDays / (totalCars * 30)) * 100)) : 0;
      
      return {
        ...owner,
        total_cars: totalCars,
        total_earnings: totalEarnings,
        pending_payouts: pendingPayouts,
        payout_history: payoutHistory,
        avg_utilization: avgUtilization,
        avg_rating: avgRating
      };
    });
  },

  getFleetOwners: async () => {
    return getOrSetCache('admin:fleetOwners', ADMIN_CACHE_TTL_MS, async () => {
      const { data, error } = await supabase
        .from('user_profiles')
        .select(`
          id,
          full_name,
          email,
          phone_number,
          role,
          status,
          fleet_owner_settings (
            company_name,
            commission_rate
          )
        `)
        .eq('role', 'fleet_owner');
      if (error) return handleSupabaseErrorWrapper(error, 'getFleetOwners');

      const normalizedData = (data || []).map((owner: any) => {
        const settings = owner.fleet_owner_settings;
        const settingsArray = settings
          ? (Array.isArray(settings) ? settings : [settings])
          : [];
        return {
          ...owner,
          fleet_owner_settings: settingsArray
        };
      });

      return normalizedData;
    });
  },

  createFleetOwnerAccount: async (data: any) => {
    const { data: resData, error: invokeError } = await supabase.functions.invoke('create-user', {
      body: {
        email: data.email,
        password: data.password || 'Fleet123!',
        role: 'fleet_owner',
        fullName: data.contact_name,
        phoneNumber: data.phone_number,
        companyName: data.company_name,
        commissionRate: data.commission_rate
      }
    });

    if (invokeError) {
      throw new Error(invokeError.message || 'Failed to create fleet owner account');
    }
    if (resData?.error) {
      throw new Error(resData.error || 'Failed to create fleet owner account');
    }

    const userId = resData.userId;

    // Send welcome email
    try {
      const { sendTemplatedEmail } = await import('./emailProvider');
      await sendTemplatedEmail(data.email, 'fleet_owner_welcome', {
        name: data.contact_name,
        email: data.email,
      });
    } catch (emailErr) {
      logger.error('Failed to send fleet owner welcome email:', emailErr);
    }

    // In-app welcome message
    const { data: adminUser } = await supabase.auth.getUser();
    if (adminUser.user) {
      await supabase.from('messages').insert({
        sender_id: adminUser.user.id,
        receiver_id: userId,
        subject: 'Welcome to LinkedUp Cars - Fleet Owner Account',
        content: `Hello ${data.contact_name},\n\nYour Fleet Owner account has been created.\n\nLogin Email: ${data.email}\nTemporary Password: ${data.password || 'Fleet123!'}\n\nPlease log in and change your password immediately.`,
        status: 'unread'
      });
    }

    invalidateCachePrefix('admin:fleetOwners');
    invalidateCachePrefix('admin:users');
    invalidateCachePrefix('admin:dashboard:');

    return { id: userId, email: data.email };
  },

  addFleetOwner: async (owner: any) => {
    // This would typically involve creating a user profile and fleet owner settings.
    // For now, let's assume we are just updating an existing user to be a fleet owner.
    const { data, error } = await supabase
      .from('user_profiles')
      .update({ role: 'fleet_owner' })
      .eq('id', owner.id)
      .select();
    if (error) throw error;

    const { error: settingsError } = await supabase
      .from('fleet_owner_settings')
      .upsert({ id: owner.id, ...owner.settings });
    if (settingsError) throw settingsError;

    invalidateCachePrefix('admin:fleetOwners');
    invalidateCachePrefix('admin:users');

    return data;
  },

  updateFleetOwner: async (id: string, updates: any) => {
    const { error } = await supabase
      .from('fleet_owner_settings')
      .update(updates)
      .eq('id', id);
    if (error) throw error;
    invalidateCachePrefix('admin:fleetOwners');
    invalidateCachePrefix('admin:dashboard:');
  },

  deleteFleetOwner: async (id: string) => {
    // Delete fleet_owner_settings first (FK constraint)
    await supabase.from('fleet_owner_settings').delete().eq('id', id);

    // Revert profile role to client (preserves booking history)
    const { error } = await supabase
      .from('user_profiles')
      .update({ role: 'client' })
      .eq('id', id);
    if (error) throw error;
    invalidateCachePrefix('admin:fleetOwners');
    invalidateCachePrefix('admin:users');

    // Hard-delete from Supabase Auth via secure edge function
    const { data, error: invokeError } = await supabase.functions.invoke('delete-user', {
      body: { userId: id },
    });
    if (invokeError) {
      logger.warn('Could not delete auth user (non-fatal):', invokeError.message);
    } else if (data?.error) {
      logger.warn('Could not delete auth user (non-fatal):', data.error);
    }
  },

  updateFleetOwnerSettings: async (id: string, settings: any) => {
    const { data, error } = await supabase
      .from('fleet_owner_settings')
      .upsert({ id, ...settings })
      .select();
    if (error) return handleSupabaseErrorWrapper(error, 'updateFleetOwnerSettings');

    // Sync status/role with user_profiles if settings status is changed
    if (settings.status === 'active') {
      await supabase
        .from('user_profiles')
        .update({ role: 'fleet_owner', status: 'active' })
        .eq('id', id);
    } else if (settings.status === 'suspended') {
      await supabase
        .from('user_profiles')
        .update({ status: 'suspended' })
        .eq('id', id);
    }

    invalidateCachePrefix('admin:fleetOwners');
    invalidateCachePrefix('admin:users');
    invalidateCachePrefix('admin:dashboard:');

    return data;
  },

  resetFleetOwnerPassword: async (email: string) => {
    const fleetUrl = import.meta.env.VITE_FLEET_URL || 'https://fleet.linkedupcarsrentals.com';
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${fleetUrl}/login`,
    });
    if (error) return handleSupabaseErrorWrapper(error, 'resetFleetOwnerPassword');
  },

  // --- Financials ---
  getFinancials: async () => {
    try {
      logger.log('Fetching financials with confirmed bookings filter...');
      
      // Fetch only paid bookings with active statuses
      const { data: confirmedBookings, error: bookingsError } = await supabase
        .from('bookings')
        .select('id, total_amount, platform_commission, status, payment_status, created_at, car_id, client_id')
        .eq('payment_status', 'paid')
        .in('status', [...PAID_REVENUE_STATUSES_DB])
        .order('created_at', { ascending: false });
      
      if (bookingsError) {
        logger.error('Bookings query error:', bookingsError);
        throw bookingsError;
      }
      
      logger.log('Confirmed bookings fetched:', confirmedBookings?.length || 0);

      // Fetch transactions (for historical data that might be manually recorded)
      const { data: transactions, error: tError } = await supabase
        .from('transactions')
        .select('*')
        .order('created_at', { ascending: false });
      if (tError) {
        logger.warn('Transactions query failed (non-fatal):', tError);
      }

      // Fetch expenses
      const { data: expenses, error: eError } = await supabase
        .from('expenses')
        .select('*')
        .order('date', { ascending: false });
      if (eError) {
        logger.warn('Expenses query failed (non-fatal):', eError);
      }

      // Fetch payout_settlements with booking + car context for partner ledger
      const { data: settlements, error: settlementsError } = await supabase
        .from('payout_settlements')
        .select(`
          id, booking_id, type, target_id, amount, status, payment_reference, settled_at, created_at,
          booking:bookings(
            id, total_amount, platform_commission, created_at, payment_status, status, car_id,
            cars(id, make, model, is_outsourced, outsource_owner_name, fleet_owner_id)
          )
        `)
        .order('created_at', { ascending: false });
      if (settlementsError) {
        logger.warn('payout_settlements query failed (non-fatal):', settlementsError);
      }

      const { data: brokers } = await supabase
        .from('brokers')
        .select('id, name')
        .order('name', { ascending: true });

      const { data: outsourcedCars } = await supabase
        .from('cars')
        .select('id')
        .eq('is_outsourced', true);

      const outsourcedCarIds = new Set((outsourcedCars || []).map((c: any) => c.id));
      const settlementRows = settlements || [];
      const brokerRows = brokers || [];

      // Calculate revenue from confirmed bookings only
      const totalRevenue = confirmedBookings?.reduce((sum, booking) => sum + Number(booking.total_amount), 0) || 0;
      const totalPlatformCommission = confirmedBookings?.reduce(
        (sum, booking) => sum + Number(booking.platform_commission || 0),
        0
      ) || 0;

      const settledPayouts = settlementRows.filter((s: any) => s.status === 'paid');
      const totalPayouts = settledPayouts.reduce((sum: number, s: any) => sum + Number(s.amount || 0), 0);

      const pendingSettlementAmount = settlementRows
        .filter((s: any) => s.status === 'pending')
        .reduce((sum: number, s: any) => sum + Number(s.amount || 0), 0);

      const payoutBreakdown = settlementsError
        ? createEmptyPayoutBreakdown()
        : buildPayoutBreakdown(settlementRows, outsourcedCarIds);

      const bookingsById = new Map(
        (confirmedBookings || []).map((b: any) => [b.id, b])
      );

      const brokerReconciliation = settlementsError
        ? []
        : buildBrokerReconciliation(settlementRows, brokerRows, bookingsById);

      const bookingReconciliation = settlementsError
        ? []
        : buildBookingReconciliation(settlementRows, brokerRows);

      const chartData = settlementsError
        ? []
        : buildMonthlyPartnerChart(confirmedBookings || [], settlementRows, outsourcedCarIds);

      const totalExpenses = expenses?.reduce((sum, e) => sum + Number(e.amount), 0) || 0;

      // Net platform revenue = gross - settled supplier/broker payouts - expenses
      const netRevenue = totalRevenue - totalPayouts - totalExpenses;

      logger.log('Financials calculated:', {
        totalRevenue,
        totalPayouts,
        totalExpenses,
        netRevenue,
        pendingSettlementAmount,
        totalPlatformCommission,
      });

      return {
        transactions: transactions || [],
        expenses: expenses || [],
        settlements: settlementRows,
        totalRevenue,
        totalPlatformCommission,
        totalPayouts,
        totalExpenses,
        netRevenue,
        pendingSettlementAmount,
        payoutBreakdown,
        brokerReconciliation,
        bookingReconciliation,
        chartData,
      };
    } catch (error) {
      logger.error('getFinancials error:', error);
      return handleSupabaseErrorWrapper(error, 'getFinancials');
    }
  },

  // --- Finance Extras: P&L, Receivables Aging, Tax Summary ---
  getFinanceExtras: async (rangeDays: number = 90) => {
    try {
      const sinceISO = new Date(Date.now() - rangeDays * 86400000).toISOString();
      const VAT_RATE = 0.16;

      const [bookingsRes, expensesRes, payoutsRes] = await Promise.all([
        supabase
          .from('bookings')
          .select('id, total_amount, amount_paid, payment_status, status, start_date, end_date, created_at, user_id')
          .gte('created_at', sinceISO),
        supabase.from('expenses').select('amount, category, created_at').gte('created_at', sinceISO),
        supabase.from('payouts').select('amount, status, created_at').gte('created_at', sinceISO),
      ]);

      const bookings = bookingsRes.data || [];
      const expenses = expensesRes.data || [];
      const payouts = payoutsRes.data || [];

      // Monthly P&L
      const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const monthly: Record<string, any> = {};
      const seedMonths = Math.min(12, Math.ceil(rangeDays / 30));
      for (let i = seedMonths - 1; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        d.setDate(1);
        monthly[monthKey(d)] = { month: monthKey(d), revenue: 0, expenses: 0, payouts: 0, netProfit: 0 };
      }
      bookings
        .filter((b: any) => b.payment_status === 'paid')
        .forEach((b: any) => {
          const k = monthKey(new Date(b.start_date || b.created_at));
          if (!monthly[k]) monthly[k] = { month: k, revenue: 0, expenses: 0, payouts: 0, netProfit: 0 };
          monthly[k].revenue += Number(b.total_amount || 0);
        });
      expenses.forEach((e: any) => {
        const k = monthKey(new Date(e.created_at));
        if (!monthly[k]) monthly[k] = { month: k, revenue: 0, expenses: 0, payouts: 0, netProfit: 0 };
        monthly[k].expenses += Number(e.amount || 0);
      });
      payouts
        .filter((p: any) => p.status === 'processed')
        .forEach((p: any) => {
          const k = monthKey(new Date(p.created_at));
          if (!monthly[k]) monthly[k] = { month: k, revenue: 0, expenses: 0, payouts: 0, netProfit: 0 };
          monthly[k].payouts += Number(p.amount || 0);
        });
      Object.values(monthly).forEach((m: any) => (m.netProfit = m.revenue - m.expenses));
      const pnl = Object.values(monthly).sort((a: any, b: any) => a.month.localeCompare(b.month));

      // Receivables aging: bookings with balance owed
      const now = Date.now();
      const buckets = { current: 0, d30: 0, d60: 0, d90: 0, over90: 0 };
      const receivables: any[] = [];
      bookings.forEach((b: any) => {
        const owed = Number(b.total_amount || 0) - Number(b.amount_paid || 0);
        if (owed <= 0) return;
        if (b.status === 'cancelled') return;
        const age = Math.floor((now - new Date(b.created_at).getTime()) / 86400000);
        let bucket: keyof typeof buckets = 'current';
        if (age > 90) bucket = 'over90';
        else if (age > 60) bucket = 'd90';
        else if (age > 30) bucket = 'd60';
        else if (age > 0) bucket = 'd30';
        buckets[bucket] += owed;
        receivables.push({ id: b.id, owed, ageDays: age, bucket, status: b.status });
      });

      // Tax summary (revenue is VAT-inclusive; extract embedded VAT)
      const grossRevenue = bookings
        .filter((b: any) => b.payment_status === 'paid')
        .reduce((s: number, b: any) => s + Number(b.total_amount || 0), 0);
      const vatCollected = grossRevenue - grossRevenue / (1 + VAT_RATE);
      const netOfVat = grossRevenue - vatCollected;

      return {
        rangeDays,
        pnl,
        receivables: {
          buckets,
          total: Object.values(buckets).reduce((s, v) => s + v, 0),
          count: receivables.length,
          items: receivables.sort((a, b) => b.ageDays - a.ageDays).slice(0, 50),
        },
        tax: {
          rate: VAT_RATE,
          grossRevenue,
          vatCollected,
          netOfVat,
        },
      };
    } catch (error) {
      logger.error('getFinanceExtras error:', error);
      return handleSupabaseErrorWrapper(error, 'getFinanceExtras');
    }
  },

  // --- Payouts ---
  getPayouts: async () => {
    // First get all payout transactions
    const { data: transactions, error: txError } = await supabase
      .from('transactions')
      .select('*')
      .eq('type', 'payout_out')
      .order('created_at', { ascending: false });
    
    if (txError) return handleSupabaseErrorWrapper(txError, 'getPayouts');
    
    // Then get user profiles for each transaction
    const userIds = [...new Set(transactions?.map(t => t.user_id) || [])];
    if (userIds.length === 0) return [];
    
    const { data: profiles, error: profileError } = await supabase
      .from('user_profiles')
      .select('id, full_name, email')
      .in('id', userIds);
    
    if (profileError) return handleSupabaseErrorWrapper(profileError, 'getPayouts');
    
    // Combine the data
    return transactions?.map(tx => ({
      ...tx,
      user_profile: profiles?.find(p => p.id === tx.user_id)
    })) || [];
  },

  approvePayouts: async (ids: string[]) => {
    const { data, error } = await supabase
      .from('transactions')
      .update({ status: 'completed' })
      .in('id', ids)
      .select();
    if (error) return handleSupabaseErrorWrapper(error, 'approvePayouts');
    return data;
  },

  getTransactions: async () => {
    const { data, error } = await supabase
      .from('transactions')
      .select(`
        *,
        bookings (*),
        user_profiles (*)
      `)
      .order('created_at', { ascending: false });
    if (error) return handleSupabaseErrorWrapper(error, 'getTransactions');
    return data;
  },

  getExpenses: async () => {
    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .order('date', { ascending: false });
    if (error) return handleSupabaseErrorWrapper(error, 'getExpenses');
    return data;
  },

  addExpense: async (expense: any) => {
    const { data, error } = await supabase
      .from('expenses')
      .insert([expense])
      .select();
    if (error) return handleSupabaseErrorWrapper(error, 'addExpense');
    return data;
  },

  // --- Pricing ---
  getPricingRules: async () => {
    const { data, error } = await supabase
      .from('pricing_rules')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) return handleSupabaseErrorWrapper(error, 'getPricingRules');
    return data;
  },

  addPricingRule: async (rule: any) => {
    const { data, error } = await supabase
      .from('pricing_rules')
      .insert([rule])
      .select();
    if (error) return handleSupabaseErrorWrapper(error, 'addPricingRule');
    return data;
  },

  updatePricingRule: async (id: string, updates: any) => {
    const { data, error } = await supabase
      .from('pricing_rules')
      .update(updates)
      .eq('id', id)
      .select();
    if (error) return handleSupabaseErrorWrapper(error, 'updatePricingRule');
    return data;
  },

  deletePricingRule: async (id: string) => {
    const { error } = await supabase
      .from('pricing_rules')
      .delete()
      .eq('id', id);
    if (error) return handleSupabaseErrorWrapper(error, 'deletePricingRule');
  },

  // --- Coupons (Removed duplicate) ---

  // --- Reviews ---
  getReviews: async () => {
    const { data, error } = await supabase
      .from('reviews')
      .select(`
        *,
        user_profiles (full_name),
        cars (*)
      `)
      .order('created_at', { ascending: false });
    if (error) return handleSupabaseErrorWrapper(error, 'getReviews');
    return data;
  },

  updateReviewStatus: async (id: string, status: string) => {
    const { data, error } = await supabase
      .from('reviews')
      .update({ status })
      .eq('id', id)
      .select();
    if (error) return handleSupabaseErrorWrapper(error, 'updateReviewStatus');
    return data;
  },

  deleteReview: async (id: string) => {
    const { error } = await supabase
      .from('reviews')
      .delete()
      .eq('id', id);
    if (error) return handleSupabaseErrorWrapper(error, 'deleteReview');
  },

  // --- Reports ---
  getReports: async () => {
    const { data, error } = await supabase
      .from('reports')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) return handleSupabaseErrorWrapper(error, 'getReports');
    return data;
  },

  getReportStats: async () => {
    try {
      const { count: userCount } = await supabase.from('user_profiles').select('*', { count: 'exact', head: true });
      const { data: cars } = await supabase.from('cars').select('status');
      
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const { count: newUsersCount } = await supabase
        .from('user_profiles')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', thirtyDaysAgo.toISOString());

      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
      const { count: prevUsersCount } = await supabase
        .from('user_profiles')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', sixtyDaysAgo.toISOString())
        .lt('created_at', thirtyDaysAgo.toISOString());

      const platformGrowth = prevUsersCount && prevUsersCount > 0 
        ? ((newUsersCount || 0) / prevUsersCount) * 100 
        : (newUsersCount || 0) > 0 ? 100 : 0;

      const operationalCars = cars?.filter(c => c.status !== 'maintenance').length || 0;
      const fleetHealth = cars?.length ? (operationalCars / cars.length) * 100 : 100;

      return {
        platformGrowth: Number(platformGrowth.toFixed(1)),
        activeUsers: userCount || 0,
        fleetHealth: Number(fleetHealth.toFixed(1)),
        newUsers: newUsersCount || 0
      };
    } catch (error) {
      return { platformGrowth: 0, activeUsers: 0, fleetHealth: 0, newUsers: 0 };
    }
  },

  generateReport: async (report: any) => {
    const { data, error } = await supabase
      .from('reports')
      .insert([{ ...report, status: 'generating' }])
      .select();
    if (error) return handleSupabaseErrorWrapper(error, 'generateReport');
    
    // Simulate generation for now
    setTimeout(async () => {
      await supabase
        .from('reports')
        .update({ status: 'ready', file_url: 'https://example.com/report.pdf' })
        .eq('id', data[0].id);
    }, 100);

    return data;
  },

  // --- Drivers ---
  getDrivers: async () => {
    const { data, error } = await supabase
      .from('user_profiles')
      .select(`
        *,
        driver_profiles (*),
        bookings:bookings!bookings_driver_id_fkey (
          id,
          status,
          needs_chauffeur,
          start_date,
          end_date,
          total_amount,
          cars (make, model, license_plate)
        )
      `)
      .eq('role', 'driver');
    if (error) return handleSupabaseErrorWrapper(error, 'getDrivers');
    return data;
  },

  addDriver: async (driver: any) => {
    const { data: resData, error: invokeError } = await supabase.functions.invoke('create-user', {
      body: {
        email: driver.email,
        password: driver.password || 'Driver123!',
        role: 'driver',
        fullName: driver.full_name,
        phoneNumber: driver.phone_number,
        licenseNumber: driver.license_number
      }
    });

    if (invokeError) {
      throw new Error(invokeError.message || 'Failed to add driver');
    }
    if (resData?.error) {
      throw new Error(resData.error || 'Failed to add driver');
    }

    return [{ id: resData.userId, ...driver }];
  },

  updateDriverStatus: async (id: string, status: string) => {
    const { data, error } = await supabase
      .from('driver_profiles')
      .update({ status })
      .eq('id', id)
      .select();
    if (error) return handleSupabaseErrorWrapper(error, 'updateDriverStatus');
    return data;
  },

  updateFleetOwnerStatus: async (id: string, status: string) => {
    // 1. Upsert fleet_owner_settings status (to support users who don't have settings row yet)
    const { data, error } = await supabase
      .from('fleet_owner_settings')
      .upsert({ id, status })
      .select();
    if (error) return handleSupabaseErrorWrapper(error, 'updateFleetOwnerStatus');

    // 2. Sync user_profiles.role so ProtectedRoute grants portal access
    if (status === 'active') {
      const { error: roleError } = await supabase
        .from('user_profiles')
        .update({ role: 'fleet_owner', status: 'active' })
        .eq('id', id);
      if (roleError) {
        logger.error('[updateFleetOwnerStatus] Failed to sync user_profiles role:', roleError);
      }
    } else if (status === 'suspended') {
      const { error: roleError } = await supabase
        .from('user_profiles')
        .update({ status: 'suspended' })
        .eq('id', id);
      if (roleError) {
        logger.error('[updateFleetOwnerStatus] Failed to sync user_profiles status:', roleError);
      }
    }

    return data;
  },

  updateCarStatus: async (id: string, status: string) => {
    const { data, error } = await supabase
      .from('cars')
      .update({ status })
      .eq('id', id)
      .select();
    if (error) return handleSupabaseErrorWrapper(error, 'updateCarStatus');
    return data;
  },

  // --- Verifications ---
  getVerifications: async () => {
    try {
      const { data: drivers, error: dError } = await supabase
        .from('driver_profiles')
        .select(`
          *,
          user_profiles (*)
        `)
        .eq('status', 'pending_verification');
      if (dError) throw dError;

      const { data: owners, error: oError } = await supabase
        .from('fleet_owner_settings')
        .select(`
          *,
          user_profiles (*)
        `)
        .eq('status', 'pending_verification');
      if (oError) throw oError;

      const { data: cars, error: cError } = await supabase
        .from('cars')
        .select(`
          *,
          fleet_owner:user_profiles (*)
        `)
        .or('status.eq.unavailable,is_approved.eq.false');
      if (cError) throw cError;

      return {
        drivers: drivers || [],
        fleetOwners: owners || [],
        cars: cars || []
      };
    } catch (error) {
      return handleSupabaseErrorWrapper(error, 'getVerifications');
    }
  },

  // --- Car Performance & Earnings ---
  getCarEarnings: async () => {
    try {
      const { data: cars, error: cError } = await supabase
        .from('cars')
        .select(`
          *,
          fleet_owner:user_profiles (*)
        `);
      if (cError) throw cError;

      const { data: bookings, error: bError } = await supabase
        .from('bookings')
        .select('*')
        .in('status', [...PAID_REVENUE_STATUSES_DB])
        .eq('payment_status', 'paid');
      if (bError) throw bError;

      const { data: maintenance, error: mError } = await supabase
        .from('maintenance')
        .select('*');
      if (mError) throw mError;

      return (cars || []).map(car => {
        const carBookings = bookings.filter(b => b.car_id === car.id);
        const carMaintenance = maintenance.filter(m => m.car_id === car.id);
        
        const totalEarnings = carBookings.reduce((sum, b) => sum + (b.total_amount || 0), 0);
        const totalMaintenance = carMaintenance.reduce((sum, m) => sum + (m.cost || 0), 0);
        const tripsCount = carBookings.length;
        
        const totalBookingDays = carBookings.reduce((sum, b) => {
          const start = new Date(b.start_date);
          const end = new Date(b.end_date);
          return sum + Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
        }, 0);

        const lastTrip = carBookings.sort((a, b) => new Date(b.end_date).getTime() - new Date(a.end_date).getTime())[0];
        
        return {
          ...car,
          totalEarnings,
          totalMaintenance,
          tripsCount,
          lastTripDate: lastTrip ? lastTrip.end_date : 'N/A',
          utilizationRate: tripsCount > 0 ? Math.min(Math.round((totalBookingDays / 30) * 100), 100) : 0,
          avgDailyEarnings: totalBookingDays > 0 ? totalEarnings / totalBookingDays : 0,
          payoutStatus: 'paid'
        };
      });
    } catch (error) {
      return handleSupabaseErrorWrapper(error, 'getCarEarnings');
    }
  },

  getCarEarningsStats: async () => {
    try {
      const { data: cars } = await supabase.from('cars').select('id, make, model, daily_rate');
      const { data: bookings } = await supabase.from('bookings')
        .select('car_id, total_amount, start_date, end_date')
        .in('status', [...PAID_REVENUE_STATUSES_DB])
        .eq('payment_status', 'paid');

      if (!cars || !bookings) return { highestEarner: 'N/A', highestEarnings: 0, avgUtilization: 0, avgDailyEarning: 0 };

      const carEarningsMap: Record<string, number> = {};
      const carBookingDaysMap: Record<string, number> = {};
      let totalBookingDays = 0;
      
      bookings.forEach(b => {
        carEarningsMap[b.car_id] = (carEarningsMap[b.car_id] || 0) + Number(b.total_amount);
        const start = new Date(b.start_date);
        const end = new Date(b.end_date);
        const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
        totalBookingDays += days;
        carBookingDaysMap[b.car_id] = (carBookingDaysMap[b.car_id] || 0) + days;
      });

      let highestEarnerId = '';
      let highestEarnings = 0;
      Object.entries(carEarningsMap).forEach(([id, earnings]) => {
        if (earnings > highestEarnings) {
          highestEarnings = earnings;
          highestEarnerId = id;
        }
      });

      const highestEarnerCar = cars.find(c => (c as any).id === highestEarnerId);

      // Average daily earning per car (from actual paid bookings, not list daily_rate)
      let sumCarAvgDaily = 0;
      let carsWithTrips = 0;
      cars.forEach(car => {
        const days = carBookingDaysMap[(car as any).id] || 0;
        if (days > 0) {
          sumCarAvgDaily += (carEarningsMap[(car as any).id] || 0) / days;
          carsWithTrips++;
        }
      });
      const avgDailyEarning = carsWithTrips > 0 ? sumCarAvgDaily / carsWithTrips : 0;
      
      // Calculate utilization: total booking days / (total cars * 30 days) for a rough monthly estimate
      const avgUtilization = cars.length > 0 ? (totalBookingDays / (cars.length * 30)) * 100 : 0;

      return {
        highestEarner: highestEarnerCar ? `${highestEarnerCar.make} ${highestEarnerCar.model}` : 'N/A',
        highestEarnings,
        avgUtilization: Math.min(Math.round(avgUtilization), 100),
        avgDailyEarning: Number(avgDailyEarning.toFixed(2))
      };
    } catch (error) {
      return { highestEarner: 'N/A', highestEarnings: 0, avgUtilization: 0, avgDailyEarning: 0 };
    }
  },

  // --- Per-Car Report Card ---
  // Returns a full financial + operational snapshot for a single car.
  // rangeDays limits the trend window (default 180 days).
  getCarReport: async (carId: string, rangeDays: number = 180) => {
    try {
      const since = new Date(Date.now() - rangeDays * 24 * 60 * 60 * 1000).toISOString();

      const [carRes, bookingsRes, expensesRes, maintenanceRes] = await Promise.all([
        supabase.from('cars').select('*, fleet_owner:user_profiles(*)').eq('id', carId).maybeSingle(),
        supabase
          .from('bookings')
          .select('id, start_date, end_date, total_amount, status, payment_status, created_at, user_profiles(full_name)')
          .eq('car_id', carId)
          .order('start_date', { ascending: false }),
        supabase
          .from('expenses')
          .select('id, amount, type, category, description, created_at, meta')
          .eq('car_id', carId)
          .order('created_at', { ascending: false }),
        supabase
          .from('maintenance')
          .select('id, cost, description, service_date, created_at')
          .eq('car_id', carId)
          .order('created_at', { ascending: false }),
      ]);

      if (carRes.error) throw carRes.error;
      const car = carRes.data;
      const bookings = bookingsRes.data || [];
      const expenses = expensesRes.data || [];
      const maintenance = maintenanceRes.data || [];

      const paidBookings = bookings.filter(
        (b: any) =>
          PAID_REVENUE_STATUSES_DB.includes(b.status) && b.payment_status === 'paid',
      );

      const totalRevenue = paidBookings.reduce((s: number, b: any) => s + Number(b.total_amount || 0), 0);
      const totalExpenses = expenses.reduce((s: number, e: any) => s + Number(e.amount || 0), 0);
      const totalMaintenance = maintenance.reduce((s: number, m: any) => s + Number(m.cost || 0), 0);
      const netProfit = totalRevenue - totalExpenses - totalMaintenance;
      const roi = totalExpenses + totalMaintenance > 0
        ? (netProfit / (totalExpenses + totalMaintenance)) * 100
        : 0;

      // Booking days & utilization
      let totalBookingDays = 0;
      paidBookings.forEach((b: any) => {
        const d = Math.max(
          1,
          Math.ceil((new Date(b.end_date).getTime() - new Date(b.start_date).getTime()) / 86400000),
        );
        totalBookingDays += d;
      });
      const utilizationRate = Math.min(Math.round((totalBookingDays / Math.max(rangeDays, 1)) * 100), 100);
      const avgDailyRevenue = totalBookingDays > 0 ? totalRevenue / totalBookingDays : 0;
      const revenuePerTrip = paidBookings.length > 0 ? totalRevenue / paidBookings.length : 0;

      // Monthly trend (revenue vs cost) for last rangeDays
      const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const monthly: Record<string, { month: string; revenue: number; cost: number; trips: number }> = {};
      const seedMonths = Math.min(12, Math.ceil(rangeDays / 30));
      for (let i = seedMonths - 1; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        d.setDate(1);
        const k = monthKey(d);
        monthly[k] = { month: k, revenue: 0, cost: 0, trips: 0 };
      }
      paidBookings.forEach((b: any) => {
        const k = monthKey(new Date(b.start_date));
        if (!monthly[k]) monthly[k] = { month: k, revenue: 0, cost: 0, trips: 0 };
        monthly[k].revenue += Number(b.total_amount || 0);
        monthly[k].trips += 1;
      });
      [...expenses, ...maintenance.map((m: any) => ({ ...m, amount: m.cost, created_at: m.service_date || m.created_at }))].forEach((e: any) => {
        const k = monthKey(new Date(e.created_at));
        if (!monthly[k]) monthly[k] = { month: k, revenue: 0, cost: 0, trips: 0 };
        monthly[k].cost += Number(e.amount || 0);
      });
      const trend = Object.values(monthly).sort((a, b) => a.month.localeCompare(b.month));

      // Expense breakdown by type
      const expenseByType: Record<string, number> = {};
      expenses.forEach((e: any) => {
        const t = e.type || e.category || 'other';
        expenseByType[t] = (expenseByType[t] || 0) + Number(e.amount || 0);
      });
      if (totalMaintenance > 0) expenseByType['maintenance'] = (expenseByType['maintenance'] || 0) + totalMaintenance;
      const expenseBreakdown = Object.entries(expenseByType)
        .map(([type, amount]) => ({ type, amount }))
        .sort((a, b) => b.amount - a.amount);

      const lastTrip = paidBookings[0];
      const nextBooking = bookings.find((b: any) => new Date(b.start_date) > new Date());

      return {
        car,
        kpis: {
          totalRevenue,
          totalExpenses: totalExpenses + totalMaintenance,
          netProfit,
          roi,
          tripsCount: paidBookings.length,
          totalBookingDays,
          utilizationRate,
          avgDailyRevenue,
          revenuePerTrip,
        },
        trend,
        expenseBreakdown,
        recentBookings: bookings.slice(0, 10),
        recentExpenses: expenses.slice(0, 10),
        recentMaintenance: maintenance.slice(0, 5),
        lastTripDate: lastTrip?.end_date || null,
        nextBookingDate: nextBooking?.start_date || null,
        rangeDays,
      };
    } catch (error) {
      return handleSupabaseErrorWrapper(error, 'getCarReport');
    }
  },

  // --- Messages ---
  getMessages: async () => {
    const { data, error } = await supabase
      .from('messages')
      .select(`
        *,
        sender:user_profiles!sender_id(*),
        receiver:user_profiles!receiver_id(*)
      `)
      .order('created_at', { ascending: false });
    if (error) return handleSupabaseErrorWrapper(error, 'getMessages');
    return data;
  },

  sendMessage: async (message: any) => {
    const { data, error } = await supabase
      .from('messages')
      .insert([message])
      .select();
    if (error) return handleSupabaseErrorWrapper(error, 'sendMessage');
    return data;
  },

  sendBroadcast: async (broadcast: any) => {
    const { data, error } = await supabase
      .from('broadcasts')
      .insert([broadcast])
      .select();
    if (error) return handleSupabaseErrorWrapper(error, 'sendBroadcast');
    return data;
  },

  // --- Hero Content ---
  getHeroContent: async () => {
    const { data, error } = await supabase
      .from('hero_content')
      .select('*')
      .order('display_order', { ascending: true });
    if (error) return handleSupabaseErrorWrapper(error, 'getHeroContent');
    return data;
  },

  createHeroContent: async (content: any) => {
    // Sanitize payload to ensure correct types for Supabase
    const sanitizedContent = {
      ...content,
      car_id: (content.car_id === "" || !content.car_id) ? null : content.car_id,
      display_order: parseInt(content.display_order) || 0,
      is_active: Boolean(content.is_active)
    };

    const { data, error } = await supabase
      .from('hero_content')
      .insert([sanitizedContent])
      .select();
    if (error) return handleSupabaseErrorWrapper(error, 'createHeroContent');
    return data;
  },

  // --- App Settings ---
  getAppSettings: async (keys?: string[]) => {
    let query = supabase.from('app_settings').select('*');
    if (keys && keys.length > 0) {
      query = query.in('key', keys);
    }
    const { data, error } = await query;
    if (error) return handleSupabaseErrorWrapper(error, 'getAppSettings');
    return data;
  },

  updateAppSetting: async (key: string, value: string, description?: string) => {
    const { data, error } = await supabase
      .from('app_settings')
      .upsert({ key, value, logo_url: value, description }, { onConflict: 'key' })
      .select();
    if (error) return handleSupabaseErrorWrapper(error, 'updateAppSetting');
    return data;
  },

  deleteHeroContent: async (id: string) => {
    const { error } = await supabase
      .from('hero_content')
      .delete()
      .eq('id', id);
    if (error) return handleSupabaseErrorWrapper(error, 'deleteHeroContent');
    return true;
  },

  // --- Contracts ---
  getContracts: async () => {
    const { data, error } = await supabase
      .from('contracts_master')
      .select('*')
      .order('version', { ascending: false });
    if (error) return handleSupabaseErrorWrapper(error, 'getContracts');
    return data;
  },

  createContract: async (contract: any) => {
    const { data, error } = await supabase
      .from('contracts_master')
      .insert([contract])
      .select();
    if (error) return handleSupabaseErrorWrapper(error, 'createContract');
    return data;
  },

  deleteContract: async (id: string) => {
    const { error } = await supabase
      .from('contracts_master')
      .delete()
      .eq('id', id);
    if (error) return handleSupabaseErrorWrapper(error, 'deleteContract');
    return true;
  },

  getPaymentRequests: async () => {
    const { data: payments, error } = await supabase
      .from('payment_requests')
      .select('*, bookings(*)')
      .order('created_at', { ascending: false });

    if (error) return handleSupabaseErrorWrapper(error, 'getPaymentRequests');

    const clientIds = [...new Set((payments || []).map((payment: any) => payment.client_id).filter(Boolean))];
    let profiles: any[] = [];

    if (clientIds.length > 0) {
      const { data: profileData, error: profileError } = await supabase
        .from('user_profiles')
        .select('id, full_name, email, phone_number')
        .in('id', clientIds);

      if (profileError) return handleSupabaseErrorWrapper(profileError, 'getPaymentRequestsProfiles');
      profiles = profileData || [];
    }

    return (payments || []).map((payment: any) => ({
      ...payment,
      client: profiles.find(profile => profile.id === payment.client_id) || null,
    }));
  },

  syncPaymentRequest: async (paymentRequestId: string) => {
    const response = await fetch('/api/ncba/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentRequestId }),
    });

    const data = await response.json();
    if (!response.ok || data.error) {
      throw new Error(data.error || 'Failed to sync NCBA payment status');
    }

    return data;
  },

  syncPaymentByBookingId: async (bookingId: string) => {
    const response = await fetch(`/api/ncba/sync-booking/${bookingId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    const data = await response.json();
    if (!response.ok || data.error) {
      throw new Error(data.error || 'Failed to sync NCBA payment for booking');
    }

    return data;
  },

  verifyPayment: async (_id: string, status: 'verified' | 'rejected', _verifiedById: string, bookingId?: string, amount?: number, clientId?: string, transactionCode?: string) => {
    logger.log('Verifying payment:', { status, bookingId, amount, clientId, transactionCode });
    const data = { status };

    if (status === 'verified' && bookingId) {
      // First check if booking is cancelled
      const { data: booking } = await supabase
        .from('bookings')
        .select('status')
        .eq('id', bookingId)
        .single();

      if (booking?.status === 'cancelled') {
        throw new Error('Cannot verify payment for cancelled booking');
      }

      // Update booking status to confirmed + payment to paid
      const { error: updateError } = await supabase
        .from('bookings')
        .update({ status: 'confirmed', payment_status: 'paid' })
        .eq('id', bookingId);

      if (updateError) {
        logger.error('Error updating booking status:', updateError);
        throw new Error('Failed to update booking status');
      }

      // Create a transaction record (only if we have client context)
      if (clientId && amount) {
        const { error: transactionError } = await supabase
          .from('transactions')
          .insert({
            booking_id: bookingId,
            user_id: clientId,
            amount: amount,
            type: 'payment_in',
            status: 'completed',
            transaction_code: transactionCode || bookingId
          });

        if (transactionError) {
          logger.error('Error creating transaction:', transactionError);
        }

        // Send in-app notification to the client
        await supabase.from('notifications').insert({
          user_id: clientId,
          title: 'Payment Approved',
          content: `Your M-Pesa payment of KSh ${Number(amount).toLocaleString()} has been verified. Your booking is now confirmed!`,
          type: 'success',
          is_read: false,
          link: `/bookings/${bookingId}`,
        }).then(() => {}, (err: any) => logger.error('Notification insert error:', err));
      }

      logger.log('Payment verification completed successfully');
    } else if (status === 'rejected' && bookingId) {
      // Revert booking status to pending + mark payment as failed
      const { error: updateError } = await supabase
        .from('bookings')
        .update({ status: 'pending', payment_status: 'failed' })
        .eq('id', bookingId);

      if (updateError) {
        logger.error('Error updating booking status to failed:', updateError);
        throw new Error('Failed to update booking status');
      }

      logger.log('Payment rejection completed successfully');
    }

    return data;
  },

  // --- Growth Tools (Coupons) ---
  getCoupons: async () => {
    const { data, error } = await supabase
      .from('coupons')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) return handleSupabaseErrorWrapper(error, 'getCoupons');
    return data;
  },

  createCoupon: async (coupon: any) => {
    const { data, error } = await supabase
      .from('coupons')
      .insert([coupon])
      .select();
    if (error) return handleSupabaseErrorWrapper(error, 'createCoupon');
    return data;
  },

  deleteCoupon: async (id: string) => {
    const { error } = await supabase
      .from('coupons')
      .delete()
      .eq('id', id);
    if (error) return handleSupabaseErrorWrapper(error, 'deleteCoupon');
    return true;
  },
  // --- Incidents ---
  getIncidents: async () => {
    const { data, error } = await supabase
      .from('incidents')
      .select(`
        *,
        car:cars (*),
        user:user_profiles!incidents_user_id_fkey (*)
      `)
      .order('created_at', { ascending: false });
    if (error) return handleSupabaseErrorWrapper(error, 'getIncidents');
    return data;
  },

  updateIncidentStatus: async (id: string, status: string) => {
    const { data, error } = await supabase
      .from('incidents')
      .update({ status })
      .eq('id', id)
      .select();
    if (error) return handleSupabaseErrorWrapper(error, 'updateIncidentStatus');
    return data;
  },

  // --- Client Documents ---
  getClientDocuments: async () => {
    const { data, error } = await supabase
      .from('client_documents')
      .select(`
        *,
        client:user_profiles!client_id (*)
      `)
      .order('uploaded_at', { ascending: false });
    if (error) return handleSupabaseErrorWrapper(error, 'getClientDocuments');
    return data;
  },

  approveClientDocument: async (id: string, verifiedBy: string) => {
    const { data, error } = await supabase
      .from('client_documents')
      .update({ 
        status: 'approved', 
        verified_at: new Date().toISOString(), 
        verified_by: verifiedBy 
      })
      .eq('id', id)
      .select();
    if (error) return handleSupabaseErrorWrapper(error, 'approveClientDocument');
    return data;
  },

  rejectClientDocument: async (id: string, reason: string, verifiedBy: string) => {
    const { data, error } = await supabase
      .from('client_documents')
      .update({ 
        status: 'rejected', 
        rejection_reason: reason,
        verified_at: new Date().toISOString(), 
        verified_by: verifiedBy 
      })
      .eq('id', id)
      .select();
    if (error) return handleSupabaseErrorWrapper(error, 'rejectClientDocument');
    return data;
  },

  getSystemHealth: async () => {
    const start = Date.now();
    const { error: dbError } = await supabase.from('cars').select('id').limit(1);
    const end = Date.now();
    const latency = end - start;
    
    const status = dbError ? 'down' : (latency > 500 ? 'degraded' : 'operational');
    const authLatency = Math.max(10, latency - 5);
    const storageLatency = latency + 15;
    
    return {
      services: [
        { name: 'Database', status, latency: `${latency}ms`, uptime: '99.99%' },
        { name: 'Authentication', status, latency: `${authLatency}ms`, uptime: '100%' },
        { name: 'Storage', status, latency: `${storageLatency}ms`, uptime: '99.95%' },
        { name: 'API Gateway', status: 'operational', latency: '24ms', uptime: '99.99%' },
        { name: 'Payment Gateway', status: 'operational', latency: '156ms', uptime: '99.8%' },
      ],
      performance: Array.from({ length: 7 }).map((_, i) => {
        const d = new Date();
        d.setHours(d.getHours() - (6 - i) * 4);
        return {
          time: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          cpu: Math.floor(Math.random() * 40) + 10,
          memory: Math.floor(Math.random() * 30) + 40,
          network: Math.floor(Math.random() * 50) + 20,
        };
      })
    };
  },

  deleteBooking: async (bookingId: string) => {
    try {
      logger.log('Deleting booking:', bookingId);

      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        throw new Error('You must be signed in to delete bookings.');
      }

      const response = await fetch(`/api/bookings/${bookingId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || `Failed to delete booking (${response.status})`);
      }

      logger.log('Booking deleted');
      return { success: true };
    } catch (error) {
      logger.error('Delete booking failed:', error);
      return handleSupabaseErrorWrapper(error, 'deleteBooking');
    }
  },

  deleteReservation: async (reservationId: string) => {
    const { data, error } = await supabase
      .from('car_reservations')
      .delete()
      .eq('id', reservationId);
    if (error) return handleSupabaseErrorWrapper(error, 'deleteReservation');
    invalidateCachePrefix('admin:reservations:');
    invalidateFleetInventoryCaches();
    return data;
  },

  getBrokers: async () => {
    const { data, error } = await supabase
      .from('brokers')
      .select('*')
      .order('name', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  addBroker: async (broker: {
    name: string;
    phone?: string | null;
    email?: string | null;
    default_commission_rate?: number;
  }) => {
    const { data, error } = await supabase
      .from('brokers')
      .insert({
        name: broker.name,
        phone: broker.phone || null,
        email: broker.email || null,
        default_commission_rate: broker.default_commission_rate ?? 10,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },
};