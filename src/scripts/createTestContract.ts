// Test script to create a sample contract for testing
import { supabase } from '../lib/supabase.js';

async function createTestContract() {
  try {
    console.log('Creating test contract...');
    
    const testContract = {
      version: '1.0.0',
      contract_title: 'Standard Rental Agreement',
      terms_summary: 'This is a standard rental agreement template for vehicle rentals.',
      contract_url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
      is_active: true,
      uploaded_by: 'test-user'
    };

    const { data, error } = await supabase
      .from('contracts_master')
      .insert([testContract])
      .select()
      .single();

    if (error) {
      console.error('Error creating test contract:', error);
      return;
    }

    console.log('✅ Test contract created successfully:', data);
    return data;
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run the function
createTestContract();
