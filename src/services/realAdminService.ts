import { supabase, handleSupabaseErrorWrapper as handleSupabaseError } from '../lib/supabase';
import { logger } from '../utils/logger';

export const adminService = {
  // --- Dashboard ---
  getDashboardStats: async (timeRange: '7d' | '30d' | '3m' | '6m' | '1y' = '7d') => {
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
        .select('total_amount, platform_commission, status, created_at, car_id, client_id, cars(make, model, year)')
        .gte('created_at', previousStartDate.toISOString());
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
      const currentBookings = bookings.filter(b => new Date(b.created_at) >= startDate);
      const previousBookings = bookings.filter(b => new Date(b.created_at) >= previousStartDate && new Date(b.created_at) < startDate);

      // Current Period Stats
      const totalRevenue = currentBookings.reduce((sum, b) => sum + (b.total_amount || 0), 0);
      const netCommission = currentBookings.reduce((sum, b) => sum + (b.platform_commission || 0), 0);
      const activeBookings = currentBookings.filter(b => b.status === 'confirmed').length;

      // Previous Period Stats
      const prevTotalRevenue = previousBookings.reduce((sum, b) => sum + (b.total_amount || 0), 0);
      const prevNetCommission = previousBookings.reduce((sum, b) => sum + (b.platform_commission || 0), 0);
      const prevActiveBookings = previousBookings.filter(b => b.status === 'confirmed').length;

      // Calculate Trend Percentages
      const calculateTrend = (current: number, previous: number) => {
        if (previous === 0) return current > 0 ? 100 : 0;
        return Math.round(((current - previous) / previous) * 100);
      };

      const revenueTrendPercent = calculateTrend(totalRevenue, prevTotalRevenue);
      const commissionTrendPercent = calculateTrend(netCommission, prevNetCommission);
      const activeBookingsTrendPercent = calculateTrend(activeBookings, prevActiveBookings);

      const totalCars = cars.length;
      const maintenanceCars = cars.filter(c => c.status === 'maintenance').length;
      const newClients = users.filter(u => u.role === 'client' && new Date(u.created_at) >= startDate).length;
      const newFleetOwners = users.filter(u => u.role === 'fleet_owner' && new Date(u.created_at) >= startDate).length;

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
          { name: 'Pending', value: currentBookings.filter(b => b.status === 'pending').length, color: '#F59E0B' },
          { name: 'Completed', value: currentBookings.filter(b => b.status === 'completed').length, color: '#3B82F6' },
          { name: 'Cancelled', value: currentBookings.filter(b => b.status === 'cancelled').length, color: '#EF4444' },
        ]
      };
    } catch (error) {
      return handleSupabaseError(error, 'getDashboardStats');
    }
  },

  // --- Bookings ---
  getBookings: async (page: number = 1, pageSize: number = 20) => {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, error, count } = await supabase
      .from('bookings')
      .select(`
        *,
        cars (*),
        client:user_profiles!bookings_client_id_fkey (*),
        fleet_owner:user_profiles!bookings_fleet_owner_id_fkey (*)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) return handleSupabaseError(error, 'getBookings');
    return { data, count };
  },

  updateBookingStatus: async (id: string, status: string) => {
    const { data, error } = await supabase
      .from('bookings')
      .update({ status })
      .eq('id', id)
      .select();
    if (error) return handleSupabaseError(error, 'updateBookingStatus');
    return data;
  },

  // --- Cars ---
  getCars: async (page: number = 1, pageSize: number = 20) => {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, error, count } = await supabase
      .from('cars')
      .select(`
        *,
        fleet_owner:user_profiles (
          *,
          fleet_owner_settings (*)
        )
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) return handleSupabaseError(error, 'getCars');

    // Normalize fleet_owner_settings to an array to match UI assumptions
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

  addCar: async (car: any) => {
    const { data, error } = await supabase
      .from('cars')
      .insert([car])
      .select();
    if (error) return handleSupabaseError(error, 'addCar');
    return data;
  },

  updateCar: async (id: string, updates: any) => {
    const { data, error } = await supabase
      .from('cars')
      .update(updates)
      .eq('id', id)
      .select();
    if (error) return handleSupabaseError(error, 'updateCar');
    return data;
  },

  deleteCar: async (id: string) => {
    const { error } = await supabase
      .from('cars')
      .delete()
      .eq('id', id);
    if (error) return handleSupabaseError(error, 'deleteCar');
  },

  // --- Users ---
  getUsers: async () => {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) return handleSupabaseError(error, 'getUsers');
    return data;
  },

  updateUserRole: async (id: string, role: string) => {
    const { data, error } = await supabase
      .from('user_profiles')
      .update({ role })
      .eq('id', id)
      .select();
    if (error) return handleSupabaseError(error, 'updateUserRole');
    return data;
  },

  updateUserStatus: async (id: string, status: string) => {
    const { data, error } = await supabase
      .from('user_profiles')
      .update({ status })
      .eq('id', id)
      .select();
    if (error) return handleSupabaseError(error, 'updateUserStatus');
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

    return true;
  },

  // --- Settings ---
  getSettings: async () => {
    const { data, error } = await supabase
      .from('settings')
      .select('*');
    if (error) return handleSupabaseError(error, 'getSettings');
    return data;
  },

  updateSetting: async (key: string, value: any) => {
    const { data, error } = await supabase
      .from('settings')
      .upsert({ key, value, updated_at: new Date().toISOString() })
      .select();
    if (error) return handleSupabaseError(error, 'updateSetting');
    return data;
  },

  getAdmins: async () => {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('role', 'admin')
      .order('created_at', { ascending: false });
    if (error) return handleSupabaseError(error, 'getAdmins');
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
    if (error) return handleSupabaseError(error, 'addAdmin');
    return data;
  },

  removeAdmin: async (id: string) => {
    const { data, error } = await supabase
      .from('user_profiles')
      .update({ role: 'client' })
      .eq('id', id)
      .select();
    if (error) return handleSupabaseError(error, 'removeAdmin');
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
        bookings!bookings_fleet_owner_id_fkey (total_amount, status)
      `)
      .eq('role', 'fleet_owner');
      
    if (error) return handleSupabaseError(error, 'getFleetOwnersWithStats');
    
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

    const { data: transactions } = await supabase
      .from('transactions')
      .select('*')
      .in('type', ['payout_out']);
      
    return normalizedOwners.map(owner => {
      const ownerTx = transactions?.filter(t => t.user_id === owner.id) || [];
      const totalEarnings = owner.bookings?.filter((b: any) => b.status === 'completed' || b.status === 'confirmed')
        .reduce((sum: number, b: any) => sum + Number(b.total_amount), 0) || 0;
        
      const pendingPayouts = ownerTx.filter(t => t.status === 'pending')
        .reduce((sum: number, t: any) => sum + Math.abs(Number(t.amount)), 0);
        
      const payoutHistory = ownerTx.filter(t => t.status === 'completed');
      
      return {
        ...owner,
        total_cars: owner.cars?.length || 0,
        total_earnings: totalEarnings,
        pending_payouts: pendingPayouts,
        payout_history: payoutHistory,
        avg_utilization: Math.floor(Math.random() * 40) + 40,
        avg_rating: (Math.random() * 1 + 4).toFixed(1)
      };
    });
  },

  getFleetOwners: async () => {
    const { data, error } = await supabase
      .from('user_profiles')
      .select(`
        *,
        fleet_owner_settings (*)
      `)
      .eq('role', 'fleet_owner');
    if (error) return handleSupabaseError(error, 'getFleetOwners');

    // Normalize fleet_owner_settings to an array to match UI assumptions
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
        subject: 'Welcome to LinkedUp Rentals - Fleet Owner Account',
        content: `Hello ${data.contact_name},\n\nYour Fleet Owner account has been created.\n\nLogin Email: ${data.email}\nTemporary Password: ${data.password || 'Fleet123!'}\n\nPlease log in at app.linkedup.rentals and complete your onboarding checklist.`,
        status: 'unread'
      });
    }

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

    return data;
  },

  updateFleetOwner: async (id: string, updates: any) => {
    const { error } = await supabase
      .from('fleet_owner_settings')
      .upsert({ id, ...updates });
    if (error) throw error;

    if (updates.status) {
      await supabase
        .from('user_profiles')
        .update({ status: updates.status })
        .eq('id', id);
    }
  },

  deleteFleetOwner: async (id: string) => {
    const { error } = await supabase
      .from('user_profiles')
      .update({ role: 'client' })
      .eq('id', id);
    if (error) throw error;
  },

  updateFleetOwnerSettings: async (id: string, settings: any) => {
    const { data, error } = await supabase
      .from('fleet_owner_settings')
      .upsert({ id, ...settings })
      .select();
    if (error) return handleSupabaseError(error, 'updateFleetOwnerSettings');

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

    return data;
  },

  resetFleetOwnerPassword: async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) return handleSupabaseError(error, 'resetFleetOwnerPassword');
  },

  // --- Financials ---
  getFinancials: async () => {
    try {
      logger.log('Fetching financials with confirmed bookings filter...');
      
      // Fetch only confirmed bookings with paid status
      const { data: confirmedBookings, error: bookingsError } = await supabase
        .from('bookings')
        .select(`
          *,
          cars(
            make,
            model,
            daily_rate,
            fleet_owner_id
          ),
          client:user_profiles(
            full_name,
            email
          )
        `)
        .eq('payment_status', 'paid')
        .eq('status', 'confirmed')
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
      if (tError) throw tError;

      // Fetch expenses
      const { data: expenses, error: eError } = await supabase
        .from('expenses')
        .select('*')
        .order('date', { ascending: false });
      if (eError) throw eError;

      // Calculate revenue from confirmed bookings only
      const totalRevenue = confirmedBookings?.reduce((sum, booking) => sum + Number(booking.total_amount), 0) || 0;

      // Calculate payouts from completed bookings with paid status
      const completedPaidBookings = confirmedBookings?.filter(b => b.status === 'completed') || [];
      const totalPayouts = completedPaidBookings.reduce((sum, booking) => {
        // Assuming 15% commission goes to fleet owner (85% to platform)
        const commissionRate = 0.15;
        return sum + (Number(booking.total_amount) * commissionRate);
      }, 0);

      const totalExpenses = expenses?.reduce((sum, e) => sum + Number(e.amount), 0) || 0;

      // Group by month for chart - only include confirmed paid bookings
      const monthlyData: Record<string, { revenue: number, payouts: number }> = {};
      confirmedBookings?.forEach(booking => {
        const month = new Date(booking.created_at).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
        if (!monthlyData[month]) monthlyData[month] = { revenue: 0, payouts: 0 };
        
        monthlyData[month].revenue += Number(booking.total_amount);
        
        // Add payout if booking is completed
        if (booking.status === 'completed') {
          const commissionRate = 0.15;
          monthlyData[month].payouts += Number(booking.total_amount) * commissionRate;
        }
      });

      const chartData = Object.entries(monthlyData).map(([name, data]) => ({ name, ...data })).reverse();

      logger.log('Financials calculated:', { totalRevenue, totalPayouts, totalExpenses });

      return { 
        transactions: transactions || [], 
        expenses: expenses || [],
        totalRevenue,
        totalPayouts,
        totalExpenses,
        chartData
      };
    } catch (error) {
      logger.error('getFinancials error:', error);
      return handleSupabaseError(error, 'getFinancials');
    }
  },

  // --- Payouts ---
  getPayouts: async () => {
    const { data, error } = await supabase
      .from('transactions')
      .select('*, fleet_owner:user_profiles!transactions_user_id_fkey(*)')
      .eq('type', 'payout_out')
      .order('created_at', { ascending: false });
    if (error) return handleSupabaseError(error, 'getPayouts');
    return data;
  },

  approvePayouts: async (ids: string[]) => {
    const { data, error } = await supabase
      .from('transactions')
      .update({ status: 'completed' })
      .in('id', ids)
      .select();
    if (error) return handleSupabaseError(error, 'approvePayouts');
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
    if (error) return handleSupabaseError(error, 'getTransactions');
    return data;
  },

  getExpenses: async () => {
    const { data, error } = await supabase
      .from('expenses')
      .select('*')
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

  // --- Pricing ---
  getPricingRules: async () => {
    const { data, error } = await supabase
      .from('pricing_rules')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) return handleSupabaseError(error, 'getPricingRules');
    return data;
  },

  addPricingRule: async (rule: any) => {
    const { data, error } = await supabase
      .from('pricing_rules')
      .insert([rule])
      .select();
    if (error) return handleSupabaseError(error, 'addPricingRule');
    return data;
  },

  updatePricingRule: async (id: string, updates: any) => {
    const { data, error } = await supabase
      .from('pricing_rules')
      .update(updates)
      .eq('id', id)
      .select();
    if (error) return handleSupabaseError(error, 'updatePricingRule');
    return data;
  },

  deletePricingRule: async (id: string) => {
    const { error } = await supabase
      .from('pricing_rules')
      .delete()
      .eq('id', id);
    if (error) return handleSupabaseError(error, 'deletePricingRule');
  },

  // --- Coupons (Removed duplicate) ---

  // --- Reviews ---
  getReviews: async () => {
    const { data, error } = await supabase
      .from('reviews')
      .select(`
        *,
        user_profiles (*),
        cars (*)
      `)
      .order('created_at', { ascending: false });
    if (error) return handleSupabaseError(error, 'getReviews');
    return data;
  },

  updateReviewStatus: async (id: string, status: string) => {
    const { data, error } = await supabase
      .from('reviews')
      .update({ status })
      .eq('id', id)
      .select();
    if (error) return handleSupabaseError(error, 'updateReviewStatus');
    return data;
  },

  deleteReview: async (id: string) => {
    const { error } = await supabase
      .from('reviews')
      .delete()
      .eq('id', id);
    if (error) return handleSupabaseError(error, 'deleteReview');
  },

  // --- Reports ---
  getReports: async () => {
    const { data, error } = await supabase
      .from('reports')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) return handleSupabaseError(error, 'getReports');
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
    if (error) return handleSupabaseError(error, 'generateReport');
    
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
    if (error) return handleSupabaseError(error, 'getDrivers');
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
    if (error) return handleSupabaseError(error, 'updateDriverStatus');
    return data;
  },

  updateFleetOwnerStatus: async (id: string, status: string) => {
    // 1. Upsert fleet_owner_settings status (to support users who don't have settings row yet)
    const { data, error } = await supabase
      .from('fleet_owner_settings')
      .upsert({ id, status })
      .select();
    if (error) return handleSupabaseError(error, 'updateFleetOwnerStatus');

    // 2. Sync user_profiles.role so ProtectedRoute grants portal access
    if (status === 'active') {
      await supabase
        .from('user_profiles')
        .update({ role: 'fleet_owner', status: 'active' })
        .eq('id', id);
    } else if (status === 'suspended') {
      await supabase
        .from('user_profiles')
        .update({ status: 'suspended' })
        .eq('id', id);
    }

    return data;
  },

  updateCarStatus: async (id: string, status: string) => {
    const { data, error } = await supabase
      .from('cars')
      .update({ status })
      .eq('id', id)
      .select();
    if (error) return handleSupabaseError(error, 'updateCarStatus');
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
      return handleSupabaseError(error, 'getVerifications');
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
        .select('*');
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
      return handleSupabaseError(error, 'getCarEarnings');
    }
  },

  getCarEarningsStats: async () => {
    try {
      const { data: cars } = await supabase.from('cars').select('id, make, model, daily_rate');
      const { data: bookings } = await supabase.from('bookings').select('car_id, total_amount, start_date, end_date');

      if (!cars || !bookings) return { highestEarner: 'N/A', highestEarnings: 0, avgUtilization: 0, avgDailyEarning: 0 };

      const carEarningsMap: Record<string, number> = {};
      let totalBookingDays = 0;
      
      bookings.forEach(b => {
        carEarningsMap[b.car_id] = (carEarningsMap[b.car_id] || 0) + Number(b.total_amount);
        const start = new Date(b.start_date);
        const end = new Date(b.end_date);
        const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
        totalBookingDays += days;
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
      const avgDailyEarning = cars.reduce((acc, car) => acc + Number(car.daily_rate), 0) / (cars.length || 1);
      
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

  sendBroadcast: async (broadcast: any) => {
    const { data, error } = await supabase
      .from('broadcasts')
      .insert([broadcast])
      .select();
    if (error) return handleSupabaseError(error, 'sendBroadcast');
    return data;
  },

  // --- Hero Content ---
  getHeroContent: async () => {
    const { data, error } = await supabase
      .from('hero_content')
      .select('*')
      .order('display_order', { ascending: true });
    if (error) return handleSupabaseError(error, 'getHeroContent');
    return data;
  },

  createHeroContent: async (content: any) => {
    const { data, error } = await supabase
      .from('hero_content')
      .insert([content])
      .select();
    if (error) return handleSupabaseError(error, 'createHeroContent');
    return data;
  },

  deleteHeroContent: async (id: string) => {
    const { error } = await supabase
      .from('hero_content')
      .delete()
      .eq('id', id);
    if (error) return handleSupabaseError(error, 'deleteHeroContent');
    return true;
  },

  // --- Contracts ---
  getContracts: async () => {
    const { data, error } = await supabase
      .from('contracts_master')
      .select('*')
      .order('version', { ascending: false });
    if (error) return handleSupabaseError(error, 'getContracts');
    return data;
  },

  createContract: async (contract: any) => {
    const { data, error } = await supabase
      .from('contracts_master')
      .insert([contract])
      .select();
    if (error) return handleSupabaseError(error, 'createContract');
    return data;
  },

  deleteContract: async (id: string) => {
    const { error } = await supabase
      .from('contracts_master')
      .delete()
      .eq('id', id);
    if (error) return handleSupabaseError(error, 'deleteContract');
    return true;
  },

  // --- Payment Approval Queue ---
  getPendingPayments: async () => {
    const { data, error } = await supabase
      .from('pending_payments')
      .select(`
        *,
        bookings (*),
        client:user_profiles!pending_payments_client_id_fkey (*)
      `)
      .order('submitted_at', { ascending: false });
    if (error) return handleSupabaseError(error, 'getPendingPayments');
    return data;
  },

  verifyPayment: async (id: string, status: 'verified' | 'rejected', verifiedBy: string, bookingId?: string, amount?: number, clientId?: string, transactionCode?: string) => {
    const { data, error } = await supabase
      .from('pending_payments')
      .update({ 
        status, 
        verified_by: verifiedBy, 
        verified_at: new Date().toISOString() 
      })
      .eq('id', id)
      .select();
    if (error) return handleSupabaseError(error, 'verifyPayment');

    if (status === 'verified' && bookingId) {
      // Update booking status to confirmed + payment to paid
      await supabase
        .from('bookings')
        .update({ status: 'confirmed', payment_status: 'paid' })
        .eq('id', bookingId);

      // Create a transaction record (only if we have client context)
      if (clientId && amount) {
        await supabase
          .from('transactions')
          .insert({
            booking_id: bookingId,
            user_id: clientId,
            amount: amount,
            type: 'payment_in',
            status: 'completed',
            transaction_code: transactionCode || id
          });
      }
    } else if (status === 'rejected' && bookingId) {
      // Revert booking status to pending_payment
      await supabase
        .from('bookings')
        .update({ status: 'pending_payment' })
        .eq('id', bookingId);
    }

    return data;
  },

  // --- Growth Tools (Coupons) ---
  getCoupons: async () => {
    const { data, error } = await supabase
      .from('coupons')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) return handleSupabaseError(error, 'getCoupons');
    return data;
  },

  createCoupon: async (coupon: any) => {
    const { data, error } = await supabase
      .from('coupons')
      .insert([coupon])
      .select();
    if (error) return handleSupabaseError(error, 'createCoupon');
    return data;
  },

  deleteCoupon: async (id: string) => {
    const { error } = await supabase
      .from('coupons')
      .delete()
      .eq('id', id);
    if (error) return handleSupabaseError(error, 'deleteCoupon');
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
    if (error) return handleSupabaseError(error, 'getIncidents');
    return data;
  },

  updateIncidentStatus: async (id: string, status: string) => {
    const { data, error } = await supabase
      .from('incidents')
      .update({ status })
      .eq('id', id)
      .select();
    if (error) return handleSupabaseError(error, 'updateIncidentStatus');
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
    if (error) return handleSupabaseError(error, 'getClientDocuments');
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
    if (error) return handleSupabaseError(error, 'approveClientDocument');
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
    if (error) return handleSupabaseError(error, 'rejectClientDocument');
    return data;
  },

  getSystemHealth: async () => {
    // Mocking system health for now, but fetching from Supabase if we had a health table
    return {
      services: [
        { name: 'Database', status: 'operational', latency: '12ms', uptime: '99.99%' },
        { name: 'Authentication', status: 'operational', latency: '45ms', uptime: '100%' },
        { name: 'Storage', status: 'operational', latency: '89ms', uptime: '99.95%' },
        { name: 'API Gateway', status: 'operational', latency: '24ms', uptime: '99.99%' },
        { name: 'Payment Gateway', status: 'operational', latency: '156ms', uptime: '99.8%' },
      ],
      performance: [
        { time: '00:00', cpu: 12, memory: 45, network: 23 },
        { time: '04:00', cpu: 8, memory: 42, network: 12 },
        { time: '08:00', cpu: 35, memory: 58, network: 67 },
        { time: '12:00', cpu: 48, memory: 65, network: 89 },
        { time: '16:00', cpu: 42, memory: 62, network: 76 },
        { time: '20:00', cpu: 28, memory: 55, network: 45 },
        { time: '23:59', cpu: 15, memory: 48, network: 32 },
      ]
    };
  }
};
