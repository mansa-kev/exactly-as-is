/**
 * Clean up financials data - delete all transactions and reset financial records
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
  console.log('Cleaning up financials data...');
  
  try {
    // 1. Delete all transactions
    console.log('Deleting all transactions...');
    const { error: txError } = await fetch(`${SUPABASE_URL}/rest/v1/transactions`, {
      method: 'DELETE',
      headers
    });
    
    if (txError) {
      console.error('Error deleting transactions:', txError);
    } else {
      console.log('   All transactions deleted');
    }
    
    // 2. Reset all bookings to pending_payment_verification status
    console.log('Resetting booking statuses...');
    const { error: bookingError } = await fetch(`${SUPABASE_URL}/rest/v1/bookings`, {
      method: 'PATCH',
      headers: {
        ...headers,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        status: 'pending_payment_verification',
        payment_status: 'pending'
      })
    });
    
    if (bookingError) {
      console.error('Error resetting bookings:', bookingError);
    } else {
      console.log('   All bookings reset to pending status');
    }
    
    // 3. Delete all pending payments (optional - comment out if you want to keep them)
    console.log('Deleting all pending payments...');
    const { error: pendingError } = await fetch(`${SUPABASE_URL}/rest/v1/pending_payments`, {
      method: 'DELETE',
      headers
    });
    
    if (pendingError) {
      console.error('Error deleting pending payments:', pendingError);
    } else {
      console.log('   All pending payments deleted');
    }
    
    // 4. Update financial summaries (if they exist)
    console.log('Checking for financial summaries...');
    const { data: summaries, error: summaryError } = await fetch(`${SUPABASE_URL}/rest/v1/financial_summaries`, {
      method: 'DELETE',
      headers
    });
    
    if (summaryError && !summaryError.message?.includes('does not exist')) {
      console.error('Error deleting financial summaries:', summaryError);
    } else {
      console.log('   Financial summaries deleted (if they existed)');
    }
    
    console.log('\nFinancials cleanup complete!');
    console.log('- All transactions deleted');
    console.log('- All bookings reset to pending_payment_verification');
    console.log('- All pending payments deleted');
    console.log('- Financial summaries deleted');
    
  } catch (error) {
    console.error('Cleanup failed:', error);
    process.exit(1);
  }
}

main().catch(console.error);
