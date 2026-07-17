import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Missing Authorization header')
    }
    const token = authHeader.replace('Bearer ', '')

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    // Verify the caller is authenticated
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)
    if (authError || !user) {
      throw new Error(`Unauthorized: ${authError?.message || 'No user session found'}`)
    }

    // Use service role to bypass all RLS
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Verify caller is admin or fleet_owner
    const { data: adminCheck, error: adminError } = await supabaseAdmin
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (adminError || !adminCheck || (adminCheck.role !== 'admin' && adminCheck.role !== 'fleet_owner')) {
      throw new Error('Forbidden: Only admins and fleet owners can delete users')
    }

    const { userId } = await req.json()
    if (!userId) {
      throw new Error('Missing userId in request body')
    }

    // --- Manual cascade delete in dependency order ---
    // (In case live DB doesn't have full cascade constraints applied)

    // 1. Delete booking-related children first
    const { data: bookings } = await supabaseAdmin
      .from('bookings')
      .select('id')
      .or(`client_id.eq.${userId},fleet_owner_id.eq.${userId}`)

    if (bookings && bookings.length > 0) {
      const bookingIds = bookings.map((b: any) => b.id)
      await supabaseAdmin.from('booking_timeline_events').delete().in('booking_id', bookingIds)
      await supabaseAdmin.from('messages').delete().in('booking_id', bookingIds)
      await supabaseAdmin.from('booking_documents').delete().in('booking_id', bookingIds)
      await supabaseAdmin.from('contracts').delete().in('booking_id', bookingIds)
      await supabaseAdmin.from('payments').delete().in('booking_id', bookingIds)
      await supabaseAdmin.from('reviews').delete().in('booking_id', bookingIds)
    }

    // 2. Delete records that reference user_profiles directly
    await supabaseAdmin.from('bookings').delete().or(`client_id.eq.${userId},fleet_owner_id.eq.${userId}`)
    await supabaseAdmin.from('car_reservations').delete().or(`client_id.eq.${userId},fleet_owner_id.eq.${userId}`)
    await supabaseAdmin.from('messages').delete().or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
    await supabaseAdmin.from('notifications').delete().eq('user_id', userId)
    await supabaseAdmin.from('reviews').delete().eq('user_id', userId)
    await supabaseAdmin.from('driver_profiles').delete().eq('id', userId)
    await supabaseAdmin.from('fleet_owner_settings').delete().eq('id', userId)
    await supabaseAdmin.from('client_glovebox').delete().eq('client_id', userId)

    // 3. Delete from auth.users (may already be gone - ignore 404)
    const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(userId)
    if (authDeleteError && authDeleteError.status !== 404) {
      console.error('Auth delete error (non-404):', authDeleteError.message)
      // Don't throw — continue to clean up the profile record
    }

    // 4. Finally delete the profile itself
    const { error: profileDeleteError } = await supabaseAdmin
      .from('user_profiles')
      .delete()
      .eq('id', userId)

    if (profileDeleteError) {
      throw new Error(`Failed to delete user profile: ${profileDeleteError.message}`)
    }

    return new Response(
      JSON.stringify({ success: true, message: 'User deleted successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  }
})
