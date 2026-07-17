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
    if (!authHeader) throw new Error('Missing Authorization header')
    const token = authHeader.replace('Bearer ', '')

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)
    if (authError || !user) throw new Error(`Unauthorized: ${authError?.message || 'No user'}`)

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Only admins or fleet_owners may delete bookings
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || !profile || (profile.role !== 'admin' && profile.role !== 'fleet_owner')) {
      throw new Error('Forbidden: Only admins and fleet owners can delete bookings')
    }

    const { bookingId } = await req.json()
    if (!bookingId || typeof bookingId !== 'string') {
      throw new Error('Missing or invalid bookingId')
    }

    // Cascade-delete related rows then the booking itself
    await supabaseAdmin.from('booking_inspections').delete().eq('booking_id', bookingId)
    await supabaseAdmin.from('booking_extensions').delete().eq('booking_id', bookingId)
    await supabaseAdmin.from('transactions').delete().eq('booking_id', bookingId)

    const { error: bookingError } = await supabaseAdmin
      .from('bookings')
      .delete()
      .eq('id', bookingId)

    if (bookingError) throw bookingError

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  }
})
