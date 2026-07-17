/**
 * Create test pending payments for testing payment verification
 */

const SUPABASE_URL = 'https://edroffvtzrowpsooszqh.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVkcm9mZnZ0enJvd3Bzb29zenFoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTc0MzY2MiwiZXhwIjoyMDkxMzE5NjYyfQ.jL_YxElgo1_RMcrsslERsioazsCTlwAzw-G0JylGJh8';

const headers = {
  'apikey': SERVICE_ROLE_KEY,
  'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=minimal',
};

async function main() {
  console.log('Creating test pending payments...');
  
  try {
    // First, get some existing bookings to create payments for
    const { data: bookings, error: bookingError } = await fetch(
      `${SUPABASE_URL}/rest/v1/bookings?select=id,client_id,total_amount&limit=5`,
      { headers }
    ).then(res => res.json());
    
    if (bookingError) {
      console.error('Error fetching bookings:', bookingError);
      return;
    }
    
    if (!bookings || bookings.length === 0) {
      console.log('No bookings found. Please create some bookings first.');
      return;
    }
    
    console.log(`Found ${bookings.length} bookings to create payments for`);
    
    // Create test pending payments for each booking
    for (const booking of bookings) {
      const paymentData = {
        booking_id: booking.id,
        client_id: booking.client_id,
        amount: booking.total_amount,
        transaction_code: `ABC${Math.floor(Math.random() * 1000000).toString().padStart(6, '0')}`,
        status: 'submitted'
      };
      
      const { error } = await fetch(`${SUPABASE_URL}/rest/v1/pending_payments`, {
        method: 'POST',
        headers,
        body: JSON.stringify(paymentData)
      });
      
      if (error) {
        console.error(`Error creating payment for booking ${booking.id}:`, error);
      } else {
        console.log(`   Created payment for booking ${booking.id} with code ${paymentData.transaction_code}`);
      }
    }
    
    console.log('\nTest payments created successfully!');
    console.log('- Admin can now test payment verification');
    console.log('- Use the displayed M-Pesa codes to verify payments');
    
  } catch (error) {
    console.error('Failed to create test payments:', error);
    process.exit(1);
  }
}

main().catch(console.error);
