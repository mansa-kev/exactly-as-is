import { supabase, handleSupabaseErrorWrapper as handleSupabaseError } from '../lib/supabase';
import { logger } from '../utils/logger';
import { Car, VehicleModel } from '../types';
import { getOrSetCache, invalidateCachePrefix } from '../utils/queryCache';
import { groupVehicleModels, VehicleModelGroup } from '../utils/vehicleModelGrouping';
import {
  CALENDAR_BLOCKING_STATUSES_DB,
  PAID_REVENUE_STATUSES_DB,
  isActiveBookingStatus,
  isPaidRevenueStatus,
} from '../constants/bookingStatuses';

const FLEET_CACHE_TTL_MS = 60_000;

export const fleetService = {
  getModelUnitCounts: async (): Promise<Record<string, number>> => {
    return getOrSetCache('fleet:modelUnitCounts', FLEET_CACHE_TTL_MS, async () => {
      const { data, error } = await supabase
        .from('cars')
        .select('vehicle_model_id')
        .not('vehicle_model_id', 'is', null);
      if (error) return {};
      const counts: Record<string, number> = {};
      for (const row of data || []) {
        if (!row.vehicle_model_id) continue;
        counts[row.vehicle_model_id] = (counts[row.vehicle_model_id] || 0) + 1;
      }
      return counts;
    });
  },

  // --- Public Fleet ---
  getAllVehicleModels: async () => {
    return getOrSetCache('fleet:allVehicleModels', FLEET_CACHE_TTL_MS, async () => {
      const { data, error } = await supabase
        .from('vehicle_models')
        .select('*')
        .eq('is_public', true)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false });
      if (error) return handleSupabaseError(error, 'getAllVehicleModels');
      return data as VehicleModel[];
    });
  },

  getGroupedPublicVehicleModels: async (): Promise<VehicleModelGroup[]> => {
    return getOrSetCache('fleet:groupedVehicleModels', FLEET_CACHE_TTL_MS, async () => {
      const [models, unitCounts] = await Promise.all([
        fleetService.getAllVehicleModels(),
        fleetService.getModelUnitCounts(),
      ]);
      const modelList = Array.isArray(models) ? models : [];
      return groupVehicleModels(modelList, unitCounts).filter((group) => group.is_public);
    });
  },

  getAvailableGroupedVehicleModels: async (
    pickupDate: string,
    dropoffDate: string
  ): Promise<VehicleModelGroup[]> => {
    const [availableModels, unitCounts] = await Promise.all([
      fleetService.getAvailableVehicleModels(pickupDate, dropoffDate),
      fleetService.getModelUnitCounts(),
    ]);
    const modelList = Array.isArray(availableModels) ? availableModels : [];
    return groupVehicleModels(modelList, unitCounts);
  },


  getVehicleModelFamilyByFriendlyId: async (friendlyId: number): Promise<VehicleModelGroup | null> => {
    const groupedPublic = await fleetService.getGroupedPublicVehicleModels();
    const cachedGroup = groupedPublic.find((group) =>
      group.variants.some((variant) => variant.friendly_id === friendlyId)
    );
    if (cachedGroup) return cachedGroup;

    const model = await fleetService.getVehicleModelByFriendlyId(friendlyId);
    if (!model) return null;

    let query = supabase.from('vehicle_models').select('*');
    if (model.family_slug) {
      query = query.eq('family_slug', model.family_slug);
    } else {
      query = query.eq('make', model.make).eq('model', model.model);
    }

    const { data, error } = await query.order('year', { ascending: false, nullsFirst: false });

    if (error) return handleSupabaseError(error, 'getVehicleModelFamilyByFriendlyId');
    const unitCounts = await fleetService.getModelUnitCounts();
    const groups = groupVehicleModels((data || []) as VehicleModel[], unitCounts);
    return groups.find((group) => group.variants.some((variant) => variant.friendly_id === friendlyId)) || groups[0] || null;
  },

  getVehicleModelFamilyById: async (id: string): Promise<VehicleModelGroup | null> => {
    const groupedPublic = await fleetService.getGroupedPublicVehicleModels();
    const cachedGroup = groupedPublic.find((group) =>
      group.variants.some((variant) => variant.id === id)
    );
    if (cachedGroup) return cachedGroup;

    const model = await fleetService.getVehicleModelById(id);
    if (!model) return null;

    let query = supabase.from('vehicle_models').select('*');
    if (model.family_slug) {
      query = query.eq('family_slug', model.family_slug);
    } else {
      query = query.eq('make', model.make).eq('model', model.model);
    }

    const { data, error } = await query.order('year', { ascending: false, nullsFirst: false });

    if (error) return handleSupabaseError(error, 'getVehicleModelFamilyById');
    const unitCounts = await fleetService.getModelUnitCounts();
    const groups = groupVehicleModels((data || []) as VehicleModel[], unitCounts);
    return groups.find((group) => group.variants.some((variant) => variant.id === id)) || groups[0] || null;
  },

  getRelatedVehicleModelGroups: async (
    category: string,
    excludeGroupKey: string,
    limit = 4
  ): Promise<VehicleModelGroup[]> => {
    if (!category) return [];
    const groups = await fleetService.getGroupedPublicVehicleModels();
    return groups
      .filter(
        (group) =>
          group.groupKey !== excludeGroupKey &&
          (group.category || '').toLowerCase() === category.toLowerCase()
      )
      .slice(0, limit);
  },

  getPublicUnitsForModelIds: async (modelIds: string[]) => {
    if (!modelIds?.length) return [];
    const { data, error } = await supabase
      .from('cars')
      .select('id, year, color, transmission, fuel_type, seats, status, vehicle_model_id, primary_image_url, photos')
      .in('vehicle_model_id', modelIds)
      .eq('status', 'available')
      .order('year', { ascending: false });
    if (error) return [];
    return data || [];
  },

  getAvailableVehicleModels: async (pickupDate: string, dropoffDate: string) => {
    // Pick models that have at least one available unit not blocked by booking.
    // This is intentionally simple for phase 1: it preserves the existing unit-level availability logic.
    const { data: cars, error: carsError } = await supabase
      .from('cars')
      .select('id, vehicle_model_id')
      .eq('status', 'available')
      .not('vehicle_model_id', 'is', null);

    if (carsError) return handleSupabaseError(carsError, 'getAvailableVehicleModels - cars');
    if (!cars?.length) return [];

    const carIds = cars.map((c: any) => c.id);

    const { data: bookings, error: bookingsError } = await supabase
      .from('bookings')
      .select('car_id')
      .in('car_id', carIds)
      .or(`start_date.lte.${dropoffDate},end_date.gte.${pickupDate}`)
      .in('status', [...CALENDAR_BLOCKING_STATUSES_DB]);

    if (bookingsError) return handleSupabaseError(bookingsError, 'getAvailableVehicleModels - bookings');

    const { data: reservations, error: reservationsError } = await supabase
      .from('car_reservations')
      .select('car_id, vehicle_model_id')
      .or(`start_date.lte.${dropoffDate},end_date.gte.${pickupDate}`)
      .in('status', ['reserved', 'confirmed', 'pending_payment']);

    if (reservationsError) return handleSupabaseError(reservationsError, 'getAvailableVehicleModels - reservations');

    const bookedCarIds = new Set((bookings || []).map((b: any) => b.car_id));
    const reservedCarIds = new Set(
      (reservations || []).map((r: any) => r.car_id).filter(Boolean)
    );

    const modelOnlyReservationCounts: Record<string, number> = {};
    for (const reservation of reservations || []) {
      if (!reservation.car_id && reservation.vehicle_model_id) {
        modelOnlyReservationCounts[reservation.vehicle_model_id] =
          (modelOnlyReservationCounts[reservation.vehicle_model_id] || 0) + 1;
      }
    }

    const freeUnitsByModel: Record<string, number> = {};
    for (const car of cars || []) {
      if (!car.vehicle_model_id) continue;
      if (bookedCarIds.has(car.id) || reservedCarIds.has(car.id)) continue;
      freeUnitsByModel[car.vehicle_model_id] = (freeUnitsByModel[car.vehicle_model_id] || 0) + 1;
    }

    const availableModelIds = Object.keys(freeUnitsByModel).filter(
      (modelId) => freeUnitsByModel[modelId] > (modelOnlyReservationCounts[modelId] || 0)
    );

    if (availableModelIds.length === 0) return [];

    const { data: models, error: modelsError } = await supabase
      .from('vehicle_models')
      .select('*')
      .in('id', availableModelIds)
      .eq('is_public', true)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });

    if (modelsError) return handleSupabaseError(modelsError, 'getAvailableVehicleModels - models');
    return models as VehicleModel[];
  },


  getVehicleModelByFriendlyId: async (friendlyId: number) => {
    const { data, error } = await supabase
      .from('vehicle_models')
      .select('*')
      .eq('friendly_id', friendlyId)
      .maybeSingle();
    if (error) return handleSupabaseError(error, 'getVehicleModelByFriendlyId');
    return data as VehicleModel | null;
  },

  getVehicleModelById: async (id: string) => {
    const { data, error } = await supabase
      .from('vehicle_models')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) return handleSupabaseError(error, 'getVehicleModelById');
    return data as VehicleModel | null;
  },

  getAllCars: async () => {
    return getOrSetCache('fleet:allCars', FLEET_CACHE_TTL_MS, async () => {
      const { data, error } = await supabase
        .from('cars')
        .select('*')
        .eq('status', 'available')
        .order('created_at', { ascending: false });
      if (error) return handleSupabaseError(error, 'getAllCars');
      return data;
    });
  },

  getAvailableCars: async (pickupDate: string, dropoffDate: string, location?: string) => {
    // 1. Get all cars
    const { data: cars, error: carsError } = await supabase
      .from('cars')
      .select('*')
      .eq('status', 'available');
    
    if (carsError) return handleSupabaseError(carsError, 'getAvailableCars - cars');

    // 2. Get all bookings that overlap with the requested dates
    const { data: bookings, error: bookingsError } = await supabase
      .from('bookings')
      .select('car_id')
      .or(`start_date.lte.${dropoffDate},end_date.gte.${pickupDate}`)
      .in('status', [...CALENDAR_BLOCKING_STATUSES_DB]);

    if (bookingsError) return handleSupabaseError(bookingsError, 'getAvailableCars - bookings');

    const bookedCarIds = new Set(bookings?.map(b => b.car_id));

    // 3. Filter out booked cars
    return cars?.filter(car => !bookedCarIds.has(car.id)) || [];
  },

  getCarById: async (id: string) => {
    const { data, error } = await supabase
      .from('cars')
      .select('*')
      .eq('id', id)
      .single();
    if (error) return handleSupabaseError(error, 'getCarById');
    return data;
  },

  // --- Dashboard ---
  getDashboardStats: async (fleetOwnerId: string) => {
    return getOrSetCache(`fleet:dashboard:${fleetOwnerId}`, FLEET_CACHE_TTL_MS, async () => {
      try {
        // Fetch cars
        const { data: cars, error: cError } = await supabase
          .from('cars')
          .select('id, make, model, status, daily_rate')
          .eq('fleet_owner_id', fleetOwnerId);
        if (cError) throw cError;

        // Fetch bookings
        const { data: bookings, error: bError } = await supabase
          .from('bookings')
          .select('id, car_id, status, total_amount, start_date, end_date, created_at')
          .eq('fleet_owner_id', fleetOwnerId);
        if (bError) throw bError;

        // Fetch payouts (handle gracefully if table doesn't exist yet)
        let payouts: any[] = [];
        try {
          const { data: pData, error: pError } = await supabase
            .from('payouts')
            .select('amount, status, created_at')
            .eq('fleet_owner_id', fleetOwnerId);
          if (pError) throw pError;
          payouts = pData || [];
        } catch (e) {
          logger.warn("Could not fetch payouts. Table might not exist yet.", e);
        }

        const totalCars = cars.length;
        const activeBookings = bookings.filter(b => isActiveBookingStatus(b.status)).length;
        const maintenanceCars = cars.filter(c => c.status === 'maintenance').length;
      
      // Utilization Rate (simplified: active bookings / total cars)
      const utilizationRate = totalCars > 0 ? Math.round((activeBookings / totalCars) * 100) : 0;

      const totalEarnings = bookings
        .filter(b => isPaidRevenueStatus(b.status))
        .reduce((sum, b) => sum + Number(b.total_amount), 0);

      const netPayouts = payouts
        .filter(p => p.status === 'processed')
        .reduce((sum, p) => sum + Number(p.amount), 0);

      const pendingPayouts = payouts
        .filter(p => p.status === 'pending')
        .reduce((sum, p) => sum + Number(p.amount), 0);

      // Bookings last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const recentBookings = bookings.filter(b => new Date(b.created_at) >= thirtyDaysAgo);
      const totalBookings30Days = recentBookings.length;

      // Average Booking Duration
      let totalDurationDays = 0;
      let durationCount = 0;
      bookings.forEach(b => {
        if (b.start_date && b.end_date) {
          const start = new Date(b.start_date);
          const end = new Date(b.end_date);
          const diffTime = Math.abs(end.getTime() - start.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          totalDurationDays += diffDays;
          durationCount++;
        }
      });
      const avgBookingDuration = durationCount > 0 ? Math.round(totalDurationDays / durationCount) : 0;

      // Monthly Earnings Trend (Last 6 months)
      const monthlyEarningsMap: Record<string, number> = {};
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      
      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        monthlyEarningsMap[`${monthNames[d.getMonth()]} ${d.getFullYear()}`] = 0;
      }

      payouts.filter(p => p.status === 'processed').forEach(p => {
        const d = new Date(p.created_at);
        const key = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
        if (monthlyEarningsMap[key] !== undefined) {
          monthlyEarningsMap[key] += Number(p.amount);
        }
      });
      
      const monthlyEarningsTrend = Object.keys(monthlyEarningsMap).map(key => ({
        month: key,
        earnings: monthlyEarningsMap[key]
      }));

      // Days with Most Bookings
      const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const dayCounts = [0, 0, 0, 0, 0, 0, 0];
      bookings.forEach(b => {
        if (b.start_date) {
          const d = new Date(b.start_date);
          dayCounts[d.getDay()]++;
        }
      });
      const bookingsByDay = daysOfWeek.map((day, index) => ({
        day,
        bookings: dayCounts[index]
      }));

      // Car Performance Snapshot
      const carRevenueMap: Record<string, number> = {};
      cars.forEach(c => carRevenueMap[c.id] = 0);
      
      bookings.filter(b => isPaidRevenueStatus(b.status)).forEach(b => {
        if (b.car_id && carRevenueMap[b.car_id] !== undefined) {
          carRevenueMap[b.car_id] += Number(b.total_amount);
        }
      });

      let topCar = null;
      let underperformingCar = null;
      
      if (cars.length > 0) {
        const sortedCars = [...cars].sort((a, b) => (carRevenueMap[b.id] || 0) - (carRevenueMap[a.id] || 0));
        topCar = {
          name: `${sortedCars[0].make} ${sortedCars[0].model}`,
          revenue: carRevenueMap[sortedCars[0].id] || 0
        };
        const lastCar = sortedCars[sortedCars.length - 1];
        underperformingCar = {
          name: `${lastCar.make} ${lastCar.model}`,
          revenue: carRevenueMap[lastCar.id] || 0
        };
      }

        return {
          totalCars,
          activeBookings,
          maintenanceCars,
          utilizationRate,
          totalEarnings,
          netPayouts,
          pendingPayouts,
          totalBookings30Days,
          avgBookingDuration,
          monthlyEarningsTrend,
          bookingsByDay,
          topCar,
          underperformingCar
        };
      } catch (error) {
        return handleSupabaseError(error, 'getDashboardStats');
      }
    });
  },

  // --- Fleet Management ---
  getMyCars: async (fleetOwnerId: string) => {
    return getOrSetCache(`fleet:cars:${fleetOwnerId}`, FLEET_CACHE_TTL_MS, async () => {
      const { data, error } = await supabase
        .from('cars')
        .select('*')
        .eq('fleet_owner_id', fleetOwnerId);
      if (error) return handleSupabaseError(error, 'getMyCars');
      return data;
    });
  },

  getCarDetails: async (carId: string) => {
    try {
      const { data: car, error: cError } = await supabase
        .from('cars')
        .select('*')
        .eq('id', carId)
        .single();
      if (cError) throw cError;

      const { data: maintenance, error: mError } = await supabase
        .from('maintenance')
        .select('*')
        .eq('car_id', carId)
        .order('date', { ascending: false });
      if (mError) throw mError;

      const { data: damageReports, error: dError } = await supabase
        .from('damage_reports')
        .select('*')
        .eq('car_id', carId)
        .order('created_at', { ascending: false });
      if (dError) throw dError;

      const { data: bookings, error: bError } = await supabase
        .from('bookings')
        .select('*')
        .eq('car_id', carId)
        .order('start_date', { ascending: true });
      if (bError) throw bError;

      return { ...car, maintenance, damageReports, bookings };
    } catch (error) {
      return handleSupabaseError(error, 'getCarDetails');
    }
  },

  addCar: async (car: Partial<Car>) => {
    const processedCar = {
      ...car,
      is_approved: false,
      status: 'unavailable'
    };
    const { data, error } = await supabase
      .from('cars')
      .insert([processedCar])
      .select();
    if (error) return handleSupabaseError(error, 'addCar');
    invalidateCachePrefix('fleet:allCars');
    invalidateCachePrefix('fleet:allVehicleModels');
    invalidateCachePrefix('fleet:cars:');
    invalidateCachePrefix('fleet:dashboard:');
    return data;
  },

  updateCar: async (id: string, updates: Partial<Car>) => {
    const { data, error } = await supabase
      .from('cars')
      .update(updates)
      .eq('id', id)
      .select();
    if (error) return handleSupabaseError(error, 'updateCar');
    invalidateCachePrefix('fleet:allCars');
    invalidateCachePrefix('fleet:allVehicleModels');
    invalidateCachePrefix('fleet:cars:');
    invalidateCachePrefix('fleet:dashboard:');
    return data;
  },

  getMaintenanceLogs: async (fleetOwnerId: string) => {
    // We need to fetch cars first to get their IDs, or use a join if Supabase allows filtering on joined tables
    const { data: cars, error: cError } = await supabase
      .from('cars')
      .select('id')
      .eq('fleet_owner_id', fleetOwnerId);
    if (cError) return handleSupabaseError(cError, 'getMaintenanceLogs - cars');
    
    const carIds = cars?.map(c => c.id) || [];
    if (carIds.length === 0) return [];

    const { data, error } = await supabase
      .from('maintenance')
      .select('*, cars(make, model, license_plate)')
      .in('car_id', carIds)
      .order('date', { ascending: false });
    if (error) return handleSupabaseError(error, 'getMaintenanceLogs');
    return data;
  },

  addMaintenanceLog: async (log: any) => {
    const { data, error } = await supabase
      .from('maintenance')
      .insert([log])
      .select();
    if (error) return handleSupabaseError(error, 'addMaintenanceLog');
    return data;
  },

  getDamageReports: async (fleetOwnerId: string) => {
    const { data, error } = await supabase
      .from('damage_reports')
      .select('*, cars(make, model, license_plate)')
      .eq('fleet_owner_id', fleetOwnerId)
      .order('created_at', { ascending: false });
    if (error) return handleSupabaseError(error, 'getDamageReports');
    return data;
  },

  getReviews: async (carId: string) => {
    const { data, error } = await supabase
      .from('car_reviews')
      .select('*')
      .eq('car_id', carId)
      .eq('status', 'approved')
      .order('created_at', { ascending: false });
    if (error) return [];
    return data;
  },

  getReviewsForVehicleModel: async (modelId: string, variantIds?: string[]) => {
    const modelIds = variantIds?.length ? variantIds : [modelId];
    const { data: units, error: unitsError } = await supabase
      .from('cars')
      .select('id')
      .in('vehicle_model_id', modelIds);
    if (unitsError) return [];

    const carIds = (units || []).map((unit) => unit.id);
    if (!carIds.length) return [];

    const { data, error } = await supabase
      .from('car_reviews')
      .select('*')
      .in('car_id', carIds)
      .eq('status', 'approved')
      .order('created_at', { ascending: false });
    if (error) return [];
    return data;
  },

  submitReview: async (review: { booking_id: string; car_id: string; user_id: string; rating: number; comment: string }) => {
    const { data, error } = await supabase
      .from('car_reviews')
      .insert([{ ...review, status: 'pending' }])
      .select()
      .single();
    if (error) return handleSupabaseError(error, 'submitReview');
    return data;
  },

  addDamageReport: async (report: any) => {
    const { data, error } = await supabase
      .from('damage_reports')
      .insert([report])
      .select();
    if (error) return handleSupabaseError(error, 'addDamageReport');
    return data;
  },

  // --- Financial & Payout Center ---
  getPayouts: async (fleetOwnerId: string) => {
    const { data, error } = await supabase
      .from('payouts')
      .select('*, bookings(id, start_date, end_date)')
      .eq('fleet_owner_id', fleetOwnerId)
      .order('created_at', { ascending: false });
    if (error) return handleSupabaseError(error, 'getPayouts');
    return data;
  },

  getBookingsForEarnings: async (fleetOwnerId: string) => {
    const { data, error } = await supabase
      .from('bookings')
      .select('id, start_date, end_date, total_amount, status, cars(make, model)')
      .eq('fleet_owner_id', fleetOwnerId)
      .eq('payment_status', 'paid')
      .in('status', [...PAID_REVENUE_STATUSES_DB]);
    if (error) return handleSupabaseError(error, 'getBookingsForEarnings');
    return data;
  },

  getExpenses: async (fleetOwnerId: string) => {
    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .eq('user_id', fleetOwnerId) // Using user_id as fleet_owner_id
      .order('date', { ascending: false });
    if (error) return handleSupabaseError(error, 'getExpenses');
    return data;
  },

  addExpense: async (expense: any) => {
    const { data, error } = await supabase
      .from('expenses')
      .insert([expense])
      .select();
    if (error) return handleSupabaseError(error, 'addExpense');
    return data;
  },

  // --- Operations & Communication ---
  getMessages: async (fleetOwnerId: string) => {
    const { data, error } = await supabase
      .from('messages')
      .select('*, sender:sender_id(full_name), receiver:receiver_id(full_name)')
      .or(`sender_id.eq.${fleetOwnerId},receiver_id.eq.${fleetOwnerId}`)
      .order('created_at', { ascending: false });
    if (error) return handleSupabaseError(error, 'getMessages');
    return data;
  },

  sendMessage: async (message: any) => {
    const { data, error } = await supabase
      .from('messages')
      .insert([message])
      .select();
    if (error) return handleSupabaseError(error, 'sendMessage');
    return data;
  },

  getPendingBookingRequests: async (fleetOwnerId: string) => {
    const { data, error } = await supabase
      .from('bookings')
      .select('*, cars(make, model), client:client_id(full_name)')
      .eq('fleet_owner_id', fleetOwnerId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    if (error) return handleSupabaseError(error, 'getPendingBookingRequests');
    return data;
  },

  updateBookingStatus: async (bookingId: string, status: string) => {
    const { data, error } = await supabase
      .from('bookings')
      .update({ status })
      .eq('id', bookingId)
      .select();
    if (error) return handleSupabaseError(error, 'updateBookingStatus');
    return data;
  },

  getEContracts: async (fleetOwnerId: string) => {
    const { data, error } = await supabase
      .from('e_contracts')
      .select('*, bookings(id, cars(make, model))')
      .eq('bookings.fleet_owner_id', fleetOwnerId);
    if (error) return handleSupabaseError(error, 'getEContracts');
    return data;
  },

  getRenterDocuments: async (fleetOwnerId: string) => {
    // First get unique client IDs for this fleet owner
    const { data: bookings, error: bError } = await supabase
      .from('bookings')
      .select('client_id')
      .eq('fleet_owner_id', fleetOwnerId);
    if (bError) return handleSupabaseError(bError, 'getRenterDocuments - bookings');
    
    const clientIds = [...new Set(bookings?.map(b => b.client_id))];
    if (clientIds.length === 0) return [];

    const { data, error } = await supabase
      .from('client_documents')
      .select('*')
      .in('client_id', clientIds);
    if (error) return handleSupabaseError(error, 'getRenterDocuments');
    return data;
  },

  getGrowthInsights: async (fleetOwnerId: string) => {
    try {
      logger.log("Fetching insights for fleetOwnerId:", fleetOwnerId);
      // Fetch necessary data for insights
      const { data: cars, error: cError } = await supabase.from('cars').select('*');
      const { data: bookings, error: bError } = await supabase.from('bookings').select('*, cars(category)');
      const { data: pricingRules, error: pError } = await supabase.from('pricing_rules').select('*');
      
      logger.log("Fetched data:", { cars, bookings, pricingRules });
      if (cError || bError || pError) {
        logger.error("Error fetching data:", { cError, bError, pError });
        throw cError || bError || pError;
      }

      const myCars = cars?.filter(c => c.fleet_owner_id === fleetOwnerId) || [];
      logger.log("My cars:", myCars);
      
      // 1. Dynamic Pricing Suggestions (Heuristic)
      const pricingSuggestions = myCars.map(car => {
        const avgRate = cars?.filter(c => c.category === car.category).reduce((sum, c) => sum + Number(c.daily_rate), 0) / (cars?.filter(c => c.category === car.category).length || 1);
        const suggestedRate = Math.round(avgRate * 1.05); // Simple 5% adjustment heuristic
        return { carId: car.id, carName: `${car.make} ${car.model}`, currentRate: car.daily_rate, suggestedRate };
      }).filter(s => s.suggestedRate !== s.currentRate);
      logger.log("Pricing suggestions:", pricingSuggestions);

      // 2. Market Insights
      const categoryCounts: Record<string, number> = {};
      (bookings || []).forEach((b: any) => {
        const cat = b.cars?.category;
        if (cat) {
          categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
        }
      });
      const topCategories = Object.entries(categoryCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([cat, count]) => ({ query: `${cat} searches`, count: count * 3 + 12 })); // simulated search volume based on real bookings
      
      const marketInsights = {
        topQueries: topCategories.length ? topCategories : [
          { query: 'SUV rentals', count: 15 },
          { query: 'Electric cars', count: 10 }
        ],
        underSupplied: topCategories.length > 0 ? `High demand for ${topCategories[0].query.split(' ')[0]} vehicles based on platform activity` : 'High demand for SUVs in your area'
      };

      // 3. Fleet Expansion Recommendations
      const expansionRecommendations = topCategories.map(tc => ({
        model: `Expand your ${tc.query.split(' ')[0]} fleet`,
        reason: `Based on high platform demand`
      }));
      if (expansionRecommendations.length === 0) {
         expansionRecommendations.push({ model: 'Add an SUV', reason: 'Consistently high demand generally' });
      }

      const result = { pricingSuggestions, marketInsights, expansionRecommendations };
      logger.log("Returning result:", result);
      return result;
    } catch (error) {
      logger.error("Error in getGrowthInsights:", error);
      return handleSupabaseError(error, 'getGrowthInsights');
    }
  },

  getSettings: async (fleetOwnerId: string) => {
    const { data, error } = await supabase
      .from('fleet_owner_settings')
      .select('*')
      .eq('id', fleetOwnerId)
      .single();
    if (error) return handleSupabaseError(error, 'getSettings');
    return data;
  },

  updateSettings: async (fleetOwnerId: string, updates: any) => {
    const { data, error } = await supabase
      .from('fleet_owner_settings')
      .update(updates)
      .eq('id', fleetOwnerId)
      .select()
      .single();
    if (error) return handleSupabaseError(error, 'updateSettings');
    return data;
  },
};
