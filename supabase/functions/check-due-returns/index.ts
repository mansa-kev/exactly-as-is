import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || '';
const FROM_EMAIL = 'LinkedUp Cars <noreply@office.linkedupcarsrentals.com>';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Only allow POST requests (or OPTIONS for CORS)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. Initialize Supabase Admin Client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 2. Calculate the threshold (1 hour from now)
    const oneHourFromNow = new Date();
    oneHourFromNow.setHours(oneHourFromNow.getHours() + 1);
    
    // 3. Find bookings that are 'on_trip', haven't been reminded, and end in < 1 hour
    const { data: dueBookings, error: fetchError } = await supabase
      .from('bookings')
      .select(`
        id, 
        end_date, 
        client_id,
        cars ( make, model ),
        client:client_id ( full_name, email )
      `)
      .eq('status', 'on_trip')
      .eq('return_reminder_sent', false)
      .lte('end_date', oneHourFromNow.toISOString());

    if (fetchError) throw fetchError;
    if (!dueBookings || dueBookings.length === 0) {
      return new Response(JSON.stringify({ message: 'No due returns found.' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const successfulReminders = [];

    // 4. Process each booking
    for (const booking of dueBookings) {
      const clientName = booking.client?.full_name || 'Valued Client';
      const clientEmail = booking.client?.email;
      const carName = `${booking.cars?.make} ${booking.cars?.model}`;
      
      if (clientEmail && RESEND_API_KEY) {
        // Send email via Resend directly
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: FROM_EMAIL,
            to: clientEmail,
            bcc: 'admin@linkedupcarsrentals.com', // Notify Admin
            subject: `Return Reminder: Your ${carName} is due soon`,
            html: `
              <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                <h2>Vehicle Return Reminder</h2>
                <p>Hello ${clientName},</p>
                <p>This is a friendly reminder that your rental for the <strong>${carName}</strong> is due for return within the next hour.</p>
                <p>Please ensure the vehicle is returned to the agreed drop-off location on time to avoid any late fees. If you need an extension, please contact us immediately.</p>
                <p>Safe travels,<br>The LinkedUp Cars Team</p>
              </div>
            `,
          }),
        });

        if (res.ok) {
          // 5. Mark as sent in DB
          await supabase
            .from('bookings')
            .update({ return_reminder_sent: true })
            .eq('id', booking.id);
            
          successfulReminders.push(booking.id);
        } else {
          console.error(`Failed to send email for booking ${booking.id}`);
        }
      }
    }

    return new Response(JSON.stringify({ success: true, processed: successfulReminders }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error('Cron error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
