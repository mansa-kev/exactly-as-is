import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client with user's credentials
const supabase = createClient(
  'https://axznbiujbijphlkqnhqp.supabase.co',
  'sb_publishable_kOxbyAwOE7G6B13_vz0EHA__UyqDehL'
);

async function debugContracts() {
  console.log('🔍 Debugging contracts with user database...');
  
  try {
    // Test 1: Check connection
    console.log('📡 Testing Supabase connection...');
    const { data: testData, error: testError } = await supabase
      .from('contracts_master')
      .select('count')
      .limit(1);
    
    console.log('📊 Connection test:', { testData, testError });

    // Test 2: Check if table exists
    console.log('🗂️ Checking contracts_master table...');
    const { data: tableInfo, error: tableError } = await supabase
      .from('contracts_master')
      .select('*')
      .limit(1);
    
    console.log('📋 Table check:', { tableInfo, tableError });

    // Test 3: Get all contracts
    console.log('📄 Fetching all contracts...');
    const { data: allContracts, error: allError } = await supabase
      .from('contracts_master')
      .select('*');
    
    console.log('� All contracts:', allContracts);
    console.log('❌ All contracts error:', allError);

    // Test 4: Get active contracts
    console.log('✅ Fetching active contracts...');
    const { data: activeContracts, error: activeError } = await supabase
      .from('contracts_master')
      .select('*')
      .eq('is_active', true);
    
    console.log('🎯 Active contracts:', activeContracts);
    console.log('❌ Active contracts error:', activeError);

    // Test 5: Check table structure
    console.log('🏗️ Checking table structure...');
    const { data: columns, error: columnsError } = await supabase
      .rpc('get_table_columns', { table_name: 'contracts_master' });
    
    console.log('📐 Table columns:', columns);
    console.log('❌ Columns error:', columnsError);

    // Test 6: Create test contract if needed
    if (!activeContracts || activeContracts.length === 0) {
      console.log('� Creating test contract...');
      
      const testContract = {
        version: '1.0.0',
        contract_title: 'Standard Rental Agreement',
        terms_summary: 'This is a standard rental agreement template for vehicle rentals.',
        contract_url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
        is_active: true,
        uploaded_by: 'system-debug'
      };

      const { data: newContract, error: createError } = await supabase
        .from('contracts_master')
        .insert([testContract])
        .select()
        .single();

      console.log('✨ Test contract created:', newContract);
      console.log('❌ Create error:', createError);
    }
    
    console.log('🎉 Debug completed successfully!');
    
  } catch (error) {
    console.error('💥 Debug error:', error);
  }
}

debugContracts();
