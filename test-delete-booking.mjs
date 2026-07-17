/**
 * Test script to verify delete booking functionality
 */

const SUPABASE_URL = 'https://edroffvtzrowpsooszqh.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVkcm9mZnZ0enJvd3Bzb29zenFoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTc0MzY2MiwiZXhwIjoyMDkxMzE5NjYyfQ.jL_YxElgo1_RMcrsslERsioazsCTlwAzw-G0JylGJh8';

// Import Supabase
import { createClient } from '@supabase/supabase-js';

const serviceClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function testDelete() {
  console.log('Testing delete booking functionality...');
  
  try {
    // First check if there's a booking to delete
    const { data: bookings, error: fetchError } = await serviceClient
      .from('bookings')
      .select('id, status')
      .limit(1);
    
    if (fetchError) {
      console.error('Error fetching bookings:', fetchError);
      return;
    }
    
    if (!bookings || bookings.length === 0) {
      console.log('No bookings found to test delete');
      return;
    }
    
    const bookingId = bookings[0].id;
    console.log(`Found booking ${bookingId} with status ${bookings[0].status}`);
    
    // Check related records
    const { data: pendingPayments } = await serviceClient
      .from('pending_payments')
      .select('id')
      .eq('booking_id', bookingId);
    
    const { data: transactions } = await serviceClient
      .from('transactions')
      .select('id')
      .eq('booking_id', bookingId);
    
    console.log(`Related records: ${pendingPayments?.length || 0} pending payments, ${transactions?.length || 0} transactions`);
    
    // Perform delete operations
    console.log('Deleting pending payments...');
    const { error: pendingError } = await serviceClient
      .from('pending_payments')
      .delete()
      .eq('booking_id', bookingId);
    
    if (pendingError) {
      console.error('Error deleting pending payments:', pendingError);
    } else {
      console.log('Pending payments deleted successfully');
    }
    
    console.log('Deleting transactions...');
    const { error: txError } = await serviceClient
      .from('transactions')
      .delete()
      .eq('booking_id', bookingId);
    
    if (txError) {
      console.error('Error deleting transactions:', txError);
    } else {
      console.log('Transactions deleted successfully');
    }
    
    console.log('Deleting booking...');
    const { error: bookingError } = await serviceClient
      .from('bookings')
      .delete()
      .eq('id', bookingId);
    
    if (bookingError) {
      console.error('Error deleting booking:', bookingError);
    } else {
      console.log('Booking deleted successfully');
    }
    
    // Verify deletion
    const { data: remainingBookings } = await serviceClient
      .from('bookings')
      .select('id')
      .eq('id', bookingId);
    
    if (remainingBookings && remainingBookings.length > 0) {
      console.error('ERROR: Booking still exists after deletion!');
    } else {
      console.log('SUCCESS: Booking fully deleted');
    }
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testDelete();
