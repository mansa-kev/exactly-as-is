import { supabase, handleSupabaseErrorWrapper as handleSupabaseError } from '../lib/supabase';
import { getOrSetCache, invalidateCachePrefix } from '../utils/queryCache';
import {
  CLIENT_ACTIVE_STATUSES_DB,
  CLIENT_UPCOMING_STATUSES_DB,
  CLIENT_VISIBLE_STATUSES_DB,
} from '../constants/bookingStatuses';
import { linkBookingAndSyncProfile, BOOKING_DOC_TO_PROFILE_COLUMN } from '../utils/bookingProfileSync';
import { BOOKING_WITH_VEHICLE_SELECT } from '../utils/bookingVehicleDisplay';

const CLIENT_CACHE_TTL_MS = 60_000;

const GLOVEBOX_COLUMN_MAP: Record<string, string> = BOOKING_DOC_TO_PROFILE_COLUMN;


export const clientService = {
  getDashboardData: async (clientId: string) => {
    return getOrSetCache(`client:dashboard:${clientId}`, CLIENT_CACHE_TTL_MS, async () => {
    try {
      // Fetch active rental (on_trip or legacy in_progress)
      const { data: activeRows, error: aError } = await supabase
        .from('bookings')
        .select(BOOKING_WITH_VEHICLE_SELECT)
        .eq('client_id', clientId)
        .in('status', [...CLIENT_ACTIVE_STATUSES_DB])
        .order('start_date', { ascending: false })
        .limit(1);
      const activeBooking = activeRows?.[0] ?? null;
      
      // Fetch upcoming bookings (paid/confirmed, awaiting pickup)
      const { data: upcomingBookings, error: uError } = await supabase
        .from('bookings')
        .select(BOOKING_WITH_VEHICLE_SELECT)
        .eq('client_id', clientId)
        .in('status', [...CLIENT_UPCOMING_STATUSES_DB])
        .order('start_date', { ascending: true });

      // Fetch profile for completion status
      const { data: profile, error: pError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', clientId)
        .single();

      // Fetch recommendations (mocked logic based on past bookings)
      const { data: pastBookings, error: bError } = await supabase
        .from('bookings')
        .select(BOOKING_WITH_VEHICLE_SELECT)
        .eq('client_id', clientId)
        .eq('status', 'completed')
        .order('end_date', { ascending: false });

      if (uError || pError || bError) throw uError || pError || bError;

      // Genuine recommendation engine based on user history
      let recommendations: any[] = [];
      
      if (pastBookings && pastBookings.length > 0) {
        // Find most frequent category and average daily rate
        const categoryCounts: Record<string, number> = {};
        let totalSpend = 0;
        let count = 0;
        
        pastBookings.forEach((b: any) => {
           if (b.cars?.category) {
             categoryCounts[b.cars.category] = (categoryCounts[b.cars.category] || 0) + 1;
             totalSpend += Number(b.cars.daily_rate) || 0;
             count++;
           }
        });
        
        const topCategory = Object.keys(categoryCounts).sort((a, b) => categoryCounts[b] - categoryCounts[a])[0];
        const avgRate = count > 0 ? totalSpend / count : 0;
        const minRate = avgRate * 0.7;
        const maxRate = avgRate * 1.3;
        
        const { data: recs, error: rError } = await supabase
          .from('cars')
          .select('*')
          .eq('category', topCategory)
          .gte('daily_rate', minRate)
          .lte('daily_rate', maxRate)
          .limit(3);
          
        if (!rError && recs && recs.length > 0) {
          recommendations = recs;
        } else {
          // Fallback to top category without price bounds if no exact matches
          const { data: fallbackRecs } = await supabase.from('cars').select('*').eq('category', topCategory).limit(3);
          recommendations = fallbackRecs || [];
        }
      } else {
         // No history: recommend generically popular or premium cars
         const { data: popularRecs } = await supabase.from('cars').select('*').limit(3);
         recommendations = popularRecs || [];
      }

      return { 
        activeBooking, 
        upcomingBookings: upcomingBookings || [], 
        profile,
        recommendations 
      };
    } catch (error) {
      return handleSupabaseError(error, 'getDashboardData');
    }
    });
  },

  getClientDocuments: async (clientId: string) => {
    const { data, error } = await supabase
      .from('bookings')
      .select('id, document_status, admin_notes, metadata, start_date, end_date, cars(make, model)')
      .eq('client_id', clientId)
      .not('metadata->documents', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return null;
    return data;
  },

  getGloveboxData: async (clientId: string) => {
    return getOrSetCache(`client:glovebox:${clientId}`, CLIENT_CACHE_TTL_MS, async () => {
      const [bookingsRes, paymentsRes, signedContractsRes, profileRes] = await Promise.all([
        supabase
          .from('bookings')
          .select('id, document_status, admin_notes, metadata, start_date, end_date, cars(make, model)')
          .eq('client_id', clientId)
          .order('created_at', { ascending: false }),
        supabase
          .from('transactions')
          .select('*, bookings(id, start_date, end_date, cars(make, model))')
          .eq('user_id', clientId)
          .order('created_at', { ascending: false }),
        supabase
          .from('e_contracts')
          .select(`
            id,
            booking_id,
            pdf_url,
            signed_at,
            bookings!inner(
              id,
              start_date,
              end_date,
              cars(make, model)
            )
          `)
          .eq('bookings.client_id', clientId)
          .order('signed_at', { ascending: false }),
        supabase
          .from('user_profiles')
          .select('*')
          .eq('id', clientId)
          .maybeSingle()
      ]);

      const bookings = bookingsRes.data || [];
      const payments = paymentsRes.data || [];
      const signedContracts = signedContractsRes.data || [];
      const profile = profileRes.data || {};

      const docBooking = bookings.find((b: any) => b.metadata?.documents);
      const docs = docBooking?.metadata?.documents || {};
      const idNumber = profile.id_number || docBooking?.metadata?.guest_info?.id_number || docBooking?.metadata?.guest_info?.idNumber || docBooking?.metadata?.idNumber || null;

      const signedContractEntries = signedContracts.map((contract: any) => ({
        id: contract.booking_id || contract.id,
        car: contract.bookings?.cars ? `${contract.bookings.cars.make} ${contract.bookings.cars.model}` : 'Unknown Car',
        start_date: contract.bookings?.start_date || null,
        end_date: contract.bookings?.end_date || null,
        contract_url: contract.pdf_url || null,
        signature_url: contract.bookings?.metadata?.signature_data || null,
        signed_at: contract.signed_at || null
      }));

      const legacyContracts = bookings
        .filter((b: any) => b.metadata?.contract_url || b.metadata?.signature_url)
        .map((b: any) => ({
          id: b.id,
          car: b.cars ? `${b.cars.make} ${b.cars.model}` : 'Unknown Car',
          start_date: b.start_date,
          end_date: b.end_date,
          contract_url: b.metadata?.contract_url || null,
          signature_url: b.metadata?.signature_url || null,
        }));

      const contractMap = new Map<string, any>();
      legacyContracts.forEach((contract: any) => contractMap.set(contract.id, contract));
      signedContractEntries.forEach((contract: any) => contractMap.set(contract.id, contract));

      return {
        docBooking,
        profile: {
          full_name: profile.full_name || null,
          email: profile.email || null,
          phone_number: profile.phone_number || null,
          address: profile.address || null,
          id_number: profile.id_number || null,
          license_number: profile.license_number || null,
        },
        documents: {
          facePhotoUrl: profile.face_photo_url || docs.facePhotoUrl || null,
          licenseFrontUrl: profile.license_front_url || docs.licenseFrontUrl || null,
          licenseBackUrl: profile.license_back_url || docs.licenseBackUrl || null,
          idFrontUrl: profile.id_front_url || docs.idFrontUrl || null,
          idBackUrl: profile.id_back_url || docs.idBackUrl || null,
          idNumber,
          status: docBooking?.document_status || null,
          bookingId: docBooking?.id || null,
        },
        contracts: Array.from(contractMap.values()),
        payments,
      };
    });
  },

  getSignedContracts: async (clientId: string) => {
    const { data, error } = await supabase
      .from('bookings')
      .select('id, start_date, end_date, metadata, cars(make, model)')
      .eq('client_id', clientId)
      .not('metadata->contract_url', 'is', null);
    if (error) return [];
    return data || [];
  },

  getTransactions: async (clientId: string) => {
    const { data, error } = await supabase
      .from('transactions')
      .select('*, bookings(id, cars(make, model))')
      .eq('user_id', clientId)
      .order('created_at', { ascending: false });
    if (error) return [];
    return data || [];
  },

  getAllBookings: async (clientId: string) => {
    return getOrSetCache(`client:bookings:${clientId}`, CLIENT_CACHE_TTL_MS, async () => {
      const { data: bookingsData, error: bookingsError } = await supabase
        .from('bookings')
        .select(BOOKING_WITH_VEHICLE_SELECT)
        .eq('client_id', clientId)
        .order('start_date', { ascending: false });

      if (bookingsError) return handleSupabaseError(bookingsError, 'getAllBookings');

      const { data: reservationsData, error: reservationsError } = await supabase
        .from('car_reservations')
        .select(BOOKING_WITH_VEHICLE_SELECT)
        .eq('client_id', clientId)
        .in('status', ['reserved', 'pending_payment']);

      if (reservationsError) return handleSupabaseError(reservationsError, 'getAllReservations');

      const mappedReservations = (reservationsData || []).map(res => ({
        ...res,
        is_reservation: true,
        // Ensure status reflects what client should see
        status: res.status === 'reserved' ? 'pending_payment' : res.status
      }));

      const combined = [...(bookingsData || []), ...mappedReservations];
      // Sort by start_date descending
      combined.sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime());

      return combined;
    });
  },

  updateProfile: async (clientId: string, updates: any) => {
    const { data, error } = await supabase
      .from('user_profiles')
      .update(updates)
      .eq('id', clientId);
    if (error) return handleSupabaseError(error, 'updateProfile');
    invalidateCachePrefix(`client:dashboard:${clientId}`);
    invalidateCachePrefix(`client:glovebox:${clientId}`);
    return data;
  },

  getPreferences: async (clientId: string) => {
    const { data, error } = await supabase
      .from('client_preferences')
      .select('*')
      .eq('id', clientId)
      .single();
    if (error && error.code !== 'PGRST116') return handleSupabaseError(error, 'getPreferences');
    return data;
  },

  updatePreferences: async (clientId: string, updates: any) => {
    const { data, error } = await supabase
      .from('client_preferences')
      .upsert({ id: clientId, ...updates });
    if (error) return handleSupabaseError(error, 'updatePreferences');
    return data;
  },

  getWishlist: async (clientId: string) => {
    const { data, error } = await supabase
      .from('wishlist')
      .select('*, cars(*)')
      .eq('client_id', clientId);
    if (error) return handleSupabaseError(error, 'getWishlist');
    return data;
  },

  addToWishlist: async (clientId: string, carId: string) => {
    const { data, error } = await supabase
      .from('wishlist')
      .insert({ client_id: clientId, car_id: carId });
    if (error) return handleSupabaseError(error, 'addToWishlist');
    invalidateCachePrefix(`client:dashboard:${clientId}`);
    return data;
  },

  removeFromWishlist: async (clientId: string, carId: string) => {
    const { data, error } = await supabase
      .from('wishlist')
      .delete()
      .eq('client_id', clientId)
      .eq('car_id', carId);
    if (error) return handleSupabaseError(error, 'removeFromWishlist');
    invalidateCachePrefix(`client:dashboard:${clientId}`);
    return data;
  },

  getMessages: async (clientId: string) => {
    const { data, error } = await supabase
      .from('messages')
      .select('*, sender:user_profiles!sender_id(full_name, role), receiver:user_profiles!receiver_id(full_name, role)')
      .or(`sender_id.eq.${clientId},receiver_id.eq.${clientId}`)
      .order('created_at', { ascending: false });
    if (error) return handleSupabaseError(error, 'getMessages');
    return data;
  },

  sendMessage: async (message: any) => {
    const { data, error } = await supabase
      .from('messages')
      .insert(message);
    if (error) return handleSupabaseError(error, 'sendMessage');
    return data;
  },

  submitExtensionRequest: async (request: any) => {
    const { data, error } = await supabase
      .from('extension_requests')
      .insert(request);
    if (error) return handleSupabaseError(error, 'submitExtensionRequest');
    return data;
  },

  getExtensionRequests: async (clientId: string) => {
    const { data, error } = await supabase
      .from('extension_requests')
      .select('*, bookings(cars(make, model))')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });
    if (error) return handleSupabaseError(error, 'getExtensionRequests');
    return data;
  },

  getLoyaltyStatus: async (clientId: string) => {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('loyalty_tier, referral_credits')
      .eq('id', clientId)
      .single();
    if (error) return handleSupabaseError(error, 'getLoyaltyStatus');

    // Get number of completed bookings to calculate progress
    const { count, error: countError } = await supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('client_id', clientId)
      .eq('status', 'completed');
    
    if (countError) return handleSupabaseError(countError, 'getLoyaltyStatusCount');

    return {
      ...data,
      completed_bookings: count || 0
    };
  },

  getPromoCodes: async () => {
    const { data, error } = await supabase
      .from('coupons')
      .select('*')
      .eq('status', 'active')
      .gte('expiry_date', new Date().toISOString());
    if (error) return handleSupabaseError(error, 'getPromoCodes');
    return data;
  },

  getExclusiveOffers: async () => {
    const { data, error } = await supabase
      .from('exclusive_offers')
      .select('*')
      .eq('status', 'active');
    if (error) return handleSupabaseError(error, 'getExclusiveOffers');
    return data;
  },

  syncGuestBookingToProfile: async (clientId: string, booking: any) => {
    const { synced } = await linkBookingAndSyncProfile(supabase, { ...booking, client_id: clientId });
    if (!synced) return;
    invalidateCachePrefix(`client:glovebox:${clientId}`);
    invalidateCachePrefix(`client:dashboard:${clientId}`);
  },

  getReviewsForBookings: async (clientId: string, bookingIds: string[]) => {
    if (!bookingIds.length) return [];
    const { data, error } = await supabase
      .from('car_reviews')
      .select('id, booking_id, status, rating')
      .eq('user_id', clientId)
      .in('booking_id', bookingIds);
    if (error) return [];
    return data || [];
  },

  // -------- Glovebox document upload / removal --------
  // Document slot keys map to user_profiles columns via GLOVEBOX_COLUMN_MAP.
  uploadGloveboxDocument: async (clientId: string, docKey: string, file: File): Promise<string> => {
    const column = GLOVEBOX_COLUMN_MAP[docKey];
    if (!column) throw new Error(`Unknown document slot: ${docKey}`);

    const ext = file.name.split('.').pop() || 'jpg';
    const path = `glovebox/${clientId}/${docKey}_${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from('public_assets')
      .upload(path, file, { upsert: true, cacheControl: '3600' });
    if (upErr) throw upErr;

    const { data: pub } = supabase.storage.from('public_assets').getPublicUrl(path);
    const url = pub.publicUrl;

    const { error } = await supabase
      .from('user_profiles')
      .update({ [column]: url })
      .eq('id', clientId);
    if (error) throw error;

    invalidateCachePrefix(`client:glovebox:${clientId}`);
    invalidateCachePrefix(`client:dashboard:${clientId}`);
    return url;
  },

  removeGloveboxDocument: async (clientId: string, docKey: string) => {
    const column = GLOVEBOX_COLUMN_MAP[docKey];
    if (!column) throw new Error(`Unknown document slot: ${docKey}`);
    const { error } = await supabase
      .from('user_profiles')
      .update({ [column]: null })
      .eq('id', clientId);
    if (error) throw error;
    invalidateCachePrefix(`client:glovebox:${clientId}`);
    invalidateCachePrefix(`client:dashboard:${clientId}`);
  },

  // -------- Sidebar badge counts --------
  getSidebarCounts: async (clientId: string) => {
    const [bookingsRes, msgsRes] = await Promise.all([
      supabase
        .from('bookings')
        .select('id, status, document_status, payment_status', { count: 'exact', head: false })
        .eq('client_id', clientId)
        .in('status', [...CLIENT_VISIBLE_STATUSES_DB]),
      supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', clientId)
        .eq('read', false),
    ]);
    const bookings = bookingsRes.data || [];
    const actionRequired = bookings.filter((b: any) =>
      b.document_status === 'resubmission_required' ||
      b.payment_status === 'pending' ||
      b.payment_status === 'failed'
    ).length;
    return {
      bookingsCount: bookings.length,
      bookingsActionRequired: actionRequired,
      unreadInbox: msgsRes.count || 0,
    };
  },
};
